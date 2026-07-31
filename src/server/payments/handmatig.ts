import type { BetaalIntent, BetaalStart, PaymentProvider } from './provider'

// De enige provider die er is. Hij "start" een betaling door de instructies van
// het event terug te geven; verder gebeurt er niets. Geen webhook: er komt geen
// bevestiging van buiten, de organisator meldt de betaling zelf in de admin.

/** Valt terug op een neutrale tekst als de organisator niets heeft ingevuld. */
const STANDAARD_INSTRUCTIES =
  'Neem contact op met de organisator om je betaling af te ronden. Zodra je betaling binnen is, ontvang je je e-ticket met QR-code.'

export function maakHandmatig(instructies: string | null): PaymentProvider {
  return {
    key: 'handmatig',
    async start(_intent: BetaalIntent): Promise<BetaalStart> {
      return {
        soort: 'handmatig',
        instructies: instructies?.trim() || STANDAARD_INSTRUCTIES,
      }
    },
  }
}

export const handmatig = maakHandmatig(null)
