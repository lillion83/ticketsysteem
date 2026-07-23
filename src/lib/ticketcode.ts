import { createHmac, timingSafeEqual } from 'node:crypto'

// Harde regel 1: ticketcodes zijn `{uuid}.{hmac}`. HMAC-SHA256 over
// `event_id + ticket_id`, afgekapt tot 16 tekens, met TICKET_SECRET.
// Nooit oplopende nummers, nooit persoonsgegevens in de code.

const SECRET = process.env.TICKET_SECRET
if (!SECRET) {
  throw new Error('TICKET_SECRET ontbreekt in de omgeving (.env)')
}

const HMAC_LENGTE = 16

/** Berekent de afgekapte HMAC (hex) over event_id + ticket_id. */
function berekenHmac(eventId: string, ticketId: string): string {
  return createHmac('sha256', SECRET as string)
    .update(eventId + ticketId)
    .digest('hex')
    .slice(0, HMAC_LENGTE)
}

/** Bouwt de volledige ticketcode `{ticket_id}.{hmac}`. */
export function signTicket(eventId: string, ticketId: string): string {
  return `${ticketId}.${berekenHmac(eventId, ticketId)}`
}

export type VerifyResult =
  | { valid: true; ticketId: string }
  | { valid: false; ticketId: null }

/**
 * Verifieert een ticketcode offline: is de HMAC met ons geheim geldig?
 * Vergelijkt timing-safe. De caller kent event_id (in fase B: het huidige event;
 * in de scanner: het gesyncte event). Geeft bij succes het ticket_id terug,
 * zodat de db-lookup daarop kan.
 */
export function verifyTicketCode(
  eventId: string,
  code: string,
): VerifyResult {
  const punt = code.indexOf('.')
  if (punt <= 0) return { valid: false, ticketId: null }

  const ticketId = code.slice(0, punt)
  const gegeven = code.slice(punt + 1)
  const verwacht = berekenHmac(eventId, ticketId)

  // timingSafeEqual eist gelijke lengte; anders sowieso ongeldig.
  if (gegeven.length !== verwacht.length) {
    return { valid: false, ticketId: null }
  }

  const gelijk = timingSafeEqual(
    Buffer.from(gegeven),
    Buffer.from(verwacht),
  )
  return gelijk ? { valid: true, ticketId } : { valid: false, ticketId: null }
}
