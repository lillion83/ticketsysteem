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
