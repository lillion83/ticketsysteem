// Datumformattering voor de publieke discovery-front-end. Vaste tijdzone
// America/Paramaribo (UTC-3), zodat tijden kloppen ongeacht de server-tijdzone.

const TZ = 'America/Paramaribo'

// Tijd met punt als scheidingsteken, zoals het ontwerp ("19.00").
function tijd(date: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TZ,
  })
    .format(date)
    .replace(':', '.')
}

/** Korte regel voor kaarten: "za 12 feb · 19.00". */
export function formatDateLine(date: Date): string {
  const datum = new Intl.DateTimeFormat('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(date)
  return `${datum} · ${tijd(date)}`
}

/** Volledige datum voor de detailpagina: "zaterdag 12 februari 2026". */
export function formatDateLong(date: Date): string {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  }).format(date)
}

/** Tijdsbereik: "09.00 – 12.00". */
export function formatTimeRange(start: Date, eind: Date): string {
  return `${tijd(start)} – ${tijd(eind)}`
}

// --- Client-side datumfilters voor de /events-zoekpagina ---
// Bewust op de lokale tijd van de bezoeker: een filter mag benaderend zijn.

function zelfdeDag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Valt de datum op vandaag? */
export function isVandaag(d: Date): boolean {
  return zelfdeDag(d, new Date())
}

/**
 * Valt de datum op het komende weekend (vrijdag t/m zondag binnen 7 dagen)?
 *
 * Vrijdag telt mee: het uitgaansweekend begint hier vrijdagavond, en het
 * weekendblok op de homepage toont vr–zo. Deze functie is de enige definitie van
 * "dit weekend" — de homepage en het datumfilter op /events delen hem, zodat de
 * twee niet elk een eigen weekend krijgen.
 */
export function isDitWeekend(d: Date): boolean {
  const nu = new Date()
  const overZeven = new Date(nu.getTime() + 7 * 24 * 60 * 60 * 1000)
  const dag = d.getDay() // 0 = zondag, 5 = vrijdag, 6 = zaterdag
  return (
    (dag === 0 || dag === 5 || dag === 6) &&
    d >= new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()) &&
    d <= overZeven
  )
}

/** Valt de datum op een gekozen dag (YYYY-MM-DD)? */
export function isOpDatum(d: Date, iso: string): boolean {
  const [jaar, maand, dag] = iso.split('-').map(Number)
  if (!jaar || !maand || !dag) return true
  return (
    d.getFullYear() === jaar &&
    d.getMonth() + 1 === maand &&
    d.getDate() === dag
  )
}
