import type { GesynctTicket, ScanResultaat } from '#/lib/scanResult'

// Offline-laag van de scanner (PLAN §3.3). Bewust localStorage, geen IndexedDB:
// onder de 200 tickets is de lijst ~15 kB (harde regel 5). Alles per event
// gesleuteld, zodat twee events op één toestel elkaar niet in de weg zitten.

const LIJST_KEY = (eventId: string) => `scanner:lijst:${eventId}`
const QUEUE_KEY = (eventId: string) => `scanner:queue:${eventId}`

// De volledige gesyncte lijst, plus wanneer en met welke re-entry-instelling.
export type Lijst = {
  gesyncedOp: string // ISO-tijd van de server bij de laatste volledige sync
  naam: string // eventnaam, zodat de header ook offline (koude start) rendert
  reEntry: boolean
  tickets: Record<string, { gebruikt_op: string | null; ingetrokken_op: string | null }>
}

// Eén scan die nog naar de server moet. Alleen groene scans belanden hier:
// een rood resultaat verandert niets aan de serverstatus en hoeft niet geüpload.
export type WachtScan = {
  client_scan_uuid: string
  code: string
  tijdstip_client: string // ISO, het moment dat de deur 'm scande
  resultaat: ScanResultaat
}

function veiligLezen<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const ruw = window.localStorage.getItem(key)
    return ruw ? (JSON.parse(ruw) as T) : null
  } catch {
    return null
  }
}

function veiligSchrijven(key: string, waarde: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(waarde))
  } catch {
    // localStorage vol of geblokkeerd: de in-memory state blijft leidend,
    // dit is enkel de back-up bij een herstart.
  }
}

// --- lijst ---

export function laadLijst(eventId: string): Lijst | null {
  return veiligLezen<Lijst>(LIJST_KEY(eventId))
}

export function bewaarLijst(
  eventId: string,
  data: {
    gesyncedOp: string
    naam: string
    reEntry: boolean
    tickets: GesynctTicket[]
  },
): Lijst {
  const tickets: Lijst['tickets'] = {}
  for (const t of data.tickets) {
    tickets[t.code] = {
      gebruikt_op: t.gebruikt_op,
      ingetrokken_op: t.ingetrokken_op,
    }
  }
  const lijst: Lijst = {
    gesyncedOp: data.gesyncedOp,
    naam: data.naam,
    reEntry: data.reEntry,
    tickets,
  }
  veiligSchrijven(LIJST_KEY(eventId), lijst)
  return lijst
}

/**
 * Markeert een code lokaal als gebruikt (PLAN §3.3 stap 3), zodat een tweede
 * scan van hetzelfde ticket meteen rood geeft — óók offline. Geeft de
 * bijgewerkte lijst terug.
 */
export function markeerGebruikt(
  eventId: string,
  code: string,
  tijdstip: string,
): Lijst | null {
  const lijst = laadLijst(eventId)
  if (!lijst) return null
  // markeerGebruikt wordt alleen voor een groene, in-lijst code aangeroepen
  // (bepaalLokaal geeft een onbekende code al rood_ongeldig).
  const t = lijst.tickets[code]
  if (!t.gebruikt_op) {
    t.gebruikt_op = tijdstip
    veiligSchrijven(LIJST_KEY(eventId), lijst)
  }
  return lijst
}

// --- uploadqueue ---

export function laadQueue(eventId: string): WachtScan[] {
  return veiligLezen<WachtScan[]>(QUEUE_KEY(eventId)) ?? []
}

export function voegToeAanQueue(eventId: string, scan: WachtScan): WachtScan[] {
  const queue = laadQueue(eventId)
  queue.push(scan)
  veiligSchrijven(QUEUE_KEY(eventId), queue)
  return queue
}

export function verwijderUitQueue(
  eventId: string,
  uuids: string[],
): WachtScan[] {
  const weg = new Set(uuids)
  const queue = laadQueue(eventId).filter(
    (s) => !weg.has(s.client_scan_uuid),
  )
  veiligSchrijven(QUEUE_KEY(eventId), queue)
  return queue
}
