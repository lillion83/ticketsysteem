// Kleine CSV-helper voor de export (fase F). Excel opent dit direct; geen
// dependency nodig. Puur, client-bruikbaar.

function ontsnap(waarde: string | number | null): string {
  const s = waarde === null ? '' : String(waarde)
  // Velden met komma, aanhalingsteken of newline tussen quotes; quotes verdubbeld.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Bouwt een CSV-string uit kolomkoppen en rijen. */
export function naarCsv(
  kolommen: string[],
  rijen: Array<Array<string | number | null>>,
): string {
  const regels = [kolommen.map(ontsnap).join(',')]
  for (const rij of rijen) regels.push(rij.map(ontsnap).join(','))
  // \r\n en een UTF-8 BOM, zodat Excel accenten goed toont.
  return '﻿' + regels.join('\r\n')
}

/** Start een download van een CSV-string in de browser. */
export function downloadCsv(bestandsnaam: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = bestandsnaam
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
