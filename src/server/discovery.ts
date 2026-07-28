import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  eventAgenda,
  eventFaq,
  eventSprekers,
  events,
  organizations,
  ticketTypes,
} from '#/db/schema'
import { formatDateLine, formatDateLong, formatTimeRange } from '#/lib/datum'

// Publieke discovery-lezers (PLAN fase 2). Zelfde bewuste uitzondering op harde
// regel 3 als src/server/publicTicket.ts: hier is geen sessie en dus geen
// organization_id om op te filteren — de etalage toont events van álle
// organisaties. We filteren in plaats daarvan op `status = 'actief'`, zodat
// concepten en afgelopen events nooit publiek lekken.

const PUBLIEK = 'actief'

export type PublicEventCard = {
  id: string
  categorie: string | null
  // Geüploade cover; null = de categorie-placeholder uit `coverStyle`.
  cover: string | null
  titel: string
  dateLine: string
  // ISO-startdatum, zodat de client op datum kan filteren en sorteren.
  datumStart: string
  locatie: string | null
  prijsVanafSrd: number | null
  aanmeldingen: number
}

// Aggregatie van ticket_types per event: laagste SRD-prijs ("vanaf") en totaal
// verkocht (aanmeldingen). In JS omdat de lijst klein blijft (< 200 events).
function aggregateTypes(rows: Array<{ event_id: string; prijs_srd: string; aantal_verkocht: string }>) {
  const perEvent = new Map<string, { minSrd: number | null; verkocht: number }>()
  for (const r of rows) {
    const huidig = perEvent.get(r.event_id) ?? { minSrd: null, verkocht: 0 }
    const srd = Number(r.prijs_srd)
    huidig.minSrd = huidig.minSrd === null ? srd : Math.min(huidig.minSrd, srd)
    huidig.verkocht += Number(r.aantal_verkocht)
    perEvent.set(r.event_id, huidig)
  }
  return perEvent
}

export const listPublicEvents = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<PublicEventCard>> => {
  const eventRows = await db
    .select()
    .from(events)
    .where(eq(events.status, PUBLIEK))
    .orderBy(asc(events.datum_start))

  const ids = eventRows.map((e) => e.id)
  const typeRows = ids.length
    ? await db
        .select({
          event_id: ticketTypes.event_id,
          prijs_srd: ticketTypes.prijs_srd,
          aantal_verkocht: ticketTypes.aantal_verkocht,
        })
        .from(ticketTypes)
        .where(inArray(ticketTypes.event_id, ids))
    : []

  const agg = aggregateTypes(typeRows)

  return eventRows.map((e) => {
    const a = agg.get(e.id)
    return {
      id: e.id,
      categorie: e.categorie,
      cover: e.cover_afbeelding_url,
      titel: e.naam,
      dateLine: formatDateLine(e.datum_start),
      datumStart: e.datum_start.toISOString(),
      locatie: e.locatie,
      prijsVanafSrd: a?.minSrd ?? null,
      aanmeldingen: a?.verkocht ?? 0,
    }
  })
})

export type PublicEventDetail = {
  id: string
  titel: string
  dateLocationLine: string
  dateLong: string
  timeRange: string
  locatie: string | null
  categorie: string | null
  cover: string | null
  // Afmetingen van de cover; null = onbekend, de banner snijdt dan bij.
  coverBreedte: number | null
  coverHoogte: number | null
  organisator: string
  prijsVanafSrd: number | null
  paragrafen: Array<string>
  sprekers: Array<{ id: string; naam: string; rol: string | null; avatarUrl: string | null }>
  agenda: Array<{ id: string; tijd: string; titel: string; subtitel: string | null; beschrijving: string | null }>
  faqs: Array<{ id: string; vraag: string; antwoord: string | null }>
  tickets: Array<{
    id: string
    naam: string
    prijsSrd: number
    aantalBeschikbaar: number
    features: Array<string>
  }>
}

export const getPublicEvent = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }): Promise<PublicEventDetail> => {
    const rows = await db
      .select({
        id: events.id,
        naam: events.naam,
        datum_start: events.datum_start,
        datum_eind: events.datum_eind,
        locatie: events.locatie,
        categorie: events.categorie,
        cover_afbeelding_url: events.cover_afbeelding_url,
        cover_breedte: events.cover_breedte,
        cover_hoogte: events.cover_hoogte,
        beschrijving: events.beschrijving,
        organisator: organizations.naam,
      })
      .from(events)
      .innerJoin(organizations, eq(events.organization_id, organizations.id))
      .where(and(eq(events.id, eventId), eq(events.status, PUBLIEK)))
      .limit(1)

    if (rows.length === 0) throw new Error('Event niet gevonden')
    const e = rows[0]

    const [typeRows, sprekerRows, agendaRows, faqRows] = await Promise.all([
      db.select().from(ticketTypes).where(eq(ticketTypes.event_id, eventId)),
      db.select().from(eventSprekers).where(eq(eventSprekers.event_id, eventId)).orderBy(asc(eventSprekers.volgorde)),
      db.select().from(eventAgenda).where(eq(eventAgenda.event_id, eventId)).orderBy(asc(eventAgenda.volgorde)),
      db.select().from(eventFaq).where(eq(eventFaq.event_id, eventId)).orderBy(asc(eventFaq.volgorde)),
    ])

    const prijzenSrd = typeRows.map((t) => Number(t.prijs_srd))
    const prijsVanafSrd = prijzenSrd.length ? Math.min(...prijzenSrd) : null

    return {
      id: e.id,
      titel: e.naam,
      dateLocationLine: `${formatDateLine(e.datum_start)}${e.locatie ? ` · ${e.locatie}` : ''}`,
      dateLong: formatDateLong(e.datum_start),
      timeRange: formatTimeRange(e.datum_start, e.datum_eind),
      locatie: e.locatie,
      categorie: e.categorie,
      cover: e.cover_afbeelding_url,
      coverBreedte: e.cover_breedte,
      coverHoogte: e.cover_hoogte,
      organisator: e.organisator,
      prijsVanafSrd,
      paragrafen: (e.beschrijving ?? '')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean),
      sprekers: sprekerRows.map((s) => ({ id: s.id, naam: s.naam, rol: s.rol, avatarUrl: s.avatar_url })),
      agenda: agendaRows.map((a) => ({
        id: a.id,
        tijd: a.tijd,
        titel: a.titel,
        subtitel: a.subtitel,
        beschrijving: a.beschrijving,
      })),
      faqs: faqRows.map((f) => ({ id: f.id, vraag: f.vraag, antwoord: f.antwoord })),
      tickets: typeRows.map((t) => ({
        id: t.id,
        naam: t.naam,
        prijsSrd: Number(t.prijs_srd),
        aantalBeschikbaar: Number(t.aantal_beschikbaar),
        features: t.features ?? [],
      })),
    }
  })
