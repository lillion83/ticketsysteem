import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { eventCategorie, eventSprekers, events, ticketTypes } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { requireContentAccess } from '#/server/scope'

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
    const { organizationId } = await requireContentAccess(eventId)
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
  // Afmetingen van de cover (uit de upload). null = onbekend, banner snijdt bij.
  cover_breedte: number | null
  cover_hoogte: number | null
  // Aangeklikt focuspunt in procenten; null = midden.
  cover_focus_x: number | null
  cover_focus_y: number | null
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
  // Focuspunt komt uit een klik in de browser: afdwingen dat het 0–100 blijft.
  const inBereik = (n: number | null) =>
    n === null || Number.isNaN(n) ? null : Math.min(100, Math.max(0, Math.round(n)))
  return {
    ...data,
    cover_focus_x: inBereik(data.cover_focus_x),
    cover_focus_y: inBereik(data.cover_focus_y),
  }
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
        cover_breedte: data.cover_breedte,
        cover_hoogte: data.cover_hoogte,
        cover_focus_x: data.cover_focus_x,
        cover_focus_y: data.cover_focus_y,
      })
      .returning()
    return event
  })

// Publiceer-flow (src/routes/events.new.tsx): maakt in één transactie het event,
// zijn tickettypes en zijn line-up aan. status = 'actief' (publiceren) of
// 'concept' (opslaan als concept). Vereist een ingelogde organisator.
// De valuta/USD-prijs, features en vroegboekkorting uit het formulier hebben
// (nog) geen kolom en worden bewust niet opgeslagen; inkoopprijs valt op 0 terug.
export type FullEventInput = {
  naam: string
  categorie: Categorie | null
  beschrijving: string | null
  datum_start: string
  datum_eind: string
  locatie: string | null
  cover_afbeelding_url: string | null
  cover_breedte: number | null
  cover_hoogte: number | null
  cover_focus_x: number | null
  cover_focus_y: number | null
  status: 'concept' | 'actief'
  tiers: Array<{ naam: string; prijs_srd: string; aantal_beschikbaar: string; features: Array<string> }>
  sprekers: Array<{ naam: string; rol: string | null }>
}

function parseFullEventInput(data: FullEventInput): FullEventInput {
  parseEventInput({
    naam: data.naam,
    datum_start: data.datum_start,
    datum_eind: data.datum_eind,
    locatie: data.locatie,
    re_entry_toegestaan: false,
    status: data.status,
    categorie: data.categorie,
    beschrijving: data.beschrijving,
    cover_afbeelding_url: data.cover_afbeelding_url,
    cover_breedte: data.cover_breedte,
    cover_hoogte: data.cover_hoogte,
    cover_focus_x: data.cover_focus_x,
    cover_focus_y: data.cover_focus_y,
  })
  // Alleen tiers met een naam tellen mee; hun prijs en aantal moeten geldig zijn.
  const tiers = data.tiers.filter((t) => t.naam.trim())
  for (const t of tiers) {
    for (const [veld, waarde] of [
      ['prijs', t.prijs_srd],
      ['aantal beschikbaar', t.aantal_beschikbaar],
    ] as const) {
      if (waarde === '' || Number.isNaN(Number(waarde)) || Number(waarde) < 0) {
        throw new Error(`Ongeldige waarde voor ${veld} bij tier "${t.naam}"`)
      }
    }
  }
  return { ...data, tiers, sprekers: data.sprekers.filter((s) => s.naam.trim()) }
}

export const createFullEvent = createServerFn({ method: 'POST' })
  .validator(parseFullEventInput)
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    return db.transaction(async (tx) => {
      const [event] = await tx
        .insert(events)
        .values({
          organization_id: organizationId,
          naam: data.naam.trim(),
          datum_start: new Date(data.datum_start),
          datum_eind: new Date(data.datum_eind),
          locatie: data.locatie?.trim() || null,
          re_entry_toegestaan: false,
          status: data.status,
          categorie: data.categorie,
          beschrijving: data.beschrijving?.trim() || null,
          cover_afbeelding_url: data.cover_afbeelding_url?.trim() || null,
          cover_breedte: data.cover_breedte,
          cover_hoogte: data.cover_hoogte,
          cover_focus_x: data.cover_focus_x,
          cover_focus_y: data.cover_focus_y,
        })
        .returning()

      if (data.tiers.length > 0) {
        await tx.insert(ticketTypes).values(
          data.tiers.map((t) => ({
            event_id: event.id,
            organization_id: organizationId,
            naam: t.naam.trim(),
            prijs_srd: t.prijs_srd,
            inkoopprijs_srd: '0',
            aantal_beschikbaar: t.aantal_beschikbaar,
            features: t.features.map((f) => f.trim()).filter(Boolean),
          })),
        )
      }

      if (data.sprekers.length > 0) {
        await tx.insert(eventSprekers).values(
          data.sprekers.map((s, i) => ({
            event_id: event.id,
            organization_id: organizationId,
            naam: s.naam.trim(),
            rol: s.rol?.trim() || null,
            volgorde: String(i),
          })),
        )
      }

      return { id: event.id, status: event.status }
    })
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .validator((data: EventInput & { id: string }) => {
    if (!data.id) throw new Error('id ontbreekt')
    parseEventInput(data)
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireContentAccess(data.id)
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
        cover_breedte: data.cover_breedte,
        cover_hoogte: data.cover_hoogte,
        cover_focus_x: data.cover_focus_x,
        cover_focus_y: data.cover_focus_y,
      })
      .where(
        and(eq(events.id, data.id), eq(events.organization_id, organizationId)),
      )
      .returning()
    if (rows.length === 0) throw new Error('Event niet gevonden')
    return rows[0]
  })
