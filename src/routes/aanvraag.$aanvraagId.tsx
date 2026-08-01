import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { formatPrice, useCurrency } from '#/components/discovery/currency'
import { getPubliekeAanvraag, meldBetaling } from '#/server/ticketaanvragen'
import type { PubliekeAanvraag } from '#/server/ticketaanvragen'
import { whatsappLink } from '#/lib/whatsapp'
import { betaalAppLabel } from '#/lib/betaalmethoden'

// Bevestigingspagina voor de bezoeker — ontwerp: "Aanvraag.dc.html", toestand
// `bevestigd` / `wacht` / `betaald`. Publiek en zonder login: het uuid in de URL
// is de sleutel, zoals de ticketcode dat is in `t.$code`.
//
// Bewust géén SiteNav/SiteFooter: dit is een telefoonscherm dat je vanuit het
// aanvraagformulier binnenvalt, geen pagina om vanaf te navigeren. Het ontwerp
// zet er dan ook niets omheen.
//
// De pagina toont wat de bezoeker gekozen heeft, niet alle methoden naast
// elkaar: koos hij een betaalverzoek, dan is de bankrekening ruis. Zonder keuze
// (oude aanvragen, of een event zonder methoden) valt hij terug op de volledige
// lijst.
//
// Hier gebeurt geen betaling (harde regel 6). "Ik heb overgemaakt" is een
// melding van de bezoeker, geen bevestiging: de organisator drukt in de admin op
// "Betaling ontvangen & ticket sturen" en dát zet de status om.

export const Route = createFileRoute('/aanvraag/$aanvraagId')({
  loader: ({ params }) => getPubliekeAanvraag({ data: params.aanvraagId }),
  component: AanvraagPagina,
  errorComponent: NietGevonden,
})

/** Hoe lang een aanvraag geldig blijft; spiegelt GELDIG_UREN op de server. */
const GELDIG_UREN = 48

// De kop kleurt mee met de stand. 'afgewezen' is de historische schrijfwijze van
// 'geannuleerd'; beide horen bij dezelfde kop.
const KOP: Record<
  string,
  { teken: string; kleur: string; titel: (voornaam: string) => string }
> = {
  nieuw: { teken: '✓', kleur: '#22C55E', titel: (v) => `Bedankt, ${v}!` },
  betaald: {
    teken: '✓',
    kleur: '#2563EB',
    titel: () => 'Betaling ontvangen',
  },
  afgehandeld: {
    teken: '🎫',
    kleur: '#22C55E',
    titel: () => 'Je ticket is onderweg',
  },
  geannuleerd: {
    teken: '×',
    kleur: '#EF4444',
    titel: () => 'Aanvraag geannuleerd',
  },
  afgewezen: {
    teken: '×',
    kleur: '#EF4444',
    titel: () => 'Aanvraag geannuleerd',
  },
  verlopen: {
    teken: '×',
    kleur: '#94A3B8',
    titel: () => 'Aanvraag verlopen',
  },
}

/**
 * Waar de aanvraag in de vier stappen staat. Let op het verschil tussen fase 2
 * en 3: bij 2 zegt de bezoeker dat hij betaald heeft, bij 3 heeft de organisator
 * dat bevestigd. Alleen dat laatste telt voor de voorraad.
 */
function faseVan(aanvraag: PubliekeAanvraag): number {
  if (aanvraag.status === 'afgehandeld') return 4
  if (aanvraag.status === 'betaald') return 3
  return aanvraag.betalingGemeldOp ? 2 : 1
}

function AanvraagPagina() {
  const aanvraag = Route.useLoaderData()
  const currency = useCurrency()
  const kop = KOP[aanvraag.status] ?? KOP.nieuw
  const voornaam = aanvraag.naam.trim().split(/\s+/)[0]
  // Betalen heeft alleen zin zolang er nog niets binnen is.
  const nogTeBetalen = aanvraag.status === 'nieuw'
  const fase = faseVan(aanvraag)

  // Welke methode de bezoeker koos. Zonder keuze tonen we alles wat het event
  // aanbiedt — dat is het gedrag van vóór de betaalverzoek-flow.
  const gekozen = aanvraag.gekozenSoort
  const zichtbaar = gekozen
    ? aanvraag.betaalmethoden.filter((m) => m.soort === gekozen)
    : aanvraag.betaalmethoden

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-[430px]">
        {/* Kop — donker, met de bevestiging als eerste wat je ziet. */}
        <div className="bg-[#0F172A] px-[22px] pt-[34px] pb-[30px] text-center">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[26px] font-extrabold text-white"
            style={{ background: kop.kleur }}
          >
            {kop.teken}
          </div>
          <div className="mt-4 text-[22px] font-extrabold tracking-[-0.01em] text-white">
            {kop.titel(voornaam)}
          </div>
          <div className="mt-1.5 text-[14px] leading-[1.5] text-[#94A3B8]">
            <KopRegel aanvraag={aanvraag} />
          </div>
        </div>

        <div className="flex flex-col gap-[18px] px-[22px] pt-5 pb-7">
          {/* Samenvatting: wat, wanneer, hoeveel — één regel, geen tabel. */}
          <div className="flex items-center justify-between gap-4 rounded-[14px] border border-[#E5E7EB] px-4 py-3.5">
            <div>
              <div className="text-[14.5px] font-extrabold">
                {aanvraag.aantal}× {aanvraag.typeNaam}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[#64748B]">
                {aanvraag.dateLong} · {aanvraag.timeRange}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-bold text-[#64748B]">
                Te betalen
              </div>
              <div className="text-[17px] font-extrabold">
                {formatPrice(aanvraag.totaalSrd, currency)}
              </div>
            </div>
          </div>

          {nogTeBetalen &&
            zichtbaar.map((m) => (
              <MethodeBlok
                key={m.soort}
                aanvraag={aanvraag}
                soort={m.soort}
                gegevens={m.gegevens}
              />
            ))}

          {/* De tijdlijn staat er zolang er nog iets te gebeuren staat. Is het
              ticket verstuurd, dan is de tijdlijn geschiedenis en de e-ticket-
              kaart het antwoord. */}
          {aanvraag.status !== 'afgehandeld' &&
            aanvraag.status !== 'geannuleerd' &&
            aanvraag.status !== 'afgewezen' &&
            aanvraag.status !== 'verlopen' && (
              <Tijdlijn aanvraag={aanvraag} fase={fase} />
            )}

          {nogTeBetalen && <Acties aanvraag={aanvraag} />}

          {aanvraag.status === 'afgehandeld' && <ETicket />}

          {aanvraag.instructies && nogTeBetalen && (
            <p className="text-[12.5px] leading-[1.55] whitespace-pre-line text-[#64748B]">
              {aanvraag.instructies}
            </p>
          )}

          <div className="rounded-[14px] bg-[#F8FAFC] px-4 py-3.5 text-[12.5px] leading-[1.55] text-[#475569]">
            {nogTeBetalen ? (
              <Geldigheidsregel aanvraag={aanvraag} />
            ) : (
              <>
                Vragen over je ticket? Neem contact op met{' '}
                <strong className="text-[#0F172A]">
                  {aanvraag.organisator}
                </strong>
                .
              </>
            )}
          </div>

          <Link
            to="/events/$eventId"
            params={{ eventId: aanvraag.eventId }}
            className="text-center text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
          >
            Terug naar het event
          </Link>
        </div>
      </div>
    </main>
  )
}

/** De regel onder de kop, per stand en per gekozen methode. */
function KopRegel({ aanvraag }: { aanvraag: PubliekeAanvraag }) {
  const event = (
    <span className="font-bold text-white">{aanvraag.eventTitel}</span>
  )
  const app = aanvraag.gekozenApp
    ? betaalAppLabel(aanvraag.gekozenApp)
    : 'je betaalapp'

  if (aanvraag.status === 'afgehandeld') {
    return <>Je e-ticket met QR-code voor {event} is verstuurd.</>
  }
  if (aanvraag.status === 'betaald') {
    return <>Je betaling voor {event} is binnen. Je e-ticket wordt gemaakt.</>
  }
  if (aanvraag.status !== 'nieuw') {
    return <>Je ticketaanvraag voor {event} is niet meer geldig.</>
  }
  // Bezoeker heeft zelf gemeld dat hij betaald heeft.
  if (aanvraag.betalingGemeldOp) {
    return (
      <>
        Bedankt — de organisator kijkt na of je betaling voor {event} binnen is.
        Daarna volgt je e-ticket automatisch.
      </>
    )
  }
  if (aanvraag.gekozenSoort === 'bank') {
    return (
      <>
        Je tickets voor {event} staan voor je klaar. Hieronder staan de
        betaalgegevens.
      </>
    )
  }
  if (aanvraag.gekozenSoort === 'contant') {
    return (
      <>
        Je tickets voor {event} staan voor je klaar. Hieronder lees je waar je
        contant betaalt.
      </>
    )
  }
  if (aanvraag.gekozenSoort === 'whatsapp') {
    return (
      <>
        Je tickets voor {event} staan voor je klaar. De organisator stuurt je zo
        een betaalverzoek in {app}.
      </>
    )
  }
  return <>Je ticketaanvraag voor {event} is ontvangen.</>
}

/**
 * De teller uit het ontwerp: "Nog 47 uur 52 min geldig", met de balk erbij.
 *
 * Pas na de eerste render: de server en de browser rekenen anders laat, en een
 * verschil van een minuut is genoeg voor een hydratiefout. Tot dat moment blijft
 * de plek leeg in plaats van dat er een verkeerde tijd staat.
 *
 * Let op: niets zet een aanvraag ooit op 'verlopen'. Deze teller is dus een
 * mededeling, geen deadline die het systeem handhaaft.
 */
function Teller({ vervaltOp }: { vervaltOp: string | null }) {
  const [nu, setNu] = useState<number | null>(null)

  useEffect(() => {
    setNu(Date.now())
    const timer = setInterval(() => setNu(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  if (!vervaltOp || nu === null) return null

  const deadline = new Date(vervaltOp).getTime()
  const over = Math.max(0, deadline - nu)
  const uren = Math.floor(over / 3600000)
  const minuten = Math.floor((over % 3600000) / 60000)
  const voortgang = Math.min(100, (over / (GELDIG_UREN * 3600000)) * 100)
  const datum = new Date(deadline).toLocaleString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-bold">
          {over === 0
            ? 'Niet meer geldig'
            : `Nog ${uren} uur ${String(minuten).padStart(2, '0')} min geldig`}
        </span>
        <span className="text-[12px] text-[#94A3B8]">vervalt {datum}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-[#F1F5F9]">
        <div
          className="h-full bg-[#F59E0B]"
          style={{ width: `${voortgang}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Het blok per betaalmethode: chip, uitleg, de gegevens die de organisator
 * invulde, en de teller. De inhoud verschilt per soort; de omlijsting niet.
 */
function MethodeBlok({
  aanvraag,
  soort,
  gegevens,
}: {
  aanvraag: PubliekeAanvraag
  soort: string
  gegevens: Record<string, string | undefined>
}) {
  const currency = useCurrency()
  const gemeld = Boolean(aanvraag.betalingGemeldOp)
  const app = aanvraag.gekozenApp ? betaalAppLabel(aanvraag.gekozenApp) : null

  if (soort === 'whatsapp') {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB]">
        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          <Chip
            kleur={gemeld ? '#2563EB' : '#B45309'}
            stip={gemeld ? '#2563EB' : '#F59E0B'}
            tekst={gemeld ? 'Betaling gemeld' : 'Verzoek onderweg'}
          />
          <div className="text-[15.5px] font-extrabold">
            {gemeld
              ? 'We controleren je betaling'
              : `De organisator stuurt je zo een betaalverzoek`}
          </div>
          <div className="text-[13px] leading-[1.55] text-[#64748B]">
            {gemeld
              ? 'Zodra de organisator je betaling heeft gezien, krijg je automatisch je e-ticket.'
              : `Je krijgt een bericht via WhatsApp met een betaalverzoek${
                  app ? ` in ${app}` : ''
                }. Meestal binnen een paar minuten, uiterlijk binnen een dag.`}
          </div>
          <Teller vervaltOp={aanvraag.vervaltOp} />
        </div>
        <div className="flex flex-col gap-2.5 border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3.5">
          {app && <Regel label="Betaalapp" waarde={app} />}
          <Regel label="Kenmerk" waarde={aanvraag.kenmerk} mono />
          {gegevens.nummer && (
            <Regel label="Verzoek van" waarde={gegevens.nummer} />
          )}
        </div>
      </div>
    )
  }

  if (soort === 'bank') {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#E5E7EB]">
        <div className="flex flex-col gap-2.5 px-4 py-3.5">
          <Chip
            kleur={gemeld ? '#2563EB' : '#B45309'}
            stip={gemeld ? '#2563EB' : '#F59E0B'}
            tekst={gemeld ? 'Betaling gemeld' : 'Wacht op je overschrijving'}
          />
          <div className="text-[15.5px] font-extrabold">
            {gemeld
              ? 'We controleren je overschrijving'
              : `Maak ${formatPrice(aanvraag.totaalSrd, currency)} over`}
          </div>
          <div className="text-[13px] leading-[1.55] text-[#64748B]">
            {gemeld
              ? 'Bedankt — de organisator kijkt na of het bedrag is bijgeschreven. Zodra dat zo is, krijg je automatisch je e-ticket.'
              : `Gebruik ${aanvraag.kenmerk} als omschrijving, dan koppelt de organisator je betaling meteen aan deze aanvraag.`}
          </div>
        </div>
        <div className="border-t border-[#F1F5F9] bg-[#F8FAFC] px-4 pt-1.5 pb-3">
          <Rij label="Bank" waarde={gegevens.bank} />
          <Rij label="Rekeningnummer" waarde={gegevens.rekening} mono />
          <Rij label="Ten name van" waarde={gegevens.tenName} />
          <Rij
            label="Bedrag"
            waarde={formatPrice(aanvraag.totaalSrd, currency)}
          />
          <Rij label="Omschrijving" waarde={aanvraag.kenmerk} mono laatste />
        </div>
        <div className="border-t border-[#F1F5F9] px-4 py-3">
          <Teller vervaltOp={aanvraag.vervaltOp} />
        </div>
      </div>
    )
  }

  if (soort === 'contant') {
    return (
      <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#E5E7EB] px-4 py-3.5">
        <div className="text-[15.5px] font-extrabold">
          Waar je contant betaalt
        </div>
        <div className="text-[13px] leading-[1.55] text-[#64748B]">
          {gegevens.tekst ??
            'Spreek met de organisator af waar en wanneer je contant betaalt.'}{' '}
          Noem kenmerk {aanvraag.kenmerk}, dan krijg je je e-ticket direct.
        </div>
        <Teller vervaltOp={aanvraag.vervaltOp} />
      </div>
    )
  }

  return null
}

/**
 * "Wat gebeurt er nu?" — vier stappen, met een vinkje voor wat achter de rug is
 * en een blauwe stip voor waar het nu op wacht. De teksten verschillen per
 * methode, de vorm niet.
 */
function Tijdlijn({
  aanvraag,
  fase,
}: {
  aanvraag: PubliekeAanvraag
  fase: number
}) {
  const currency = useCurrency()
  const bedrag = formatPrice(aanvraag.totaalSrd, currency)
  const app = aanvraag.gekozenApp
    ? betaalAppLabel(aanvraag.gekozenApp)
    : 'je betaalapp'

  const rijen: Array<[string, string]> =
    aanvraag.gekozenSoort === 'bank'
      ? [
          [
            'Je aanvraag is binnen',
            `De organisator ziet hem direct in zijn dashboard, met kenmerk ${aanvraag.kenmerk}.`,
          ],
          [
            `Je maakt ${bedrag} over`,
            `Naar de rekening hierboven, met ${aanvraag.kenmerk} als omschrijving. Zonder kenmerk duurt het langer.`,
          ],
          [
            'De organisator bevestigt je betaling',
            'Zodra het bedrag is bijgeschreven — meestal binnen één werkdag.',
          ],
          [
            'Je e-ticket wordt verstuurd',
            'Met QR-code, naar je WhatsApp en e-mail.',
          ],
        ]
      : aanvraag.gekozenSoort === 'contant'
        ? [
            [
              'Je aanvraag is binnen',
              `De organisator houdt ${aanvraag.aantal} ${aanvraag.aantal === 1 ? 'ticket' : 'tickets'} voor je vast.`,
            ],
            ['Je betaalt contant', 'Op de plek en tijd die hierboven staan.'],
            [
              'De organisator bevestigt je betaling',
              'Direct bij het afrekenen.',
            ],
            [
              'Je e-ticket wordt verstuurd',
              'Met QR-code, naar je WhatsApp en e-mail.',
            ],
          ]
        : [
            [
              'Je aanvraag is binnen',
              `De organisator ziet hem direct in zijn dashboard, met je keuze voor ${app}.`,
            ],
            [
              'Je ontvangt een betaalverzoek',
              `Via WhatsApp, te betalen in ${app}. Meestal binnen een paar minuten.`,
            ],
            [
              'Je rondt de betaling af',
              `Je opent ${app} en bevestigt ${bedrag}.`,
            ],
            [
              'Je e-ticket wordt verstuurd',
              'Met QR-code, naar je WhatsApp en e-mail.',
            ],
          ]

  return (
    <div>
      <div className="text-[15.5px] font-extrabold">Wat gebeurt er nu?</div>
      <div className="mt-3">
        {rijen.map(([titel, tekst], i) => {
          const klaar = i < fase
          const nu = i === fase
          return (
            <div key={i} className="grid grid-cols-[28px_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-2 text-[12px] font-extrabold"
                  style={{
                    background: klaar ? '#DCFCE7' : nu ? '#2563EB' : '#fff',
                    color: klaar ? '#16A34A' : nu ? '#fff' : '#94A3B8',
                    borderColor: klaar ? '#BBF7D0' : nu ? '#2563EB' : '#E5E7EB',
                  }}
                >
                  {klaar ? '✓' : i + 1}
                </span>
                {i < rijen.length - 1 && (
                  <span
                    className="w-0.5 min-h-3 flex-1"
                    style={{ background: klaar ? '#BBF7D0' : '#F1F5F9' }}
                  />
                )}
              </div>
              <div className="pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-[14px] font-extrabold"
                    style={{ color: klaar || nu ? '#0F172A' : '#64748B' }}
                  >
                    {titel}
                  </span>
                  {(klaar || nu) && (
                    <span
                      className="rounded-full px-[7px] py-0.5 text-[10.5px] font-extrabold tracking-[0.06em] uppercase"
                      style={{
                        background: klaar ? '#DCFCE7' : '#DBEAFE',
                        color: klaar ? '#16A34A' : '#2563EB',
                      }}
                    >
                      {klaar ? 'Klaar' : 'Nu'}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[12.5px] leading-[1.55] text-[#64748B]">
                  {tekst}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * De knoppen onder de tijdlijn: het gesprek met de organisator, en bij bank en
 * contant de melding "Ik heb overgemaakt". Die melding zet alleen een stempel —
 * de organisator bevestigt het geld.
 */
function Acties({ aanvraag }: { aanvraag: PubliekeAanvraag }) {
  const router = useRouter()
  const [bezig, setBezig] = useState(false)
  const gemeld = Boolean(aanvraag.betalingGemeldOp)

  // Het nummer van de gekozen methode, met de organisatie als terugval voor
  // events van vóór de per-methode velden.
  const methodeNummer = aanvraag.betaalmethoden.find(
    (m) => m.soort === 'whatsapp',
  )?.gegevens.nummer
  const tekst = `Hoi, ik heb ${aanvraag.aantal}× ${aanvraag.typeNaam} aangevraagd voor ${aanvraag.eventTitel} op naam van ${aanvraag.naam}. Kenmerk ${aanvraag.kenmerk}.`
  const waUrl = whatsappLink(
    methodeNummer ?? aanvraag.organisatorTelefoon,
    tekst,
  )

  // Melden heeft alleen zin als de bezoeker zelf iets overmaakt of afgeeft; bij
  // een betaalverzoek ziet de organisator de betaling in zijn eigen app.
  const kanMelden =
    !gemeld &&
    (aanvraag.gekozenSoort === 'bank' || aanvraag.gekozenSoort === 'contant')

  async function meld() {
    setBezig(true)
    try {
      await meldBetaling({ data: aanvraag.id })
      await router.invalidate()
    } finally {
      setBezig(false)
    }
  }

  if (!waUrl && !kanMelden && !gemeld) return null

  return (
    <div className="flex flex-col gap-2.5">
      {kanMelden && (
        <button
          type="button"
          onClick={meld}
          disabled={bezig}
          className="w-full rounded-full bg-[#2563EB] py-3.5 text-[15px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {bezig ? 'Bezig…' : 'Ik heb betaald'}
        </button>
      )}
      {gemeld && (
        <div className="rounded-[14px] border border-[#E5E7EB] py-3 text-center text-[14px] font-bold text-[#16A34A]">
          Betaling gemeld ✓
        </div>
      )}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-[14px] bg-[#16A34A] px-4 py-[15px] hover:bg-[#15803D]"
        >
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-white/20 text-[15px] font-extrabold text-white">
            W
          </span>
          <span className="flex-1">
            <span className="block text-[15px] font-extrabold text-white">
              Open het gesprek met de organisator
            </span>
            <span className="mt-px block text-[12.5px] text-white/85">
              Vraag je verzoek na of stel een vraag
            </span>
          </span>
          <span className="flex-none text-[18px] text-white">›</span>
        </a>
      )}
    </div>
  )
}

/**
 * Wat er staat zodra het ticket verstuurd is. Bewust géén QR-code hier: de
 * koppeling tussen aanvraag en ticket is een benadering (zie
 * `ticketsVoorAanvraag`), en op een deelbare link de verkeerde QR tonen is
 * erger dan hem niet tonen. De echte QR staat in de mail, in WhatsApp en onder
 * "Mijn tickets".
 */
function ETicket() {
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-[#E5E7EB] px-4 py-[18px]">
      <div className="text-[15.5px] font-extrabold">
        Je e-ticket is verstuurd
      </div>
      <div className="text-[13px] leading-[1.55] text-[#64748B]">
        Je vindt de QR-code in je WhatsApp en e-mail. Laat hem scannen bij de
        ingang — een screenshot werkt ook, zonder internet.
      </div>
      <Link
        to="/mijn-ticket"
        className="w-full rounded-full bg-[#2563EB] py-3 text-center text-[14.5px] font-bold text-white hover:bg-[#1D4ED8]"
      >
        Bekijk je tickets
      </Link>
    </div>
  )
}

function Geldigheidsregel({ aanvraag }: { aanvraag: PubliekeAanvraag }) {
  const app = aanvraag.gekozenApp ? betaalAppLabel(aanvraag.gekozenApp) : null
  return (
    <>
      Je aanvraag blijft <strong className="text-[#0F172A]">48 uur</strong>{' '}
      geldig. Daarna komen je {aanvraag.aantal}{' '}
      {aanvraag.aantal === 1 ? 'ticket' : 'tickets'} weer vrij.{' '}
      {aanvraag.gekozenSoort === 'whatsapp' ? (
        <>
          Je betaalt pas wanneer je het verzoek {app ? `in ${app} ` : ''}
          bevestigt — nooit op deze pagina.
        </>
      ) : aanvraag.gekozenSoort === 'contant' ? (
        <>
          Noem kenmerk{' '}
          <strong className="text-[#0F172A]">{aanvraag.kenmerk}</strong> bij het
          afrekenen, dan vindt de organisator je aanvraag meteen terug.
        </>
      ) : (
        <>
          Vermeld altijd kenmerk{' '}
          <strong className="text-[#0F172A]">{aanvraag.kenmerk}</strong> —
          zonder omschrijving moet de organisator je betaling handmatig
          opzoeken.
        </>
      )}
    </>
  )
}

function Chip({
  kleur,
  stip,
  tekst,
}: {
  kleur: string
  stip: string
  tekst: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: stip }}
        aria-hidden
      />
      <span
        className="text-[12px] font-extrabold tracking-[0.04em] uppercase"
        style={{ color: kleur }}
      >
        {tekst}
      </span>
    </div>
  )
}

/** Label-waardepaar in de grijze voet van een methodeblok. */
function Regel({
  label,
  waarde,
  mono,
}: {
  label: string
  waarde: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-[#64748B]">{label}</span>
      <span className={mono ? 'font-mono font-medium' : 'font-extrabold'}>
        {waarde}
      </span>
    </div>
  )
}

/** Rij in de bankgegevens. Niet ingevuld = niet tonen, geen lege plek. */
function Rij({
  label,
  waarde,
  mono,
  laatste,
}: {
  label: string
  waarde?: string
  mono?: boolean
  laatste?: boolean
}) {
  if (!waarde) return null
  return (
    <div
      className={`flex justify-between gap-4 py-[9px] text-[13px] ${
        laatste ? '' : 'border-b border-[#EEF2F6]'
      }`}
    >
      <span className="text-[#64748B]">{label}</span>
      <span className={mono ? 'font-mono font-bold' : 'font-extrabold'}>
        {waarde}
      </span>
    </div>
  )
}

function NietGevonden() {
  return (
    <main className="mx-auto max-w-[430px] px-6 py-24 text-center">
      <h1 className="mb-3 text-[24px] font-extrabold">
        Aanvraag niet gevonden
      </h1>
      <p className="mb-6 text-[14.5px] text-[#64748B]">
        Deze link klopt niet of is verlopen. Vraag je ticket opnieuw aan op de
        eventpagina.
      </p>
      <Link
        to="/events"
        className="inline-block rounded-full bg-[#2563EB] px-6 py-3 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
      >
        Bekijk alle events
      </Link>
    </main>
  )
}
