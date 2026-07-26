// Opgeslagen (favoriete) events in localStorage. Lichtgewicht: alleen een set
// event-ids, geen aparte favorietenpagina (die kan later). SSR-veilig.

const KEY = 'discovery_favorieten'

function lees(): Array<string> {
  if (typeof localStorage === 'undefined') return []
  try {
    const ruw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(ruw) ? ruw.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function isFavoriet(id: string): boolean {
  return lees().includes(id)
}

/** Wisselt de favoriet-status en geeft de nieuwe status terug. */
export function toggleFavoriet(id: string): boolean {
  const huidig = lees()
  const nieuw = huidig.includes(id) ? huidig.filter((x) => x !== id) : [...huidig, id]
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(nieuw))
  return nieuw.includes(id)
}
