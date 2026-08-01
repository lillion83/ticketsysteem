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
  whatsapp: 'Betaalverzoek via WhatsApp',
  bank: 'Bankoverschrijving',
  contant: 'Contant',
  online: 'Online betalen',
}

/** Eén regel uitleg per methode, zoals in het ontwerp onder de titel. */
export const BETAALMETHODE_UITLEG: Record<BetaalmethodeSoort, string> = {
  whatsapp:
    'De organisator stuurt je een betaalverzoek. Je betaalt in je eigen betaalapp — niet in WhatsApp.',
  bank: 'Je krijgt de rekeninggegevens en een kenmerk op de volgende pagina.',
  contant: 'Betaal bij het afhaalpunt of aan de deur.',
  online: 'Direct online betalen — binnenkort.',
}

/**
 * De betaalapps waarin een organisator zijn verzoek kan sturen. Vaste lijst en
 * geen vrij tekstveld: de sleutel belandt in `reserveringen.betaalmethode` en
 * moet daar één schrijfwijze houden, anders is er achteraf niet op te tellen.
 *
 * Dit is géén betaalkoppeling (harde regel 6). Wij registreren alleen in welke
 * app de organisator het verzoek stuurt; het verzoek zelf maakt hij daar zelf.
 */
export const BETAALAPPS = [
  { key: 'mope', label: 'Mope' },
  { key: 'uni5pay', label: 'Uni5Pay' },
] as const

export type BetaalApp = (typeof BETAALAPPS)[number]['key']

export function isBetaalApp(waarde: string): waarde is BetaalApp {
  return BETAALAPPS.some((a) => a.key === waarde)
}

export function betaalAppLabel(app: string): string {
  return BETAALAPPS.find((a) => a.key === app)?.label ?? app
}

/** De velden die een organisator per methode invult, in beeldvolgorde. */
export const METHODE_VELDEN: Record<
  BetaalmethodeSoort,
  Array<{
    key: string
    label: string
    placeholder: string
    lang?: boolean
    /** Vinkjes uit BETAALAPPS in plaats van een tekstveld. */
    apps?: boolean
  }>
> = {
  whatsapp: [
    {
      key: 'nummer',
      label: 'WhatsApp-nummer',
      placeholder: '+597 812 4455',
    },
    {
      key: 'apps',
      label: 'Betaalapps waarin je het verzoek stuurt',
      placeholder: '',
      apps: true,
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
 * De betaalapps die bij deze methode horen, uit `config.apps` — één string met
 * komma's, zodat `MethodeConfig` puur tekst blijft en er geen migratie nodig is.
 * Onbekende sleutels vallen af: de publieke pagina biedt alleen apps aan die de
 * code ook kent.
 */
export function leesApps(config: MethodeConfig): Array<BetaalApp> {
  return (config.apps ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(isBetaalApp)
}

/** Andersom, voor het eventformulier. Niets aangevinkt = geen sleutel. */
export function schrijfApps(apps: Array<BetaalApp>): string {
  return BETAALAPPS.filter((a) => apps.includes(a.key))
    .map((a) => a.key)
    .join(',')
}

/**
 * De keuze van de bezoeker, zoals die in `reserveringen.betaalmethode` staat:
 * `'whatsapp'`, `'whatsapp:mope'`, `'bank'` of `'contant'`. De app hangt met een
 * dubbele punt aan de soort vast in plaats van in een eigen kolom — dat scheelt
 * een migratie, en de soort blijft vooraan zodat oude rijen (`'whatsapp'`) zonder
 * meer blijven werken.
 */
export type Betaalkeuze = {
  soort: BetaalmethodeSoort | null
  app: BetaalApp | null
}

export function leesKeuze(betaalmethode: string | null): Betaalkeuze {
  if (!betaalmethode?.trim()) return { soort: null, app: null }
  const [ruweSoort, ruweApp] = betaalmethode.trim().toLowerCase().split(':')
  const soort = (['whatsapp', 'bank', 'contant', 'online'] as const).find(
    (s) => s === ruweSoort,
  )
  return {
    soort: soort ?? null,
    app: ruweApp && isBetaalApp(ruweApp) ? ruweApp : null,
  }
}

export function schrijfKeuze(soort: BetaalmethodeSoort, app: string): string {
  return app && isBetaalApp(app) ? `${soort}:${app}` : soort
}

/**
 * Label voor de admin: "Betaalverzoek · Mope", "Bankoverschrijving", "Contant".
 * Een waarde die we niet herkennen tonen we ongewijzigd — beter een rare string
 * dan een leeg vakje.
 */
export function keuzeLabel(betaalmethode: string | null): string | null {
  if (!betaalmethode?.trim()) return null
  const { soort, app } = leesKeuze(betaalmethode)
  if (!soort) return betaalmethode
  if (soort === 'whatsapp') {
    return app ? `Betaalverzoek · ${betaalAppLabel(app)}` : 'Betaalverzoek'
  }
  return BETAALMETHODE_LABEL[soort]
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
