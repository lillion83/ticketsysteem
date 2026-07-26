import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, ticketTypes, tickets, user } from '#/db/schema'
import { requireUser } from '#/server/session'

// "Mijn Tickets" (fase K): een ingelogde koper ziet de tickets die op zijn
// (geverifieerde) e-mailadres zijn uitgegeven, met status. Geen org-scope: dit
// is het kopersgedeelte, niet de admin.

export type MijnTicketStatus = 'geldig' | 'gebruikt' | 'ingetrokken'

export type MijnTicket = {
  code: string
  event_naam: string
  datum_start: Date
  locatie: string | null
  type_naam: string
  status: MijnTicketStatus
  gebruikt_op: Date | null
}

/**
 * Zoekt het koper-account bij een e-mailadres (case-insensitief). Server-only
 * (leest de user-tabel): dit wordt vanuit uitgifte-serverfuncties aangeroepen en
 * mag nooit in de client-bundel belanden — vgl. `laadPublicTicket`.
 */
export const vindKoperUserId = createServerOnlyFn(async (email: string): Promise<string | null> => {
  const rows = await db
    .select({ id: user.id })
    .from(user)
    .where(sql`lower(${user.email}) = lower(${email})`)
    .limit(1)
  return rows[0]?.id ?? null
})

export const listMijnTickets = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<MijnTicket>> => {
  const { userId, email } = await requireUser()

  // Claim: tickets die op dit (geverifieerde) e-mailadres staan maar nog geen
  // koper-account hadden, koppelen we nu aan deze gebruiker. Idempotent.
  await db
    .update(tickets)
    .set({ koper_user_id: userId })
    .where(and(sql`lower(${tickets.koper_email}) = lower(${email})`, isNull(tickets.koper_user_id)))

  const rows = await db
    .select({
      code: tickets.code,
      gebruikt_op: tickets.gebruikt_op,
      ingetrokken_op: tickets.ingetrokken_op,
      type_naam: ticketTypes.naam,
      event_naam: events.naam,
      datum_start: events.datum_start,
      locatie: events.locatie,
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
    .innerJoin(events, eq(tickets.event_id, events.id))
    .where(eq(tickets.koper_user_id, userId))
    .orderBy(desc(events.datum_start))

  return rows.map((r) => ({
    code: r.code,
    event_naam: r.event_naam,
    datum_start: r.datum_start,
    locatie: r.locatie,
    type_naam: r.type_naam,
    status: r.ingetrokken_op ? 'ingetrokken' : r.gebruikt_op ? 'gebruikt' : 'geldig',
    gebruikt_op: r.gebruikt_op,
  }))
})
