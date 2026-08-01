import { randomUUID } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import {
  events,
  eventBetaalmethoden,
  organizations,
  reserveringen,
  ticketTypes,
  tickets,
} from '#/db/schema'
import { requireAuth } from '#/server/session'
import { vindKoperUserId } from '#/server/mijnTickets'
import { signTicket } from '#/lib/ticketcode'
import { maakHandmatig } from '#/server/payments/handmatig'
import { formatDateLong, formatTimeRange } from '#/lib/datum'

// Ticketaanvragen (heette in fase G "reserveringen"; de tabel houdt die naam —
// zie Migratieplan §0). Een bezoeker vraagt publiek een ticket aan, de
// organisator registreert de betaling en geeft het ticket uit.
//
// De oude `verwerkReservering` deed drie dingen in één klap: voorraad ophogen,
// tickets maken en de status zetten. Dat is hier opgesplitst in `markeerBetaald`
// en `genereerTickets`, zodat de admin "betaling ontvangen" en "ticket sturen"
// los kan aanbieden. `betaalEnVerstuur` doet beide en is wat de hoofdknop
// aanroept — dat pad is functioneel identiek aan de oude knop.
//
// Er is geen online betaling (harde regel 6): betalen gebeurt buiten het systeem
// om, wij registreren alleen dát het gebeurd is.

const MAX_AANTAL = 10

/** Hoe lang een aanvraag geldig blijft zonder betaling. */
const GELDIG_UREN = 48

export type TicketaanvraagInput = {
  event_id: string
  ticket_type_id: string
  naam: string
  email: string | null
  telefoon: string | null
  aantal: number
  opmerking: string | null
  /**
   * Voorkeur van de bezoeker: 'whatsapp' | 'bank' | 'contant'. Optioneel — de
   * publieke pagina biedt de keuze pas aan als het event betaalmethoden heeft.
   */
  betaalmethode?: string | null
}

// Publieke aanmaak — zonder sessie, zelfde bewuste uitzondering op harde regel 3
// als src/server/publicTicket.ts. We leiden organization_id af uit het event en
// controleren dat het event actief is en het tickettype erbij hoort.
export const createTicketaanvraag = createServerFn({ method: 'POST' })
  .validator((data: TicketaanvraagInput): TicketaanvraagInput => {
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
    const aantal = Math.min(
      Math.max(Math.floor(data.aantal) || 1, 1),
      MAX_AANTAL,
    )

    const eventRows = await db
      .select({
        organization_id: events.organization_id,
        verkoop_actief: events.verkoop_actief,
      })
      .from(events)
      .where(and(eq(events.id, data.event_id), eq(events.status, 'actief')))
      .limit(1)
    if (eventRows.length === 0) throw new Error('Event niet gevonden')
    if (!eventRows[0].verkoop_actief) {
      throw new Error('Dit event verkoopt geen tickets via het platform')
    }
    const organizationId = eventRows[0].organization_id

    const typeRows = await db
      .select({ id: ticketTypes.id })
      .from(ticketTypes)
      .where(
        and(
          eq(ticketTypes.id, data.ticket_type_id),
          eq(ticketTypes.event_id, data.event_id),
        ),
      )
      .limit(1)
    if (typeRows.length === 0) throw new Error('Tickettype niet gevonden')

    const vervalt = new Date(Date.now() + GELDIG_UREN * 60 * 60 * 1000)

    const nieuw = await db
      .insert(reserveringen)
      .values({
        event_id: data.event_id,
        ticket_type_id: data.ticket_type_id,
        organization_id: organizationId,
        naam: data.naam.trim(),
        email: data.email?.trim() || null,
        telefoon: data.telefoon?.trim() || null,
        aantal: String(aantal),
        opmerking: data.opmerking?.trim() || null,
        betaalmethode: data.betaalmethode?.trim() || null,
        vervalt_op: vervalt,
      })
      .returning({ id: reserveringen.id })

    // Alleen het id terug: dat is de onraadbare sleutel van de
    // bevestigingspagina (`/aanvraag/$id`), zelfde patroon als de ticketcode in
    // `t.$code`. Verder lekken we niets over het event of de organisatie.
    return { id: nieuw[0].id }
  })

// --- Bevestigingspagina bezoeker ---

export type PubliekeAanvraag = {
  id: string
  status: string
  naam: string
  aantal: number
  typeNaam: string
  prijsSrd: number
  totaalSrd: number
  vervaltOp: string | null
  eventId: string
  eventTitel: string
  dateLong: string
  timeRange: string
  locatie: string | null
  organisator: string
  /** Alleen voor de WhatsApp-knop; leeg = geen knop, alleen de instructietekst. */
  organisatorTelefoon: string | null
  /** Uit de handmatige provider: de tekst van de organisator, of de standaard. */
  instructies: string
  betaalmethoden: Array<'whatsapp' | 'bank' | 'contant' | 'online'>
}

/**
 * Wat de bezoeker ziet nadat hij een ticket heeft aangevraagd. Publiek en
 * zonder sessie: het aanvraag-uuid is de sleutel, precies zoals de ticketcode
 * dat is in `t.$code`. Zelfde bewuste uitzondering op harde regel 3 als
 * publicTicket.ts — de organisatie komt uit de aanvraag zelf.
 *
 * Alleen wat de bezoeker nodig heeft om te betalen. Nadrukkelijk niet:
 * e-mailadres, telefoonnummer of opmerking van de aanvrager, en geen
 * betaalreferentie — die staan wel in de rij maar horen niet op een pagina die
 * met een link te delen is.
 */
export const getPubliekeAanvraag = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }): Promise<PubliekeAanvraag> => {
    const rows = await db
      .select({
        id: reserveringen.id,
        status: reserveringen.status,
        naam: reserveringen.naam,
        aantal: reserveringen.aantal,
        vervalt_op: reserveringen.vervalt_op,
        type_naam: ticketTypes.naam,
        prijs_srd: ticketTypes.prijs_srd,
        event_id: events.id,
        event_naam: events.naam,
        datum_start: events.datum_start,
        datum_eind: events.datum_eind,
        locatie: events.locatie,
        betaalinstructies: events.betaalinstructies,
        organisator: organizations.naam,
        organisator_telefoon: organizations.telefoon,
      })
      .from(reserveringen)
      .innerJoin(ticketTypes, eq(reserveringen.ticket_type_id, ticketTypes.id))
      .innerJoin(events, eq(reserveringen.event_id, events.id))
      .innerJoin(
        organizations,
        eq(reserveringen.organization_id, organizations.id),
      )
      .where(eq(reserveringen.id, id))
      .limit(1)
    if (rows.length === 0) throw new Error('Aanvraag niet gevonden')
    const r = rows[0]

    const methodeRows = await db
      .select({ soort: eventBetaalmethoden.soort })
      .from(eventBetaalmethoden)
      .where(
        and(
          eq(eventBetaalmethoden.event_id, r.event_id),
          eq(eventBetaalmethoden.actief, true),
        ),
      )
      .orderBy(eventBetaalmethoden.volgorde)

    const aantal = Math.max(Number(r.aantal), 1)
    const prijsSrd = Number(r.prijs_srd)

    // Via de provider-laag (stap 7) in plaats van rechtstreeks uit het event:
    // als hier ooit een echte provider bij komt, is dit de plek waar zijn
    // `start()` een redirect teruggeeft in plaats van een instructietekst.
    const start = await maakHandmatig(r.betaalinstructies).start({
      aanvraagId: r.id,
      bedragSrd: String(prijsSrd * aantal),
      omschrijving: `${aantal}× ${r.type_naam} — ${r.event_naam}`,
    })

    return {
      id: r.id,
      status: r.status,
      naam: r.naam,
      aantal,
      typeNaam: r.type_naam,
      prijsSrd,
      totaalSrd: prijsSrd * aantal,
      vervaltOp: r.vervalt_op ? r.vervalt_op.toISOString() : null,
      eventId: r.event_id,
      eventTitel: r.event_naam,
      dateLong: formatDateLong(r.datum_start),
      timeRange: formatTimeRange(r.datum_start, r.datum_eind),
      locatie: r.locatie,
      organisator: r.organisator,
      organisatorTelefoon: r.organisator_telefoon,
      instructies: start.soort === 'handmatig' ? start.instructies : '',
      betaalmethoden: methodeRows.map((m) => m.soort),
    }
  })

// --- Admin (auth-gescoopt) ---

export const listTicketaanvragen = createServerFn({ method: 'GET' })
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
        betaald_op: reserveringen.betaald_op,
        betaalmethode: reserveringen.betaalmethode,
        betaalreferentie: reserveringen.betaalreferentie,
        vervalt_op: reserveringen.vervalt_op,
        afgehandeld_op: reserveringen.afgehandeld_op,
        type_naam: ticketTypes.naam,
        prijs_srd: ticketTypes.prijs_srd,
        ticket_type_id: reserveringen.ticket_type_id,
      })
      .from(reserveringen)
      .innerJoin(ticketTypes, eq(reserveringen.ticket_type_id, ticketTypes.id))
      .where(
        and(
          eq(reserveringen.event_id, eventId),
          eq(reserveringen.organization_id, organizationId),
        ),
      )
      .orderBy(desc(reserveringen.aangemaakt_op))
  })

/**
 * Stap 1: registreert dat het geld binnen is. Raakt geen voorraad en maakt geen
 * tickets — dat is `genereerTickets`. Alleen een aanvraag met status 'nieuw'
 * mag hierheen; de WHERE bewaakt dat, dus dubbelklikken levert een fout in
 * plaats van een tweede statusmutatie.
 */
export const markeerBetaald = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id: string
      betaalmethode?: string | null
      betaalreferentie?: string | null
    }) => {
      if (!data.id) throw new Error('id ontbreekt')
      return data
    },
  )
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .update(reserveringen)
      .set({
        status: 'betaald',
        betaald_op: new Date(),
        ...(data.betaalmethode ? { betaalmethode: data.betaalmethode } : {}),
        ...(data.betaalreferentie
          ? { betaalreferentie: data.betaalreferentie }
          : {}),
      })
      .where(
        and(
          eq(reserveringen.id, data.id),
          eq(reserveringen.organization_id, organizationId),
          eq(reserveringen.status, 'nieuw'),
        ),
      )
      .returning({ id: reserveringen.id })
    if (rows.length === 0) {
      throw new Error('Aanvraag niet gevonden of al betaald gemeld')
    }
    return { ok: true }
  })

/**
 * De transactie uit de oude `verwerkReservering`, ongewijzigd van opbouw: hoogt
 * de voorraad atomair op met `aantal` (geen rij terug = uitverkocht), geeft dat
 * aantal tickets uit en zet de aanvraag op 'afgehandeld'.
 *
 * `sta_nieuw_toe` bepaalt of een nog niet als betaald gemelde aanvraag mag
 * doorschieten. Dat is wat `betaalEnVerstuur` gebruikt en wat de oude knop deed.
 */
async function genereerTicketsIntern(
  id: string,
  organizationId: string,
  userId: string,
  staNieuwToe: boolean,
) {
  return db.transaction(async (tx) => {
    const toegestaneStatussen = staNieuwToe
      ? (['nieuw', 'betaald'] as const)
      : (['betaald'] as const)

    const rows = await tx
      .select()
      .from(reserveringen)
      .where(
        and(
          eq(reserveringen.id, id),
          eq(reserveringen.organization_id, organizationId),
          inArray(reserveringen.status, [...toegestaneStatussen]),
        ),
      )
      .limit(1)
    if (rows.length === 0) {
      throw new Error('Aanvraag niet gevonden of al afgehandeld')
    }
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
      throw new Error('Niet genoeg voorraad voor deze aanvraag')
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
        // Vaste waarde uit src/lib/verkoopkanaal.ts. Bestaande rijen dragen nog
        // 'reservering'; die mappen in de UI op hetzelfde label.
        verkoopkanaal: 'online',
      }
    })
    const ingevoegd = await tx
      .insert(tickets)
      .values(nieuweTickets)
      .returning({ id: tickets.id })

    await tx
      .update(reserveringen)
      .set({
        status: 'afgehandeld',
        afgehandeld_op: new Date(),
        // Bij het gecombineerde pad is 'betaald' overgeslagen; leg het moment
        // alsnog vast zodat de tijdlijn klopt.
        ...(res.betaald_op ? {} : { betaald_op: new Date() }),
      })
      .where(eq(reserveringen.id, res.id))

    return { ticketIds: ingevoegd.map((t) => t.id) }
  })
}

/** Stap 2 los: alleen voor aanvragen die al op 'betaald' staan. */
export const genereerTickets = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { userId, organizationId } = await requireAuth()
    return genereerTicketsIntern(id, organizationId, userId, false)
  })

/**
 * Stap 1 + 2 in één: de hoofdknop in de admin. Gedraagt zich identiek aan de
 * oude `verwerkReservering`.
 */
export const betaalEnVerstuur = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { userId, organizationId } = await requireAuth()
    return genereerTicketsIntern(id, organizationId, userId, true)
  })

/**
 * Trekt een aanvraag in. Zet status 'geannuleerd' (de oude code schreef
 * 'afgewezen'; die waarde blijft bestaan voor historische rijen). Alleen
 * aanvragen waarvoor nog geen tickets zijn uitgegeven mogen hierheen — anders
 * zou de voorraad niet meer kloppen.
 */
export const annuleerTicketaanvraag = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { organizationId } = await requireAuth()
    const rows = await db
      .update(reserveringen)
      .set({ status: 'geannuleerd', afgehandeld_op: new Date() })
      .where(
        and(
          eq(reserveringen.id, id),
          eq(reserveringen.organization_id, organizationId),
          inArray(reserveringen.status, ['nieuw', 'betaald']),
        ),
      )
      .returning({ id: reserveringen.id })
    if (rows.length === 0) {
      throw new Error('Aanvraag niet gevonden of al afgehandeld')
    }
    return { ok: true }
  })

/**
 * De tickets die bij een afgehandelde aanvraag horen.
 *
 * `tickets` heeft bewust geen `reservering_id` — die kolom toevoegen zou een
 * migratie op de ticket-tabel betekenen, en die tabel blijft ongemoeid. In plaats
 * daarvan matchen we op wat de aanvraag in het ticket heeft achtergelaten: zelfde
 * event, zelfde tickettype, zelfde koper en een verkoopkanaal dat op een online
 * aanvraag wijst ('online', of 'reservering' voor rijen van vóór migratie 0012).
 *
 * Dat is een benadering. Twee aanvragen van dezelfde persoon voor hetzelfde
 * tickettype vallen samen — daarom is dit alleen goed genoeg om leverknoppen bij
 * te tonen, en nooit om iets op te muteren.
 */
export const ticketsVoorAanvraag = createServerFn({ method: 'GET' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { organizationId } = await requireAuth()

    const rows = await db
      .select()
      .from(reserveringen)
      .where(
        and(
          eq(reserveringen.id, id),
          eq(reserveringen.organization_id, organizationId),
        ),
      )
      .limit(1)
    if (rows.length === 0) throw new Error('Aanvraag niet gevonden')
    const res = rows[0]

    const koperFilter = res.email
      ? eq(tickets.koper_email, res.email)
      : res.telefoon
        ? eq(tickets.koper_telefoon, res.telefoon)
        : eq(tickets.koper_naam, res.naam)

    return db
      .select({
        id: tickets.id,
        code: tickets.code,
        koper_naam: tickets.koper_naam,
        koper_telefoon: tickets.koper_telefoon,
        koper_email: tickets.koper_email,
        geleverd_via: tickets.geleverd_via,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.organization_id, organizationId),
          eq(tickets.event_id, res.event_id),
          eq(tickets.ticket_type_id, res.ticket_type_id),
          inArray(tickets.verkoopkanaal, ['online', 'reservering']),
          koperFilter,
        ),
      )
      .orderBy(desc(tickets.verkocht_op))
      .limit(Math.max(Number(res.aantal), 1))
  })

// --- Betaalmethoden per event ---

export type Betaalmethode = {
  soort: 'whatsapp' | 'bank' | 'contant' | 'online'
  provider: string | null
  config: string | null
}

/**
 * Publiek: de bezoeker moet ná zijn aanvraag zien hoe hij kan betalen. Zelfde
 * uitzondering op harde regel 3 als publicTicket.ts — org afgeleid uit het event.
 */
export const listBetaalmethoden = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    return db
      .select({
        soort: eventBetaalmethoden.soort,
        provider: eventBetaalmethoden.provider,
        config: eventBetaalmethoden.config,
        volgorde: eventBetaalmethoden.volgorde,
      })
      .from(eventBetaalmethoden)
      .where(
        and(
          eq(eventBetaalmethoden.event_id, eventId),
          eq(eventBetaalmethoden.actief, true),
        ),
      )
      .orderBy(eventBetaalmethoden.volgorde)
  })

/**
 * Admin: vervangt de hele set voor dit event. Volledig vervangen in plaats van
 * per rij bijwerken houdt de volgorde en de "uitgevinkt = weg"-semantiek van het
 * ontwerp simpel; het gaat om hooguit een handvol rijen.
 */
export const setBetaalmethoden = createServerFn({ method: 'POST' })
  .validator((data: { eventId: string; methoden: Array<Betaalmethode> }) => {
    if (!data.eventId) throw new Error('eventId ontbreekt')
    for (const m of data.methoden) {
      if (!['whatsapp', 'bank', 'contant', 'online'].includes(m.soort)) {
        throw new Error('Onbekende betaalmethode')
      }
      if (m.soort === 'online') {
        // Harde regel 6: geen online betaling. De kolom bestaat alleen zodat
        // Uni5Pay/Mope er later bij kunnen zonder enum-migratie.
        throw new Error('Online betalen is nog niet beschikbaar')
      }
    }
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()

    const eventRows = await db
      .select({ id: events.id })
      .from(events)
      .where(
        and(
          eq(events.id, data.eventId),
          eq(events.organization_id, organizationId),
        ),
      )
      .limit(1)
    if (eventRows.length === 0) throw new Error('Event niet gevonden')

    await db.transaction(async (tx) => {
      await tx
        .delete(eventBetaalmethoden)
        .where(
          and(
            eq(eventBetaalmethoden.event_id, data.eventId),
            eq(eventBetaalmethoden.organization_id, organizationId),
          ),
        )
      if (data.methoden.length === 0) return
      await tx.insert(eventBetaalmethoden).values(
        data.methoden.map((m, i) => ({
          event_id: data.eventId,
          organization_id: organizationId,
          soort: m.soort,
          provider: m.provider,
          config: m.config,
          actief: true,
          volgorde: String(i),
        })),
      )
    })

    return { ok: true }
  })
