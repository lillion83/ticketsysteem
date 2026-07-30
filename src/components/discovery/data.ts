// Vaste taxonomie voor de discovery-front-end (categorieën + filteropties).
// De event-gegevens zelf komen uit de database via `src/server/discovery.ts`;
// dit bestand houdt alleen de niet-data-UI-taxonomie.

// Categorieën zoals ze in de filter-sidebar, de admin-selects en de
// homepage-tegels verschijnen. Gelijk aan de `event_categorie`-enum in het
// schema — die twee moeten in dezelfde volgorde en spelling blijven staan.
export const eventCategories = [
  'Muziek & Concerten',
  'Nightlife',
  'Cultuur & Festival',
  'Food & Drinks',
  'Business & Netwerk',
  'Sport & Outdoor',
  'Workshops',
  'Familie & Kids',
] as const

export type EventCategorie = (typeof eventCategories)[number]

/**
 * Kleur per categorie, uit het ontwerp (Homepage.dc.html).
 *
 * - `tint` — het gevulde vierkantje achter het stipje op de categorie-tegel.
 * - `dot` — het stipje zelf, en de tekstkleur van de categoriebadge op een kaart.
 * - `rond` — het ontwerp wisselt bewust af tussen een rondje en een blokje, zodat
 *   acht tegels naast elkaar niet als één grijze rij lezen.
 *
 * Dit is de enige plek waar categoriekleuren staan; `coverStyle` in `site.tsx`
 * leidt de streep-placeholder hier ook uit af.
 */
export type CategorieStijl = { tint: string; dot: string; rond: boolean }

export const categoryStyles: Record<EventCategorie, CategorieStijl> = {
  'Muziek & Concerten': { tint: '#EAF0FE', dot: '#1D4ED8', rond: true },
  Nightlife: { tint: '#F1EBFC', dot: '#6D3FD1', rond: false },
  'Cultuur & Festival': { tint: '#E9F6EE', dot: '#137A3A', rond: true },
  'Food & Drinks': { tint: '#FEF2E4', dot: '#B4700C', rond: false },
  'Business & Netwerk': { tint: '#E7F4F7', dot: '#0E6B80', rond: true },
  'Sport & Outdoor': { tint: '#FBECEC', dot: '#B4231F', rond: false },
  Workshops: { tint: '#EEF1F6', dot: '#3A4453', rond: true },
  'Familie & Kids': { tint: '#FDEEF4', dot: '#A81F5C', rond: false },
}

function isEventCategorie(waarde: string | null): waarde is EventCategorie {
  return (
    waarde !== null &&
    (eventCategories as ReadonlyArray<string>).includes(waarde)
  )
}

/**
 * Stijl van een categorie, of `undefined` als het event er geen heeft. De
 * categorie komt uit de database als `string | null`, dus hier moet een
 * onbekende waarde niet stilletjes op een lege stijl uitkomen — vandaar de
 * expliciete controle in plaats van rechtstreeks indexeren.
 */
export function categoryStyle(
  categorie: string | null,
): CategorieStijl | undefined {
  return isEventCategorie(categorie) ? categoryStyles[categorie] : undefined
}

export const dateFilters = [
  'Elke datum',
  'Vandaag',
  'Dit weekend',
  'Kies datum...',
]
