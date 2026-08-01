import { Link, createFileRoute } from '@tanstack/react-router'
import { listEvents } from '#/server/events'

export const Route = createFileRoute('/admin/events/')({
  loader: () => listEvents(),
  component: EventsOverzicht,
})

const statusStijl: Record<string, string> = {
  actief: 'bg-[#DCFCE7] text-[#16A34A]',
  concept: 'bg-[#F1F5F9] text-[#64748B]',
  afgelopen: 'bg-[#FEF3C7] text-[#B45309]',
}

// Aanmaken gebeurt in de wizard op /events/new. Dit scherm had daarnaast een
// eigen inline formulier; die twee liepen uit elkaar (de wizard kent
// betaalmethoden en tickettypes, het inline formulier maakte een kaal concept).
// Eén formulier, dus hier alleen nog de lijst.
function EventsOverzicht() {
  const events = Route.useLoaderData()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Events</h1>
          <p className="text-[13px] text-[#64748B]">
            Beheer je evenementen en tickettypes
          </p>
        </div>
        <Link
          to="/events/new"
          className="rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
        >
          + Nieuw event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center shadow-sm">
          <p className="text-[#64748B]">Nog geen evenementen.</p>
          <Link
            to="/events/new"
            className="mt-4 inline-block rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
          >
            Maak je eerste event aan
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          {events.map((event, i) => (
            <Link
              key={event.id}
              to="/admin/events/$eventId"
              params={{ eventId: event.id }}
              className={`flex items-center justify-between px-5 py-4 hover:bg-[#F8FAFC] ${i > 0 ? 'border-t border-[#E5E7EB]' : ''}`}
            >
              <div>
                <div className="text-[15px] font-bold">{event.naam}</div>
                <div className="text-[13px] text-[#64748B]">
                  {new Date(event.datum_start).toLocaleString('nl-NL')}
                  {event.locatie ? ` · ${event.locatie}` : ''}
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusStijl[event.status] ?? statusStijl.concept}`}
              >
                {event.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
