import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { eventCategorie, events } from '#/db/schema'
import { requireAuth } from '#/server/session'

type Categorie = (typeof eventCategorie.enumValues)[number]

// Alle functies scopen op organization_id uit de sessie (harde regel 3).

export const listEvents = createServerFn({ method: 'GET' }).handler(async () => {
  const { organizationId } = await requireAuth()
  return db
    .select()
    .from(events)
    .where(eq(events.organization_id, organizationId))
    .orderBy(desc(events.datum_start))
})

export const getEvent = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .select()
      .from(events)
      .where(
        and(eq(events.id, eventId), eq(events.organization_id, organizationId)),
      )
      .limit(1)
    if (rows.length === 0) throw new Error('Event niet gevonden')
    return rows[0]
  })

export type EventInput = {
  naam: string
  datum_start: string
  datum_eind: string
  locatie: string | null
  re_entry_toegestaan: boolean
  status: string
  // Publieke discovery-velden (optioneel).
  categorie: Categorie | null
  beschrijving: string | null
  cover_afbeelding_url: string | null
}

function parseEventInput(data: EventInput): EventInput {
  if (!data.naam.trim()) throw new Error('Naam is verplicht')
  if (!data.datum_start || !data.datum_eind) {
    throw new Error('Start- en einddatum zijn verplicht')
  }
  if (new Date(data.datum_eind) < new Date(data.datum_start)) {
    throw new Error('Einddatum ligt vóór de startdatum')
  }
  if (data.categorie !== null && !eventCategorie.enumValues.includes(data.categorie)) {
    throw new Error('Ongeldige categorie')
  }
  return data
}

export const createEvent = createServerFn({ method: 'POST' })
  .validator(parseEventInput)
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const [event] = await db
      .insert(events)
      .values({
        organization_id: organizationId,
        naam: data.naam.trim(),
        datum_start: new Date(data.datum_start),
        datum_eind: new Date(data.datum_eind),
        locatie: data.locatie?.trim() || null,
        re_entry_toegestaan: data.re_entry_toegestaan,
        status: data.status,
        categorie: data.categorie,
        beschrijving: data.beschrijving?.trim() || null,
        cover_afbeelding_url: data.cover_afbeelding_url?.trim() || null,
      })
      .returning()
    return event
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .validator((data: EventInput & { id: string }) => {
    if (!data.id) throw new Error('id ontbreekt')
    parseEventInput(data)
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .update(events)
      .set({
        naam: data.naam.trim(),
        datum_start: new Date(data.datum_start),
        datum_eind: new Date(data.datum_eind),
        locatie: data.locatie?.trim() || null,
        re_entry_toegestaan: data.re_entry_toegestaan,
        status: data.status,
        categorie: data.categorie,
        beschrijving: data.beschrijving?.trim() || null,
        cover_afbeelding_url: data.cover_afbeelding_url?.trim() || null,
      })
      .where(
        and(eq(events.id, data.id), eq(events.organization_id, organizationId)),
      )
      .returning()
    if (rows.length === 0) throw new Error('Event niet gevonden')
    return rows[0]
  })
