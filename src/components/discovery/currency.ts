import { useSyncExternalStore } from 'react'

// Valuta-weergave voor de discovery-front-end. SRD is de opgeslagen bron van
// waarheid (CLAUDE.md-conventie: "Bedragen in SRD"); USD is een weergave-
// omrekening via een vaste koers. Een header-toggle kiest de eenheid en die
// keuze wordt in localStorage bewaard, zodat ze over paginanavigatie heen blijft.

export type Currency = 'SRD' | 'USD'

// Vaste omrekenkoers: 1 USD ≈ dit aantal SRD. Bewust een constante en geen
// live-koers — makkelijk naar een env-var te tillen als dat ooit nodig is.
export const SRD_PER_USD = 36

const STORAGE_KEY = 'discovery_valuta'

// Module-store met useSyncExternalStore, hetzelfde lokaal-eerst patroon als
// src/lib/scannerStore.ts. Geen React-context/provider nodig.
const listeners = new Set<() => void>()

function readStored(): Currency {
  if (typeof localStorage === 'undefined') return 'SRD'
  return localStorage.getItem(STORAGE_KEY) === 'USD' ? 'USD' : 'SRD'
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setCurrency(valuta: Currency): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, valuta)
  listeners.forEach((l) => l())
}

/** Huidige valutakeuze; her-rendert componenten bij een toggle. */
export function useCurrency(): Currency {
  // getServerSnapshot geeft 'SRD' zodat server- en eerste client-render matchen.
  return useSyncExternalStore(subscribe, readStored, () => 'SRD')
}

/**
 * Formatteert een SRD-bedrag in de gekozen valuta, bv. "SRD 500" of "$14".
 * SRD is de enige opgeslagen prijs; USD is altijd een omrekening.
 */
export function formatPrice(bedragSrd: number, valuta: Currency): string {
  if (valuta === 'USD') {
    const usd = Math.round(bedragSrd / SRD_PER_USD)
    return `$${usd.toLocaleString('en-US')}`
  }
  return `SRD ${bedragSrd.toLocaleString('nl-NL')}`
}
