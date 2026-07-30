import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  CheckIcon,
  HeartIcon,
  PinIcon,
  SearchIcon,
  SiteFooter,
  SiteNav,
  SitePage,
  coverStyle,
} from '#/components/discovery/site'
import {
  categoryStyle,
  categoryStyles,
  eventCategories,
} from '#/components/discovery/data'
import { formatPrice, useCurrency } from '#/components/discovery/currency'
import { isFavoriet, toggleFavoriet } from '#/components/discovery/favorites'
import { isDitWeekend } from '#/lib/datum'
import { getHomepageStats, listPublicEvents } from '#/server/discovery'
import type { HomepageStats, PublicEventCard } from '#/server/discovery'

// Homepage van de publieke discovery-front-end (ontwerp: Homepage.dc.html).
// Events en cijfers komen uit de database (actieve events, alle organisaties).
//
// Twee bewuste afwijkingen van het ontwerp, allebei omdat het ontwerp iets
// belooft dat dit platform niet doet:
//
// 1. Alle getallen op deze pagina komen uit de database. Het ontwerp toonde
//    "147 evenementen live", "4,8 uit 2.140 beoordelingen" en "38 mensen gaan";
//    daar is geen data voor, dus die blokken tonen tekst zonder getal of staan
//    er niet. Om dezelfde reden ontbreken de sterrenratings en de reviewsectie.
// 2. Nergens staat dat je hier betaalt. Er is geen betaallogica (CLAUDE.md,
//    harde regel 6): je reserveert op de site en regelt de betaling met de
//    organisator. De hero, de drie stappen en de FAQ zeggen dat ook zo.
export const Route = createFileRoute('/')({
  loader: async () => ({
    events: await listPublicEvents(),
    stats: await getHomepageStats(),
  }),
  component: Home,
})

const MONO = "font-['IBM_Plex_Mono',monospace]"

function prijsLabel(
  prijsVanafSrd: number | null,
  currency: ReturnType<typeof useCurrency>,
): string {
  return prijsVanafSrd === null
    ? 'Gratis'
    : formatPrice(prijsVanafSrd, currency)
}

function Home() {
  const { events, stats } = Route.useLoaderData()
  const currency = useCurrency()

  const uitgelicht = events.slice(0, 4)
  const weekend = events.filter((ev) => isDitWeekend(new Date(ev.datumStart)))

  return (
    <SitePage>
      <SiteNav active="home" />
      <Hero events={events} stats={stats} />
      <Categorieen events={events} />
      <Uitgelicht events={uitgelicht} currency={currency} />
      <Weekend events={weekend} currency={currency} />
      <DrieStappen />
      <VoorOrganisatoren stats={stats} />
      <Faq />
      <SiteFooter />
    </SitePage>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────

function Hero({
  events,
  stats,
}: {
  events: Array<PublicEventCard>
  stats: HomepageStats
}) {
  const eersteDrie = events.slice(0, 3)
  // `.at()` in plaats van `[0]`: die geeft eerlijk `undefined` terug bij een lege
  // lijst, zodat de zwevende kaart zonder actieve events gewoon wegblijft.
  const eerstvolgend = events.at(0)

  return (
    <section className="border-b border-[#EDF0F5] bg-gradient-to-b from-[#F7F9FC] to-white">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(420px,1fr))] items-center gap-14 px-6 pb-10 pt-16">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3E8F0] bg-white py-1.5 pl-2 pr-3 text-[12.5px] font-semibold text-[#3A4453]">
            <span className="ml-1 h-[7px] w-[7px] rounded-full bg-[#16A34A]" />
            <span>
              {stats.events > 0
                ? `${stats.events} ${stats.events === 1 ? 'evenement' : 'evenementen'} op het platform`
                : 'De eerste evenementen komen eraan'}
            </span>
          </div>

          <h1 className="mt-5 text-[clamp(38px,4.4vw,60px)] font-extrabold leading-[1.02] tracking-[-0.035em]">
            Elk evenement in Suriname. Eén ticket, direct op je telefoon.
          </h1>

          <p className="mt-5 max-w-[52ch] text-[18px] leading-[1.55] text-[#48515F]">
            Geen flyers die je tijdlijn voorbijschieten en geen zoektocht naar
            wie er nog tickets heeft. Zoek op datum, locatie of categorie,
            reserveer je plek en ontvang je ticket met QR-code per mail.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to="/events"
              className="flex min-h-[52px] items-center rounded-full bg-[#1D4ED8] px-6 text-[15.5px] font-bold text-white shadow-[0_6px_18px_-8px_rgba(29,78,216,0.6)] hover:bg-[#1737A8]"
            >
              Evenementen bekijken
            </Link>
            <Link
              to="/events/new"
              className="flex min-h-[52px] items-center rounded-full border border-[#DDE3EC] bg-white px-6 text-[15.5px] font-bold text-[#0B1220] hover:border-[#0B1220]"
            >
              Event plaatsen
            </Link>
          </div>

          {/* Het ontwerp had hier een sterrenrating ("4,8 uit 2.140 beoordelingen").
              Er zijn geen beoordelingen, dus staan er twee dingen die wél waar zijn. */}
          <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[#3A4453]">
              <CheckIcon stroke="#16A34A" /> Geverifieerde organisatoren
            </span>
            <span className="flex items-center gap-2 text-[14px] font-semibold text-[#3A4453]">
              <CheckIcon stroke="#16A34A" /> Ticket met QR-code per mail
            </span>
          </div>
        </div>

        {/* Op een telefoon wordt 480px hoog naast twee smalle kolommen te fors;
            het ontwerp is op desktop getekend. */}
        <div className="relative grid h-[340px] grid-cols-[1.15fr_0.85fr] grid-rows-[auto_auto] gap-3.5 sm:h-[480px]">
          <HeroTegel
            event={eersteDrie[0]}
            className="row-span-2"
            badge="Uitgelicht"
          />
          <HeroTegel event={eersteDrie[1]} />
          <HeroTegel event={eersteDrie[2]} />

          {eerstvolgend && (
            <div className="absolute bottom-3.5 left-3.5 flex w-[min(300px,86%)] items-center gap-3 rounded-[16px] border border-[#E3E8F0] bg-white p-3.5 shadow-[0_16px_40px_-14px_rgba(11,18,32,0.24)]">
              <div
                className="h-[52px] w-[52px] flex-none rounded-[12px] bg-cover bg-center"
                style={coverStyle(eerstvolgend.categorie, eerstvolgend.cover)}
              />
              <div className="min-w-0">
                <div
                  className={`${MONO} text-[10.5px] uppercase leading-none tracking-[0.08em] text-[#1D4ED8]`}
                >
                  Eerstvolgende
                </div>
                <div className="mt-1.5 truncate text-[14.5px] font-bold">
                  {eerstvolgend.titel}
                </div>
                <div className="mt-[3px] truncate text-[12.5px] text-[#5A6472]">
                  {eerstvolgend.dateLine}
                  {eerstvolgend.locatie ? ` · ${eerstvolgend.locatie}` : ''}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Zoekbalk />
      <Statistieken stats={stats} />
    </section>
  )
}

// Eén tegel van de hero-collage: de flyer van een event, of het categorie-decor
// uit `coverStyle` als er geen flyer is. Zonder events blijft het lege decor
// staan — dat leest als "hier komen straks evenementen", niet als een fout.
function HeroTegel({
  event,
  className = '',
  badge,
}: {
  event: PublicEventCard | undefined
  className?: string
  badge?: string
}) {
  const inhoud = (
    <>
      {event?.cover && (
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 to-transparent"
        />
      )}
      {badge && (
        <span className="absolute left-3.5 top-3.5 rounded-full bg-[#0B1220]/[0.82] px-2.5 py-1.5 text-[11.5px] font-bold text-white">
          {badge}
        </span>
      )}
      {event && (
        <span
          className={`absolute inset-x-3.5 bottom-3.5 text-[13px] font-bold ${
            event.cover ? 'text-white' : 'text-[#0B1220]'
          }`}
        >
          {event.titel}
        </span>
      )}
    </>
  )

  const stijl = `relative overflow-hidden rounded-[20px] border border-[#E3E8F0] ${className}`

  if (!event) {
    return <div className={stijl} style={coverStyle(null, null)} />
  }
  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.id }}
      className={stijl}
      style={coverStyle(event.categorie, event.cover)}
    >
      {inhoud}
    </Link>
  )
}

// ── Zoekbalk ────────────────────────────────────────────────────────────────

// De snelfilters wijzen op parameters die /events al valideert.
const snelFilters: Array<{ label: string; search: Record<string, unknown> }> = [
  { label: 'Vandaag', search: { date: 'Vandaag' } },
  { label: 'Dit weekend', search: { date: 'Dit weekend' } },
  { label: 'Gratis', search: { prijsType: 'gratis' } },
  {
    label: 'Muziek & Concerten',
    search: { categories: ['Muziek & Concerten'] },
  },
  { label: 'Nightlife', search: { categories: ['Nightlife'] } },
]

function Zoekbalk() {
  const navigate = useNavigate()
  const [zoekEvent, setZoekEvent] = useState('')
  const [zoekLocatie, setZoekLocatie] = useState('')
  const [zoekDatum, setZoekDatum] = useState('')

  // Zoekbalk → /events met de bestaande searchparams (zoekterm + evt. datum).
  function zoek(e: React.FormEvent) {
    e.preventDefault()
    const q = [zoekEvent, zoekLocatie]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(' ')
    navigate({
      to: '/events',
      search: {
        q: q || undefined,
        date: zoekDatum ? 'Kies datum...' : undefined,
        datum: zoekDatum || undefined,
      },
    })
  }

  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-12">
      <form
        onSubmit={zoek}
        className="flex flex-wrap items-center gap-1 rounded-[28px] border border-[#E9ECF2] bg-[#F3F5F9] p-2.5 pl-2 shadow-[0_10px_30px_-18px_rgba(11,18,32,0.24)] sm:rounded-full"
      >
        <ZoekVeld
          label="Zoek event"
          placeholder="Waar heb je zin in?"
          value={zoekEvent}
          onChange={setZoekEvent}
        >
          <SearchIcon stroke="#3A4453" size={20} />
        </ZoekVeld>
        <span className="my-1.5 hidden w-px self-stretch bg-[#DDE3EC] sm:block" />
        <ZoekVeld
          label="Locatie"
          placeholder="Paramaribo, Suriname"
          value={zoekLocatie}
          onChange={setZoekLocatie}
        >
          <PinIcon stroke="#3A4453" size={20} />
        </ZoekVeld>
        <span className="my-1.5 hidden w-px self-stretch bg-[#DDE3EC] sm:block" />
        <ZoekVeld
          label="Datum"
          type="date"
          value={zoekDatum}
          onChange={setZoekDatum}
        >
          <CalendarIcon />
        </ZoekVeld>
        <button
          type="submit"
          className="flex min-h-[56px] min-w-[140px] flex-none items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-6 text-[15.5px] font-bold text-white hover:bg-[#1737A8]"
        >
          Zoeken
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <span className="mr-0.5 text-[13px] font-semibold text-[#7C8595]">
          Snel:
        </span>
        {snelFilters.map((f) => (
          <Link
            key={f.label}
            to="/events"
            search={f.search}
            className="flex min-h-[38px] items-center rounded-full border border-[#E3E8F0] bg-white px-3.5 text-[13.5px] font-semibold text-[#3A4453] hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
          >
            {f.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function ZoekVeld({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  children,
}: {
  label: string
  placeholder?: string
  value: string
  onChange: (v: string) => void
  type?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-[180px] flex-1 cursor-text items-center gap-3.5 rounded-full px-4 py-2">
      <span className="flex-none">{children}</span>
      <span className="block min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-[#0B1220]">
          {label}
        </span>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full border-0 bg-transparent text-[15px] font-medium text-[#0B1220] outline-none placeholder:text-[#98A0AE]"
        />
      </span>
    </label>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3A4453"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3.5v3M16 3.5v3" />
    </svg>
  )
}

// ── Statistieken ────────────────────────────────────────────────────────────

function Statistieken({ stats }: { stats: HomepageStats }) {
  // Drie tellingen uit de database, plus één regel zonder getal — het vierde
  // blokje in het ontwerp ("< 30 sec van betaling tot ticket") was verzonnen.
  const regels: Array<[string, string]> = [
    [
      String(stats.events),
      stats.events === 1
        ? 'Evenement op het platform'
        : 'Evenementen op het platform',
    ],
    [
      String(stats.organisatoren),
      stats.organisatoren === 1 ? 'Organisator' : 'Organisatoren',
    ],
    [String(stats.tickets), 'Tickets uitgegeven'],
    ['SRD & USD', 'Prijzen in beide valuta'],
  ]

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-11">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-6 border-t border-[#EDF0F5] pt-12">
        {regels.map(([waarde, label]) => (
          <div key={label}>
            <div className="text-[27px] font-extrabold tracking-[-0.02em]">
              {waarde}
            </div>
            <div className="mt-1 text-[13.5px] font-medium text-[#5A6472]">
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Categorieën ─────────────────────────────────────────────────────────────

function Categorieen({ events }: { events: Array<PublicEventCard> }) {
  const rij = useRef<HTMLDivElement>(null)

  // Aantal per categorie uit de echte events; het ontwerp had vaste aantallen.
  const aantallen = new Map<string, number>()
  for (const ev of events) {
    if (ev.categorie)
      aantallen.set(ev.categorie, (aantallen.get(ev.categorie) ?? 0) + 1)
  }

  function scroll(richting: -1 | 1) {
    rij.current?.scrollBy({ left: richting * 428, behavior: 'smooth' })
  }

  return (
    <section className="mx-auto max-w-[1240px] px-6 pb-2 pt-[72px]">
      <SectieKop
        titel="Waar heb je vanavond zin in?"
        subtitel="Acht categorieën, één tik naar wat er speelt."
        linkLabel="Alle categorieën →"
      />
      <div className="mt-6 flex items-center gap-3">
        <PijlKnop
          richting={-1}
          label="Vorige categorieën"
          onClick={() => scroll(-1)}
        />
        <div
          ref={rij}
          className="flex min-w-0 flex-1 gap-3.5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]"
        >
          {eventCategories.map((naam) => {
            const stijl = categoryStyles[naam]
            const aantal = aantallen.get(naam) ?? 0
            return (
              <Link
                key={naam}
                to="/events"
                search={{ categories: [naam] }}
                className="block flex-none basis-[200px] rounded-[16px] border border-[#E9ECF2] bg-white p-[18px] text-[#0B1220] transition hover:-translate-y-0.5 hover:border-[#D6DDE9] hover:shadow-[0_10px_24px_-14px_rgba(11,18,32,0.22)]"
              >
                <div
                  className="grid h-[38px] w-[38px] place-items-center rounded-[11px]"
                  style={{ background: stijl.tint }}
                >
                  <span
                    className={`block h-3.5 w-3.5 ${stijl.rond ? 'rounded-full' : 'rounded-[3px]'}`}
                    style={{ background: stijl.dot }}
                  />
                </div>
                <div className="mt-3.5 text-[15.5px] font-bold">{naam}</div>
                <div className="mt-[3px] text-[13px] font-medium text-[#7C8595]">
                  {aantal === 0
                    ? 'Nog geen events'
                    : `${aantal} ${aantal === 1 ? 'event' : 'events'}`}
                </div>
              </Link>
            )
          })}
        </div>
        <PijlKnop
          richting={1}
          label="Volgende categorieën"
          onClick={() => scroll(1)}
        />
      </div>
    </section>
  )
}

function PijlKnop({
  richting,
  label,
  onClick,
}: {
  richting: -1 | 1
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 flex-none place-items-center rounded-full border border-[#E3E8F0] bg-white hover:border-[#0B1220]"
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#0B1220"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path
          d={richting === -1 ? 'M14.5 5 8 12l6.5 7' : 'M9.5 5 16 12l-6.5 7'}
        />
      </svg>
    </button>
  )
}

// ── Uitgelichte events ──────────────────────────────────────────────────────

function Uitgelicht({
  events,
  currency,
}: {
  events: Array<PublicEventCard>
  currency: ReturnType<typeof useCurrency>
}) {
  return (
    <section className="mx-auto max-w-[1240px] px-6 pt-16">
      {/* Het ontwerp noemt dit "Trending deze week — de meest bekeken
          evenementen". We tellen geen weergaves, dus dat zou een verzonnen
          ordening zijn; dit is gewoon wat er het eerst aankomt. */}
      <SectieKop
        titel="Binnenkort in Suriname"
        subtitel="De eerstvolgende evenementen op het platform."
        linkLabel="Alle evenementen →"
      />
      {events.length === 0 ? (
        <LegeStaat />
      ) : (
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(268px,1fr))] gap-5">
          {events.map((ev) => (
            <EventKaart key={ev.id} event={ev} currency={currency} />
          ))}
        </div>
      )}
    </section>
  )
}

function EventKaart({
  event: ev,
  currency,
}: {
  event: PublicEventCard
  currency: ReturnType<typeof useCurrency>
}) {
  // localStorage is er pas op de client; begin op `false` zodat de server-render
  // en de eerste client-render gelijk zijn (zelfde aanpak als useCurrency).
  const [favoriet, setFavoriet] = useState(false)
  useEffect(() => setFavoriet(isFavoriet(ev.id)), [ev.id])

  const stijl = categoryStyle(ev.categorie)

  return (
    <article className="flex flex-col overflow-hidden rounded-[18px] border border-[#E9ECF2] bg-white transition hover:-translate-y-[3px] hover:shadow-[0_18px_40px_-20px_rgba(11,18,32,0.28)]">
      <div
        className="relative aspect-[16/11] bg-cover bg-center"
        style={coverStyle(ev.categorie, ev.cover)}
      >
        {stijl && ev.categorie && (
          <span
            className="absolute left-3 top-3 rounded-lg px-2.5 py-[5px] text-[11.5px] font-bold"
            style={{ background: stijl.tint, color: stijl.dot }}
          >
            {ev.categorie}
          </span>
        )}
        <button
          type="button"
          onClick={() => setFavoriet(toggleFavoriet(ev.id))}
          aria-label={favoriet ? 'Verwijder uit bewaard' : 'Bewaar evenement'}
          aria-pressed={favoriet}
          className="absolute right-2.5 top-2.5 grid h-[38px] w-[38px] place-items-center rounded-full border border-[#E9ECF2] bg-white/95 hover:border-[#C9D3E3]"
        >
          <HeartIcon stroke={favoriet ? '#DC2626' : '#3A4453'} size={17} />
        </button>
        <span className="absolute bottom-2.5 right-2.5 rounded-[9px] bg-[#0B1220]/[0.86] px-2.5 py-1.5 text-[13px] font-bold text-white">
          {prijsLabel(ev.prijsVanafSrd, currency)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2.5">
          <span
            className={`${MONO} text-[11px] uppercase leading-none tracking-[0.06em] text-[#1D4ED8]`}
          >
            {ev.dateLine}
          </span>
        </div>
        <h3 className="text-[17.5px] font-bold leading-[1.25] tracking-[-0.02em]">
          {ev.titel}
        </h3>
        <div className="flex items-center gap-1.5 text-[13.5px] text-[#5A6472]">
          <PinIcon stroke="#5A6472" size={14} />
          {ev.locatie ?? 'Locatie volgt'}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <span className="min-w-0 truncate text-[13px] font-semibold text-[#3A4453]">
            {ev.organisator}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2.5 border-t border-[#F1F3F8] pt-3">
          <span className="text-[12.5px] font-semibold text-[#5A6472]">
            {ev.aanmeldingen > 0 ? `${ev.aanmeldingen} verkocht` : ''}
          </span>
          <Link
            to="/events/$eventId"
            params={{ eventId: ev.id }}
            className="ml-auto flex min-h-[40px] items-center rounded-[11px] bg-[#F3F5F9] px-4 text-[14px] font-bold text-[#0B1220] hover:bg-[#1D4ED8] hover:text-white"
          >
            Tickets
          </Link>
        </div>
      </div>
    </article>
  )
}

// ── Dit weekend ─────────────────────────────────────────────────────────────

const WEEKENDDAGEN = [
  { label: 'Vrijdag', dag: 5 },
  { label: 'Zaterdag', dag: 6 },
  { label: 'Zondag', dag: 0 },
]

function Weekend({
  events,
  currency,
}: {
  events: Array<PublicEventCard>
  currency: ReturnType<typeof useCurrency>
}) {
  const [dag, setDag] = useState<number | null>(null)
  const zichtbaar =
    dag === null
      ? events
      : events.filter((ev) => new Date(ev.datumStart).getDay() === dag)

  if (events.length === 0) return null

  return (
    <section className="mx-auto max-w-[1240px] px-6 pt-16">
      <div className="overflow-hidden rounded-[20px] border border-[#E9ECF2]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EDF0F5] bg-[#FBFCFE] p-[20px_22px]">
          <div>
            <h2 className="text-[21px] font-extrabold tracking-[-0.025em]">
              Dit weekend
            </h2>
            <p className="mt-1.5 text-[14.5px] text-[#5A6472]">
              {events.length}{' '}
              {events.length === 1 ? 'evenement' : 'evenementen'} van vrijdag
              tot en met zondag
            </p>
          </div>
          <div className="flex gap-1.5">
            <DagTab
              label="Alles"
              actief={dag === null}
              onClick={() => setDag(null)}
            />
            {WEEKENDDAGEN.map((d) => (
              <DagTab
                key={d.dag}
                label={d.label}
                actief={dag === d.dag}
                onClick={() => setDag(d.dag)}
              />
            ))}
          </div>
        </div>

        {zichtbaar.length === 0 ? (
          <div className="px-[22px] py-10 text-center text-[14px] text-[#5A6472]">
            Op die dag staat er nog niets gepland.
          </div>
        ) : (
          zichtbaar.map((ev) => (
            <WeekendRegel key={ev.id} event={ev} currency={currency} />
          ))
        )}

        <div className="p-[16px_22px] text-center">
          <Link
            to="/events"
            search={{ date: 'Dit weekend' }}
            className="inline-flex min-h-[44px] items-center text-[14.5px] font-bold text-[#1D4ED8] hover:text-[#1737A8]"
          >
            Bekijk het hele weekend →
          </Link>
        </div>
      </div>
    </section>
  )
}

function WeekendRegel({
  event: ev,
  currency,
}: {
  event: PublicEventCard
  currency: ReturnType<typeof useCurrency>
}) {
  const stijl = categoryStyle(ev.categorie)
  return (
    <div className="flex flex-wrap items-center gap-[18px] border-b border-[#F1F3F8] p-[16px_22px] hover:bg-[#FBFCFE]">
      <div
        className="h-16 w-[84px] flex-none rounded-[12px] bg-cover bg-center"
        style={coverStyle(ev.categorie, ev.cover)}
      />
      <div className="min-w-0 flex-1 basis-[220px]">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`${MONO} text-[11px] uppercase leading-none tracking-[0.06em] text-[#1D4ED8]`}
          >
            {ev.dateLine}
          </span>
          {stijl && ev.categorie && (
            <span
              className="rounded-[7px] px-2 py-[3px] text-[11px] font-bold"
              style={{ background: stijl.tint, color: stijl.dot }}
            >
              {ev.categorie}
            </span>
          )}
        </div>
        <div className="mt-1.5 text-[16.5px] font-bold tracking-[-0.015em]">
          {ev.titel}
        </div>
        <div className="mt-[3px] text-[13.5px] text-[#5A6472]">
          {ev.locatie ?? 'Locatie volgt'} · {ev.organisator}
        </div>
      </div>
      <div className="text-right">
        <div className="text-[15.5px] font-extrabold">
          {prijsLabel(ev.prijsVanafSrd, currency)}
        </div>
        {ev.aanmeldingen > 0 && (
          <div className="mt-0.5 text-[12.5px] text-[#7C8595]">
            {ev.aanmeldingen} verkocht
          </div>
        )}
      </div>
      <Link
        to="/events/$eventId"
        params={{ eventId: ev.id }}
        className="flex min-h-[44px] items-center rounded-[11px] bg-[#1D4ED8] px-[18px] text-[14.5px] font-bold text-white hover:bg-[#1737A8]"
      >
        Bekijk
      </Link>
    </div>
  )
}

function DagTab({
  label,
  actief,
  onClick,
}: {
  label: string
  actief: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actief}
      className={`min-h-[40px] rounded-[10px] border px-3.5 text-[13.5px] font-bold ${
        actief
          ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
          : 'border-[#E3E8F0] bg-white text-[#3A4453]'
      }`}
    >
      {label}
    </button>
  )
}

// ── Van flyer naar ticket ───────────────────────────────────────────────────

// Herschreven t.o.v. het ontwerp: dat sprak over "reken veilig af in SRD of USD"
// en een beveiligde betaalverbinding. Dit platform verwerkt geen betalingen.
const stappen = [
  {
    n: '1',
    titel: 'Zoek op datum, locatie of categorie',
    tekst:
      'Alles wat er in Suriname speelt op één plek — gefilterd tot wat vanavond of dit weekend voor jou relevant is.',
  },
  {
    n: '2',
    titel: 'Reserveer en spreek af met de organisator',
    tekst:
      'Je reserveert je plek op de site. Betalen doe je rechtstreeks met de organisator; je ziet vooraf wie dat is en wat het kost.',
  },
  {
    n: '3',
    titel: 'Scan je ticket bij de ingang',
    tekst:
      'Zodra je betaling rond is, komt je ticket met QR-code binnen per mail en WhatsApp. Geen printer nodig — bij de deur scannen we je telefoon.',
  },
]

function DrieStappen() {
  return (
    <section className="mt-[72px] border-y border-[#EDF0F5] bg-[#F7F9FC]">
      <div className="mx-auto max-w-[1240px] px-6 py-16">
        <h2 className="text-[clamp(24px,2.4vw,32px)] font-extrabold tracking-[-0.03em]">
          Van flyer naar ticket in drie stappen
        </h2>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5">
          {stappen.map((s) => (
            <div
              key={s.n}
              className="rounded-[18px] border border-[#E9ECF2] bg-white p-6"
            >
              <div className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-[#0B1220] text-[14.5px] font-bold text-white">
                {s.n}
              </div>
              <div className="mt-4 text-[17px] font-bold tracking-[-0.02em]">
                {s.titel}
              </div>
              <p className="mt-2 text-[14.5px] leading-[1.6] text-[#5A6472]">
                {s.tekst}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Voor organisatoren ──────────────────────────────────────────────────────

function VoorOrganisatoren({ stats }: { stats: HomepageStats }) {
  const tegels: Array<[string, string]> = [
    [String(stats.organisatoren), 'Organisatoren op het platform'],
    [String(stats.tickets), 'Tickets uitgegeven'],
    ['0 SRD', 'Kosten om je event te plaatsen'],
    ['Live', 'Verkoop- en scancijfers'],
  ]

  return (
    <section className="mx-auto max-w-[1240px] px-6 pt-[72px]">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-center gap-10 rounded-[24px] bg-[#0B1220] p-[clamp(28px,4vw,56px)]">
        <div>
          <div
            className={`${MONO} text-[11px] uppercase leading-none tracking-[0.12em] text-[#8FA6E8]`}
          >
            Voor organisatoren
          </div>
          <h2 className="mt-4 text-[clamp(26px,3vw,40px)] font-extrabold leading-[1.1] tracking-[-0.03em] text-white">
            Zet je event online in tien minuten.
          </h2>
          <p className="mt-3.5 max-w-[48ch] text-[16.5px] leading-[1.6] text-[#B9C2D2]">
            Maak je event aan, deel één link en volg je verkoop live. Aan de
            deur scan je de QR-codes met je telefoon — ook zonder internet.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/events/new"
              className="flex min-h-[50px] items-center rounded-[12px] bg-white px-5 text-[15.5px] font-bold text-[#0B1220] hover:bg-[#E9ECF2]"
            >
              Event plaatsen
            </Link>
            <Link
              to="/word-organisator"
              className="flex min-h-[50px] items-center rounded-[12px] border border-[#2A3448] px-5 text-[15.5px] font-bold text-white hover:border-[#4A576F]"
            >
              Organisator worden
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          {tegels.map(([waarde, label]) => (
            <div
              key={label}
              className="rounded-[16px] border border-[#1D2637] bg-[#111A2B] p-5"
            >
              <div className="text-[24px] font-extrabold tracking-[-0.02em] text-white">
                {waarde}
              </div>
              <div className="mt-1.5 text-[13px] font-medium text-[#93A0B5]">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ─────────────────────────────────────────────────────────────────────

// Antwoorden herschreven naar hoe dit systeem werkelijk werkt. Het ontwerp
// beloofde online betalen, automatische terugbetaling bij afgelasting en het
// overzetten van een ticket op een andere naam; dat kan het platform geen van
// drieën, dus dat staat er niet.
const faqs = [
  {
    v: 'Hoe ontvang ik mijn ticket?',
    a: 'Zodra je betaling bij de organisator rond is, krijg je je ticket met QR-code per mail en WhatsApp. Geen printer nodig — bij de ingang scannen ze je telefoon.',
  },
  {
    v: 'Hoe en waar betaal ik?',
    a: 'Betalen gaat niet via deze site. Je reserveert hier je plek en spreekt met de organisator af hoe je betaalt. Je ziet vooraf wie de organisator is en wat het ticket kost.',
  },
  {
    v: 'Waarom kan ik kiezen tussen SRD en USD?',
    a: 'Alle prijzen zijn in SRD vastgelegd. De knop bovenaan rekent ze om naar USD zodat je een indicatie hebt; het bedrag dat je afspreekt blijft in SRD.',
  },
  {
    v: 'Wat als een evenement wordt afgelast?',
    a: 'Dan hoor je dat van de organisator. Omdat je betaling rechtstreeks bij de organisator ligt, loopt een terugbetaling ook via hen.',
  },
  {
    v: 'Wat kost het om zelf een event te plaatsen?',
    a: 'Niets. Je maakt je event aan, deelt de link en houdt je verkoop en de scans aan de deur live bij.',
  },
]

function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <section className="mx-auto max-w-[820px] px-6 pb-20 pt-[72px]">
      <h2 className="text-[clamp(24px,2.4vw,32px)] font-extrabold tracking-[-0.03em]">
        Veelgestelde vragen
      </h2>
      <div className="mt-5 border-t border-[#E9ECF2]">
        {faqs.map((f, i) => (
          <div key={f.v} className="border-b border-[#E9ECF2]">
            <button
              type="button"
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              className="flex min-h-[60px] w-full items-center justify-between gap-4 px-1 py-4 text-left text-[16.5px] font-bold text-[#0B1220]"
            >
              {f.v}
              <span className="flex-none text-[22px] font-medium text-[#7C8595]">
                {open === i ? '−' : '+'}
              </span>
            </button>
            {open === i && (
              <p className="max-w-[64ch] px-1 pb-5 text-[15.5px] leading-[1.65] text-[#5A6472]">
                {f.a}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Gedeelde stukjes ────────────────────────────────────────────────────────

function SectieKop({
  titel,
  subtitel,
  linkLabel,
}: {
  titel: string
  subtitel: string
  linkLabel: string
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <h2 className="text-[clamp(24px,2.4vw,32px)] font-extrabold tracking-[-0.03em]">
          {titel}
        </h2>
        <p className="mt-2 text-[16px] text-[#5A6472]">{subtitel}</p>
      </div>
      <Link
        to="/events"
        className="flex min-h-[44px] items-center text-[14.5px] font-bold text-[#1D4ED8] hover:text-[#1737A8]"
      >
        {linkLabel}
      </Link>
    </div>
  )
}

function LegeStaat() {
  return (
    <div className="mt-6 rounded-[16px] border border-dashed border-[#E3E8F0] py-12 text-center text-[14px] text-[#5A6472]">
      Nog geen actieve evenementen. Kom snel terug!
    </div>
  )
}
