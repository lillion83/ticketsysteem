import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  eventAgenda,
  eventSprekers,
  events,
  reserveringen,
  ticketTypes,
} from '#/db/schema'
import { requireContentAccess } from '#/server/scope'

// Het scherm direct ná publiceren (ontwerp D3 / sectie 2a stap 3): "je event
// staat online", deelknoppen, en een checklist met wat de pagina sterker maakt.
//
// De checklist is volledig afgeleid uit het event zelf — geen tabel met
// afvinkbare taken. Wat af is, is af omdat het veld gevuld is; dat kan niet uit
// de pas lopen en vraagt geen migratie.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type EventLiveData = {
  event: { id: string; naam: string; status: string }
  /** Welke verbeteringen al gedaan zijn; de route maakt er de checklist van. */
  gedaan: {
    beschrijving: boolean
    flyer: boolean
    lineup: boolean
    programma: boolean
    tweedeType: boolean
  }
  cijfers: {
    aanvragen: number
    verkocht: number
    capaciteit: number
  }
  /** Publiek gepubliceerde events van de afgelopen zeven dagen, over alle organisaties. */
  eventsDezeWeek: number
}

export const getEventLive = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }): Promise<EventLiveData> => {
    // Zelfde toegangsregel als de rest van de event-inhoud (fase J).
    const { organizationId } = await requireContentAccess(eventId)

    const eventRows = await db
      .select({
        id: events.id,
        naam: events.naam,
        status: events.status,
        beschrijving: events.beschrijving,
        cover: events.cover_afbeelding_url,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
    if (eventRows.length === 0) throw new Error('Event niet gevonden')
    const e = eventRows[0]

    const [typeRows, sprekerRij, agendaRij, aanvraagRij, weekRij] =
      await Promise.all([
        db
          .select({
            aantal_beschikbaar: ticketTypes.aantal_beschikbaar,
            aantal_verkocht: ticketTypes.aantal_verkocht,
          })
          .from(ticketTypes)
          .where(
            and(
              eq(ticketTypes.event_id, eventId),
              eq(ticketTypes.organization_id, organizationId),
            ),
          ),
        db
          .select({ aantal: sql<number>`count(*)` })
          .from(eventSprekers)
          .where(eq(eventSprekers.event_id, eventId)),
        db
          .select({ aantal: sql<number>`count(*)` })
          .from(eventAgenda)
          .where(eq(eventAgenda.event_id, eventId)),
        db
          .select({ aantal: sql<number>`count(*)` })
          .from(reserveringen)
          .where(
            and(
              eq(reserveringen.event_id, eventId),
              eq(reserveringen.organization_id, organizationId),
            ),
          ),
        // Cross-org en zonder org-filter, net als de publieke discovery-tellers:
        // dit is een marktcijfer, geen data van deze organisatie.
        db
          .select({ aantal: sql<number>`count(*)` })
          .from(events)
          .where(
            and(
              eq(events.status, 'actief'),
              gte(events.aangemaakt_op, new Date(Date.now() - WEEK_MS)),
            ),
          ),
      ])

    return {
      event: { id: e.id, naam: e.naam, status: e.status },
      gedaan: {
        beschrijving: Boolean(e.beschrijving?.trim()),
        flyer: Boolean(e.cover?.trim()),
        lineup: Number(sprekerRij[0].aantal) > 0,
        programma: Number(agendaRij[0].aantal) > 0,
        tweedeType: typeRows.length > 1,
      },
      cijfers: {
        aanvragen: Number(aanvraagRij[0].aantal),
        verkocht: typeRows.reduce((s, t) => s + Number(t.aantal_verkocht), 0),
        capaciteit: typeRows.reduce(
          (s, t) => s + Number(t.aantal_beschikbaar),
          0,
        ),
      },
      eventsDezeWeek: Number(weekRij[0].aantal),
    }
  })
