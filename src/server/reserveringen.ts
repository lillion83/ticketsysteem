import { randomUUID } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, reserveringen, ticketTypes, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { vindKoperUserId } from '#/server/mijnTickets'
import { signTicket } from '#/lib/ticketcode'

// Reserveringsbrug (fase G). Een bezoeker vraagt publiek een ticket aan; de
// organisator verwerkt dat in de admin tot een echt ticket via de bestaande
// uitgifte. Geen online betaling (harde regel 6).

const MAX_AANTAL = 10

export type ReserveringInput = {
  event_id: string
  ticket_type_id: string
  naam: string
  email: string | null
  telefoon: string | null
  aantal: number
  opmerking: string | null
}

// Publieke aanmaak — zonder sessie, zelfde bewuste uitzondering op harde regel 3
// als src/server/publicTicket.ts. We leiden organization_id af uit het event en
// controleren dat het event actief is en het tickettype erbij hoort.
export const createReservering = createServerFn({ method: 'POST' })
  .validator((data: ReserveringInput): ReserveringInput => {
    if (!data.naam.trim()) throw new Error('Naam is verplicht')
    if (!data.email?.trim() && !data.telefoon?.trim()) {
      throw new Error('Vul een e-mailadres of telefoonnummer in')
    }
    if (data.naam.length > 200 || (data.opmerking?.length ?? 0) > 1000) {
      throw new Error('Invoer te lang')
    }
    return data
  })
  .handler(async ({ data }) => {
    const aantal = Math.min(Math.max(Math.floor(data.aantal) || 1, 1), MAX_AANTAL)

    const eventRows = await db
      .select({ organization_id: events.organization_id })
      .from(events)
      .where(and(eq(events.id, data.event_id), eq(events.status, 'actief')))
      .limit(1)
    if (eventRows.length === 0) throw new Error('Event niet gevonden')
    const organizationId = eventRows[0].organization_id

    const typeRows = await db
      .select({ id: ticketTypes.id })
      .from(ticketTypes)
      .where(and(eq(ticketTypes.id, data.ticket_type_id), eq(ticketTypes.event_id, data.event_id)))
      .limit(1)
    if (typeRows.length === 0) throw new Error('Tickettype niet gevonden')

    await db.insert(reserveringen).values({
      event_id: data.event_id,
      ticket_type_id: data.ticket_type_id,
      organization_id: organizationId,
      naam: data.naam.trim(),
      email: data.email?.trim() || null,
      telefoon: data.telefoon?.trim() || null,
      aantal: String(aantal),
      opmerking: data.opmerking?.trim() || null,
    })

    // Bewust minimale respons: niets teruglekken over het event/de organisatie.
    return { ok: true }
  })

// --- Admin (auth-gescoopt) ---

export const listReserveringen = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()
    return db
      .select({
        id: reserveringen.id,
        naam: reserveringen.naam,
        email: reserveringen.email,
        telefoon: reserveringen.telefoon,
        aantal: reserveringen.aantal,
        opmerking: reserveringen.opmerking,
        status: reserveringen.status,
        aangemaakt_op: reserveringen.aangemaakt_op,
        type_naam: ticketTypes.naam,
        ticket_type_id: reserveringen.ticket_type_id,
      })
      .from(reserveringen)
      .innerJoin(ticketTypes, eq(reserveringen.ticket_type_id, ticketTypes.id))
      .where(and(eq(reserveringen.event_id, eventId), eq(reserveringen.organization_id, organizationId)))
      .orderBy(desc(reserveringen.aangemaakt_op))
  })

// Verwerkt een reservering tot echte tickets: hoogt de voorraad atomair op met
// `aantal`, geeft dat aantal tickets uit (zelfde code-opbouw als issueTicket) en
// markeert de reservering afgehandeld — alles in één transactie.
export const verwerkReservering = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { userId, organizationId } = await requireAuth()

    return db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(reserveringen)
        .where(
          and(
            eq(reserveringen.id, id),
            eq(reserveringen.organization_id, organizationId),
            eq(reserveringen.status, 'nieuw'),
          ),
        )
        .limit(1)
      if (rows.length === 0) throw new Error('Reservering niet gevonden of al verwerkt')
      const res = rows[0]
      const aantal = Math.max(Number(res.aantal), 1)

      // Voorraad atomair ophogen én bewaken (geen rij terug = uitverkocht).
      const typeRows = await tx
        .update(ticketTypes)
        .set({ aantal_verkocht: sql`${ticketTypes.aantal_verkocht} + ${aantal}` })
        .where(
          and(
            eq(ticketTypes.id, res.ticket_type_id),
            eq(ticketTypes.event_id, res.event_id),
            eq(ticketTypes.organization_id, organizationId),
            sql`${ticketTypes.aantal_verkocht} + ${aantal} <= ${ticketTypes.aantal_beschikbaar}`,
          ),
        )
        .returning({ id: ticketTypes.id })
      if (typeRows.length === 0) {
        throw new Error('Niet genoeg voorraad voor deze reservering')
      }

      // Koppel aan een bestaand koper-account (fase K) als dat er is.
      const koperUserId = res.email ? await vindKoperUserId(res.email) : null
      const nieuweTickets = Array.from({ length: aantal }, () => {
        const ticketId = randomUUID()
        return {
          id: ticketId,
          event_id: res.event_id,
          ticket_type_id: res.ticket_type_id,
          organization_id: organizationId,
          code: signTicket(res.event_id, ticketId),
          koper_naam: res.naam,
          koper_telefoon: res.telefoon,
          koper_email: res.email,
          koper_user_id: koperUserId,
          verkocht_op: new Date(),
          verkocht_door_user_id: userId,
          verkoopkanaal: 'reservering',
        }
      })
      const ingevoegd = await tx.insert(tickets).values(nieuweTickets).returning({ id: tickets.id })

      await tx
        .update(reserveringen)
        .set({ status: 'afgehandeld', afgehandeld_op: new Date() })
        .where(eq(reserveringen.id, res.id))

      return { ticketIds: ingevoegd.map((t) => t.id) }
    })
  })

export const afwijzenReservering = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .update(reserveringen)
      .set({ status: 'afgewezen', afgehandeld_op: new Date() })
      .where(
        and(
          eq(reserveringen.id, id),
          eq(reserveringen.organization_id, organizationId),
          eq(reserveringen.status, 'nieuw'),
        ),
      )
      .returning({ id: reserveringen.id })
    if (rows.length === 0) throw new Error('Reservering niet gevonden of al verwerkt')
    return { ok: true }
  })
