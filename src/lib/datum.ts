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
