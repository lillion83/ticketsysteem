import { createHash, randomBytes } from 'node:crypto'
import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { and, count, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, scannerSessions, scans } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { qrSvg } from '#/lib/qr'

// Fase F — scannertoegang zonder accounts (PLAN §3.5). De admin koppelt een
// scanner via een token; deurpersoneel opent dat op de eigen telefoon. Het token
// is alleen geldig voor dit event, vervalt 6 uur na de eindtijd en is intrekbaar.
// Alles org-gescoopt (harde regel 3).

const ZES_UUR_MS = 6 * 60 * 60 * 1000

// Alleen de hash gaat de database in; het ruwe token zie je één keer bij het
// koppelen. sha256 volstaat: het token is hoog-entropisch (32 random bytes),
// geen wachtwoord dat trage hashing nodig heeft.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function publicBaseUrl(): string {
  const url = process.env.PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL || ''
  return url.replace(/\/+$/, '')
}

export type ScanContext = {
  organizationId: string
  // Sessie waarmee gescand wordt, of null als de ingelogde admin zelf scant.
  scannerSessieId: string | null
  // Wie de scan uitvoert (sessie-id of user-id) → tickets.gebruikt_door.
  actorId: string
}

/**
 * Bepaalt de context van een scan-request: via een scannertoken (deurpersoneel
 * zonder account) óf via de ingelogde admin. Gooit bij een ongeldig, verlopen of
 * ingetrokken token. Server-only helper, gebruikt door de sync/upload-endpoints.
 */
// createServerOnlyFn: deze helpers gebruiken node:crypto + drizzle en mogen nooit
// in de client-bundel belanden. scannerSessions.ts wordt óók door client-routes
// geïmporteerd (via createServerFn-stubs), dus platte exports zouden meeliften —
// dit stript ze uit de client (zelfde patroon als requireAuth).
export const resolveScanContext = createServerOnlyFn(async function (
  eventId: string,
  token: string | undefined,
): Promise<ScanContext> {
  if (token) {
    const rows = await db
      .select({
        id: scannerSessions.id,
        event_id: scannerSessions.event_id,
        organization_id: scannerSessions.organization_id,
        vervalt_op: scannerSessions.vervalt_op,
        ingetrokken_op: scannerSessions.ingetrokken_op,
      })
      .from(scannerSessions)
      .where(eq(scannerSessions.token_hash, hashToken(token)))
      .limit(1)
    if (rows.length === 0) throw new Error('Ongeldige scannertoken')
    const s = rows[0]
    if (s.event_id !== eventId) throw new Error('Ongeldige scannertoken')
    if (s.ingetrokken_op) throw new Error('Scannertoken is ingetrokken')
    if (s.vervalt_op && s.vervalt_op < new Date()) {
      throw new Error('Scannertoken is verlopen')
    }
    return {
      organizationId: s.organization_id,
      scannerSessieId: s.id,
      actorId: s.id,
    }
  }

  const { userId, organizationId } = await requireAuth()
  return { organizationId, scannerSessieId: null, actorId: userId }
})

/** Werkt laatste_sync bij zodat de admin ziet dat een scanner leeft. */
export const raakSessieAan = createServerOnlyFn(async function (
  scannerSessieId: string,
) {
  await db
    .update(scannerSessions)
    .set({ laatste_sync: new Date() })
    .where(eq(scannerSessions.id, scannerSessieId))
})

// --- admin: koppelen, lijst, intrekken ---

export const createScannerSession = createServerFn({ method: 'POST' })
  .validator((data: { eventId: string; label: string }) => {
    if (!data.eventId) throw new Error('eventId ontbreekt')
    return { eventId: data.eventId, label: data.label.trim() }
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()

    const ev = await db
      .select({ datum_eind: events.datum_eind })
      .from(events)
      .where(
        and(
          eq(events.id, data.eventId),
          eq(events.organization_id, organizationId),
        ),
      )
      .limit(1)
    if (ev.length === 0) throw new Error('Event niet gevonden')

    const token = randomBytes(32).toString('base64url')
    const vervalt = new Date(ev[0].datum_eind.getTime() + ZES_UUR_MS)

    const [rij] = await db
      .insert(scannerSessions)
      .values({
        event_id: data.eventId,
        organization_id: organizationId,
        token_hash: hashToken(token),
        label: data.label || null,
        vervalt_op: vervalt,
      })
      .returning({ id: scannerSessions.id })

    // De koppel-URL en QR komen hier één keer terug; daarna staat alleen de
    // hash in de db en is het token niet meer op te vragen.
    const url = `${publicBaseUrl()}/s/${token}`
    return { id: rij.id, url, qrSvg: await qrSvg(url) }
  })

export const listScannerSessions = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()

    const sessies = await db
      .select({
        id: scannerSessions.id,
        label: scannerSessions.label,
        vervalt_op: scannerSessions.vervalt_op,
        ingetrokken_op: scannerSessions.ingetrokken_op,
        laatste_sync: scannerSessions.laatste_sync,
      })
      .from(scannerSessions)
      .where(
        and(
          eq(scannerSessions.event_id, eventId),
          eq(scannerSessions.organization_id, organizationId),
        ),
      )

    // Aantal scans per sessie, in één groupBy, daarna in JS samengevoegd.
    const tellingen = await db
      .select({
        sid: scans.scanner_sessie_id,
        n: count(),
      })
      .from(scans)
      .where(
        and(
          eq(scans.event_id, eventId),
          eq(scans.organization_id, organizationId),
        ),
      )
      .groupBy(scans.scanner_sessie_id)
    const perSessie = new Map(tellingen.map((t) => [t.sid, Number(t.n)]))

    return sessies.map((s) => ({
      id: s.id,
      label: s.label,
      vervalt_op: s.vervalt_op ? s.vervalt_op.toISOString() : null,
      ingetrokken_op: s.ingetrokken_op ? s.ingetrokken_op.toISOString() : null,
      laatste_sync: s.laatste_sync ? s.laatste_sync.toISOString() : null,
      aantal_scans: perSessie.get(s.id) ?? 0,
    }))
  })

export const revokeScannerSession = createServerFn({ method: 'POST' })
  .validator((data: { sessieId: string }) => {
    if (!data.sessieId) throw new Error('sessieId ontbreekt')
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .update(scannerSessions)
      .set({ ingetrokken_op: new Date() })
      .where(
        and(
          eq(scannerSessions.id, data.sessieId),
          eq(scannerSessions.organization_id, organizationId),
        ),
      )
      .returning({ id: scannerSessions.id })
    if (rows.length === 0) throw new Error('Sessie niet gevonden')
    return rows[0]
  })

/**
 * Wisselt een scannertoken in voor de event-info (pairing-route /s/{token}).
 * Bewust géén requireAuth: deurpersoneel is niet ingelogd. Geeft alleen het
 * event-id terug als het token geldig is; verder niets gevoeligs.
 */
export const resolveScannerToken = createServerFn({ method: 'GET' })
  .validator((token: string) => {
    if (!token) throw new Error('token ontbreekt')
    return token
  })
  .handler(async ({ data: token }) => {
    const rows = await db
      .select({
        event_id: scannerSessions.event_id,
        vervalt_op: scannerSessions.vervalt_op,
        ingetrokken_op: scannerSessions.ingetrokken_op,
      })
      .from(scannerSessions)
      .where(eq(scannerSessions.token_hash, hashToken(token)))
      .limit(1)
    if (rows.length === 0) throw new Error('Onbekende scannertoken')
    const s = rows[0]
    if (s.ingetrokken_op) throw new Error('Deze scanner is ingetrokken')
    if (s.vervalt_op && s.vervalt_op < new Date()) {
      throw new Error('Deze scanner is verlopen')
    }
    return { eventId: s.event_id }
  })
