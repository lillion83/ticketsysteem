import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, organizations, ticketTypes, tickets } from '#/db/schema'
import { requireAdmin } from '#/server/session'

// Platform-overzicht voor de admin (fase J). Dit is het ENIGE gebied dat
// cross-org leest — de gedocumenteerde uitzondering op harde regel 3, geconcen-
// treerd achter requireAdmin(). Uitsluitend lezen; niets muteren.

const WEEKDAGEN = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']

export type PlatformStats = {
  aantalOrganisaties: number
  aantalEvents: number
  capaciteit: number
  uitgegeven: number
  beschikbaar: number
  waardeSrd: number
  perOrg: Array<{ naam: string; uitgegeven: number }>
  reeks: Array<{ label: string; aantal: number }>
}

export const getPlatformStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PlatformStats> => {
    await requireAdmin()

    const [orgTel] = await db
      .select({ n: sql<number>`count(*)` })
      .from(organizations)
    const [eventTel] = await db.select({ n: sql<number>`count(*)` }).from(events)
    const [cap] = await db
      .select({ capaciteit: sql<number>`coalesce(sum(${ticketTypes.aantal_beschikbaar}), 0)` })
      .from(ticketTypes)

    const [totalen] = await db
      .select({
        uitgegeven: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is null)`,
        waardeSrd: sql<number>`coalesce(sum(${ticketTypes.prijs_srd}) filter (where ${tickets.ingetrokken_op} is null), 0)`,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))

    // Uitgegeven per organisatie (voor de donut).
    const perOrgRows = await db
      .select({
        naam: organizations.naam,
        uitgegeven: sql<number>`count(${tickets.id}) filter (where ${tickets.ingetrokken_op} is null)`,
      })
      .from(organizations)
      .leftJoin(tickets, eq(tickets.organization_id, organizations.id))
      .groupBy(organizations.naam)
      .orderBy(desc(sql`count(${tickets.id}) filter (where ${tickets.ingetrokken_op} is null)`))

    // Uitgifte per dag over de laatste 7 dagen (cross-org).
    const zevenDagenGeleden = new Date()
    zevenDagenGeleden.setHours(0, 0, 0, 0)
    zevenDagenGeleden.setDate(zevenDagenGeleden.getDate() - 6)
    const reeksRows = await db
      .select({ verkocht_op: tickets.verkocht_op })
      .from(tickets)
      .where(and(isNull(tickets.ingetrokken_op), gte(tickets.verkocht_op, zevenDagenGeleden)))

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

    const capaciteit = Number(cap.capaciteit)
    const uitgegeven = Number(totalen.uitgegeven)

    return {
      aantalOrganisaties: Number(orgTel.n),
      aantalEvents: Number(eventTel.n),
      capaciteit,
      uitgegeven,
      beschikbaar: Math.max(0, capaciteit - uitgegeven),
      waardeSrd: Number(totalen.waardeSrd),
      perOrg: perOrgRows.map((r) => ({ naam: r.naam, uitgegeven: Number(r.uitgegeven) })),
      reeks,
    }
  },
)

export type PlatformEvent = {
  id: string
  naam: string
  organisatie: string
  datum_start: string
  locatie: string | null
  status: string
  uitgegeven: number
}

export const listAllEvents = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<PlatformEvent>> => {
    await requireAdmin()

    const rows = await db
      .select({
        id: events.id,
        naam: events.naam,
        organisatie: organizations.naam,
        datum_start: events.datum_start,
        locatie: events.locatie,
        status: events.status,
        uitgegeven: sql<number>`count(${tickets.id}) filter (where ${tickets.ingetrokken_op} is null)`,
      })
      .from(events)
      .innerJoin(organizations, eq(events.organization_id, organizations.id))
      .leftJoin(tickets, eq(tickets.event_id, events.id))
      .groupBy(events.id, organizations.naam)
      .orderBy(desc(events.datum_start))

    return rows.map((r) => ({
      id: r.id,
      naam: r.naam,
      organisatie: r.organisatie,
      datum_start: r.datum_start.toISOString(),
      locatie: r.locatie,
      status: r.status,
      uitgegeven: Number(r.uitgegeven),
    }))
  },
)
