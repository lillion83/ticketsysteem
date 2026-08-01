import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  EventBanner,
  SiteFooter,
  SiteNav,
  SitePage,
  stripe,
} from '#/components/discovery/site'
import { formatPrice, useCurrency } from '#/components/discovery/currency'
import { isFavoriet, toggleFavoriet } from '#/components/discovery/favorites'
import { getPublicEvent } from '#/server/discovery'
import type { PublicEventDetail } from '#/server/discovery'
import { createTicketaanvraag } from '#/server/ticketaanvragen'
// Labels en uitleg voor de betaalkeuze in het aanvraagformulier — zelfde bron
// als het eventformulier en de bevestigingspagina.
import {
  BETAALMETHODE_LABEL,
  BETAALMETHODE_UITLEG,
  betaalAppLabel,
  schrijfKeuze,
} from '#/lib/betaalmethoden'
import type { BetaalmethodeSoort } from '#/lib/betaalmethoden'

// Event-detailpagina (ontwerp: EventDetail.dc.html), gevoed door de database.
export const Route = createFileRoute('/events/$eventId')({
  loader: ({ params }) => getPublicEvent({ data: params.eventId }),
  component: EventDetailPage,
  errorComponent: NietGevonden,
})

/**
 * "Koop ticket" zodra de bezoeker zelf een bedrag kan overmaken (bank of straks
 * online), "Ticket aanvragen" als het bij WhatsApp of contant blijft: dan is het
 * eerst een gesprek met de organisator (Migratieplan §4.2).
 */
function ticketKnopLabel(betaalmethoden: PublicEventDetail['betaalmethoden']) {
  const kopen = betaalmethoden.some(
    (m) => m.soort === 'bank' || m.soort === 'online',
  )
  return kopen ? 'Koop ticket' : 'Ticket aanvragen'
}

// Accent-paletje voor de agenda-tijdlijn (puur visueel, cyclet per item).
const agendaAccenten: Array<[string, string]> = [
  ['#2563EB', '#DBEAFE'],
  ['#F59E0B', '#FEF3C7'],
  ['#22C55E', '#DCFCE7'],
]

function EventDetailPage() {
  const detail = Route.useLoaderData()
  const currency = useCurrency()
  const [reserveerOpen, setReserveerOpen] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(false)

  // Favoriet-status pas op de client laden (localStorage bestaat niet op de server).
  useEffect(() => {
    setOpgeslagen(isFavoriet(detail.id))
  }, [detail.id])

  // Alleen aangeroepen vanuit een client-event, dus window/navigator bestaan hier.
  // Cast: niet elke browser heeft de Web Share API, dus behandel `share` als optioneel.
  function deel() {
    const url = window.location.href
    const nav = navigator as unknown as {
      share?: (d: { title: string; url: string }) => Promise<void>
      clipboard: { writeText: (t: string) => Promise<void> }
    }
    if (nav.share) {
      nav.share({ title: detail.titel, url }).catch(() => {})
    } else {
      nav.clipboard.writeText(url).catch(() => {})
    }
  }

  // Google Maps-zoeklink op basis van de locatie.
  const kaartUrl = detail.locatie
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.locatie)}`
    : null

  return (
    <SitePage>
      <SiteNav active="events" />
      {reserveerOpen && (
        <AanvraagModal
          eventId={detail.id}
          eventTitel={detail.titel}
          dateLong={detail.dateLong}
          tickets={detail.tickets}
          betaalmethoden={detail.betaalmethoden}
          onClose={() => setReserveerOpen(false)}
        />
      )}

      <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-8 md:px-12">
        {/* Hero */}
        <EventBanner
          categorie={detail.categorie}
          cover={detail.cover}
          className="relative mb-9 h-[380px] overflow-hidden rounded-[20px]"
        >
          <div className="absolute inset-0 bg-[linear-gradient(transparent_40%,rgba(0,0,0,0.75))]" />
          <div className="absolute bottom-7 left-8 text-white">
            <h1 className="mb-2 text-[30px] font-extrabold md:text-[38px]">
              {detail.titel}
            </h1>
            <div className="text-[15px] font-semibold">
              {detail.dateLocationLine}
            </div>
          </div>
        </EventBanner>

        <div className="grid items-start gap-8 md:grid-cols-[1fr_380px]">
          {/* Hoofdinhoud */}
          <div>
            {detail.paragrafen.length > 0 && (
              <Card>
                <h2 className="mb-4 text-[22px] font-extrabold">
                  Over dit Event
                </h2>
                {detail.paragrafen.map((p, i) => (
                  <p
                    key={i}
                    className="mb-3.5 text-[14.5px] leading-[1.7] text-[#334155] last:mb-0"
                  >
                    {p}
                  </p>
                ))}
              </Card>
            )}

            {detail.sprekers.length > 0 && (
              <Card>
                <h2 className="mb-5 text-[22px] font-extrabold">
                  Sprekers/Line-up
                </h2>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {detail.sprekers.map((s) => (
                    <div key={s.id} className="text-center">
                      <div
                        className="mx-auto mb-2.5 h-[76px] w-[76px] rounded-full"
                        style={
                          s.avatarUrl
                            ? {
                                backgroundImage: `url(${s.avatarUrl})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : stripe('#F1F5F9', '#E2E8F0')
                        }
                      />
                      <div className="text-[14px] font-extrabold">{s.naam}</div>
                      {s.rol && (
                        <div className="text-[12.5px] text-[#64748B]">
                          {s.rol}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {detail.agenda.length > 0 && (
              <Card>
                <h2 className="mb-5 text-[22px] font-extrabold">Agenda</h2>
                <div className="flex flex-col">
                  {detail.agenda.map((a, i) => {
                    const hasLine = i < detail.agenda.length - 1
                    const [accent, dotBg] =
                      agendaAccenten[i % agendaAccenten.length]
                    return (
                      <div key={a.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full"
                            style={{ background: dotBg }}
                          >
                            <svg
                              width="15"
                              height="15"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke={accent}
                              strokeWidth="2"
                            >
                              <rect x="9" y="2" width="6" height="12" rx="3" />
                              <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
                            </svg>
                          </div>
                          {hasLine && (
                            <div className="min-h-[24px] w-0.5 flex-1 bg-[#E5E7EB]" />
                          )}
                        </div>
                        <div className="mb-4 flex-1 rounded-[14px] border border-[#E5E7EB] p-[16px_18px]">
                          <div className="mb-1.5 flex items-start justify-between">
                            <div className="text-[15px] font-extrabold">
                              {a.titel}
                            </div>
                            <span className="whitespace-nowrap rounded-full bg-[#DBEAFE] px-2.5 py-[3px] text-[12px] font-bold text-[#2563EB]">
                              {a.tijd}
                            </span>
                          </div>
                          {a.subtitel && (
                            <div className="mb-2 text-[13px] text-[#64748B]">
                              {a.subtitel}
                            </div>
                          )}
                          {a.beschrijving && (
                            <div className="text-[13.5px] leading-[1.6] text-[#334155]">
                              {a.beschrijving}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {/* Verkoopt de organisator niet via het platform, dan blijft het
                hele ticketblok weg — flyer en informatie zijn dan de pagina. */}
            {detail.verkoopActief && detail.tickets.length > 0 && (
              <Card last>
                <h2 className="mb-5 text-[22px] font-extrabold">Tickets</h2>
                <div className="flex flex-col gap-4">
                  {detail.tickets.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-[14px] border border-[#E5E7EB] p-[18px]"
                    >
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div className="text-[16px] font-extrabold">
                          {t.naam}
                        </div>
                        <div className="whitespace-nowrap text-[16px] font-extrabold text-[#2563EB]">
                          {formatPrice(t.prijsSrd, currency)}
                        </div>
                      </div>
                      {t.features.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                          {t.features.map((f, i) => (
                            <li
                              key={i}
                              className="flex items-center gap-2 text-[13.5px] text-[#334155]"
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#2563EB"
                                strokeWidth="2.5"
                                className="flex-none"
                              >
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Rechter rail */}
          <div className="flex flex-col gap-5 md:sticky md:top-6">
            <div className="rounded-[16px] border border-[#E5E7EB] p-6">
              <h3 className="mb-4 text-[18px] font-extrabold">Event Detail</h3>
              <div className="mb-4.5 flex flex-col gap-3.5">
                <DetailRow>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {detail.dateLong}
                </DetailRow>
                <DetailRow>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  {detail.timeRange}
                </DetailRow>
                {detail.locatie && (
                  <DetailRow>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2563EB"
                      strokeWidth="2"
                    >
                      <path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {detail.locatie}
                  </DetailRow>
                )}
              </div>
              {kaartUrl && (
                <a
                  href={kaartUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mb-3.5 inline-block text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
                >
                  Bekijk op Kaart
                </a>
              )}
              <div
                className="relative mb-5 h-[120px] rounded-[12px]"
                style={stripe('#F0FDF4', '#DCFCE7')}
              >
                <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#2563EB] shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
              </div>
              {/* Zonder verkoop via het platform geen prijs en geen knop: de
                  bezoeker regelt zijn ticket buiten de site om. */}
              {detail.verkoopActief && (
                <>
                  <div className="mb-0.5 text-[13px] text-[#64748B]">Vanaf</div>
                  <div className="mb-4 text-[22px] font-extrabold text-[#2563EB]">
                    {detail.prijsVanafSrd === null
                      ? 'Gratis'
                      : formatPrice(detail.prijsVanafSrd, currency)}
                  </div>
                  {/* Opent het aanvraagformulier. De organisator registreert de
                      betaling in de admin en stuurt daarna het ticket. */}
                  <button
                    onClick={() => setReserveerOpen(true)}
                    className="mb-3 block w-full rounded-full bg-[#2563EB] py-3.5 text-center text-[15px] font-bold text-white hover:bg-[#1D4ED8]"
                  >
                    {ticketKnopLabel(detail.betaalmethoden)} →
                  </button>
                </>
              )}
              <div className="flex gap-2.5">
                <RailButton
                  onClick={() => setOpgeslagen(toggleFavoriet(detail.id))}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill={opgeslagen ? '#2563EB' : 'none'}
                    stroke={opgeslagen ? '#2563EB' : '#0F172A'}
                    strokeWidth="2"
                  >
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                  {opgeslagen ? 'Opgeslagen' : 'Bewaar'}
                </RailButton>
                <RailButton onClick={deel}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="2"
                  >
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
                  </svg>
                  Deel
                </RailButton>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-[16px] border border-[#E5E7EB] p-5">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#0F172A] font-extrabold text-white">
                {detail.organisator.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-[12px] text-[#64748B]">
                  Georganiseerd door
                </div>
                <div className="text-[14.5px] font-extrabold">
                  {detail.organisator}
                </div>
              </div>
            </div>

            {detail.faqs.length > 0 && (
              <div className="rounded-[16px] border border-[#E5E7EB] p-6">
                <h3 className="mb-3.5 text-[18px] font-extrabold">
                  Veelgestelde Vragen
                </h3>
                {detail.faqs.map((f) => (
                  <details
                    key={f.id}
                    className="border-t border-[#F1F5F9] py-3.5 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-bold">
                      {f.vraag}
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#64748B"
                        strokeWidth="2"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </summary>
                    {f.antwoord && (
                      <div className="mt-2.5 text-[13.5px] leading-[1.6] text-[#64748B]">
                        {f.antwoord}
                      </div>
                    )}
                  </details>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SiteFooter />
    </SitePage>
  )
}

function NietGevonden() {
  return (
    <SitePage>
      <SiteNav active="events" />
      <div className="mx-auto max-w-[600px] px-6 py-24 text-center">
        <h1 className="mb-3 text-[28px] font-extrabold">Event niet gevonden</h1>
        <p className="mb-6 text-[15px] text-[#64748B]">
          Dit event bestaat niet of is niet meer beschikbaar.
        </p>
        <Link
          to="/events"
          className="inline-block rounded-full bg-[#2563EB] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
        >
          Bekijk alle events
        </Link>
      </div>
      <SiteFooter />
    </SitePage>
  )
}

function Card({
  children,
  last,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`rounded-[16px] border border-[#E5E7EB] p-7 ${last ? '' : 'mb-6'}`}
    >
      {children}
    </div>
  )
}

function DetailRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 text-[14px] text-[#334155]">{children}</div>
  )
}

function RailButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E5E7EB] py-3 text-[13.5px] font-bold hover:bg-[#F1F5F9]"
    >
      {children}
    </button>
  )
}

/**
 * Aanvraagformulier — ontwerp "Aanvraag.dc.html", toestand `form`. Verstuurt een
 * publieke ticketaanvraag en stuurt de bezoeker door naar zijn bevestigingspagina.
 *
 * De betaalkeuze staat als radiokaarten in beeld in plaats van in een uitklaplijst,
 * met de app-keuze (Mope/Uni5Pay) inline ónder het betaalverzoek. Dat scheelt een
 * scherm en de knop kan beloven wat er echt gebeurt.
 *
 * Er wordt hier niets betaald (harde regel 6): dit is een voorkeur die de
 * organisator in zijn dashboard terugziet.
 */
function AanvraagModal({
  eventId,
  eventTitel,
  dateLong,
  tickets,
  betaalmethoden,
  onClose,
}: {
  eventId: string
  eventTitel: string
  dateLong: string
  tickets: PublicEventDetail['tickets']
  betaalmethoden: PublicEventDetail['betaalmethoden']
  onClose: () => void
}) {
  const navigate = useNavigate()
  const currency = useCurrency()
  const [ticketTypeId, setTicketTypeId] = useState(tickets[0]?.id ?? '')
  const [naam, setNaam] = useState('')
  const [email, setEmail] = useState('')
  const [telefoon, setTelefoon] = useState('')
  const [aantal, setAantal] = useState(1)
  const [opmerking, setOpmerking] = useState('')
  // Leeg als het event geen betaalmethoden heeft: dan staat de keuze er niet.
  const [soort, setSoort] = useState<BetaalmethodeSoort | ''>(
    betaalmethoden[0]?.soort ?? '',
  )
  const [app, setApp] = useState<string>('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  // Losse veldfouten: het ontwerp kleurt het telefoonveld en zet de app-fout
  // ónder de appkeuze, niet als één melding bovenaan.
  const [veldFout, setVeldFout] = useState<'telefoon' | 'app' | null>(null)

  const gekozenType = tickets.find((t) => t.id === ticketTypeId) ?? tickets[0]
  const apps = betaalmethoden.find((m) => m.soort === soort)?.apps ?? []
  const appNaam = app ? betaalAppLabel(app) : 'je betaalapp'

  async function verstuur(e: React.FormEvent) {
    e.preventDefault()
    // Een betaalverzoek zonder app is een verzoek dat de organisator nergens
    // heen kan sturen; het ontwerp blokkeert daarop.
    if (soort === 'whatsapp' && apps.length > 0 && !app) {
      setVeldFout('app')
      return
    }
    if (soort === 'whatsapp' && !telefoon.trim()) {
      setVeldFout('telefoon')
      return
    }
    setFout(null)
    setVeldFout(null)
    setBezig(true)
    try {
      const { id } = await createTicketaanvraag({
        data: {
          event_id: eventId,
          ticket_type_id: ticketTypeId,
          naam,
          email: email || null,
          telefoon: telefoon || null,
          aantal,
          opmerking: opmerking || null,
          betaalmethode: soort ? schrijfKeuze(soort, app) : null,
        },
      })
      navigate({ to: '/aanvraag/$aanvraagId', params: { aanvraagId: id } })
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Aanvragen mislukt')
      setBezig(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[440px] rounded-[18px] bg-white p-[22px] shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-3.5 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[20px] font-extrabold tracking-[-0.01em]">
              {ticketKnopLabel(betaalmethoden)}
            </h3>
            <div className="mt-0.5 text-[13px] text-[#64748B]">
              {eventTitel} · {dateLong}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[15px] text-[#94A3B8] hover:text-[#0F172A]"
            aria-label="Sluiten"
          >
            ✕
          </button>
        </div>
        {tickets.length === 0 ? (
          <p className="text-[14px] text-[#64748B]">
            Voor dit event zijn nog geen tickettypes beschikbaar.
          </p>
        ) : (
          <form onSubmit={verstuur} className="flex flex-col gap-3.5">
            {/* Wat je krijgt en wat het kost, vóór alle velden — zoals in het
                ontwerp de eerste kaart onder de kop. */}
            <div className="flex items-center justify-between gap-4 rounded-[14px] border border-[#E5E7EB] px-4 py-3.5">
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-extrabold">
                  {aantal}× {gekozenType.naam}
                </div>
                <div className="mt-0.5 text-[12.5px] text-[#64748B]">
                  {dateLong}
                </div>
              </div>
              <div className="flex-none text-right">
                <div className="text-[11px] font-bold text-[#64748B]">
                  Te betalen
                </div>
                <div className="text-[17px] font-extrabold">
                  {formatPrice(gekozenType.prijsSrd * aantal, currency)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_92px] gap-2.5">
              <Veld label="Tickettype">
                <select
                  value={ticketTypeId}
                  onChange={(e) => setTicketTypeId(e.target.value)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px]"
                >
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.naam}
                    </option>
                  ))}
                </select>
              </Veld>
              <Veld label="Aantal">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={aantal}
                  onChange={(e) =>
                    setAantal(Math.min(Math.max(Number(e.target.value), 1), 10))
                  }
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px]"
                />
              </Veld>
            </div>

            <Veld label="Naam">
              <ReserveerInput value={naam} onChange={setNaam} required />
            </Veld>
            <Veld label="E-mail">
              <ReserveerInput value={email} onChange={setEmail} type="email" />
            </Veld>

            {/* WhatsApp-nummer met vaste landcode ervoor. De +597 is beeld, geen
                waarde: `normaliseerTelefoon` zet een kaal nummer zelf om, en zo
                kan iemand met een buitenlands nummer nog steeds +31… typen. */}
            <label className="flex flex-col gap-1">
              <span className="text-[13px] font-bold">WhatsApp-nummer</span>
              <div
                className="flex overflow-hidden rounded-[10px] border bg-[#F8FAFC]"
                style={{
                  borderColor: veldFout === 'telefoon' ? '#EF4444' : '#E5E7EB',
                }}
              >
                <span className="flex items-center border-r border-[#E5E7EB] px-3 text-[14px] text-[#64748B]">
                  +597
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="812 4455"
                  value={telefoon}
                  onChange={(e) => {
                    setTelefoon(e.target.value)
                    if (veldFout === 'telefoon') setVeldFout(null)
                  }}
                  aria-describedby="tel-help"
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-2.5 text-[14px] outline-none"
                />
              </div>
              <span
                id="tel-help"
                className="text-[12px] leading-[1.45]"
                style={{
                  color: veldFout === 'telefoon' ? '#EF4444' : '#94A3B8',
                }}
              >
                {veldFout === 'telefoon'
                  ? 'Vul een geldig mobiel nummer in, bijvoorbeeld 812 4455.'
                  : 'Hierop ontvang je het betaalverzoek en later je e-ticket.'}
              </span>
            </label>
            <p className="-mt-1 text-[12px] text-[#94A3B8]">
              Vul minstens een e-mailadres óf telefoonnummer in.
            </p>

            {/* Voorkeur, geen betaling: de organisator ziet hem in de admin
                terug. Alleen tonen als hij methoden heeft aangezet. */}
            {betaalmethoden.length > 0 && (
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Hoe wil je betalen?"
              >
                <div className="text-[13px] font-bold">Hoe wil je betalen?</div>
                {betaalmethoden.map((m) => (
                  <MethodeKaart
                    key={m.soort}
                    soort={m.soort}
                    gekozen={soort === m.soort}
                    onKies={() => {
                      setSoort(m.soort)
                      setVeldFout(null)
                    }}
                  >
                    {/* De app-keuze hoort bij het betaalverzoek en klapt daar
                        onder open, in plaats van op een eigen scherm. */}
                    {m.soort === 'whatsapp' &&
                      soort === 'whatsapp' &&
                      m.apps.length > 0 && (
                        <div className="flex flex-col gap-2.5 border-t border-[#F1F5F9] pt-3">
                          <div className="text-[12.5px] font-bold">
                            In welke app wil je het verzoek ontvangen?
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {m.apps.map((a) => (
                              <button
                                key={a}
                                type="button"
                                role="radio"
                                aria-checked={app === a}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setApp(a)
                                  setVeldFout(null)
                                }}
                                className={`rounded-[12px] border bg-white px-3 py-2.5 text-left ${
                                  app === a
                                    ? 'border-[#2563EB] shadow-[0_0_0_3px_rgba(37,99,235,0.12)]'
                                    : 'border-[#E5E7EB]'
                                }`}
                              >
                                <div className="text-[14px] font-extrabold">
                                  {betaalAppLabel(a)}
                                </div>
                                <div className="text-[11.5px] text-[#64748B]">
                                  Betaalapp
                                </div>
                              </button>
                            ))}
                          </div>
                          <div className="rounded-[10px] bg-[#F8FAFC] px-3 py-2.5 text-[12px] leading-[1.5] text-[#64748B]">
                            Je betaalt nooit ín WhatsApp. Dat gebruiken we
                            alleen om je het verzoek te sturen en je op de
                            hoogte te houden.
                          </div>
                          {veldFout === 'app' && (
                            <div className="text-[12px] font-semibold text-[#EF4444]">
                              Kies eerst een betaalapp.
                            </div>
                          )}
                        </div>
                      )}
                  </MethodeKaart>
                ))}
                {/* De lege plek uitleggen werkt beter dan hem verzwijgen. */}
                <div className="flex items-center gap-2 rounded-[14px] border border-dashed border-[#E5E7EB] px-4 py-3 opacity-60">
                  <span className="h-[18px] w-[18px] flex-none rounded-full border-2 border-[#E2E8F0]" />
                  <div className="text-[13.5px] font-bold text-[#94A3B8]">
                    Direct online betalen — binnenkort
                  </div>
                </div>
              </div>
            )}

            <Veld label="Opmerking (optioneel)">
              <textarea
                value={opmerking}
                onChange={(e) => setOpmerking(e.target.value)}
                rows={2}
                className="w-full resize-y rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2563EB]"
              />
            </Veld>
            {fout && (
              <p className="text-[13px] font-semibold text-[#EF4444]">{fout}</p>
            )}
            <button
              type="submit"
              disabled={bezig}
              className="mt-1 rounded-full bg-[#2563EB] py-3.5 text-[15px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {bezig ? 'Bezig…' : ctaLabel(soort)}
            </button>
            <div className="text-center text-[12px] leading-[1.5] text-[#94A3B8]">
              {soort === 'whatsapp'
                ? `Je betaalt pas wanneer je het verzoek in ${appNaam} bevestigt.`
                : 'Je kunt je keuze op de volgende pagina nog wijzigen.'}
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

/** De knop belooft precies wat er na het versturen gebeurt. */
function ctaLabel(soort: BetaalmethodeSoort | '') {
  if (soort === 'whatsapp') return 'Vraag je betaalverzoek aan'
  if (soort === 'bank') return 'Aanvragen en bankgegevens tonen'
  return 'Aanvraag versturen'
}

/** Eén radiokaart in de methodenkiezer, met de uitleg onder de titel. */
function MethodeKaart({
  soort,
  gekozen,
  onKies,
  children,
}: {
  soort: BetaalmethodeSoort
  gekozen: boolean
  onKies: () => void
  children?: React.ReactNode
}) {
  return (
    <div
      role="radio"
      aria-checked={gekozen}
      tabIndex={0}
      onClick={onKies}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onKies()
        }
      }}
      className="flex cursor-pointer flex-col gap-3 rounded-[14px] border px-4 py-3.5"
      style={{
        borderColor: gekozen ? '#2563EB' : '#E5E7EB',
        background: gekozen ? '#F8FAFF' : '#fff',
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-2"
          style={{ borderColor: gekozen ? '#2563EB' : '#CBD5E1' }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: gekozen ? '#2563EB' : 'transparent' }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14.5px] font-extrabold">
            {BETAALMETHODE_LABEL[soort]}
          </div>
          <div className="mt-0.5 text-[12.5px] leading-[1.5] text-[#64748B]">
            {BETAALMETHODE_UITLEG[soort]}
          </div>
        </div>
      </div>
      {children}
    </div>
  )
}

function Veld({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] font-bold">{label}</span>
      {children}
    </label>
  )
}

function ReserveerInput({
  value,
  onChange,
  type = 'text',
  required,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <input
      type={type}
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2563EB]"
    />
  )
}
