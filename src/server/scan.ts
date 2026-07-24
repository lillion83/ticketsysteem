import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { verifyTicketCode } from '#/lib/ticketcode'

// Het scan-endpoint (fase D). Harde regel 2: de scan is één atomaire UPDATE.
// Rij terug = groen; geen rij = rood, en pas dán ophalen waarom. Nooit eerst
// SELECT en dan UPDATE. Alles org-gescoopt (harde regel 3).

// De zes resultaten uit PLAN §4 / de scanResultaat-enum in het schema.
export type ScanResultaat =
  | 'groen'
  | 'groen_re_entry'
  | 'rood_al_gebruikt'
  | 'rood_ongeldig'
  | 'rood_ingetrokken'
  | 'rood_verkeerd_event'

export type ScanRespons = {
  resultaat: ScanResultaat
  // Alleen gevuld bij rood_al_gebruikt: wanneer het ticket eerder scande.
  gebruikt_op: string | null
}

export const recordScan = createServerFn({ method: 'POST' })
  .validator((data: { eventId: string; code: string }) => {
    if (!data.eventId) throw new Error('eventId ontbreekt')
    if (!data.code.trim()) throw new Error('Geen code')
    return { eventId: data.eventId, code: data.code.trim() }
  })
  .handler(async ({ data }): Promise<ScanRespons> => {
    const { userId, organizationId } = await requireAuth()
    const { eventId, code } = data

    // 1. HMAC eerst — vervalst of verminkt = direct rood, geen DB-touch
    //    (PLAN §3.3 stap 1). De HMAC bindt event_id, dus een ticket van een
    //    ander event faalt hier al en leest als rood_ongeldig.
    if (!verifyTicketCode(eventId, code).valid) {
      return { resultaat: 'rood_ongeldig', gebruikt_op: null }
    }

    // 2. Atomaire markering. De WHERE dekt org + event + niet-ingetrokken +
    //    nog-niet-gebruikt; één rij terug betekent: dit ticket is nu binnen.
    const gemarkeerd = await db
      .update(tickets)
      .set({ gebruikt_op: new Date(), gebruikt_door: userId })
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
      return { resultaat: 'groen', gebruikt_op: null }
    }

    // 3. Geen rij → ophalen waarom. Eén org-gescoopte join.
    const rows = await db
      .select({
        event_id: tickets.event_id,
        gebruikt_op: tickets.gebruikt_op,
        ingetrokken_op: tickets.ingetrokken_op,
        re_entry_toegestaan: events.re_entry_toegestaan,
      })
      .from(tickets)
      .innerJoin(events, eq(tickets.event_id, events.id))
      .where(
        and(
          eq(tickets.code, code),
          eq(tickets.organization_id, organizationId),
        ),
      )
      .limit(1)

    if (rows.length === 0)
      return { resultaat: 'rood_ongeldig', gebruikt_op: null }
    const rij = rows[0]
    if (rij.event_id !== eventId) {
      return { resultaat: 'rood_verkeerd_event', gebruikt_op: null }
    }
    if (rij.ingetrokken_op) {
      return { resultaat: 'rood_ingetrokken', gebruikt_op: null }
    }
    if (rij.gebruikt_op) {
      return rij.re_entry_toegestaan
        ? { resultaat: 'groen_re_entry', gebruikt_op: null }
        : {
            resultaat: 'rood_al_gebruikt',
            gebruikt_op: rij.gebruikt_op.toISOString(),
          }
    }
    // Defensief: hoort onbereikbaar te zijn (dan had stap 2 gemarkeerd).
    return { resultaat: 'rood_ongeldig', gebruikt_op: null }
  })
