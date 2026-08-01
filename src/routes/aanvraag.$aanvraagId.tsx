import { createFileRoute, Link } from '@tanstack/react-router'
import { formatPrice, useCurrency } from '#/components/discovery/currency'
import { getPubliekeAanvraag } from '#/server/ticketaanvragen'
import type { PubliekeAanvraag } from '#/server/ticketaanvragen'
import { whatsappLink } from '#/lib/whatsapp'

// Bevestigingspagina voor de bezoeker — ontwerp: "Ticketverkoop UX.dc.html",
// scherm 02 "Bezoeker · bevestiging". Publiek en zonder login: het uuid in de URL
// is de sleutel, zoals de ticketcode dat is in `t.$code`.
//
// Bewust géén SiteNav/SiteFooter: dit is een telefoonscherm dat je vanuit het
// aanvraagformulier binnenvalt, geen pagina om vanaf te navigeren. Het ontwerp
// zet er dan ook niets omheen.
//
// Hier gebeurt geen betaling (harde regel 6). De pagina vertelt hoe de bezoeker
// het geld overmaakt; de organisator drukt daarna in de admin op "Betaling
// ontvangen & ticket sturen".

export const Route = createFileRoute('/aanvraag/$aanvraagId')({
  loader: ({ params }) => getPubliekeAanvraag({ data: params.aanvraagId }),
  component: AanvraagPagina,
  errorComponent: NietGevonden,
})

// Het ontwerp toont één toestand: net aangevraagd. De rest van de statussen komt
// erbij omdat de link deelbaar is en later opnieuw geopend wordt — ze kleuren
// alleen de kop en laten het betaalblok weg. De DB-waarden zijn ongewijzigd;
// 'afgewezen' is de historische schrijfwijze van 'geannuleerd'.
const KOP: Record<
  string,
  {
    teken: string
    kleur: string
    titel: (voornaam: string) => string
    regel: string
  }
> = {
  nieuw: {
    teken: '✓',
    kleur: '#22C55E',
    titel: (v) => `Bedankt, ${v}!`,
    regel: 'is ontvangen.',
  },
  betaald: {
    teken: '✓',
    kleur: '#2563EB',
    titel: () => 'Betaling ontvangen',
    regel: 'is betaald. Je e-ticket wordt klaargemaakt.',
  },
  afgehandeld: {
    teken: '🎫',
    kleur: '#22C55E',
    titel: () => 'Je ticket is onderweg',
    regel: 'is afgerond. Je e-ticket met QR-code is verstuurd.',
  },
  geannuleerd: {
    teken: '×',
    kleur: '#EF4444',
    titel: () => 'Aanvraag geannuleerd',
    regel: 'is ingetrokken.',
  },
  afgewezen: {
    teken: '×',
    kleur: '#EF4444',
    titel: () => 'Aanvraag geannuleerd',
    regel: 'is ingetrokken.',
  },
  verlopen: {
    teken: '×',
    kleur: '#94A3B8',
    titel: () => 'Aanvraag verlopen',
    regel: 'is verlopen zonder betaling.',
  },
}

function AanvraagPagina() {
  const aanvraag = Route.useLoaderData()
  const currency = useCurrency()
  const kop = KOP[aanvraag.status] ?? KOP.nieuw
  const voornaam = aanvraag.naam.trim().split(/\s+/)[0]
  // Betalen heeft alleen zin zolang er nog niets binnen is.
  const nogTeBetalen = aanvraag.status === 'nieuw'

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
            Je ticketaanvraag voor{' '}
            <span className="font-bold text-white">{aanvraag.eventTitel}</span>{' '}
            {kop.regel}
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

          {nogTeBetalen && <Betalen aanvraag={aanvraag} />}

          <div className="rounded-[14px] bg-[#F8FAFC] px-4 py-3.5 text-[12.5px] leading-[1.55] text-[#475569]">
            {nogTeBetalen ? (
              <>
                Je aanvraag blijft{' '}
                <strong className="text-[#0F172A]">48 uur</strong> geldig.
                Vragen? App de organisator direct.
              </>
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

/**
 * Het betaalblok: één kaart per methode die de organisator heeft aangezet, in
 * zijn volgorde. De gegevens komen uit `config` per methode; heeft hij die niet
 * ingevuld, dan valt de kaart terug op zijn instructietekst. Die tekst staat er
 * altijd onder — zonder aangezette methoden is het het enige houvast.
 */
function Betalen({ aanvraag }: { aanvraag: PubliekeAanvraag }) {
  return (
    <div>
      <div className="text-[15.5px] font-extrabold">Voltooi nu je betaling</div>
      <div className="mt-0.5 mb-3 text-[13px] leading-[1.5] text-[#64748B]">
        Zodra je betaling binnen is, krijg je je e-ticket met QR-code.
      </div>

      <div className="flex flex-col gap-2.5">
        {aanvraag.betaalmethoden.map((m) => {
          if (m.soort === 'whatsapp') {
            return (
              <WhatsappRij
                key={m.soort}
                aanvraag={aanvraag}
                nummer={m.gegevens.nummer ?? null}
              />
            )
          }
          if (m.soort === 'bank') {
            return (
              <Kaart key={m.soort} titel="Bankoverschrijving">
                <Regel label="Bank" waarde={m.gegevens.bank} />
                <Regel label="Rekening" waarde={m.gegevens.rekening} mono />
                <Regel label="Ten name van" waarde={m.gegevens.tenName} />
                <Regel label="Kenmerk" waarde={aanvraag.kenmerk} mono laatste />
              </Kaart>
            )
          }
          if (m.soort === 'contant') {
            return (
              <Kaart key={m.soort} titel="Contant">
                <p className="mt-1 text-[13px] leading-[1.5] text-[#64748B]">
                  {m.gegevens.tekst ??
                    'Spreek met de organisator af waar en wanneer je contant betaalt.'}
                </p>
              </Kaart>
            )
          }
          return null
        })}
      </div>

      {aanvraag.instructies && (
        <p className="mt-3 text-[12.5px] leading-[1.55] whitespace-pre-line text-[#64748B]">
          {aanvraag.instructies}
        </p>
      )}
    </div>
  )
}

/** WhatsApp is de gebruikelijkste route in Suriname en krijgt daarom de knop. */
function WhatsappRij({
  aanvraag,
  nummer,
}: {
  aanvraag: PubliekeAanvraag
  nummer: string | null
}) {
  // Het nummer van de methode, met de organisatie als terugval voor events van
  // vóór de per-methode velden.
  const telefoon = nummer ?? aanvraag.organisatorTelefoon
  const tekst = `Hoi, ik heb ${aanvraag.aantal}× ${aanvraag.typeNaam} aangevraagd voor ${aanvraag.eventTitel} op naam van ${aanvraag.naam}. Kenmerk ${aanvraag.kenmerk}.`
  const url = whatsappLink(telefoon, tekst)

  if (!url) {
    return (
      <Kaart titel="WhatsApp">
        <p className="mt-1 text-[13px] leading-[1.5] text-[#64748B]">
          De organisator handelt de betaling af via WhatsApp. Zijn nummer staat
          in de instructies hieronder.
        </p>
      </Kaart>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-[14px] bg-[#16A34A] px-4 py-[15px] hover:bg-[#15803D]"
    >
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-white/20 text-[15px] font-extrabold text-white">
        W
      </span>
      <span className="flex-1">
        <span className="block text-[15px] font-extrabold text-white">
          Betaal via WhatsApp
        </span>
        <span className="mt-px block text-[12.5px] text-white/85">
          Stuur je betaalbewijs naar {telefoon}
        </span>
      </span>
      <span className="flex-none text-[18px] text-white">›</span>
    </a>
  )
}

function Kaart({
  titel,
  children,
}: {
  titel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[14px] border border-[#E5E7EB] px-4 py-[15px]">
      <div className="text-[14.5px] font-extrabold">{titel}</div>
      {children}
    </div>
  )
}

/** Regel in de bankkaart. Niet ingevuld = niet tonen, geen lege plek. */
function Regel({
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
      className={`flex justify-between gap-4 py-[5px] text-[13px] ${
        laatste ? '' : 'border-b border-[#F1F5F9]'
      }`}
    >
      <span className="text-[#64748B]">{label}</span>
      <span className={mono ? 'font-mono font-medium' : 'font-bold'}>
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
