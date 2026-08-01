// Betaalmethoden per event: de vorm van `event_betaalmethoden.config`, en het
// kenmerk dat de bezoeker bij zijn overschrijving vermeldt.
//
// Het ontwerp (scherm 02) toont per methode concrete gegevens — "Finabank /
// 1234567890 / KNF-4821" — terwijl de methodenkiezer in datzelfde ontwerp alleen
// vinkjes had. Die gegevens moeten dus ergens vandaan komen: `config` bestond al
// als vrij veld per methode, en dit bestand legt vast wat erin zit.
//
// Geen betaallogica (harde regel 6): dit is invoer van de organisator die we
// ongewijzigd aan de bezoeker tonen. Er wordt niets mee gerekend of geverifieerd.

export type BetaalmethodeSoort = 'whatsapp' | 'bank' | 'contant' | 'online'

export const BETAALMETHODE_LABEL: Record<BetaalmethodeSoort, string> = {
  whatsapp: 'WhatsApp',
  bank: 'Bankoverschrijving',
  contant: 'Contant',
  online: 'Online betalen',
}

/** De velden die een organisator per methode invult, in beeldvolgorde. */
export const METHODE_VELDEN: Record<
  BetaalmethodeSoort,
  Array<{ key: string; label: string; placeholder: string; lang?: boolean }>
> = {
  whatsapp: [
    {
      key: 'nummer',
      label: 'WhatsApp-nummer',
      placeholder: '+597 812 4455',
    },
  ],
  bank: [
    { key: 'bank', label: 'Bank', placeholder: 'Finabank' },
    { key: 'rekening', label: 'Rekeningnummer', placeholder: '1234567890' },
    { key: 'tenName', label: 'Ten name van', placeholder: 'Kingston Events' },
  ],
  contant: [
    {
      key: 'tekst',
      label: 'Waar en wanneer',
      placeholder:
        'Aan de deur, of bij ons afhaalpunt aan de Kwattaweg 122, dagelijks 10:00–18:00.',
      lang: true,
    },
  ],
  // Online betalen bestaat niet (harde regel 6); staat hier alleen zodat het
  // record compleet is en de UI er niet op hoeft te controleren.
  online: [],
}

// Ontbrekende sleutels zijn de normale toestand — een organisator hoeft niets in
// te vullen — dus expliciet `undefined` in het type. De UI kan zo per veld
// beslissen of hij het toont.
export type MethodeConfig = Record<string, string | undefined>

/**
 * `config` is een JSON-object als tekst. Alles wat daar niet aan voldoet — oude
 * rijen met `null`, of handmatig gevulde tekst — levert een leeg object op, zodat
 * de UI altijd op de betaalinstructies kan terugvallen.
 */
export function leesConfig(config: string | null): MethodeConfig {
  if (!config?.trim()) return {}
  try {
    const gelezen: unknown = JSON.parse(config)
    if (!gelezen || typeof gelezen !== 'object' || Array.isArray(gelezen)) {
      return {}
    }
    const uit: MethodeConfig = {}
    for (const [k, v] of Object.entries(gelezen)) {
      if (typeof v === 'string' && v.trim()) uit[k] = v.trim()
    }
    return uit
  } catch {
    return {}
  }
}

/** Lege velden gaan er niet in; is er niets ingevuld, dan blijft `config` null. */
export function schrijfConfig(waarden: MethodeConfig): string | null {
  const gevuld: Array<[string, string]> = []
  for (const [k, v] of Object.entries(waarden)) {
    if (v?.trim()) gevuld.push([k, v.trim()])
  }
  if (gevuld.length === 0) return null
  return JSON.stringify(Object.fromEntries(gevuld))
}

/**
 * Het kenmerk dat de bezoeker bij zijn betaling vermeldt, in de vorm `KNF-4821`
 * uit het ontwerp: de initialen van het event plus vier cijfers uit het
 * aanvraag-uuid.
 *
 * Bewust afgeleid en niet opgeslagen — geen kolom, geen migratie, en de admin
 * berekent hetzelfde kenmerk uit dezelfde twee waarden. Het is een leeshulp voor
 * mensen, geen sleutel: twee aanvragen binnen één event kunnen in theorie
 * hetzelfde nummer krijgen, en dat mag. De kolom `betaalreferentie` blijft waar
 * de organisator het kenmerk van de bank zelf noteert.
 */
export function betaalKenmerk(eventNaam: string, aanvraagId: string): string {
  const initialen =
    eventNaam
      .split(/\s+/)
      .map((w) => w.replace(/[^\p{L}]/gu, '').charAt(0))
      .filter(Boolean)
      .slice(0, 3)
      .join('')
      .toUpperCase() || 'TKT'
  const hex = aanvraagId.replace(/[^0-9a-f]/gi, '').slice(0, 4)
  const nummer = (parseInt(hex, 16) || 0) % 10000
  return `${initialen}-${String(nummer).padStart(4, '0')}`
}
