// Voorgevulde WhatsApp-link. Bewust géén afbeelding: een wa.me-link kan alleen
// tekst versturen (PLAN §3.6), dus we sturen de link naar de ticketpagina.

// Suriname. Nummers zonder landcode krijgen deze ervoor.
const STANDAARD_LANDCODE = '597'

/**
 * Maakt van een ingetypt nummer de cijferreeks die wa.me verwacht (E.164
 * zonder plus). Spaties, streepjes en haakjes eruit; `00` en `+` zijn een
 * expliciete landcode; een leidende nul is een binnenlands voorvoegsel en gaat
 * eraf. Blijft er niets over, dan geven we null terug en tonen we geen knop.
 */
export function normaliseerTelefoon(nummer: string | null): string | null {
  if (!nummer) return null

  const opgeschoond = nummer.replace(/[^\d+]/g, '')
  if (!opgeschoond) return null

  let cijfers: string
  if (opgeschoond.startsWith('+')) {
    cijfers = opgeschoond.slice(1)
  } else if (opgeschoond.startsWith('00')) {
    cijfers = opgeschoond.slice(2)
  } else {
    cijfers = STANDAARD_LANDCODE + opgeschoond.replace(/^0+/, '')
  }

  cijfers = cijfers.replace(/\D/g, '')
  return cijfers.length >= 8 ? cijfers : null
}

/** wa.me-link met voorgevulde tekst, of null bij een onbruikbaar nummer. */
export function whatsappLink(
  nummer: string | null,
  tekst: string,
): string | null {
  const cijfers = normaliseerTelefoon(nummer)
  if (!cijfers) return null
  return `https://wa.me/${cijfers}?text=${encodeURIComponent(tekst)}`
}

/** Standaardtekst bij het versturen van een ticket. */
export function ticketBericht(opties: {
  koperNaam: string | null
  eventNaam: string
  datum: Date | string
  locatie: string | null
  ticketUrl: string
}): string {
  const datum = new Date(opties.datum).toLocaleString('nl-NL', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
  const regels = [
    `Hoi${opties.koperNaam ? ` ${opties.koperNaam}` : ''}, hier is je ticket voor ${opties.eventNaam}.`,
    '',
    `Datum: ${datum}`,
  ]
  if (opties.locatie) regels.push(`Locatie: ${opties.locatie}`)
  regels.push(
    '',
    'Open deze link aan de deur — laat de QR-code scannen:',
    opties.ticketUrl,
    '',
    'Tip: maak een screenshot van de QR, dan heb je hem ook zonder internet.',
  )
  return regels.join('\n')
}
