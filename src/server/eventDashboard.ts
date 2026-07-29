import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, reserveringen, scans, ticketTypes, tickets } from '#/db/schema'
import { requireContentAccess } from '#/server/scope'

// Event-dashboard: één gebundelde momentopname per event. Bewust één server-
// functie en niet zes losse: de pagina schakelt client-side tussen lifecycle
// (vóór/tijdens/na) en tijdvak (7D/30D/90D/alles), en dat mag geen refetch
// kosten. Alles gescoopt op organization_id (harde regel 3).
//
// Geen betaallogica, geen ledger, geen refunds (harde regel 6). De bedragen
// hieronder zijn indicaties: sommen van prijs_srd / inkoopprijs_srd over de
// uitgegeven tickets. Er wordt niets afgeleid over daadwerkelijke betalingen.

export type DashboardTicketType = {
  id: string
  naam: string
  capaciteit: number
  uitgegeven: number
  gebruikt: number
  prijs_srd: number
  laatste7: number
  vorige7: number
}

export type DashboardKanaal = { naam: string; aantal: number }

export type DashboardKoperRegel = {
  code: string
  naam: string | null
  type_naam: string
  prijs_srd: number
  verkocht_op: string | null
  geleverd_via: string | null
  geleverd_op: string | null
  gebruikt_op: string | null
  ingetrokken_op: string | null
}

export type EventDashboardData = {
  event: {
    id: string
    naam: string
    datum_start: string
    datum_eind: string
    locatie: string | null
    status: string
  }
  capaciteit: number
  uitgegeven: number
  beschikbaar: number
  gebruikt: number
  ingetrokken: number
  geleverd: number
  // Indicatieve bedragen (zie kop van dit bestand).
  brutoSrd: number
  inkoopSrd: number
  ingetrokkenSrd: number
  openstaandSrd: number
  perType: Array<DashboardTicketType>
  // ISO-datums van elk niet-ingetrokken uitgegeven ticket. De pagina bucket ze
  // zelf per tijdvak; onder de 200 tickets per event is dat verwaarloosbaar.
  verkoopmomenten: Array<string>
  kanalen: Array<DashboardKanaal>
  reserveringen: { aangevraagd: number; afgehandeld: number; afgewezen: number }
  scans: {
    totaal: number
    laatsteUur: number
    piekUur: string | null
    piekAantal: number
  }
  kopers: Array<DashboardKoperRegel>
}

const DAG_MS = 24 * 60 * 60 * 1000

export const getEventDashboard = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }): Promise<EventDashboardData> => {
    // requireContentAccess geeft de org van het event terug en laat ook de
    // platform-admin toe (fase J); requireAuth zou alleen de eigen org geven.
    const { organizationId } = await requireContentAccess(eventId)

    const eventScope = and(
      eq(tickets.event_id, eventId),
      eq(tickets.organization_id, organizationId),
    )
    const nu = Date.now()
    // ISO-strings met expliciete cast: een los Date-object in een `sql`-template
    // gaat als ongetypeerde parameter naar de driver en die kan het niet binden.
    const zeven = new Date(nu - 7 * DAG_MS).toISOString()
    const veertien = new Date(nu - 14 * DAG_MS).toISOString()

    const eventRijen = await db
      .select()
      .from(events)
      .where(
        and(eq(events.id, eventId), eq(events.organization_id, organizationId)),
      )
      .limit(1)
    if (eventRijen.length === 0) throw new Error('Event niet gevonden')
    const eventRij = eventRijen[0]

    // Per tickettype: capaciteit, uitgegeven, ingecheckt en de verkoop van de
    // laatste twee weken (voor 'snelst groeiend' op de pagina).
    const uitgegevenFilter = sql`${tickets.ingetrokken_op} is null`
    const perTypeRows = await db
      .select({
        id: ticketTypes.id,
        naam: ticketTypes.naam,
        capaciteit: ticketTypes.aantal_beschikbaar,
        prijs_srd: ticketTypes.prijs_srd,
        uitgegeven: sql<number>`count(${tickets.id}) filter (where ${uitgegevenFilter})`,
        gebruikt: sql<number>`count(${tickets.id}) filter (where ${uitgegevenFilter} and ${tickets.gebruikt_op} is not null)`,
        laatste7: sql<number>`count(${tickets.id}) filter (where ${uitgegevenFilter} and ${tickets.verkocht_op} >= ${zeven}::timestamptz)`,
        vorige7: sql<number>`count(${tickets.id}) filter (where ${uitgegevenFilter} and ${tickets.verkocht_op} >= ${veertien}::timestamptz and ${tickets.verkocht_op} < ${zeven}::timestamptz)`,
      })
      .from(ticketTypes)
      // De org-eis staat ook in de join-conditie, niet alleen op ticket_types:
      // harde regel 3 wil het filter expliciet op elke gelezen tabel.
      .leftJoin(
        tickets,
        and(
          eq(tickets.ticket_type_id, ticketTypes.id),
          eq(tickets.organization_id, organizationId),
        ),
      )
      .where(
        and(
          eq(ticketTypes.event_id, eventId),
          eq(ticketTypes.organization_id, organizationId),
        ),
      )
      .groupBy(
        ticketTypes.id,
        ticketTypes.naam,
        ticketTypes.aantal_beschikbaar,
        ticketTypes.prijs_srd,
      )
      .orderBy(
        desc(sql`count(${tickets.id}) filter (where ${uitgegevenFilter})`),
      )

    // Totalen + indicatieve bedragen in één pass.
    const [totalen] = await db
      .select({
        uitgegeven: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is null)`,
        gebruikt: sql<number>`count(*) filter (where ${tickets.gebruikt_op} is not null and ${tickets.ingetrokken_op} is null)`,
        ingetrokken: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is not null)`,
        geleverd: sql<number>`count(*) filter (where ${tickets.geleverd_op} is not null and ${tickets.ingetrokken_op} is null)`,
        brutoSrd: sql<number>`coalesce(sum(${ticketTypes.prijs_srd}) filter (where ${tickets.ingetrokken_op} is null), 0)`,
        inkoopSrd: sql<number>`coalesce(sum(${ticketTypes.inkoopprijs_srd}) filter (where ${tickets.ingetrokken_op} is null), 0)`,
        ingetrokkenSrd: sql<number>`coalesce(sum(${ticketTypes.prijs_srd}) filter (where ${tickets.ingetrokken_op} is not null), 0)`,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
      .where(eventScope)

    // Verkoopmomenten voor de grafiek.
    const momentRows = await db
      .select({ verkocht_op: tickets.verkocht_op })
      .from(tickets)
      .where(and(eventScope, isNull(tickets.ingetrokken_op)))

    // Verkoopkanaal staat al op het ticket; dit vervangt de 'marketingbronnen'
    // uit het ontwerp, waarvoor geen bron in het datamodel bestaat.
    const kanaalRows = await db
      .select({
        naam: tickets.verkoopkanaal,
        aantal: sql<number>`count(*)`,
      })
      .from(tickets)
      .where(and(eventScope, isNull(tickets.ingetrokken_op)))
      .groupBy(tickets.verkoopkanaal)
      .orderBy(desc(sql`count(*)`))

    const [reserveringRij] = await db
      .select({
        aangevraagd: sql<number>`count(*)`,
        afgehandeld: sql<number>`count(*) filter (where ${reserveringen.status} = 'afgehandeld')`,
        afgewezen: sql<number>`count(*) filter (where ${reserveringen.status} = 'afgewezen')`,
      })
      .from(reserveringen)
      .where(
        and(
          eq(reserveringen.event_id, eventId),
          eq(reserveringen.organization_id, organizationId),
        ),
      )

    // Scans per uur — voedt 'scans per uur' en 'piekuur' op de pagina.
    const scanRows = await db
      .select({
        uur: sql<string>`date_trunc('hour', ${scans.tijdstip_server})`,
        aantal: sql<number>`count(*)`,
      })
      .from(scans)
      .where(
        and(
          eq(scans.event_id, eventId),
          eq(scans.organization_id, organizationId),
        ),
      )
      .groupBy(sql`date_trunc('hour', ${scans.tijdstip_server})`)

    let scanTotaal = 0
    let piekUur: string | null = null
    let piekAantal = 0
    let laatsteUur = 0
    const uurGeleden = nu - 60 * 60 * 1000
    for (const r of scanRows) {
      const aantal = Number(r.aantal)
      scanTotaal += aantal
      if (aantal > piekAantal) {
        piekAantal = aantal
        piekUur = new Date(r.uur).toISOString()
      }
      if (new Date(r.uur).getTime() >= uurGeleden) laatsteUur += aantal
    }

    const koperRows = await db
      .select({
        code: tickets.code,
        naam: tickets.koper_naam,
        type_naam: ticketTypes.naam,
        prijs_srd: ticketTypes.prijs_srd,
        verkocht_op: tickets.verkocht_op,
        geleverd_via: tickets.geleverd_via,
        geleverd_op: tickets.geleverd_op,
        gebruikt_op: tickets.gebruikt_op,
        ingetrokken_op: tickets.ingetrokken_op,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
      .where(eventScope)
      .orderBy(desc(tickets.verkocht_op))
      .limit(8)

    const perType = perTypeRows.map((r) => ({
      id: r.id,
      naam: r.naam,
      capaciteit: Number(r.capaciteit),
      uitgegeven: Number(r.uitgegeven),
      gebruikt: Number(r.gebruikt),
      prijs_srd: Number(r.prijs_srd),
      laatste7: Number(r.laatste7),
      vorige7: Number(r.vorige7),
    }))

    const capaciteit = perType.reduce((s, t) => s + t.capaciteit, 0)
    const uitgegeven = Number(totalen.uitgegeven)
    const beschikbaar = Math.max(0, capaciteit - uitgegeven)
    // Waarde die nog in de kast staat: resterende plaatsen × prijs per type.
    const openstaandSrd = perType.reduce(
      (s, t) => s + Math.max(0, t.capaciteit - t.uitgegeven) * t.prijs_srd,
      0,
    )

    return {
      event: {
        id: eventRij.id,
        naam: eventRij.naam,
        datum_start: eventRij.datum_start.toISOString(),
        datum_eind: eventRij.datum_eind.toISOString(),
        locatie: eventRij.locatie,
        status: eventRij.status,
      },
      capaciteit,
      uitgegeven,
      beschikbaar,
      gebruikt: Number(totalen.gebruikt),
      ingetrokken: Number(totalen.ingetrokken),
      geleverd: Number(totalen.geleverd),
      brutoSrd: Number(totalen.brutoSrd),
      inkoopSrd: Number(totalen.inkoopSrd),
      ingetrokkenSrd: Number(totalen.ingetrokkenSrd),
      openstaandSrd,
      perType,
      verkoopmomenten: momentRows
        .map((r) => r.verkocht_op)
        .filter((d): d is Date => d != null)
        .map((d) => d.toISOString()),
      kanalen: kanaalRows.map((r) => ({
        naam: r.naam ?? 'Onbekend',
        aantal: Number(r.aantal),
      })),
      reserveringen: {
        aangevraagd: Number(reserveringRij.aangevraagd),
        afgehandeld: Number(reserveringRij.afgehandeld),
        afgewezen: Number(reserveringRij.afgewezen),
      },
      scans: { totaal: scanTotaal, laatsteUur, piekUur, piekAantal },
      kopers: koperRows.map((r) => ({
        code: r.code,
        naam: r.naam,
        type_naam: r.type_naam,
        prijs_srd: Number(r.prijs_srd),
        verkocht_op: r.verkocht_op?.toISOString() ?? null,
        geleverd_via: r.geleverd_via,
        geleverd_op: r.geleverd_op?.toISOString() ?? null,
        gebruikt_op: r.gebruikt_op?.toISOString() ?? null,
        ingetrokken_op: r.ingetrokken_op?.toISOString() ?? null,
      })),
    }
  })
