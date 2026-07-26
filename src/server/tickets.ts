import { randomUUID } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { ticketTypes, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { vindKoperUserId } from '#/server/mijnTickets'
import { signTicket } from '#/lib/ticketcode'

export type IssueTicketInput = {
  event_id: string
  ticket_type_id: string
  koper_naam: string
  koper_telefoon: string | null
  koper_email: string | null
  verkoopkanaal: string | null
}

export const issueTicket = createServerFn({ method: 'POST' })
  .validator((data: IssueTicketInput) => {
    if (!data.event_id || !data.ticket_type_id) {
      throw new Error('Event en tickettype zijn verplicht')
    }
    if (!data.koper_naam.trim()) throw new Error('Kopersnaam is verplicht')
    return data
  })
  .handler(async ({ data }) => {
    const { userId, organizationId } = await requireAuth()

    return db.transaction(async (tx) => {
      // Voorraad atomair ophogen én bewaken: geen rij terug = uitverkocht
      // (of verkeerde org/event). Nooit eerst lezen en dan schrijven.
      const typeRows = await tx
        .update(ticketTypes)
        .set({ aantal_verkocht: sql`${ticketTypes.aantal_verkocht} + 1` })
        .where(
          and(
            eq(ticketTypes.id, data.ticket_type_id),
            eq(ticketTypes.event_id, data.event_id),
            eq(ticketTypes.organization_id, organizationId),
            sql`${ticketTypes.aantal_verkocht} < ${ticketTypes.aantal_beschikbaar}`,
          ),
        )
        .returning()
      if (typeRows.length === 0) {
        throw new Error('Uitverkocht of tickettype niet gevonden')
      }

      // Ticket-id app-side, zodat code én id in één insert vastliggen
      // (geen SELECT-na-INSERT). Code = {uuid}.{hmac} (harde regel 1).
      const ticketId = randomUUID()
      const code = signTicket(data.event_id, ticketId)

      // Koppel meteen aan een bestaand koper-account (fase K) als dat er is.
      const koperEmail = data.koper_email?.trim() || null
      const koperUserId = koperEmail ? await vindKoperUserId(koperEmail) : null

      const ticketRows = await tx
        .insert(tickets)
        .values({
          id: ticketId,
          event_id: data.event_id,
          ticket_type_id: data.ticket_type_id,
          organization_id: organizationId,
          code,
          koper_naam: data.koper_naam.trim(),
          koper_telefoon: data.koper_telefoon?.trim() || null,
          koper_email: koperEmail,
          koper_user_id: koperUserId,
          verkocht_op: new Date(),
          verkocht_door_user_id: userId,
          verkoopkanaal: data.verkoopkanaal?.trim() || null,
        })
        .returning()
      return ticketRows[0]
    })
  })

export const listTickets = createServerFn({ method: 'GET' })
  .validator((data: { eventId: string; zoek?: string }) => data)
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()

    const filters = [
      eq(tickets.event_id, data.eventId),
      eq(tickets.organization_id, organizationId),
    ]
    const zoek = data.zoek?.trim()
    if (zoek) {
      const patroon = `%${zoek}%`
      filters.push(
        or(
          ilike(tickets.koper_naam, patroon),
          ilike(tickets.koper_telefoon, patroon),
          ilike(tickets.koper_email, patroon),
        )!,
      )
    }

    return db
      .select({
        id: tickets.id,
        code: tickets.code,
        koper_naam: tickets.koper_naam,
        koper_telefoon: tickets.koper_telefoon,
        koper_email: tickets.koper_email,
        verkocht_op: tickets.verkocht_op,
        geleverd_via: tickets.geleverd_via,
        geleverd_op: tickets.geleverd_op,
        gebruikt_op: tickets.gebruikt_op,
        ingetrokken_op: tickets.ingetrokken_op,
        ingetrokken_reden: tickets.ingetrokken_reden,
        type_naam: ticketTypes.naam,
      })
      .from(tickets)
      .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
      .where(and(...filters))
      .orderBy(desc(tickets.verkocht_op))
  })

export const revokeTicket = createServerFn({ method: 'POST' })
  .validator((data: { ticketId: string; reden: string }) => {
    if (!data.ticketId) throw new Error('ticketId ontbreekt')
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    // Geen rij verwijderen; alleen markeren als ingetrokken (PLAN §4).
    // De voorraadteller blijft staan: uitgegeven = uitgegeven. Terugbetaling en
    // heruitgifte vallen buiten scope (harde regel 6).
    const rows = await db
      .update(tickets)
      .set({
        ingetrokken_op: new Date(),
        ingetrokken_reden: data.reden.trim() || null,
      })
      .where(
        and(
          eq(tickets.id, data.ticketId),
          eq(tickets.organization_id, organizationId),
        ),
      )
      .returning()
    if (rows.length === 0) throw new Error('Ticket niet gevonden')
    return rows[0]
  })
