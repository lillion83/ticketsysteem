import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { scannerSessions, scans, ticketTypes, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import type { ScanResultaat } from '#/lib/scanResult'

// Fase F — live teller en scanlog. Alles org-gescoopt (harde regel 3).

export type EventStats = {
  verkocht: number // uitgegeven en niet ingetrokken
  binnen: number // gescand (gebruikt) en niet ingetrokken
  buiten: number // verkocht - binnen
  ingetrokken: number
}

export const getEventStats = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }): Promise<EventStats> => {
    const { organizationId } = await requireAuth()

    const [rij] = await db
      .select({
        verkocht: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is null)`,
        binnen: sql<number>`count(*) filter (where ${tickets.gebruikt_op} is not null and ${tickets.ingetrokken_op} is null)`,
        ingetrokken: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is not null)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.event_id, eventId),
          eq(tickets.organization_id, organizationId),
        ),
      )

    const verkocht = Number(rij.verkocht)
    const binnen = Number(rij.binnen)
    return {
      verkocht,
      binnen,
      buiten: verkocht - binnen,
      ingetrokken: Number(rij.ingetrokken),
    }
  })

// ── Dashboard (org-breed) ────────────────────────────────────────────────────
// Aggregatie over alle events van de organisatie voor het admin-dashboard.
// Bewust één gebundelde server-functie: het dashboard doet één GET en rendert
// KPI's, donut, weekgrafiek en recente kopers uit dezelfde momentopname.

export type DashboardKoper = {
  code: string
  koper_naam: string | null
  koper_email: string | null
  koper_telefoon: string | null
  type_naam: string
  verkocht_op: string | null
  status: 'uitgegeven' | 'gebruikt' | 'ingetrokken'
}

export type DashboardData = {
  capaciteit: number
  uitgegeven: number
  beschikbaar: number
  gebruikt: number
  ingetrokken: number
  waardeSrd: number
  perType: Array<{ naam: string; uitgegeven: number }>
  reeks: Array<{ label: string; aantal: number }>
  kopers: Array<DashboardKoper>
}

function koperStatus(t: {
  gebruikt_op: Date | null
  ingetrokken_op: Date | null
}): DashboardKoper['status'] {
  if (t.ingetrokken_op) return 'ingetrokken'
  if (t.gebruikt_op) return 'gebruikt'
  return 'uitgegeven'
}

const WEEKDAGEN = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']

export const getDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardData> => {
    const { organizationId } = await requireAuth()

    // Capaciteit: som van de beschikbare plaatsen over alle tickettypes.
    const [cap] = await db
      .select({
        capaciteit: sql<number>`coalesce(sum(${ticketTypes.aantal_beschikbaar}), 0)`,
      })
      .from(ticketTypes)
      .where(eq(ticketTypes.organization_id, organizationId))

    // Ticket-tellingen + indicatieve verkochte waarde (som prijs_srd over de
    // niet-ingetrokken tickets, gejoined op hun tickettype). Geen ledger.
    const [totalen] = await db
      .select({
        uitgegeven: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is null)`,
        gebruikt: sql<number>`count(*) filter (where ${tickets.gebruikt_op} is not null and ${tickets.ingetrokken_op} is null)`,
        ingetrokken: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is not null)`,
        waardeSrd: sql<number>`coalesce(sum(${ticketTypes.prijs_srd}) filter (where ${tickets.ingetrokken_op} is null), 0)`,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
      .where(eq(tickets.organization_id, organizationId))

    // Uitgegeven per tickettype (voor de donut).
    const perTypeRows = await db
      .select({
        naam: ticketTypes.naam,
        uitgegeven: sql<number>`count(${tickets.id}) filter (where ${tickets.ingetrokken_op} is null)`,
      })
      .from(ticketTypes)
      .leftJoin(tickets, eq(tickets.ticket_type_id, ticketTypes.id))
      .where(eq(ticketTypes.organization_id, organizationId))
      .groupBy(ticketTypes.naam)
      .orderBy(desc(sql`count(${tickets.id}) filter (where ${tickets.ingetrokken_op} is null)`))

    // Uitgifte per dag over de laatste 7 dagen (voor de weekgrafiek).
    const zevenDagenGeleden = new Date()
    zevenDagenGeleden.setHours(0, 0, 0, 0)
    zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 6)
    const reeksRows = await db
      .select({ verkocht_op: tickets.verkocht_op })
      .from(tickets)
      .where(
        and(
          eq(tickets.organization_id, organizationId),
          isNull(tickets.ingetrokken_op),
          gte(tickets.verkocht_op, zevenDagenGeleden),
        ),
      )

    // Buckets voor de 7 dagen, lege dagen op 0.
    const buckets = new Map<string, number>()
    const dagen: Array<{ key: string; label: string }> = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(zevenDagenGeleden)
      d.setDate(zevenDagenGeleden.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      dagen.push({ key, label: WEEKDAGEN[d.getDay()] })
      buckets.set(key, 0)
    }
    for (const r of reeksRows) {
      if (!r.verkocht_op) continue
      const key = r.verkocht_op.toISOString().slice(0, 10)
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }
    const reeks = dagen.map((d) => ({ label: d.label, aantal: buckets.get(d.key) ?? 0 }))

    // Recente kopers (org-breed).
    const koperRows = await db
      .select({
        code: tickets.code,
        koper_naam: tickets.koper_naam,
        koper_email: tickets.koper_email,
        koper_telefoon: tickets.koper_telefoon,
        verkocht_op: tickets.verkocht_op,
        gebruikt_op: tickets.gebruikt_op,
        ingetrokken_op: tickets.ingetrokken_op,
        type_naam: ticketTypes.naam,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
      .where(eq(tickets.organization_id, organizationId))
      .orderBy(desc(tickets.verkocht_op))
      .limit(8)

    const uitgegeven = Number(totalen.uitgegeven)
    const capaciteit = Number(cap.capaciteit)

    return {
      capaciteit,
      uitgegeven,
      beschikbaar: Math.max(0, capaciteit - uitgegeven),
      gebruikt: Number(totalen.gebruikt),
      ingetrokken: Number(totalen.ingetrokken),
      waardeSrd: Number(totalen.waardeSrd),
      perType: perTypeRows.map((r) => ({
        naam: r.naam,
        uitgegeven: Number(r.uitgegeven),
      })),
      reeks,
      kopers: koperRows.map((r) => ({
        code: r.code,
        koper_naam: r.koper_naam,
        koper_email: r.koper_email,
        koper_telefoon: r.koper_telefoon,
        type_naam: r.type_naam,
        verkocht_op: r.verkocht_op ? r.verkocht_op.toISOString() : null,
        status: koperStatus(r),
      })),
    }
  },
)

export type ScanLogRegel = {
  id: string
  tijdstip_server: string
  tijdstip_client: string | null
  resultaat: ScanResultaat
  koper_naam: string | null
  sessie_label: string | null
}

export const listScans = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }): Promise<ScanLogRegel[]> => {
    const { organizationId } = await requireAuth()

    const rows = await db
      .select({
        id: scans.id,
        tijdstip_server: scans.tijdstip_server,
        tijdstip_client: scans.tijdstip_client,
        resultaat: scans.resultaat,
        koper_naam: tickets.koper_naam,
        sessie_label: scannerSessions.label,
      })
      .from(scans)
      .innerJoin(tickets, eq(scans.ticket_id, tickets.id))
      .leftJoin(
        scannerSessions,
        eq(scans.scanner_sessie_id, scannerSessions.id),
      )
      .where(
        and(
          eq(scans.event_id, eventId),
          eq(scans.organization_id, organizationId),
        ),
      )
      .orderBy(desc(scans.tijdstip_server))
      .limit(1000)

    return rows.map((r) => ({
      id: r.id,
      tijdstip_server: r.tijdstip_server.toISOString(),
      tijdstip_client: r.tijdstip_client
        ? r.tijdstip_client.toISOString()
        : null,
      resultaat: r.resultaat,
      koper_naam: r.koper_naam,
      sessie_label: r.sessie_label,
    }))
  })
