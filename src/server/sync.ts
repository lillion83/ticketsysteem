import { createServerFn } from '@tanstack/react-start'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, scans, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { verifyTicketCode } from '#/lib/ticketcode'
import type { GesynctTicket, ScanResultaat } from '#/lib/scanResult'

// Fase E — de offline-laag. Twee endpoints:
//   syncTickets  : de volledige lijst voor het event (PLAN §3.3, geen delta).
//   uploadScans  : idempotente batch-upload van (groene) scans.
// Alles org-gescoopt (harde regel 3).

// --- sync: volledige lijst ophalen ---

export type SyncRespons = {
  gesyncedOp: string
  naam: string
  reEntry: boolean
  tickets: GesynctTicket[]
}

export const syncTickets = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }): Promise<SyncRespons> => {
    const { organizationId } = await requireAuth()

    const ev = await db
      .select({ naam: events.naam, reEntry: events.re_entry_toegestaan })
      .from(events)
      .where(
        and(eq(events.id, eventId), eq(events.organization_id, organizationId)),
      )
      .limit(1)
    if (ev.length === 0) throw new Error('Event niet gevonden')

    // Alleen wat de deur nodig heeft: code + status. Geen persoonsgegevens
    // (PLAN: geen ID-veld aan de deur). Onder 200 tickets is dit één request.
    const rows = await db
      .select({
        code: tickets.code,
        gebruikt_op: tickets.gebruikt_op,
        ingetrokken_op: tickets.ingetrokken_op,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.event_id, eventId),
          eq(tickets.organization_id, organizationId),
        ),
      )

    return {
      gesyncedOp: new Date().toISOString(),
      naam: ev[0].naam,
      reEntry: ev[0].reEntry,
      tickets: rows.map((r) => ({
        code: r.code,
        gebruikt_op: r.gebruikt_op ? r.gebruikt_op.toISOString() : null,
        ingetrokken_op: r.ingetrokken_op ? r.ingetrokken_op.toISOString() : null,
      })),
    }
  })

// --- upload: idempotente batch ---

export type WachtScanInput = {
  client_scan_uuid: string
  code: string
  tijdstip_client: string // ISO
  resultaat: ScanResultaat // het lokale oordeel; de server beslist opnieuw
}

export type UploadResultaat = {
  client_scan_uuid: string
  resultaat: ScanResultaat
  gebruikt_op: string | null
}

function parseTijd(iso: string): Date {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

export const uploadScans = createServerFn({ method: 'POST' })
  .validator((data: { eventId: string; scans: WachtScanInput[] }) => {
    if (!data.eventId) throw new Error('eventId ontbreekt')
    if (!Array.isArray(data.scans)) throw new Error('scans ontbreekt')
    return data
  })
  .handler(
    async ({ data }): Promise<{ resultaten: UploadResultaat[] }> => {
      const { userId, organizationId } = await requireAuth()
      const { eventId } = data

      const resultaten: UploadResultaat[] = []
      for (const scan of data.scans) {
        resultaten.push(
          await verwerkScan(scan, eventId, organizationId, userId),
        )
      }
      return { resultaten }
    },
  )

async function verwerkScan(
  scan: WachtScanInput,
  eventId: string,
  organizationId: string,
  userId: string,
): Promise<UploadResultaat> {
  const { client_scan_uuid, code } = scan
  const tijdstipClient = parseTijd(scan.tijdstip_client)

  // 0. Idempotentie (harde regel 4). Kennen we deze client_scan_uuid al, dan is
  //    hij eerder verwerkt: geef het oorspronkelijke oordeel terug en raak het
  //    ticket niet opnieuw aan. Zo levert een her-verzonden groene scan géén
  //    "al gebruikt" op. Dit is een lookup op de unieke uuid, niet de
  //    scan-beslissing zelf — die blijft de atomaire UPDATE hieronder.
  const bestaand = await db
    .select({ resultaat: scans.resultaat })
    .from(scans)
    .where(eq(scans.client_scan_uuid, client_scan_uuid))
    .limit(1)
  if (bestaand.length > 0) {
    return { client_scan_uuid, resultaat: bestaand[0].resultaat, gebruikt_op: null }
  }

  // 1. HMAC server-side (defensief: de client-queue is te manipuleren). Vervalst
  //    → rood_ongeldig, geen ticket en dus niets te loggen in scans.
  if (!verifyTicketCode(eventId, code).valid) {
    return { client_scan_uuid, resultaat: 'rood_ongeldig', gebruikt_op: null }
  }

  // 2. De atomaire markering (harde regel 2). Rij terug = dit ticket is nu
  //    binnen. gebruikt_op = tijdstip_client, zodat "vroegste wint" (PLAN §3.3)
  //    betekenis houdt over het offline-venster.
  const gemarkeerd = await db
    .update(tickets)
    .set({ gebruikt_op: tijdstipClient, gebruikt_door: userId })
    .where(
      and(
        eq(tickets.code, code),
        eq(tickets.event_id, eventId),
        eq(tickets.organization_id, organizationId),
        isNull(tickets.gebruikt_op),
        isNull(tickets.ingetrokken_op),
      ),
    )
    .returning({ id: tickets.id })
  if (gemarkeerd.length > 0) {
    await logScan(gemarkeerd[0].id, eventId, organizationId, scan, 'groen')
    return { client_scan_uuid, resultaat: 'groen', gebruikt_op: null }
  }

  // 3. Geen rij → pas nu ophalen waarom (fase D-patroon), org-gescoopt.
  const rows = await db
    .select({
      id: tickets.id,
      gebruikt_op: tickets.gebruikt_op,
      ingetrokken_op: tickets.ingetrokken_op,
      reEntry: events.re_entry_toegestaan,
    })
    .from(tickets)
    .innerJoin(events, eq(tickets.event_id, events.id))
    .where(
      and(
        eq(tickets.code, code),
        eq(tickets.event_id, eventId),
        eq(tickets.organization_id, organizationId),
      ),
    )
    .limit(1)

  if (rows.length === 0) {
    return { client_scan_uuid, resultaat: 'rood_ongeldig', gebruikt_op: null }
  }
  const rij = rows[0]

  if (rij.ingetrokken_op) {
    await logScan(rij.id, eventId, organizationId, scan, 'rood_ingetrokken')
    return { client_scan_uuid, resultaat: 'rood_ingetrokken', gebruikt_op: null }
  }

  if (rij.gebruikt_op) {
    if (rij.reEntry) {
      await logScan(rij.id, eventId, organizationId, scan, 'groen_re_entry')
      return { client_scan_uuid, resultaat: 'groen_re_entry', gebruikt_op: null }
    }
    // Conflict: twee scanners claimden hetzelfde ticket offline. Vroegste
    // tijdstempel wint — corrigeer gebruikt_op als deze scan eerder was
    // (PLAN §3.3). De scanrij zelf is het conflictlog (rood_al_gebruikt met
    // een eerder tijdstip_client dan de winnende scan).
    await db
      .update(tickets)
      .set({ gebruikt_op: tijdstipClient })
      .where(
        and(
          eq(tickets.id, rij.id),
          eq(tickets.organization_id, organizationId),
          gt(tickets.gebruikt_op, tijdstipClient),
        ),
      )
    await logScan(rij.id, eventId, organizationId, scan, 'rood_al_gebruikt')
    return {
      client_scan_uuid,
      resultaat: 'rood_al_gebruikt',
      gebruikt_op: rij.gebruikt_op.toISOString(),
    }
  }

  // Onbereikbaar in theorie (dan had stap 2 gemarkeerd), defensief rood.
  return { client_scan_uuid, resultaat: 'rood_ongeldig', gebruikt_op: null }
}

async function logScan(
  ticketId: string,
  eventId: string,
  organizationId: string,
  scan: WachtScanInput,
  resultaat: ScanResultaat,
) {
  // onConflictDoNothing dekt de race waarin dezelfde uuid gelijktijdig binnenkomt
  // (harde regel 4). scanner_sessie_id blijft null tot fase F.
  await db
    .insert(scans)
    .values({
      ticket_id: ticketId,
      event_id: eventId,
      organization_id: organizationId,
      tijdstip_client: parseTijd(scan.tijdstip_client),
      resultaat,
      client_scan_uuid: scan.client_scan_uuid,
    })
    .onConflictDoNothing({ target: scans.client_scan_uuid })
}
