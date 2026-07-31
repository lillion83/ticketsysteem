// Vaste waardenlijst voor `tickets.verkoopkanaal`. De kolom blijft `text` — geen
// migratie — maar de code smalt hem tot deze union en de UI biedt een chipgroep
// in plaats van een vrij tekstveld. Een vrij veld maakt rapportage achteraf
// waardeloos: "contant", "Contant" en "cash" zijn dan drie kanalen.

export const VERKOOPKANALEN = [
  'contant',
  'whatsapp',
  'bank',
  'vrijkaart',
  'sponsor',
  'online',
  'overig',
] as const

export type Verkoopkanaal = (typeof VERKOOPKANALEN)[number]

export const VERKOOPKANAAL_LABEL: Record<Verkoopkanaal, string> = {
  contant: 'Contant',
  whatsapp: 'WhatsApp',
  bank: 'Bankoverschrijving',
  vrijkaart: 'Vrijkaart',
  sponsor: 'Sponsor',
  online: 'Online aanvraag',
  overig: 'Overig',
}

/** True als een vrije stringwaarde een geldig kanaal is. */
export function isVerkoopkanaal(waarde: string): waarde is Verkoopkanaal {
  return (VERKOOPKANALEN as readonly string[]).includes(waarde)
}

/**
 * Label voor weergave. Bestaande rijen dragen nog `'reservering'` (het kanaal dat
 * fase G schreef); die mappen op "Online aanvraag". Alles wat verder niet in de
 * lijst staat tonen we ongewijzigd — beter een rare waarde dan een leeg vakje.
 */
export function verkoopkanaalLabel(waarde: string | null): string | null {
  if (!waarde) return null
  if (waarde === 'reservering') return VERKOOPKANAAL_LABEL.online
  return isVerkoopkanaal(waarde) ? VERKOOPKANAAL_LABEL[waarde] : waarde
}
