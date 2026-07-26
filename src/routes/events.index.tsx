import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { PinIcon, SiteFooter, SiteNav, SitePage, coverStyle } from '#/components/discovery/site'
import { dateFilters, eventCategories } from '#/components/discovery/data'
import { formatPrice, useCurrency } from '#/components/discovery/currency'
import { listPublicEvents } from '#/server/discovery'

type SortOrder = 'relevantie' | 'prijs' | 'datum'

// Zoek-/filterstate zit in de URL (validateSearch): deelbaar en bookmarkbaar,
// zoals een echte zoekpagina hoort te werken. Alle velden optioneel zodat
// Links naar /events elders geen zoekparameters hoeven mee te geven.
type EventsSearch = {
  q?: string
  categories?: Array<string>
  date?: string
  sort?: SortOrder
  page?: number
}

export const Route = createFileRoute('/events/')({
  validateSearch: (search: Record<string, unknown>): EventsSearch => ({
    q: typeof search.q === 'string' ? search.q : '',
    categories: Array.isArray(search.categories)
      ? search.categories.filter((c): c is string => typeof c === 'string')
      : [],
    date: typeof search.date === 'string' ? search.date : 'Elke datum',
    sort:
      search.sort === 'prijs' || search.sort === 'datum' || search.sort === 'relevantie'
        ? search.sort
        : 'relevantie',
    page: typeof search.page === 'number' && search.page > 0 ? search.page : 1,
  }),
  loader: () => listPublicEvents(),
  component: EventsOverzicht,
})

function EventsOverzicht() {
  const allEvents = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const currency = useCurrency()

  // Zoekparameters met standaardwaarden (alle URL-velden zijn optioneel).
  const q = search.q ?? ''
  const selectedCategories = search.categories ?? []
  const selectedDate = search.date ?? 'Elke datum'
  const sort: SortOrder = search.sort ?? 'relevantie'
  const currentPage = search.page ?? 1

  // Ondiepe merge van zoekparameters in de URL.
  function setSearch(patch: Partial<EventsSearch>) {
    navigate({ search: (prev) => ({ ...prev, ...patch }) })
  }

  function toggleCategory(name: string) {
    const next = selectedCategories.includes(name)
      ? selectedCategories.filter((c) => c !== name)
      : [...selectedCategories, name]
    setSearch({ categories: next, page: 1 })
  }

  const filtered = allEvents
    .filter((ev) => (selectedCategories.length === 0 ? true : ev.categorie !== null && selectedCategories.includes(ev.categorie)))
    .filter((ev) => {
      const needle = q.trim().toLowerCase()
      if (!needle) return true
      return `${ev.titel} ${ev.locatie ?? ''} ${ev.categorie ?? ''}`.toLowerCase().includes(needle)
    })
    .sort((a, b) => {
      if (sort === 'prijs') return (a.prijsVanafSrd ?? 0) - (b.prijsVanafSrd ?? 0)
      return 0
    })

  return (
    <SitePage>
      <SiteNav active="events" />

      <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-8 md:px-12">
        <div className="mb-3.5 text-[13px] text-[#64748B]">
          <Link to="/" className="text-[#64748B] hover:text-[#0F172A]">
            Home
          </Link>{' '}
          / <span className="font-semibold text-[#0F172A]">Aankomende Events</span>
        </div>
        <h1 className="mb-2.5 text-[36px] font-extrabold">Aankomende Events</h1>
        <p className="mb-8 max-w-[520px] text-[15px] text-[#64748B]">
          Ontdek lokale ervaringen — vind de beste concerten, workshops en meetups bij jou in de buurt.
        </p>

        <div className="grid items-start gap-8 md:grid-cols-[270px_1fr]">
          {/* Filter-sidebar */}
          <aside className="rounded-[16px] border border-[#E5E7EB] p-6 md:sticky md:top-6">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[17px] font-extrabold">Filters</span>
              <button
                onClick={() => setSearch({ q: '', categories: [], date: 'Elke datum', page: 1 })}
                className="text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
              >
                Wis alles
              </button>
            </div>

            <FilterLabel>Categorieën</FilterLabel>
            <div className="mb-6 flex flex-col gap-3">
              {eventCategories.map((name) => (
                <label key={name} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(name)}
                    onChange={() => toggleCategory(name)}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  {name}
                </label>
              ))}
            </div>

            <FilterLabel>Datum</FilterLabel>
            <div className="mb-6 flex flex-col gap-3">
              {dateFilters.map((name) => (
                <label key={name} className="flex cursor-pointer items-center gap-2.5 text-[14px] text-[#334155]">
                  <input
                    type="radio"
                    name="datum"
                    checked={selectedDate === name}
                    onChange={() => setSearch({ date: name })}
                    className="h-4 w-4 accent-[#2563EB]"
                  />
                  {name}
                </label>
              ))}
            </div>

            <FilterLabel>Prijs</FilterLabel>
            <div className="mb-2 flex justify-between text-[13px] text-[#64748B]">
              <span>SRD 0</span>
              <span>SRD 2.500</span>
            </div>
            <input type="range" min={0} max={2500} defaultValue={2500} className="mb-4 w-full accent-[#2563EB]" />
            <div className="flex gap-2.5">
              <button className="flex-1 rounded-full border border-[#E5E7EB] py-2.5 text-[13px] font-bold hover:bg-[#F1F5F9]">
                Gratis
              </button>
              <button className="flex-1 rounded-full border border-[#E5E7EB] py-2.5 text-[13px] font-bold hover:bg-[#F1F5F9]">
                Betaald
              </button>
            </div>
          </aside>

          {/* Resultaten */}
          <main>
            <div className="mb-5 flex flex-col gap-3.5 sm:flex-row">
              <div className="relative flex-1">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  value={q}
                  onChange={(e) => setSearch({ q: e.target.value, page: 1 })}
                  placeholder="Zoek events op naam, artiest of locatie..."
                  className="w-full rounded-[12px] border border-[#E5E7EB] py-3.5 pl-[42px] pr-4 text-[14px] outline-none focus:border-[#2563EB]"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSearch({ sort: e.target.value as SortOrder })}
                className="rounded-[12px] border border-[#E5E7EB] px-4 text-[14px] text-[#0F172A]"
              >
                <option value="relevantie">Relevantie</option>
                <option value="prijs">Prijs: laag naar hoog</option>
                <option value="datum">Datum</option>
              </select>
            </div>

            <div className="mb-5 text-[14px] text-[#64748B]">
              Toont <strong className="text-[#0F172A]">{filtered.length}</strong> van{' '}
              <strong className="text-[#0F172A]">{allEvents.length}</strong> events
            </div>

            <div className="mb-9 grid gap-[22px] sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((ev) => (
                <Link
                  key={ev.id}
                  to="/events/$eventId"
                  params={{ eventId: ev.id }}
                  className="block overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:shadow-md"
                >
                  <div className="relative h-[140px]" style={coverStyle(ev.categorie)}>
                    {ev.categorie && (
                      <div className="absolute left-2.5 top-2.5 rounded-full bg-[#DBEAFE] px-2.5 py-1 text-[11px] font-bold text-[#2563EB]">
                        {ev.categorie}
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="mb-2 text-[15px] font-extrabold leading-[1.3]">{ev.titel}</div>
                    <div className="mb-1.5 text-[12.5px] text-[#64748B]">{ev.dateLine}</div>
                    <div className="mb-3 flex items-center gap-1.5 text-[12.5px] text-[#64748B]">
                      <PinIcon size={12} />
                      {ev.locatie ?? 'Locatie volgt'}
                    </div>
                    <div className="flex items-center justify-between border-t border-[#F1F5F9] pt-3">
                      <span className="text-[13.5px] font-extrabold text-[#2563EB]">
                        {ev.prijsVanafSrd === null ? 'Gratis' : formatPrice(ev.prijsVanafSrd, currency)}
                      </span>
                      <span className="text-[12px] text-[#94A3B8]">{ev.aanmeldingen} aanmeldingen</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="mb-9 rounded-[16px] border border-dashed border-[#E5E7EB] py-12 text-center text-[14px] text-[#64748B]">
                Geen events gevonden. Pas je filters aan.
              </div>
            )}

            {/* Paginering (statisch; echte paginering volgt zodra er meer events zijn) */}
            <div className="flex justify-center gap-2">
              {['1', '2', '3', '...', '8'].map((label, i) => {
                const isActive = label === String(currentPage)
                const isNumber = /^\d+$/.test(label)
                return (
                  <button
                    key={i}
                    onClick={() => isNumber && setSearch({ page: Number(label) })}
                    disabled={!isNumber}
                    className={`flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#E5E7EB] text-[13px] font-bold ${
                      isActive ? 'bg-[#2563EB] text-white' : 'bg-white text-[#0F172A] hover:bg-[#F1F5F9]'
                    } ${!isNumber ? 'cursor-default' : ''}`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </main>
        </div>
      </div>

      <SiteFooter />
    </SitePage>
  )
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.05em] text-[#94A3B8]">{children}</div>
}
