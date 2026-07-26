import { createFileRoute, Link } from '@tanstack/react-router'
import {
  CheckIcon,
  HeartIcon,
  PinIcon,
  SearchIcon,
  SiteFooter,
  SiteNav,
  SitePage,
  UsersIcon,
  coverStyle,
  stripe,
} from '#/components/discovery/site'
import { categories } from '#/components/discovery/data'
import { formatMoney, useCurrency } from '#/components/discovery/currency'
import { listPublicEvents } from '#/server/discovery'

// Homepage van de publieke discovery-front-end (ontwerp: Homepage.dc.html).
// Events komen uit de database (actieve events, alle organisaties).
export const Route = createFileRoute('/')({
  loader: () => listPublicEvents(),
  component: Home,
})

function prijsLabel(
  prijsVanafSrd: number | null,
  prijsVanafUsd: number | null,
  currency: ReturnType<typeof useCurrency>,
): string {
  return prijsVanafSrd === null ? 'Gratis' : formatMoney(prijsVanafSrd, prijsVanafUsd, currency)
}

function Home() {
  const events = Route.useLoaderData()
  const currency = useCurrency()
  const featured = events.slice(0, 3)
  const upcoming = events.slice(3, 6).length > 0 ? events.slice(3, 6) : events.slice(0, 3)

  return (
    <SitePage>
      <SiteNav active="home" />

      {/* Hero */}
      <section className="mx-auto grid max-w-[1280px] items-center gap-14 px-6 pb-10 pt-16 md:grid-cols-2 md:px-12">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#DBEAFE] px-3.5 py-1.5 text-[13px] font-bold text-[#2563EB]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> Nieuw Seizoen 2026
          </div>
          <h1 className="mb-5 text-[40px] font-extrabold leading-[1.08] tracking-[-1px] md:text-[52px]">
            Ontdek Events
            <br />
            Die Inspireren
          </h1>
          <p className="mb-8 max-w-[440px] text-[17px] leading-relaxed text-[#64748B]">
            Vind en boek tickets voor concerten, workshops, conferenties en meer bij jou in de buurt. Word vandaag lid
            van de community.
          </p>
          <div className="flex gap-3.5">
            <Link
              to="/events"
              className="rounded-full bg-[#2563EB] px-7 py-3.5 text-[15px] font-bold text-white hover:bg-[#1D4ED8]"
            >
              Ontdek Events
            </Link>
            <Link
              to="/events/new"
              className="rounded-full border border-[#E5E7EB] bg-white px-7 py-3.5 text-[15px] font-bold text-[#0F172A] hover:border-[#CBD5E1]"
            >
              Verkoop Tickets
            </Link>
          </div>
          <div className="mt-7 flex gap-6 text-[13px] font-semibold text-[#64748B]">
            <span className="flex items-center gap-1.5">
              <CheckIcon /> Geverifieerde Organisatoren
            </span>
            <span className="flex items-center gap-1.5">
              <CheckIcon /> Veilig Betalen
            </span>
          </div>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-3.5">
          <div className="relative row-span-2 overflow-hidden rounded-[20px]" style={stripe('#1E293B', '#0F172A')}>
            <div className="absolute left-3.5 top-3.5 rounded-full bg-white/90 px-3 py-[5px] text-[12px] font-bold text-[#0F172A]">
              Trending
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-white">
              <div className="mb-1.5 text-[12px] font-bold opacity-85">
                {featured[0]?.categorie ?? 'Muziek'} · {featured[0]?.locatie ?? 'Paramaribo'}
              </div>
              <div className="text-[19px] font-extrabold">{featured[0]?.titel ?? 'Neon Night Festival'}</div>
            </div>
          </div>
          <div className="relative min-h-[130px] overflow-hidden rounded-[16px]" style={stripe('#EFF6FF', '#DBEAFE')}>
            <div className="absolute inset-x-2.5 bottom-2.5 text-[12px] font-bold text-[#0F172A]">
              {featured[1]?.titel ?? 'Creative Workshop'}
            </div>
          </div>
          <div className="relative min-h-[130px] overflow-hidden rounded-[16px]" style={stripe('#F0FDF4', '#DCFCE7')}>
            <div className="absolute inset-x-2.5 bottom-2.5 text-[12px] font-bold text-[#0F172A]">
              {featured[2]?.titel ?? 'Live: Future of AI Design'}
            </div>
          </div>
        </div>
      </section>

      {/* Zoekbalk */}
      <section className="mx-auto mb-14 max-w-[1100px] px-6 md:px-12">
        <div className="flex flex-col gap-4 rounded-[18px] border border-[#E5E7EB] bg-white p-[18px_24px] shadow-[0_8px_24px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:gap-0">
          <SearchField label="Event" placeholder="Waar ben je naar op zoek?" divider />
          <SearchField label="Locatie" placeholder="Paramaribo, Suriname" divider />
          <SearchField label="Datum" placeholder="Kies een datum" />
          <Link
            to="/events"
            className="flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-[#2563EB] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D4ED8] md:ml-4"
          >
            <SearchIcon />
            Zoeken
          </Link>
        </div>
      </section>

      {/* Categorieën */}
      <section className="mx-auto mb-16 max-w-[1280px] px-6 md:px-12">
        <SectionHeading title="Ontdek per Categorie" linkLabel="Alles Bekijken →" />
        <div className="flex gap-[18px] overflow-x-auto pb-1.5">
          {categories.map((cat) => (
            <Link
              to="/events"
              search={{ categories: [cat.name] }}
              key={cat.name}
              className="w-[190px] flex-none cursor-pointer"
            >
              <div className="mb-3 h-[130px] rounded-[16px]" style={cat.pattern} />
              <div className="text-[15px] font-bold text-[#0F172A]">{cat.name}</div>
              <div className="text-[13px] text-[#64748B]">{cat.sub}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Uitgelichte events */}
      <section className="bg-[#F8FAFC] px-6 py-14 md:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-7 flex items-baseline justify-between">
            <h2 className="text-[26px] font-extrabold">Uitgelichte Events</h2>
            <div className="flex gap-2">
              <button className="h-[38px] w-[38px] rounded-full border border-[#E5E7EB] bg-white hover:bg-[#F1F5F9]">
                ←
              </button>
              <button className="h-[38px] w-[38px] rounded-full border border-[#E5E7EB] bg-white hover:bg-[#F1F5F9]">
                →
              </button>
            </div>
          </div>
          {featured.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {featured.map((ev) => (
                <Link
                  key={ev.id}
                  to="/events/$eventId"
                  params={{ eventId: ev.id }}
                  className="block overflow-hidden rounded-[16px] border border-[#E5E7EB] bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition hover:shadow-md"
                >
                  <div className="relative h-[170px]" style={coverStyle(ev.categorie)}>
                    {ev.categorie && (
                      <div className="absolute left-3 top-3 rounded-full bg-[#DBEAFE] px-3 py-1 text-[12px] font-bold text-[#2563EB]">
                        {ev.categorie}
                      </div>
                    )}
                    <div className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white">
                      <HeartIcon />
                    </div>
                  </div>
                  <div className="p-[18px]">
                    <div className="mb-2 text-[13px] text-[#64748B]">{ev.dateLine}</div>
                    <div className="mb-1.5 text-[17px] font-extrabold">{ev.titel}</div>
                    <div className="mb-4 flex items-center gap-1.5 text-[13px] text-[#64748B]">
                      <PinIcon />
                      {ev.locatie ?? 'Locatie volgt'}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-[15px] font-extrabold text-[#2563EB]">
                        {prijsLabel(ev.prijsVanafSrd, ev.prijsVanafUsd, currency)}
                      </div>
                      <span className="rounded-full bg-[#2563EB] px-[18px] py-2 text-[13px] font-bold text-white">
                        Details
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Binnenkort */}
      <section className="mx-auto max-w-[1000px] px-6 py-16 md:px-12">
        <SectionHeading title="Binnenkort" linkLabel="Alle Events →" />
        {upcoming.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-col gap-4">
            {upcoming.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-col gap-5 rounded-[16px] border border-[#E5E7EB] p-3.5 sm:flex-row sm:items-center"
              >
                <div className="h-[88px] w-full flex-none rounded-[12px] sm:w-[120px]" style={coverStyle(ev.categorie)} />
                <div className="flex-1">
                  <div className="mb-1.5 flex items-center gap-2.5 text-[12px] text-[#64748B]">
                    {ev.categorie && (
                      <span className="rounded-full bg-[#DBEAFE] px-2.5 py-[3px] font-bold text-[#2563EB]">
                        {ev.categorie}
                      </span>
                    )}
                    {ev.dateLine}
                  </div>
                  <div className="mb-1 text-[16px] font-extrabold">{ev.titel}</div>
                  <div className="flex items-center gap-4 text-[13px] text-[#64748B]">
                    <span className="flex items-center gap-1.5">
                      <PinIcon size={13} />
                      {ev.locatie ?? 'Locatie volgt'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UsersIcon size={13} />
                      {ev.aanmeldingen} deelnemers
                    </span>
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="mb-2 text-[15px] font-extrabold text-[#2563EB]">
                    {prijsLabel(ev.prijsVanafSrd, ev.prijsVanafUsd, currency)}
                  </div>
                  <Link
                    to="/events/$eventId"
                    params={{ eventId: ev.id }}
                    className="inline-block rounded-full bg-[#2563EB] px-5 py-2.5 text-[13px] font-bold text-white hover:bg-[#1D4ED8]"
                  >
                    Boek Nu
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Host-banner */}
      <section className="mx-auto mb-16 max-w-[1280px] px-6 md:px-12">
        <div
          className="relative overflow-hidden rounded-[24px] px-6 py-[72px] text-center md:px-12"
          style={stripe('#1E293B', '#0F172A')}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/55 to-[#0F172A]/75" />
          <div className="relative mx-auto max-w-[560px] text-white">
            <h2 className="mb-3.5 text-[34px] font-extrabold">Host Je Eigen Event</h2>
            <p className="mb-7 text-[16px] leading-relaxed opacity-85">
              Creëer een ervaring die mensen geweldig vinden. Ons platform maakt het makkelijk om te organiseren,
              promoten en tickets te verkopen — in minuten.
            </p>
            <Link
              to="/events/new"
              className="inline-block rounded-full bg-[#2563EB] px-8 py-3.5 text-[15px] font-bold text-white hover:bg-[#1D4ED8]"
            >
              Gratis Starten
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </SitePage>
  )
}

function EmptyState() {
  return (
    <div className="rounded-[16px] border border-dashed border-[#E5E7EB] py-12 text-center text-[14px] text-[#64748B]">
      Nog geen actieve events. Kom snel terug!
    </div>
  )
}

function SearchField({ label, placeholder, divider }: { label: string; placeholder: string; divider?: boolean }) {
  return (
    <div
      className={`flex flex-1 flex-col gap-1 md:px-5 md:first:pl-0 ${
        divider ? 'md:border-r md:border-[#E5E7EB]' : ''
      }`}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#94A3B8]">{label}</span>
      <input
        placeholder={placeholder}
        className="border-none text-[14px] text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
      />
    </div>
  )
}

function SectionHeading({ title, linkLabel }: { title: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex items-baseline justify-between">
      <h2 className="text-[26px] font-extrabold">{title}</h2>
      <Link to="/events" className="text-[14px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
        {linkLabel}
      </Link>
    </div>
  )
}
