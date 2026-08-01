import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { getEventLive } from '#/server/eventLive'
import type { EventLiveData } from '#/server/eventLive'
import { getPublicBaseUrl } from '#/server/delivery'

// Het scherm direct ná publiceren — ontwerp: "Ticketverkoop UX.dc.html", D3
// ("Event live · optimaliseer later-checklist") en sectie 2a stap 3.
//
// Bewust buiten /admin: die route rendert een zijbalk, en dit scherm is in het
// ontwerp een volle breedte met een donkere kop. De trailing underscore in
// `$eventId_` haalt hem uit de nesting van de publieke eventpagina.
//
// De gedachte erachter: publiceren is klaar in drie minuten, en alles wat de
// pagina sterker maakt is optioneel en komt hierna. Niets op deze pagina is
// verplicht.
export const Route = createFileRoute('/events/$eventId_/live')({
  loader: async ({ params }) => {
    const [data, baseUrl] = await Promise.all([
      getEventLive({ data: params.eventId }),
      getPublicBaseUrl(),
    ])
    return { data, baseUrl }
  },
  component: EventLivePagina,
  errorComponent: GeenToegang,
})

type Taak = { titel: string; winst: string; klaar: boolean }

/**
 * De checklist uit het ontwerp, afgeleid uit het event. De winstregels zijn
 * bewust zonder percentages: het ontwerp had er cijfers bij staan ("34% meer"),
 * maar die zijn nergens op gebaseerd en gaan hier naar echte organisatoren.
 */
function taken(gedaan: EventLiveData['gedaan']): Array<Taak> {
  return [
    {
      titel: 'Voeg een beschrijving toe',
      winst: 'Bezoekers weten meteen waar ze naartoe gaan',
      klaar: gedaan.beschrijving,
    },
    {
      titel: 'Zet je line-up erbij',
      winst: 'Bezoekers zoeken op artiestennaam',
      klaar: gedaan.lineup,
    },
    {
      titel: 'Voeg een tweede tickettype toe',
      winst: 'Een VIP-ticket ernaast geeft mensen een keuze',
      klaar: gedaan.tweedeType,
    },
    {
      titel: 'Zet het programma erbij',
      winst: 'Aanvangstijden schelen vragen aan de deur',
      klaar: gedaan.programma,
    },
    {
      titel: 'Voeg een flyer toe',
      winst: 'Je pagina en de deelknop krijgen er een beeld bij',
      klaar: gedaan.flyer,
    },
  ]
}

function EventLivePagina() {
  const { data, baseUrl } = Route.useLoaderData()
  const [gekopieerd, setGekopieerd] = useState(false)
  const url = `${baseUrl}/events/${data.event.id}`
  const lijst = taken(data.gedaan)
  const open = lijst.filter((t) => !t.klaar).length

  // wa.me zonder nummer: WhatsApp laat de organisator zelf kiezen naar wie de
  // tekst gaat. `whatsappLink()` uit src/lib past hier niet — dat is de variant
  // mét vast nummer, voor een ticket naar één koper.
  const whatsappDeelUrl = `https://wa.me/?text=${encodeURIComponent(
    `${data.event.naam} — tickets: ${url}`,
  )}`

  function kopieer() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setGekopieerd(true)
        setTimeout(() => setGekopieerd(false), 2000)
      })
      .catch(() => {})
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {/* Kop */}
      <div className="bg-[#0F172A] px-6 pt-8 pb-7 md:px-12">
        <div className="mx-auto flex max-w-[1180px] flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center rounded-full bg-[#22C55E] px-3 py-[5px] text-[11.5px] font-extrabold text-white">
              LIVE
            </span>
            <h1 className="mt-3.5 text-[26px] font-extrabold tracking-[-0.02em] text-white md:text-[30px]">
              {data.event.naam} staat online
            </h1>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block font-mono text-[13px] text-[#94A3B8] hover:text-white"
            >
              {url}
            </a>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <a
              href={whatsappDeelUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-[#16A34A] px-6 py-3 text-[14px] font-extrabold text-white hover:bg-[#15803D]"
            >
              Deel op WhatsApp
            </a>
            <button
              type="button"
              onClick={kopieer}
              className="rounded-full border border-[#334155] px-[22px] py-3 text-[14px] font-bold text-white hover:bg-[#1E293B]"
            >
              {gekopieerd ? 'Gekopieerd ✓' : 'Kopieer link'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1180px] gap-8 px-6 pt-8 pb-12 md:grid-cols-[1fr_380px] md:px-12">
        {/* Checklist */}
        <div>
          <h2 className="text-[19px] font-extrabold">Maak je pagina sterker</h2>
          <p className="mt-1 mb-4 text-[13.5px] text-[#64748B]">
            Niets hiervan is verplicht. Alles helpt je verkoop.
          </p>
          <div className="flex flex-col gap-2.5">
            {lijst.map((t) => (
              <Link
                key={t.titel}
                to="/admin/events/$eventId"
                params={{ eventId: data.event.id }}
                className="flex items-center gap-3.5 rounded-[14px] border-[1.5px] border-[#E5E7EB] bg-white px-[18px] py-4 hover:border-[#93C5FD]"
              >
                {t.klaar ? (
                  <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-[#22C55E] text-[12px] font-extrabold text-white">
                    ✓
                  </span>
                ) : (
                  <span className="h-[22px] w-[22px] flex-none rounded-full border-2 border-[#CBD5E1] bg-white" />
                )}
                <span className="flex-1">
                  <span className="block text-[15px] font-extrabold">
                    {t.titel}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-[#64748B]">
                    {t.winst}
                  </span>
                </span>
                {!t.klaar && (
                  <span className="flex-none text-[13.5px] font-extrabold text-[#2563EB]">
                    Doen →
                  </span>
                )}
              </Link>
            ))}
          </div>
          {open === 0 && (
            <p className="mt-3 text-[13px] font-semibold text-[#15803D]">
              Alles afgevinkt — je pagina is compleet.
            </p>
          )}
        </div>

        {/* Rechterkolom */}
        <div className="flex flex-col gap-3.5">
          <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-5">
            <div className="text-[12px] font-extrabold tracking-[0.06em] text-[#64748B] uppercase">
              Vandaag
            </div>
            <div className="mt-3.5 flex flex-col gap-3">
              {/* Paginaweergaven worden niet bijgehouden — zelfde eerlijkheid als
                  de trechter op het dashboard, liever een streepje dan een nul
                  die als meting leest. */}
              <Cijfer label="Paginaweergaven" waarde="—" />
              <Cijfer
                label="Ticketaanvragen"
                waarde={String(data.cijfers.aanvragen)}
              />
              <Cijfer
                label="Verkocht"
                waarde={`${data.cijfers.verkocht} / ${data.cijfers.capaciteit}`}
              />
            </div>
            <p className="mt-3 border-t border-[#F1F5F9] pt-2.5 text-[11.5px] text-[#94A3B8]">
              Bezoekersstatistieken worden niet bijgehouden.
            </p>
          </div>

          <div className="rounded-[16px] border border-[#E5E7EB] bg-white p-5 text-[13px] leading-[1.6] text-[#475569]">
            Deze week zijn er{' '}
            <strong className="text-[#0F172A]">
              {data.eventsDezeWeek}{' '}
              {data.eventsDezeWeek === 1 ? 'event' : 'events'}
            </strong>{' '}
            gepubliceerd op het platform. Deel je pagina meteen op WhatsApp —
            dat is de plek waar in Suriname over events gepraat wordt.
          </div>

          <Link
            to="/admin/events/$eventId"
            params={{ eventId: data.event.id }}
            className="rounded-full bg-[#2563EB] py-3 text-center text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
          >
            Naar het beheerscherm
          </Link>
          <Link
            to="/events/$eventId"
            params={{ eventId: data.event.id }}
            className="text-center text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
          >
            Bekijk je pagina zoals bezoekers hem zien
          </Link>
        </div>
      </div>
    </main>
  )
}

function Cijfer({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13.5px] text-[#64748B]">{label}</span>
      <span className="text-[18px] font-extrabold">{waarde}</span>
    </div>
  )
}

function GeenToegang() {
  return (
    <main className="mx-auto max-w-[600px] px-6 py-24 text-center">
      <h1 className="mb-3 text-[26px] font-extrabold">Geen toegang</h1>
      <p className="mb-6 text-[15px] text-[#64748B]">
        Dit event bestaat niet, of het hoort niet bij jouw organisatie.
      </p>
      <Link
        to="/admin/events"
        className="inline-block rounded-full bg-[#2563EB] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
      >
        Naar je events
      </Link>
    </main>
  )
}
