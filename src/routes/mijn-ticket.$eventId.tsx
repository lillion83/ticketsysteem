import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  SiteFooter,
  SiteNav,
  SitePage,
  coverStyle,
} from '#/components/discovery/site'
import { TicketRij } from '#/components/discovery/tickets'
import { formatDateLine } from '#/lib/datum'
import { getCurrentUser } from '#/server/session'
import { listMijnTickets } from '#/server/mijnTickets'

// Detail van "Mijn Tickets" per event (fase K-vervolg): alle tickets die een
// ingelogde koper voor één event heeft. Bereikbaar via de event-lijst op
// /mijn-ticket.
export const Route = createFileRoute('/mijn-ticket/$eventId')({
  loader: async ({ params }) => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/mijn-ticket' })

    const tickets = (await listMijnTickets()).filter(
      (t) => t.event_id === params.eventId,
    )
    // Geen tickets (of niet van deze koper) → terug naar het overzicht.
    if (tickets.length === 0) throw redirect({ to: '/mijn-ticket' })

    const eerste = tickets[0]
    return {
      event: {
        naam: eerste.event_naam,
        datum_start: eerste.datum_start,
        locatie: eerste.locatie,
        categorie: eerste.categorie,
        cover: eerste.cover,
      },
      tickets,
    }
  },
  component: EventTickets,
})

function EventTickets() {
  const { event, tickets } = Route.useLoaderData()

  return (
    <SitePage>
      <SiteNav active="ticket" />
      <div className="mx-auto max-w-[640px] px-6 py-16">
        <Link
          to="/mijn-ticket"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Alle events
        </Link>

        <div className="mb-8 flex items-center gap-4">
          <div
            className="h-[64px] w-[64px] shrink-0 rounded-[12px]"
            style={coverStyle(event.categorie, event.cover)}
          />
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold leading-tight">
              {event.naam}
            </h1>
            <div className="text-[13px] text-[#64748B]">
              {formatDateLine(new Date(event.datum_start))}
              {event.locatie ? ` · ${event.locatie}` : ''}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <TicketRij key={t.code} ticket={t} />
          ))}
        </div>
      </div>
      <SiteFooter />
    </SitePage>
  )
}
