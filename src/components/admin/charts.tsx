import type { ReactNode } from 'react'

// Gedeelde presentatie-componenten voor de admin- en platform-dashboards
// (fase J). Handgetekende SVG-charts, geen chart-library (harde conventie: geen
// nieuwe dependencies). Kleuren uit de discovery-palette.

export const TYPE_KLEUREN = ['#C026D3', '#CA8A04', '#2563EB', '#0D9488', '#DB2777', '#7C3AED']
export const BESCHIKBAAR_KLEUR = '#65A30D'

export function Kpi({
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

export function Panel({ titel, sub, children }: { titel: string; sub: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-[16px] font-extrabold">{titel}</h2>
      <p className="mb-4 text-[12.5px] text-[#64748B]">{sub}</p>
      {children}
    </div>
  )
}

export type DonutSegment = { naam: string; aantal: number; kleur: string }

export function Donut({
  segmenten,
  centerBig,
  centerLabel,
}: {
  segmenten: Array<DonutSegment>
  centerBig: string
  centerLabel: string
}) {
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
            <div className="text-[22px] font-extrabold tabular-nums">{centerBig}</div>
            <div className="text-[11.5px] font-semibold text-[#64748B]">{centerLabel}</div>
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

export function WeekGrafiek({ reeks }: { reeks: Array<{ label: string; aantal: number }> }) {
  const max = Math.max(1, ...reeks.map((r) => r.aantal))
  const W = 560
  const H = 220
  const padB = 28
  const chartH = H - padB - 10
  const stap = W / reeks.length
  const barW = Math.min(46, stap * 0.5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[220px] w-full" role="img" aria-label="Uitgifte per dag">
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

// ── Iconen ───────────────────────────────────────────────────────────────────

export function TicketIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4z" />
    </svg>
  )
}
export function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
export function BoxIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 12h6" />
    </svg>
  )
}
export function CoinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.2a2.4 2.4 0 0 1 2.5-1.5c1.5 0 2.3.9 2.3 1.9 0 2.4-4.8 1.4-4.8 3.8 0 1 .9 1.9 2.5 1.9a2.5 2.5 0 0 0 2.5-1.5" />
    </svg>
  )
}
export function BuildingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
    </svg>
  )
}
