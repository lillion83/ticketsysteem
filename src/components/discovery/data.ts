import type { CSSProperties } from 'react'

// Vaste taxonomie voor de discovery-front-end (categorieën + filteropties).
// De event-gegevens zelf komen uit de database via `src/server/discovery.ts`;
// dit bestand houdt alleen de niet-data-UI-taxonomie.

function stripeBg(a: string, b: string): CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(45deg,${a},${a} 10px,${b} 10px,${b} 20px)`,
  }
}

export type Category = { name: string; sub: string; pattern: CSSProperties }

// Homepage-categorie-tegels. `name` matcht de `event_categorie`-enum-waarden
// zodat een tegel naar het juiste categoriefilter linkt.
export const categories: Array<Category> = [
  { name: 'Muziek', sub: 'Concerten & Festivals', pattern: stripeBg('#FFF7ED', '#FFEDD5') },
  { name: 'Tech', sub: 'Summits', pattern: stripeBg('#EFF6FF', '#DBEAFE') },
  { name: 'Business', sub: 'Netwerken', pattern: stripeBg('#F0FDF4', '#DCFCE7') },
  { name: 'Art & Design', sub: 'Galerijen & Shows', pattern: stripeBg('#FDF4FF', '#FAE8FF') },
  { name: 'Health', sub: 'Wellness & Yoga', pattern: stripeBg('#FEF2F2', '#FEE2E2') },
  { name: 'Sports', sub: 'Toernooien', pattern: stripeBg('#F0FDFA', '#CCFBF1') },
]

// Categorieën zoals ze in de filter-sidebar en admin-selects verschijnen.
// Gelijk aan de `event_categorie`-enum in het schema.
export const eventCategories = [
  'Muziek',
  'Tech',
  'Business',
  'Food & Drink',
  'Health',
  'Art & Design',
  'Sports',
] as const

export const dateFilters = ['Elke datum', 'Vandaag', 'Dit weekend', 'Kies datum...']
