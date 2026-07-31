// Aansluitpunt voor betaalproviders. Er is op dit moment één implementatie:
// 'handmatig'. Die verwerkt niets — hij geeft alleen de tekst terug die de
// bezoeker te zien krijgt, waarna het geld buiten het systeem om overgemaakt
// wordt en de organisator in de admin op "Betaling ontvangen" drukt.
//
// Harde regel 6 (geen betaallogica) staat overeind: hier zit geen bedragberekening,
// geen ledger en geen refund. De interface bestaat zodat Uni5Pay of Mope later één
// bestand in deze map zijn in plaats van een verbouwing van de aanvraagketen.
// Zo'n provider zou dezelfde keten aanroepen als de handmatige knop:
//
//   verifieerWebhook(req)
//     → markeerBetaald(aanvraagId, { betaalmethode, betaalreferentie })
//     → genereerTickets(aanvraagId)
//     → verstuurTickets(ids, 'mail')
//
// Er is bewust nog géén webhookroute: die komt pas als er een provider is.

export type BetaalIntent = {
  aanvraagId: string
  bedragSrd: string
  omschrijving: string
}

export type BetaalStart =
  /** De bezoeker betaalt buiten het systeem om; dit is de tekst die hij ziet. */
  | { soort: 'handmatig'; instructies: string }
  /** De bezoeker gaat naar de provider en komt terug. Nog niet in gebruik. */
  | { soort: 'redirect'; url: string }

export type WebhookResultaat = {
  aanvraagId: string
  betaald: boolean
  referentie: string
}

export interface PaymentProvider {
  /** 'handmatig' | 'uni5pay' | 'mope' */
  key: string
  start: (intent: BetaalIntent) => Promise<BetaalStart>
  verifieerWebhook?: (req: Request) => Promise<WebhookResultaat>
}
