import { Link, createFileRoute } from '@tanstack/react-router'
import { getDashboard } from '#/server/stats'
import type { DashboardData, DashboardKoper } from '#/server/stats'
import { formatPrice } from '#/components/discovery/currency'
import {
  BESCHIKBAAR_KLEUR,
  BoxIcon,
  CheckIcon,
  CoinIcon,
  Donut,
  Kpi,
  Panel,
  TYPE_KLEUREN,
  TicketIcon,
  WeekGrafiek,
} from '#/components/admin/charts'

export const Route = createFileRoute('/admin/')({
  loader: () => getDashboard(),
  component: Dashboard,
})

function Dashboard() {
  const data = Route.useLoaderData()
  const wegPct =
    data.capaciteit > 0 ? Math.round((data.uitgegeven / data.capaciteit) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight text-[#2563EB]">Dashboard</h1>
        <p className="text-[13px] text-[#64748B]">Overzicht van je verkoop over alle events</p>
      </div>

      {/* KPI's */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Capaciteit" waarde={data.capaciteit.toLocaleString('nl-NL')} sub="Alle beschikbare plaatsen" icon={<TicketIcon />} />
        <Kpi label="Uitgegeven" waarde={data.uitgegeven.toLocaleString('nl-NL')} sub={`${wegPct}% van de capaciteit weg`} icon={<CheckIcon />} />
        <Kpi label="Beschikbaar" waarde={data.beschikbaar.toLocaleString('nl-NL')} sub={`${data.gebruikt.toLocaleString('nl-NL')} binnen · ${data.ingetrokken.toLocaleString('nl-NL')} ingetrokken`} icon={<BoxIcon />} />
        <Kpi
          label="Verkochte waarde"
          chip="indicatie"
          waarde={formatPrice(data.waardeSrd, 'SRD')}
          sub="Uitgegeven × prijs · geen uitbetalingen"
          icon={<CoinIcon />}
        />
      </section>

      {/* Grafieken */}
      <section className="grid gap-4 lg:grid-cols-[5fr_7fr]">
        <Panel titel="Verkocht per tickettype" sub="Verdeling over de capaciteit">
          <Donut
            segmenten={donutSegmenten(data)}
            centerBig={`${data.uitgegeven} / ${data.beschikbaar}`}
            centerLabel="Uitgegeven / Beschikbaar"
          />
        </Panel>
        <Panel titel="Uitgifte per dag" sub="Laatste 7 dagen">
          <WeekGrafiek reeks={data.reeks} />
        </Panel>
      </section>

      {/* Kopers */}
      <section className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-extrabold">Recente kopers</h2>
          <Link to="/admin/events" className="text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
            Naar events →
          </Link>
        </div>
        <KopersTabel kopers={data.kopers} />
      </section>
    </div>
  )
}

// Bouwt de donut-segmenten: uitgegeven per tickettype + de resterende
// beschikbare plaatsen (groen).
function donutSegmenten(data: DashboardData) {
  return [
    ...data.perType.map((t, i) => ({
      naam: t.naam,
      aantal: t.uitgegeven,
      kleur: TYPE_KLEUREN[i % TYPE_KLEUREN.length],
    })),
    { naam: 'Beschikbaar', aantal: data.beschikbaar, kleur: BESCHIKBAAR_KLEUR },
  ]
}

// ── Kopers-tabel ─────────────────────────────────────────────────────────────

const statusBadge: Record<DashboardKoper['status'], { cls: string; tekst: string }> = {
  uitgegeven: { cls: 'bg-[#DCFCE7] text-[#16A34A]', tekst: 'Uitgegeven' },
  gebruikt: { cls: 'bg-[#DBEAFE] text-[#2563EB]', tekst: 'Gebruikt' },
  ingetrokken: { cls: 'bg-[#FEE2E2] text-[#DC2626]', tekst: 'Ingetrokken' },
}

function KopersTabel({ kopers }: { kopers: Array<DashboardKoper> }) {
  if (kopers.length === 0) {
    return <p className="py-6 text-center text-[14px] text-[#64748B]">Nog geen tickets uitgegeven.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] border-collapse text-[13.5px]">
        <thead>
          <tr className="text-left text-[#64748B]">
            <th className="rounded-l-[9px] bg-[#F8FAFC] px-4 py-2.5 font-bold">Naam</th>
            <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">E-mail</th>
            <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Telefoon</th>
            <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Type</th>
            <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Datum</th>
            <th className="rounded-r-[9px] bg-[#F8FAFC] px-4 py-2.5 font-bold">Status</th>
          </tr>
        </thead>
        <tbody>
          {kopers.map((k, i) => {
            const b = statusBadge[k.status]
            return (
              <tr key={k.code} className={i > 0 ? 'border-t border-[#E5E7EB]' : ''}>
                <td className="px-4 py-3.5 font-semibold">{k.koper_naam ?? '—'}</td>
                <td className="px-4 py-3.5 text-[#64748B]">{k.koper_email ?? '—'}</td>
                <td className="px-4 py-3.5 tabular-nums">{k.koper_telefoon ?? '—'}</td>
                <td className="px-4 py-3.5">{k.type_naam}</td>
                <td className="px-4 py-3.5 tabular-nums text-[#64748B]">
                  {k.verkocht_op ? new Date(k.verkocht_op).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${b.cls}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {b.tekst}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
