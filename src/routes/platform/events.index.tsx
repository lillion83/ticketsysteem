import { Link, createFileRoute } from '@tanstack/react-router'
import { listAllEvents } from '#/server/platform'

export const Route = createFileRoute('/platform/events/')({
  loader: () => listAllEvents(),
  component: AlleEvents,
})

const statusStijl: Record<string, string> = {
  actief: 'bg-[#DCFCE7] text-[#16A34A]',
  concept: 'bg-[#F1F5F9] text-[#64748B]',
  afgelopen: 'bg-[#FEF3C7] text-[#B45309]',
}

function AlleEvents() {
  const events = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight">Alle events</h1>
        <p className="text-[13px] text-[#64748B]">Alle events van alle organisatoren (alleen-lezen)</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center text-[#64748B] shadow-sm">
          Nog geen events.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[#64748B]">
                <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Event</th>
                <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Organisator</th>
                <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Datum</th>
                <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Uitgegeven</th>
                <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Status</th>
                <th className="rounded-r-[9px] bg-[#F8FAFC] px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={e.id} className={i > 0 ? 'border-t border-[#E5E7EB]' : ''}>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold">{e.naam}</div>
                    {e.locatie && <div className="text-[12px] text-[#64748B]">{e.locatie}</div>}
                  </td>
                  <td className="px-4 py-3.5">{e.organisatie}</td>
                  <td className="px-4 py-3.5 tabular-nums text-[#64748B]">
                    {new Date(e.datum_start).toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums">{e.uitgegeven}</td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusStijl[e.status] ?? statusStijl.concept}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      to="/platform/events/$eventId"
                      params={{ eventId: e.id }}
                      className="text-[13px] font-semibold text-[#2563EB] hover:underline"
                    >
                      Bewerken →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
