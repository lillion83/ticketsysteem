import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { getDashboard } from '#/server/stats'
import type { DashboardData, DashboardKoper } from '#/server/stats'
import { formatPrice } from '#/components/discovery/currency'

export const Route = createFileRoute('/admin/')({
  loader: () => getDashboard(),
  component: Dashboard,
})

// Kleuren voor de tickettypes in de donut (discovery-palette). Beschikbaar krijgt
// het groen dat ook publiek "beschikbaar" aanduidt.
const TYPE_KLEUREN = ['#C026D3', '#CA8A04', '#2563EB', '#0D9488', '#DB2777', '#7C3AED']
const BESCHIKBAAR_KLEUR = '#65A30D'

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
          <Donut data={data} />
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

// ── KPI-tegel ────────────────────────────────────────────────────────────────

function Kpi({
  label,
  waarde,
  sub,
  chip,
  icon,
}: {
  label: string
  waarde: string
  sub: string
  chip?: string
  icon: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="mb-3 grid h-9 w-9 place-items-center rounded-[9px] bg-[#EFF6FF] text-[#2563EB]">{icon}</div>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-[#64748B]">
        {label}
        {chip && <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-bold text-[#64748B]">{chip}</span>}
      </div>
      <div className="mt-1.5 text-[26px] font-extrabold tracking-tight tabular-nums">{waarde}</div>
      <div className="mt-1 text-[12px] text-[#64748B]">{sub}</div>
    </div>
  )
}

function Panel({ titel, sub, children }: { titel: string; sub: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-[16px] font-extrabold">{titel}</h2>
      <p className="mb-4 text-[12.5px] text-[#64748B]">{sub}</p>
      {children}
    </div>
  )
}

// ── Donut (handgetekend SVG) ─────────────────────────────────────────────────

function Donut({ data }: { data: DashboardData }) {
  const segmenten = [
    ...data.perType.map((t, i) => ({
      naam: t.naam,
      aantal: t.uitgegeven,
      kleur: TYPE_KLEUREN[i % TYPE_KLEUREN.length],
    })),
    { naam: 'Beschikbaar', aantal: data.beschikbaar, kleur: BESCHIKBAAR_KLEUR },
  ]
  const totaal = segmenten.reduce((s, x) => s + x.aantal, 0)

  let offset = 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-[200px] w-[200px] flex-none">
        <svg width="200" height="200" viewBox="0 0 210 210">
          <g transform="rotate(-90 105 105)">
            {totaal === 0 ? (
              <circle cx="105" cy="105" r="80" fill="none" strokeWidth="26" stroke="#E5E7EB" />
            ) : (
              segmenten
                .filter((s) => s.aantal > 0)
                .map((s) => {
                  const dash = `${s.aantal} ${totaal - s.aantal}`
                  const el = (
                    <circle
                      key={s.naam}
                      cx="105"
                      cy="105"
                      r="80"
                      fill="none"
                      strokeWidth="26"
                      pathLength={totaal}
                      stroke={s.kleur}
                      strokeDasharray={dash}
                      strokeDashoffset={-offset}
                    />
                  )
                  offset += s.aantal
                  return el
                })
            )}
          </g>
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[22px] font-extrabold tabular-nums">
              {data.uitgegeven} / {data.beschikbaar}
            </div>
            <div className="text-[11.5px] font-semibold text-[#64748B]">Uitgegeven / Beschikbaar</div>
          </div>
        </div>
      </div>
      <div className="flex min-w-[150px] flex-1 flex-col gap-2.5">
        {segmenten.map((s) => (
          <div key={s.naam} className="flex items-center gap-2.5 text-[13.5px]">
            <span className="h-3 w-3 flex-none rounded-[3px]" style={{ background: s.kleur }} />
            <span className="font-semibold text-[#64748B]">{s.naam}</span>
            <span className="ml-auto font-extrabold tabular-nums">{s.aantal}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Weekgrafiek (handgetekend SVG) ───────────────────────────────────────────

function WeekGrafiek({ reeks }: { reeks: DashboardData['reeks'] }) {
  const max = Math.max(1, ...reeks.map((r) => r.aantal))
  const W = 560
  const H = 220
  const padB = 28
  const chartH = H - padB - 10
  const stap = W / reeks.length
  const barW = Math.min(46, stap * 0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label="Uitgifte per dag">
      {/* gridlijnen op 0/50/100% */}
      {[0, 0.5, 1].map((f) => {
        const y = 10 + chartH * (1 - f)
        return (
          <g key={f}>
            <line x1="30" y1={y} x2={W} y2={y} stroke="#E5E7EB" strokeWidth="1" />
            <text x="24" y={y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">
              {Math.round(max * f)}
            </text>
          </g>
        )
      })}
      {reeks.map((r, i) => {
        const h = (r.aantal / max) * chartH
        const x = 30 + i * stap + (stap - barW) / 2
        const y = 10 + chartH - h
        return (
          <g key={r.label + i}>
            <rect x={x} y={y} width={barW} height={Math.max(h, r.aantal > 0 ? 3 : 0)} rx="5" fill="#2563EB" />
            <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#64748B">
              {r.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
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

// ── Iconen ───────────────────────────────────────────────────────────────────

function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 12h6" />
    </svg>
  )
}
function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.2a2.4 2.4 0 0 1 2.5-1.5c1.5 0 2.3.9 2.3 1.9 0 2.4-4.8 1.4-4.8 3.8 0 1 .9 1.9 2.5 1.9a2.5 2.5 0 0 0 2.5-1.5" />
    </svg>
  )
}
