import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, ticketTypes } from '#/db/schema'
import { requireAuth } from '#/server/session'

async function assertEventInOrg(eventId: string, organizationId: string) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(eq(events.id, eventId), eq(events.organization_id, organizationId)),
    )
    .limit(1)
  if (rows.length === 0) throw new Error('Event niet gevonden')
}

export const listTicketTypes = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()
    return db
      .select()
      .from(ticketTypes)
      .where(
        and(
          eq(ticketTypes.event_id, eventId),
          eq(ticketTypes.organization_id, organizationId),
        ),
      )
  })

export type TicketTypeInput = {
  event_id: string
  naam: string
  prijs_srd: string
  inkoopprijs_srd: string
  aantal_beschikbaar: string
  features: Array<string>
}

function parseTicketTypeInput(data: TicketTypeInput): TicketTypeInput {
  if (!data.naam.trim()) throw new Error('Naam is verplicht')
  for (const [veld, waarde] of [
    ['prijs', data.prijs_srd],
    ['inkoopprijs', data.inkoopprijs_srd],
    ['aantal beschikbaar', data.aantal_beschikbaar],
  ] as const) {
    if (waarde === '' || Number.isNaN(Number(waarde)) || Number(waarde) < 0) {
      throw new Error(`Ongeldige waarde voor ${veld}`)
    }
  }
  return data
}

// Normaliseert de features tot een schone string-array.
function cleanFeatures(features: Array<string>): Array<string> {
  return features.map((f) => f.trim()).filter(Boolean)
}

export const createTicketType = createServerFn({ method: 'POST' })
  .validator(parseTicketTypeInput)
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    await assertEventInOrg(data.event_id, organizationId)
    const [type] = await db
      .insert(ticketTypes)
      .values({
        event_id: data.event_id,
        organization_id: organizationId,
        naam: data.naam.trim(),
        prijs_srd: data.prijs_srd,
        inkoopprijs_srd: data.inkoopprijs_srd,
        aantal_beschikbaar: data.aantal_beschikbaar,
        features: cleanFeatures(data.features),
      })
      .returning()
    return type
  })

export const updateTicketType = createServerFn({ method: 'POST' })
  .validator((data: TicketTypeInput & { id: string }) => {
    if (!data.id) throw new Error('id ontbreekt')
    parseTicketTypeInput(data)
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .update(ticketTypes)
      .set({
        naam: data.naam.trim(),
        prijs_srd: data.prijs_srd,
        inkoopprijs_srd: data.inkoopprijs_srd,
        aantal_beschikbaar: data.aantal_beschikbaar,
        features: cleanFeatures(data.features),
      })
      .where(
        and(
          eq(ticketTypes.id, data.id),
          eq(ticketTypes.organization_id, organizationId),
        ),
      )
      .returning()
    if (rows.length === 0) throw new Error('Tickettype niet gevonden')
    return rows[0]
  })
