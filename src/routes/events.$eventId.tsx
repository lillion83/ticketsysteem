import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteFooter, SiteNav, SitePage, coverStyle, stripe } from '#/components/discovery/site'
import { formatMoney, useCurrency } from '#/components/discovery/currency'
import { getPublicEvent } from '#/server/discovery'

// Event-detailpagina (ontwerp: EventDetail.dc.html), gevoed door de database.
export const Route = createFileRoute('/events/$eventId')({
  loader: ({ params }) => getPublicEvent({ data: params.eventId }),
  component: EventDetailPage,
  errorComponent: NietGevonden,
})

// Accent-paletje voor de agenda-tijdlijn (puur visueel, cyclet per item).
const agendaAccenten: Array<[string, string]> = [
  ['#2563EB', '#DBEAFE'],
  ['#F59E0B', '#FEF3C7'],
  ['#22C55E', '#DCFCE7'],
]

function EventDetailPage() {
  const detail = Route.useLoaderData()
  const currency = useCurrency()

  return (
    <SitePage>
      <SiteNav active="events" />

      <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-8 md:px-12">
        {/* Hero */}
        <div className="relative mb-9 h-[380px] overflow-hidden rounded-[20px]" style={coverStyle(detail.categorie)}>
          <div className="absolute inset-0 bg-[linear-gradient(transparent_40%,rgba(0,0,0,0.75))]" />
          <div className="absolute bottom-7 left-8 text-white">
            <h1 className="mb-2 text-[30px] font-extrabold md:text-[38px]">{detail.titel}</h1>
            <div className="text-[14px] opacity-90">{detail.dateLocationLine}</div>
          </div>
        </div>

        <div className="grid items-start gap-8 md:grid-cols-[1fr_380px]">
          {/* Hoofdinhoud */}
          <div>
            {detail.paragrafen.length > 0 && (
              <Card>
                <h2 className="mb-4 text-[22px] font-extrabold">Over dit Event</h2>
                {detail.paragrafen.map((p, i) => (
                  <p key={i} className="mb-3.5 text-[14.5px] leading-[1.7] text-[#334155] last:mb-0">
                    {p}
                  </p>
                ))}
              </Card>
            )}

            {detail.sprekers.length > 0 && (
              <Card>
                <h2 className="mb-5 text-[22px] font-extrabold">Sprekers/Line-up</h2>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {detail.sprekers.map((s) => (
                    <div key={s.id} className="text-center">
                      <div
                        className="mx-auto mb-2.5 h-[76px] w-[76px] rounded-full"
                        style={
                          s.avatarUrl
                            ? { backgroundImage: `url(${s.avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                            : stripe('#F1F5F9', '#E2E8F0')
                        }
                      />
                      <div className="text-[14px] font-extrabold">{s.naam}</div>
                      {s.rol && <div className="text-[12.5px] text-[#64748B]">{s.rol}</div>}
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
                    const [accent, dotBg] = agendaAccenten[i % agendaAccenten.length]
                    return (
                      <div key={a.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full"
                            style={{ background: dotBg }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2">
                              <rect x="9" y="2" width="6" height="12" rx="3" />
                              <path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" />
                            </svg>
                          </div>
                          {hasLine && <div className="min-h-[24px] w-0.5 flex-1 bg-[#E5E7EB]" />}
                        </div>
                        <div className="mb-4 flex-1 rounded-[14px] border border-[#E5E7EB] p-[16px_18px]">
                          <div className="mb-1.5 flex items-start justify-between">
                            <div className="text-[15px] font-extrabold">{a.titel}</div>
                            <span className="whitespace-nowrap rounded-full bg-[#DBEAFE] px-2.5 py-[3px] text-[12px] font-bold text-[#2563EB]">
                              {a.tijd}
                            </span>
                          </div>
                          {a.subtitel && <div className="mb-2 text-[13px] text-[#64748B]">{a.subtitel}</div>}
                          {a.beschrijving && (
                            <div className="text-[13.5px] leading-[1.6] text-[#334155]">{a.beschrijving}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}

            {detail.tickets.length > 0 && (
              <Card last>
                <h2 className="mb-5 text-[22px] font-extrabold">Tickets</h2>
                <div className="flex flex-col gap-4">
                  {detail.tickets.map((t) => (
                    <div key={t.id} className="rounded-[14px] border border-[#E5E7EB] p-[18px]">
                      <div className="mb-2 flex items-start justify-between gap-4">
                        <div className="text-[16px] font-extrabold">{t.naam}</div>
                        <div className="whitespace-nowrap text-[16px] font-extrabold text-[#2563EB]">
                          {formatMoney(t.prijsSrd, t.prijsUsd, currency)}
                        </div>
                      </div>
                      {t.features.length > 0 && (
                        <ul className="flex flex-col gap-1.5">
                          {t.features.map((f, i) => (
                            <li key={i} className="flex items-center gap-2 text-[13.5px] text-[#334155]">
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {detail.dateLong}
                </DetailRow>
                <DetailRow>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 3" />
                  </svg>
                  {detail.timeRange}
                </DetailRow>
                {detail.locatie && (
                  <DetailRow>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                      <path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {detail.locatie}
                  </DetailRow>
                )}
              </div>
              <a href="#kaart" className="mb-3.5 inline-block text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
                Bekijk op Kaart
              </a>
              <div className="relative mb-5 h-[120px] rounded-[12px]" style={stripe('#F0FDF4', '#DCFCE7')}>
                <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#2563EB] shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
              </div>
              <div className="mb-0.5 text-[13px] text-[#64748B]">Vanaf</div>
              <div className="mb-4 text-[22px] font-extrabold text-[#2563EB]">
                {detail.prijsVanafSrd === null
                  ? 'Gratis'
                  : formatMoney(detail.prijsVanafSrd, detail.prijsVanafUsd, currency)}
              </div>
              {/* Registreer Nu → wire aan het bestaande checkout-/ticketflow zodra
                  dat publiek beschikbaar is (nu nog placeholder). */}
              <a
                href="#registreer"
                className="mb-3 block rounded-full bg-[#2563EB] py-3.5 text-center text-[15px] font-bold text-white hover:bg-[#1D4ED8]"
              >
                Registreer Nu →
              </a>
              <div className="flex gap-2.5">
                <RailButton>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2">
                    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
                  </svg>
                  Save
                </RailButton>
                <RailButton>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2">
                    <circle cx="18" cy="5" r="3" />
                    <circle cx="6" cy="12" r="3" />
                    <circle cx="18" cy="19" r="3" />
                    <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
                  </svg>
                  Share
                </RailButton>
              </div>
            </div>

            <div className="flex items-center gap-3.5 rounded-[16px] border border-[#E5E7EB] p-5">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#0F172A] font-extrabold text-white">
                {detail.organisator.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-[12px] text-[#64748B]">Georganiseerd door</div>
                <div className="text-[14.5px] font-extrabold">{detail.organisator}</div>
              </div>
              <a href="#volgen" className="text-[13.5px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
                Volgen
              </a>
            </div>

            {detail.faqs.length > 0 && (
              <div className="rounded-[16px] border border-[#E5E7EB] p-6">
                <h3 className="mb-3.5 text-[18px] font-extrabold">Veelgestelde Vragen</h3>
                {detail.faqs.map((f) => (
                  <details
                    key={f.id}
                    className="border-t border-[#F1F5F9] py-3.5 [&_summary::-webkit-details-marker]:hidden"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-[14px] font-bold">
                      {f.vraag}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </summary>
                    {f.antwoord && <div className="mt-2.5 text-[13.5px] leading-[1.6] text-[#64748B]">{f.antwoord}</div>}
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

function Card({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return <div className={`rounded-[16px] border border-[#E5E7EB] p-7 ${last ? '' : 'mb-6'}`}>{children}</div>
}

function DetailRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2.5 text-[14px] text-[#334155]">{children}</div>
}

function RailButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#E5E7EB] py-3 text-[13.5px] font-bold hover:bg-[#F1F5F9]">
      {children}
    </button>
  )
}
