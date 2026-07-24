import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, ticketTypes, tickets } from '#/db/schema'
import { verifyTicketCode } from '#/lib/ticketcode'
import { qrSvg } from '#/lib/qr'

// De publieke ticketpagina (PLAN §3.6). Bewuste uitzondering op harde regel 3:
// hier is geen sessie en dus geen organization_id om op te filteren. De
// ondertekende code ís het toegangsbewijs. We controleren daarom wél dat het
// ticket bij de organisatie van zijn event hoort, zodat de scoping-invariant
// zichtbaar blijft en een gekruiste rij nooit stilzwijgend doorkomt.

export type PublicTicketStatus = 'geldig' | 'gebruikt' | 'ingetrokken'

export type PublicTicket = {
  code: string
  koper_naam: string | null
  type_naam: string
  event_naam: string
  datum_start: Date
  locatie: string | null
  status: PublicTicketStatus
  gebruikt_op: Date | null
}

/** Eén foutmelding voor alles: onbekend, vervalst en verkeerd geformatteerd. */
export const TICKET_NIET_GEVONDEN = 'Ticket niet gevonden'

/**
 * Zoekt en verifieert een ticket op zijn publieke code. Gedeeld door de
 * ticketpagina en de qr-route.
 *
 * `createServerOnlyFn` is hier geen sierlaag: dit is een gewone export, en de
 * ticketpagina importeert deze module. Zonder die wikkel belandt de functie —
 * en via verifyTicketCode dus de crypto-module en Buffer — in de client-bundel.
 * Die crasht dan met "Buffer is not defined", React hydrateert niet meer, en
 * elk formulier in de app valt terug op een gewone HTML-submit.
 */
export const laadPublicTicket = createServerOnlyFn(async function laden(
  code: string,
): Promise<PublicTicket | null> {
  if (!code || code.length > 200) return null

  const rows = await db
    .select({
      code: tickets.code,
      event_id: tickets.event_id,
      organization_id: tickets.organization_id,
      koper_naam: tickets.koper_naam,
      gebruikt_op: tickets.gebruikt_op,
      ingetrokken_op: tickets.ingetrokken_op,
      type_naam: ticketTypes.naam,
      event_naam: events.naam,
      datum_start: events.datum_start,
      locatie: events.locatie,
      event_organization_id: events.organization_id,
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
    .innerJoin(events, eq(tickets.event_id, events.id))
    .where(eq(tickets.code, code))
    .limit(1)

  if (rows.length === 0) return null
  const rij = rows[0]
  if (rij.organization_id !== rij.event_organization_id) return null

  // Defense in depth: ook al kwam de code uit de database, we verifiëren de
  // HMAC opnieuw. Kost niets en vangt een handmatig aangepaste rij af.
  const verificatie = verifyTicketCode(rij.event_id, code)
  if (!verificatie.valid) return null

  const status: PublicTicketStatus = rij.ingetrokken_op
    ? 'ingetrokken'
    : rij.gebruikt_op
      ? 'gebruikt'
      : 'geldig'

  return {
    code: rij.code,
    koper_naam: rij.koper_naam,
    type_naam: rij.type_naam,
    event_naam: rij.event_naam,
    datum_start: rij.datum_start,
    locatie: rij.locatie,
    status,
    gebruikt_op: rij.gebruikt_op,
  }
})

/**
 * Loader-variant voor /t/{code}. Genereert de QR serverside mee, zodat de
 * qrcode-module nooit in de client-bundle belandt.
 */
export const getPublicTicket = createServerFn({ method: 'GET' })
  .validator((code: string) => code)
  .handler(async ({ data: code }) => {
    const ticket = await laadPublicTicket(code)
    if (!ticket) throw new Error(TICKET_NIET_GEVONDEN)
    return { ticket, qr: await qrSvg(ticket.code) }
  })
