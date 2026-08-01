import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteFooter, SiteNav, SitePage } from '#/components/discovery/site'
import { formatPrice, useCurrency } from '#/components/discovery/currency'
import { getPubliekeAanvraag } from '#/server/ticketaanvragen'
import type { PubliekeAanvraag } from '#/server/ticketaanvragen'
import { whatsappLink } from '#/lib/whatsapp'

// Bevestigingspagina voor de bezoeker (Migratieplan §4.3). Publiek en zonder
// login: het uuid in de URL is de sleutel, zoals de ticketcode dat is in
// `t.$code`. Vervangt de inline "bedankt" in de aanvraagmodal — de bezoeker moet
// nog betalen, en dat is te veel om in een modal te proppen.
//
// Hier gebeurt geen betaling (harde regel 6). De pagina vertelt hoe de bezoeker
// het geld overmaakt; de organisator drukt daarna in de admin op "Betaling
// ontvangen & ticket sturen".

export const Route = createFileRoute('/aanvraag/$aanvraagId')({
  loader: ({ params }) => getPubliekeAanvraag({ data: params.aanvraagId }),
  component: AanvraagPagina,
  errorComponent: NietGevonden,
})

// Wat de bezoeker per status te zien krijgt. De DB-waarden zijn ongewijzigd;
// alleen de labels zijn nieuw (Migratieplan §1.3). 'afgewezen' is de historische
// schrijfwijze van 'geannuleerd'.
const STATUS: Record<
  string,
  { titel: string; tekst: string; kleur: string; achtergrond: string }
> = {
  nieuw: {
    titel: 'Aanvraag ontvangen',
    tekst: 'Rond je betaling af, dan stuurt de organisator je e-ticket.',
    kleur: '#B45309',
    achtergrond: '#FEF3C7',
  },
  betaald: {
    titel: 'Betaling ontvangen',
    tekst: 'De organisator maakt je e-ticket klaar. Je krijgt het vanzelf.',
    kleur: '#1D4ED8',
    achtergrond: '#DBEAFE',
  },
  afgehandeld: {
    titel: 'Ticket verstuurd',
    tekst: 'Je e-ticket met QR-code is onderweg via WhatsApp of e-mail.',
    kleur: '#15803D',
    achtergrond: '#DCFCE7',
  },
  geannuleerd: {
    titel: 'Aanvraag geannuleerd',
    tekst: 'Deze aanvraag is ingetrokken. Vraag gerust een nieuw ticket aan.',
    kleur: '#B91C1C',
    achtergrond: '#FEE2E2',
  },
  afgewezen: {
    titel: 'Aanvraag geannuleerd',
    tekst: 'Deze aanvraag is ingetrokken. Vraag gerust een nieuw ticket aan.',
    kleur: '#B91C1C',
    achtergrond: '#FEE2E2',
  },
  verlopen: {
    titel: 'Aanvraag verlopen',
    tekst: 'Er kwam geen betaling binnen op tijd. Vraag gerust opnieuw aan.',
    kleur: '#475569',
    achtergrond: '#F1F5F9',
  },
}

function AanvraagPagina() {
  const aanvraag = Route.useLoaderData()
  const currency = useCurrency()
  const status = STATUS[aanvraag.status] ?? STATUS.nieuw
  // Betalen heeft alleen zin zolang er nog niets binnen is.
  const nogTeBetalen = aanvraag.status === 'nieuw'

  return (
    <SitePage>
      <SiteNav active="events" />

      <div className="mx-auto max-w-[680px] px-6 pb-20 pt-8 md:px-12">
        <div
          className="mb-6 rounded-[16px] px-6 py-5 text-center"
          style={{ background: status.achtergrond }}
        >
          <div className="mb-1.5 text-[34px]">🎫</div>
          <h1
            className="mb-1 text-[24px] font-extrabold"
            style={{ color: status.kleur }}
          >
            {status.titel}
          </h1>
          <p className="text-[14px]" style={{ color: status.kleur }}>
            {status.tekst}
          </p>
        </div>

        {/* Samenvatting van wat er is aangevraagd */}
        <div className="mb-6 rounded-[16px] border border-[#E5E7EB] p-6">
          <h2 className="mb-1 text-[20px] font-extrabold">
            {aanvraag.eventTitel}
          </h2>
          <div className="mb-4 text-[13.5px] text-[#64748B]">
            {aanvraag.dateLong} · {aanvraag.timeRange}
            {aanvraag.locatie ? ` · ${aanvraag.locatie}` : ''}
          </div>
          <dl className="flex flex-col gap-2.5 border-t border-[#F1F5F9] pt-4">
            <Regel label="Op naam van">{aanvraag.naam}</Regel>
            <Regel label="Ticket">
              {aanvraag.aantal}× {aanvraag.typeNaam}
            </Regel>
            <Regel label="Per ticket">
              {formatPrice(aanvraag.prijsSrd, currency)}
            </Regel>
            <div className="mt-1 flex items-center justify-between border-t border-[#F1F5F9] pt-3">
              <dt className="text-[15px] font-extrabold">Totaal</dt>
              <dd className="text-[20px] font-extrabold text-[#2563EB]">
                {formatPrice(aanvraag.totaalSrd, currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[12px] text-[#94A3B8]">
            Bewaar deze pagina — hier zie je of je betaling verwerkt is.
          </p>
        </div>

        {nogTeBetalen && <Betalen aanvraag={aanvraag} />}

        <Link
          to="/events/$eventId"
          params={{ eventId: aanvraag.eventId }}
          className="mt-6 inline-block text-[13.5px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
        >
          ← Terug naar het event
        </Link>
      </div>

      <SiteFooter />
    </SitePage>
  )
}

/**
 * Het betaalblok: één kaart per methode die de organisator heeft aangezet, in
 * zijn volgorde, plus zijn instructietekst. Heeft hij niets aangezet, dan blijft
 * alleen die tekst over — vandaar dat de instructies altijd worden getoond.
 */
function Betalen({ aanvraag }: { aanvraag: PubliekeAanvraag }) {
  const waTekst = `Hoi, ik heb ${aanvraag.aantal}× ${aanvraag.typeNaam} aangevraagd voor ${aanvraag.eventTitel} op naam van ${aanvraag.naam}. Hoe kan ik betalen?`
  const waUrl = whatsappLink(aanvraag.organisatorTelefoon, waTekst)

  return (
    <div className="rounded-[16px] border border-[#E5E7EB] p-6">
      <h2 className="mb-1 text-[18px] font-extrabold">Zo betaal je</h2>
      <p className="mb-4 text-[13.5px] text-[#64748B]">
        Je betaalt rechtstreeks aan {aanvraag.organisator}. Zodra je betaling
        binnen is, krijg je je e-ticket met QR-code.
      </p>

      <div className="mb-4 flex flex-col gap-3">
        {aanvraag.betaalmethoden.includes('whatsapp') &&
          (waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-full bg-[#16A34A] py-3.5 text-[15px] font-bold text-white hover:bg-[#15803D]"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1a12 12 0 0 1-5.4-4.7c-.4-.6-.9-1.5-.9-2.4 0-.8.4-1.3.6-1.5.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.3.4c-.1.2-.3.3-.1.6.2.3.7 1.1 1.4 1.8.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.2.1.6 0 1.1Z" />
              </svg>
              Betalen via WhatsApp
            </a>
          ) : (
            <Methode titel="WhatsApp">
              De organisator handelt de betaling af via WhatsApp. Zijn nummer
              staat in de instructies hieronder.
            </Methode>
          ))}
        {aanvraag.betaalmethoden.includes('bank') && (
          <Methode titel="Bankoverschrijving">
            Maak {aanvraag.aantal}× het ticketbedrag over en vermeld je naam als
            omschrijving. De rekeninggegevens staan in de instructies hieronder.
          </Methode>
        )}
        {aanvraag.betaalmethoden.includes('contant') && (
          <Methode titel="Contant">
            Je kunt contant betalen. Spreek met de organisator af waar en
            wanneer.
          </Methode>
        )}
      </div>

      <div className="rounded-[12px] bg-[#F8FAFC] p-4">
        <div className="mb-1.5 text-[13px] font-extrabold">
          Instructies van de organisator
        </div>
        <p className="whitespace-pre-line text-[13.5px] leading-[1.6] text-[#334155]">
          {aanvraag.instructies}
        </p>
      </div>

      {aanvraag.vervaltOp && (
        <p className="mt-3 text-[12.5px] font-semibold text-[#B45309]">
          Rond je betaling af vóór{' '}
          {new Date(aanvraag.vervaltOp).toLocaleString('nl-NL', {
            dateStyle: 'full',
            timeStyle: 'short',
          })}
          .
        </p>
      )}
    </div>
  )
}

function Methode({
  titel,
  children,
}: {
  titel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] p-4">
      <div className="mb-1 text-[14.5px] font-extrabold">{titel}</div>
      <div className="text-[13.5px] leading-[1.6] text-[#64748B]">
        {children}
      </div>
    </div>
  )
}

function Regel({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[13.5px] text-[#64748B]">{label}</dt>
      <dd className="text-[14px] font-bold">{children}</dd>
    </div>
  )
}

function NietGevonden() {
  return (
    <SitePage>
      <SiteNav active="events" />
      <div className="mx-auto max-w-[600px] px-6 py-24 text-center">
        <h1 className="mb-3 text-[28px] font-extrabold">
          Aanvraag niet gevonden
        </h1>
        <p className="mb-6 text-[15px] text-[#64748B]">
          Deze link klopt niet of is verlopen. Vraag je ticket opnieuw aan op de
          eventpagina.
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
