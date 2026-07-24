import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { events, ticketTypes, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import { verstuurMail } from '#/lib/mail'
import { qrPng } from '#/lib/qr'

// Levering van een ticket aan de koper: mail via Brevo, of markeren dat de
// WhatsApp-link verstuurd is. Alles hier is admin-werk en dus org-gescoopt
// (harde regel 3), in tegenstelling tot de publieke ticketpagina.

export type Leverkanaal = 'mail' | 'whatsapp'

// Niet exporteren: de admin-route importeert deze module, en elke gewone export
// blijft in de client-bundel staan met alles wat eraan hangt.

/** Basis-URL waarop kopers de ticketpagina openen, zonder slash op het eind. */
function publicBaseUrl(): string {
  const url = process.env.PUBLIC_BASE_URL || process.env.BETTER_AUTH_URL
  if (!url) {
    throw new Error('PUBLIC_BASE_URL ontbreekt in de omgeving (.env)')
  }
  return url.replace(/\/+$/, '')
}

/** De publieke link naar een ticket. */
function ticketUrl(base: string, code: string): string {
  return `${base}/t/${code}`
}

/**
 * Leest PUBLIC_BASE_URL uit voor de admin-UI, zodat die de ticketlink en de
 * WhatsApp-tekst synchroon kan opbouwen (een async call vóór window.open wordt
 * door popupblokkers tegengehouden).
 */
export const getPublicBaseUrl = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAuth()
    return publicBaseUrl()
  },
)

/** Combineert het bestaande kanaal met het nieuwe: mail + whatsapp = beide. */
function volgendKanaal(
  huidig: string | null,
  nieuw: Leverkanaal,
): 'mail' | 'whatsapp' | 'beide' {
  if (!huidig || huidig === nieuw) return nieuw
  return 'beide'
}

/** Haalt een ticket op binnen de organisatie van de ingelogde gebruiker. */
async function ticketVoorLevering(ticketId: string, organizationId: string) {
  const rows = await db
    .select({
      id: tickets.id,
      code: tickets.code,
      koper_naam: tickets.koper_naam,
      koper_email: tickets.koper_email,
      geleverd_via: tickets.geleverd_via,
      type_naam: ticketTypes.naam,
      event_naam: events.naam,
      datum_start: events.datum_start,
      locatie: events.locatie,
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(tickets.ticket_type_id, ticketTypes.id))
    .innerJoin(events, eq(tickets.event_id, events.id))
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.organization_id, organizationId),
      ),
    )
    .limit(1)
  if (rows.length === 0) throw new Error('Ticket niet gevonden')
  return rows[0]
}

/** Zet geleverd_via/geleverd_op, org-gescoopt. */
async function markeerGeleverd(
  ticketId: string,
  organizationId: string,
  huidig: string | null,
  kanaal: Leverkanaal,
) {
  const rows = await db
    .update(tickets)
    .set({
      geleverd_via: volgendKanaal(huidig, kanaal),
      geleverd_op: new Date(),
    })
    .where(
      and(
        eq(tickets.id, ticketId),
        eq(tickets.organization_id, organizationId),
      ),
    )
    .returning({
      geleverd_via: tickets.geleverd_via,
      geleverd_op: tickets.geleverd_op,
    })
  if (rows.length === 0) throw new Error('Ticket niet gevonden')
  return rows[0]
}

function mailHtml(opties: {
  koperNaam: string | null
  eventNaam: string
  datum: Date
  locatie: string | null
  typeNaam: string
  url: string
}): string {
  const datum = opties.datum.toLocaleString('nl-NL', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
  // Bewust simpele, inline gestileerde HTML: mailclients slopen <style>-blokken.
  return `<!doctype html>
<html lang="nl">
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px">
      <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">E-ticket</p>
      <h1 style="margin:4px 0 0;font-size:22px">${escapeHtml(opties.eventNaam)}</h1>
      <p style="margin:4px 0 0;font-size:14px;color:#4b5563">${escapeHtml(datum)}${
        opties.locatie ? ` &middot; ${escapeHtml(opties.locatie)}` : ''
      }</p>
      <p style="margin:16px 0 0;font-size:14px">Hoi${
        opties.koperNaam ? ` ${escapeHtml(opties.koperNaam)}` : ''
      }, hierbij je ticket (${escapeHtml(opties.typeNaam)}). Laat de QR-code hieronder scannen bij de ingang.</p>
      <div style="text-align:center;margin:24px 0">
        <img src="${opties.url}/qr" alt="QR-code van je ticket" width="260" height="260" style="width:260px;height:260px;display:inline-block" />
      </div>
      <div style="text-align:center">
        <a href="${opties.url}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:bold">Open je ticket</a>
      </div>
      <p style="margin:20px 0 0;font-size:12px;color:#6b7280">Zie je de QR-code niet? Hij zit ook als bijlage bij deze mail. Tip: maak een screenshot, dan werkt je ticket ook zonder internet.</p>
    </div>
  </body>
</html>`
}

function escapeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export const sendTicketMail = createServerFn({ method: 'POST' })
  .validator((data: { ticketId: string }) => {
    if (!data.ticketId) throw new Error('ticketId ontbreekt')
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const ticket = await ticketVoorLevering(data.ticketId, organizationId)

    if (!ticket.koper_email) {
      throw new Error('Dit ticket heeft geen e-mailadres')
    }

    const url = ticketUrl(publicBaseUrl(), ticket.code)
    const png = await qrPng(ticket.code)

    const resultaat = await verstuurMail({
      naar: ticket.koper_email,
      naarNaam: ticket.koper_naam,
      onderwerp: `Je ticket voor ${ticket.event_naam}`,
      html: mailHtml({
        koperNaam: ticket.koper_naam,
        eventNaam: ticket.event_naam,
        datum: ticket.datum_start,
        locatie: ticket.locatie,
        typeNaam: ticket.type_naam,
        url,
      }),
      bijlagen: [{ naam: 'ticket-qr.png', inhoud: png }],
    })

    if (!resultaat.verzonden) {
      // Niets verstuurd (geen API-key) → ook niet als geleverd markeren.
      throw new Error(
        'Mail niet verstuurd: BREVO_API_KEY of BREVO_AFZENDER_EMAIL ontbreekt in .env',
      )
    }

    return markeerGeleverd(
      ticket.id,
      organizationId,
      ticket.geleverd_via,
      'mail',
    )
  })

export const markDelivered = createServerFn({ method: 'POST' })
  // Kanaal komt als losse string binnen en wordt hier pas gesmald: de validator
  // is de grens waar clientinvoer een Leverkanaal wordt.
  .validator(
    (data: {
      ticketId: string
      kanaal: string
    }): { ticketId: string; kanaal: Leverkanaal } => {
      if (!data.ticketId) throw new Error('ticketId ontbreekt')
      if (data.kanaal !== 'mail' && data.kanaal !== 'whatsapp') {
        throw new Error('Onbekend leverkanaal')
      }
      return { ticketId: data.ticketId, kanaal: data.kanaal }
    },
  )
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    const ticket = await ticketVoorLevering(data.ticketId, organizationId)
    return markeerGeleverd(
      ticket.id,
      organizationId,
      ticket.geleverd_via,
      data.kanaal,
    )
  })
