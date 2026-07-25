// Gedeeld tussen client en server: het scanresultaat en de lokale beslisregel.
// Pure module, geen node/browser-specifieke imports — mag dus in beide bundels.

// De zes resultaten uit PLAN §4 / de scanResultaat-enum in het schema.
export type ScanResultaat =
  | 'groen'
  | 'groen_re_entry'
  | 'rood_al_gebruikt'
  | 'rood_ongeldig'
  | 'rood_ingetrokken'
  | 'rood_verkeerd_event'

export type ScanUitkomst = {
  resultaat: ScanResultaat
  // Alleen gevuld bij rood_al_gebruikt: wanneer het ticket eerder scande (ISO).
  gebruikt_op: string | null
}

// Eén ticket zoals het in de gesyncte lijst staat. Bewust géén kopersnaam of
// andere persoonsgegevens: de scanner toont alleen groen/rood (PLAN, geen
// ID-veld aan de deur).
export type GesynctTicket = {
  code: string
  gebruikt_op: string | null
  ingetrokken_op: string | null
}

export function isGroen(resultaat: ScanResultaat): boolean {
  return resultaat === 'groen' || resultaat === 'groen_re_entry'
}

// --- korte code voor handmatige invoer (PLAN §6, camera-fallback) ---
// De volledige code {uuid}.{hmac} is te lang om aan de deur in te tikken. We
// tonen daarom de laatste tekens (het staartje van de HMAC) als korte code op de
// ticketpagina en in de admin. De scanner herleidt die tegen de gesyncte lijst
// terug naar de volledige code, zodat de server-upload de HMAC blijft verifiëren.
const KORT_CODE_LENGTE = 6

export function kortCode(code: string): string {
  return code.slice(-KORT_CODE_LENGTE).toUpperCase()
}

export type CodeHerleiding =
  | { status: 'gevonden'; code: string }
  | { status: 'geen' }
  | { status: 'ambigu' }

/**
 * Zoekt de volledige code bij handmatige invoer: de korte code (staartje), of
 * een geplakte volledige code. Matcht als de invoer het einde van precies één
 * code in de lijst is. Meerdere treffers → ambigu (vraag om meer tekens).
 */
export function herleidCode(codes: string[], invoer: string): CodeHerleiding {
  const norm = invoer.trim().toLowerCase()
  if (!norm) return { status: 'geen' }
  const treffers = codes.filter((c) => c.toLowerCase().endsWith(norm))
  if (treffers.length === 1) return { status: 'gevonden', code: treffers[0] }
  if (treffers.length > 1) return { status: 'ambigu' }
  return { status: 'geen' }
}

/**
 * De lokale beslisregel (PLAN §3.3 stap 1–2). Membership-check: een code die
 * niet in de gesyncte lijst zit, is niet door ons uitgegeven → rood_ongeldig.
 * Het HMAC-geheim blijft daarmee server-side (harde regel 1). De server
 * verifieert bij de upload nogmaals; dit is de directe feedback aan de deur.
 */
export function bepaalLokaal(
  ticket: Pick<GesynctTicket, 'gebruikt_op' | 'ingetrokken_op'> | undefined,
  reEntry: boolean,
): ScanUitkomst {
  if (!ticket) return { resultaat: 'rood_ongeldig', gebruikt_op: null }
  if (ticket.ingetrokken_op) {
    return { resultaat: 'rood_ingetrokken', gebruikt_op: null }
  }
  if (ticket.gebruikt_op) {
    return reEntry
      ? { resultaat: 'groen_re_entry', gebruikt_op: null }
      : { resultaat: 'rood_al_gebruikt', gebruikt_op: ticket.gebruikt_op }
  }
  return { resultaat: 'groen', gebruikt_op: null }
}
