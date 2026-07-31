import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { getEventDashboard } from '#/server/eventDashboard'
import type { EventDashboardData } from '#/server/eventDashboard'
import { getPublicBaseUrl } from '#/server/delivery'
import { formatPrice } from '#/components/discovery/currency'
import { formatDateLong, formatTimeRange } from '#/lib/datum'
import { TYPE_KLEUREN } from '#/components/admin/charts'
import { verkoopkanaalLabel } from '#/lib/verkoopkanaal'

// Event-dashboard: één scherm per event, opgedeeld in de fases vóór / tijdens /
// na het event. Aparte route naast de beheerpagina (de trailing underscore in
// `$eventId_` haalt 'm uit de nesting), net als /admin/events/$eventId_/deur.
//
// Alle cijfers komen uit één momentopname (getEventDashboard); de lifecycle- en
// tijdvak-knoppen rekenen client-side en doen dus geen refetch.
export const Route = createFileRoute('/admin/events/$eventId_/dashboard')({
  loader: async ({ params }) => {
    const [data, baseUrl] = await Promise.all([
      getEventDashboard({ data: params.eventId }),
      getPublicBaseUrl(),
    ])
    return { data, baseUrl }
  },
  component: EventDashboard,
})

type Fase = 'voor' | 'tijdens' | 'na'
type Tijdvak = '7d' | '30d' | '90d' | 'alles'

const DAG_MS = 24 * 60 * 60 * 1000
const WEEKDAGEN = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
const MAANDEN = [
  'jan',
  'feb',
  'mrt',
  'apr',
  'mei',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
]

const GROEN = '#16A34A'
const ORANJE = '#D97706'
const ROOD = '#DC2626'
const BLAUW = '#2563EB'
const GRIJS = '#64748B'

function pct(deel: number, geheel: number): number {
  return geheel > 0 ? Math.round((deel / geheel) * 100) : 0
}

/** In welke fase zit het event nu? Bepaalt welk tabblad standaard openstaat. */
function huidigeFase(startIso: string, eindIso: string): Fase {
  const nu = Date.now()
  if (nu < new Date(startIso).getTime()) return 'voor'
  if (nu > new Date(eindIso).getTime()) return 'na'
  return 'tijdens'
}

// ── Pagina ───────────────────────────────────────────────────────────────────

function EventDashboard() {
  const { data, baseUrl } = Route.useLoaderData()
  const start = new Date(data.event.datum_start)
  const eind = new Date(data.event.datum_eind)

  const [fase, setFase] = useState<Fase>(() =>
    huidigeFase(data.event.datum_start, data.event.datum_eind),
  )
  const [tijdvak, setTijdvak] = useState<Tijdvak>('7d')
  const [gekopieerd, setGekopieerd] = useState(false)

  const publiekeUrl = `${baseUrl}/events/${data.event.id}`

  async function deelLink() {
    try {
      await navigator.clipboard.writeText(publiekeUrl)
      setGekopieerd(true)
      setTimeout(() => setGekopieerd(false), 2000)
    } catch {
      // Clipboard geweigerd (bv. geen https): laat de knop met rust.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#2563EB]">
            Dashboard
          </h1>
          <p className="text-[13px] text-[#64748B]">
            Alles over dit event op één scherm
          </p>
        </div>
        <Link
          to="/admin/events/$eventId"
          params={{ eventId: data.event.id }}
          className="text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
        >
          ← Terug naar beheer
        </Link>
      </div>

      <Hero
        data={data}
        start={start}
        eind={eind}
        publiekeUrl={publiekeUrl}
        gekopieerd={gekopieerd}
        onDeel={deelLink}
      />

      <FaseTabs fase={fase} onKies={setFase} />

      <KpiRij data={data} fase={fase} start={start} />

      <section className="grid gap-4 lg:grid-cols-[11fr_10fr]">
        <PerTypePaneel data={data} />
        <VerkoopGrafiek data={data} tijdvak={tijdvak} onTijdvak={setTijdvak} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[13fr_10fr]">
        <FinancieelPaneel data={data} />
        <KanalenPaneel data={data} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TrechterPaneel data={data} />
        <PrestatiesPaneel data={data} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[10fr_16fr]">
        <HealthPaneel data={data} />
        <InzichtenPaneel data={data} start={start} />
      </section>

      <KopersPaneel data={data} />
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────

function Hero({
  data,
  start,
  eind,
  publiekeUrl,
  gekopieerd,
  onDeel,
}: {
  data: EventDashboardData
  start: Date
  eind: Date
  publiekeUrl: string
  gekopieerd: boolean
  onDeel: () => void
}) {
  const fase = huidigeFase(data.event.datum_start, data.event.datum_eind)
  const statusLabel = {
    voor: 'Aankomend',
    tijdens: 'Live nu',
    na: 'Afgelopen',
  }[fase]

  const dagen = Math.ceil((start.getTime() - Date.now()) / DAG_MS)
  const aftel =
    fase === 'voor'
      ? dagen <= 0
        ? 'Vandaag'
        : dagen === 1
          ? 'Nog 1 dag'
          : `Nog ${dagen} dagen`
      : fase === 'tijdens'
        ? 'Bezig'
        : `Beëindigd op ${formatDateLong(eind)}`

  const knopCls =
    'rounded-[10px] border border-white/30 bg-white/15 px-3.5 py-2 text-[13.5px] font-semibold text-white hover:bg-white/25'

  return (
    <section className="rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] p-6 text-white shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold">
              {statusLabel}
            </span>
            <span className="text-[12.5px] text-white/85">{aftel}</span>
            {data.event.status !== 'actief' && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold capitalize">
                {data.event.status}
              </span>
            )}
          </div>
          <h2 className="text-[26px] font-extrabold tracking-tight sm:text-[28px]">
            {data.event.naam}
          </h2>
          <p className="mt-1.5 text-[14px] text-white/90">
            {formatDateLong(start)} · {formatTimeRange(start, eind)}
            {data.event.locatie ? ` · ${data.event.locatie}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/events/$eventId"
            params={{ eventId: data.event.id }}
            className={knopCls}
          >
            Bewerken
          </Link>
          <a
            href={publiekeUrl}
            target="_blank"
            rel="noreferrer"
            className={knopCls}
          >
            Bekijk pagina
          </a>
          <Link
            to="/admin/events/$eventId/deur"
            params={{ eventId: data.event.id }}
            className={knopCls}
          >
            Deurbeheer
          </Link>
          <button
            onClick={onDeel}
            className="rounded-[10px] bg-white px-3.5 py-2 text-[13.5px] font-bold text-[#1D4ED8] hover:bg-white/90"
          >
            {gekopieerd ? 'Gekopieerd' : 'Deel link'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Fase-tabs ────────────────────────────────────────────────────────────────

const FASE_LABEL: Record<Fase, string> = {
  voor: 'Vóór event',
  tijdens: 'Tijdens event',
  na: 'Na event',
}

function FaseTabs({ fase, onKies }: { fase: Fase; onKies: (f: Fase) => void }) {
  return (
    <div className="flex w-fit gap-1.5 rounded-xl border border-[#E5E7EB] bg-white p-1.5 shadow-sm">
      {(['voor', 'tijdens', 'na'] as const).map((f) => (
        <button
          key={f}
          onClick={() => onKies(f)}
          className={`rounded-[9px] px-4 py-2 text-[13.5px] font-bold ${
            fase === f
              ? 'bg-[#2563EB] text-white'
              : 'text-[#64748B] hover:bg-[#F8FAFC]'
          }`}
        >
          {FASE_LABEL[f]}
        </button>
      ))}
    </div>
  )
}

// ── KPI's per fase ───────────────────────────────────────────────────────────

type KpiKaart = {
  label: string
  waarde: string
  sub: string
  subKleur: string
  glyph: string
}

function KpiRij({
  data,
  fase,
  start,
}: {
  data: EventDashboardData
  fase: Fase
  start: Date
}) {
  const kaarten = useMemo(
    () => kpisVoorFase(data, fase, start),
    [data, fase, start],
  )
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {kaarten.map((k) => (
        <div
          key={k.label}
          className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm"
        >
          <div
            className="mb-3 grid h-9 w-9 place-items-center rounded-[9px] text-[14px] font-extrabold"
            style={{ background: `${k.subKleur}1A`, color: k.subKleur }}
          >
            {k.glyph}
          </div>
          <div className="text-[13px] font-semibold text-[#64748B]">
            {k.label}
          </div>
          <div className="mt-1.5 text-[24px] font-extrabold tracking-tight tabular-nums">
            {k.waarde}
          </div>
          <div
            className="mt-1 text-[12.5px] font-semibold"
            style={{ color: k.subKleur }}
          >
            {k.sub}
          </div>
        </div>
      ))}
    </section>
  )
}

/** Aantal tickets dat vandaag is uitgegeven. */
function vandaagUitgegeven(momenten: Array<string>): number {
  const vandaag = new Date().toDateString()
  return momenten.filter((m) => new Date(m).toDateString() === vandaag).length
}

/** Gemiddelde uitgifte per dag over de laatste 7 dagen. */
function snelheidPerDag(momenten: Array<string>): number {
  const grens = Date.now() - 7 * DAG_MS
  const recent = momenten.filter((m) => new Date(m).getTime() >= grens).length
  return Math.round((recent / 7) * 10) / 10
}

function uurLabel(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:00`
}

function kpisVoorFase(
  data: EventDashboardData,
  fase: Fase,
  start: Date,
): Array<KpiKaart> {
  const wegPct = pct(data.uitgegeven, data.capaciteit)
  const margeSrd = data.brutoSrd - data.inkoopSrd
  const vandaag = vandaagUitgegeven(data.verkoopmomenten)
  const snelheid = snelheidPerDag(data.verkoopmomenten)
  const buiten = data.uitgegeven - data.gebruikt

  if (fase === 'voor') {
    const dagenTeGaan = Math.max(
      0,
      Math.ceil((start.getTime() - Date.now()) / DAG_MS),
    )
    const prognose = Math.min(
      data.capaciteit,
      Math.round(data.uitgegeven + snelheid * dagenTeGaan),
    )
    return [
      {
        label: 'Tickets uitgegeven',
        waarde: `${data.uitgegeven} / ${data.capaciteit}`,
        sub: `${wegPct}% weg${vandaag > 0 ? ` · +${vandaag} vandaag` : ''}`,
        subKleur: vandaag > 0 ? GROEN : GRIJS,
        glyph: '🎟',
      },
      {
        label: 'Bruto waarde',
        waarde: formatPrice(data.brutoSrd, 'SRD'),
        sub: `Indicatie · marge ${formatPrice(margeSrd, 'SRD')}`,
        subKleur: margeSrd >= 0 ? GROEN : ROOD,
        glyph: 'SRD',
      },
      {
        label: 'Resterend',
        waarde: String(data.beschikbaar),
        sub: `${100 - wegPct}% beschikbaar`,
        subKleur: GRIJS,
        glyph: '−',
      },
      {
        label: 'Uitgiftesnelheid',
        waarde: `${snelheid} / dag`,
        sub: 'Gemiddelde laatste 7 dagen',
        subKleur: snelheid > 0 ? GROEN : GRIJS,
        glyph: '↑',
      },
      {
        label: 'Prognose',
        waarde:
          dagenTeGaan > 0
            ? `${prognose} (${pct(prognose, data.capaciteit)}%)`
            : '—',
        sub:
          dagenTeGaan > 0
            ? prognose >= data.capaciteit
              ? 'Waarschijnlijk uitverkocht'
              : `Op basis van ${dagenTeGaan} dagen te gaan`
            : 'Event is begonnen',
        subKleur: prognose >= data.capaciteit ? GROEN : ORANJE,
        glyph: '★',
      },
    ]
  }

  if (fase === 'tijdens') {
    return [
      {
        label: 'Ingecheckt',
        waarde: `${data.gebruikt} / ${data.uitgegeven}`,
        sub: `${pct(data.gebruikt, data.uitgegeven)}% binnen`,
        subKleur: GROEN,
        glyph: '✓',
      },
      {
        label: 'Nog buiten',
        waarde: String(buiten),
        sub: 'Uitgegeven, nog niet gescand',
        subKleur: GRIJS,
        glyph: '⏳',
      },
      {
        label: 'Scans laatste uur',
        waarde: String(data.scans.laatsteUur),
        sub:
          data.scans.laatsteUur > 0
            ? 'Deur is actief'
            : 'Geen scans het laatste uur',
        subKleur: data.scans.laatsteUur > 0 ? BLAUW : GRIJS,
        glyph: '⚡',
      },
      {
        label: 'Totaal scans',
        waarde: String(data.scans.totaal),
        sub: 'Inclusief afgewezen scans',
        subKleur: GRIJS,
        glyph: '●',
      },
      {
        label: 'Piekuur',
        waarde: uurLabel(data.scans.piekUur),
        sub: data.scans.piekUur
          ? `${data.scans.piekAantal} scans in dat uur`
          : 'Nog geen scans',
        subKleur: ORANJE,
        glyph: '★',
      },
    ]
  }

  const gemPrijs =
    data.uitgegeven > 0 ? Math.round(data.brutoSrd / data.uitgegeven) : 0
  const gesorteerd = [...data.perType].sort(
    (a, b) => b.uitgegeven - a.uitgegeven,
  )
  const best = gesorteerd.length > 0 ? gesorteerd[0] : null
  return [
    {
      label: 'Eindwaarde',
      waarde: formatPrice(data.brutoSrd, 'SRD'),
      sub: `Indicatie · marge ${formatPrice(margeSrd, 'SRD')}`,
      subKleur: margeSrd >= 0 ? GROEN : ROOD,
      glyph: 'SRD',
    },
    {
      label: 'Opkomst',
      waarde: `${data.gebruikt} / ${data.uitgegeven}`,
      sub: `${pct(data.gebruikt, data.uitgegeven)}% kwam opdagen`,
      subKleur: GROEN,
      glyph: '✓',
    },
    {
      label: 'No-shows',
      waarde: String(buiten),
      sub: `${pct(buiten, data.uitgegeven)}% van uitgegeven`,
      subKleur: buiten > 0 ? ROOD : GRIJS,
      glyph: '−',
    },
    {
      label: 'Gem. ticketprijs',
      waarde: formatPrice(gemPrijs, 'SRD'),
      sub: 'Over alle types',
      subKleur: GRIJS,
      glyph: 'SRD',
    },
    {
      label: 'Bestverkocht',
      waarde: best?.naam ?? '—',
      sub: best ? `${best.uitgegeven} tickets` : 'Geen tickettypes',
      subKleur: ORANJE,
      glyph: '★',
    },
  ]
}

// ── Paneel-schil ─────────────────────────────────────────────────────────────

function Paneel({
  titel,
  sub,
  extra,
  children,
}: {
  titel: string
  sub?: string
  extra?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-extrabold">{titel}</h2>
          {sub && <p className="text-[12.5px] text-[#64748B]">{sub}</p>}
        </div>
        {extra}
      </div>
      {children}
    </div>
  )
}

function Leeg({ tekst }: { tekst: string }) {
  return (
    <p className="py-6 text-center text-[13.5px] text-[#64748B]">{tekst}</p>
  )
}

// ── Verkocht per tickettype ──────────────────────────────────────────────────

function PerTypePaneel({ data }: { data: EventDashboardData }) {
  return (
    <Paneel
      titel="Uitgegeven per tickettype"
      sub="Verdeling per type, niet alleen het totaal"
    >
      {data.perType.length === 0 ? (
        <Leeg tekst="Dit event heeft nog geen tickettypes." />
      ) : (
        <div className="flex flex-col gap-4">
          {data.perType.map((t, i) => {
            const p = pct(t.uitgegeven, t.capaciteit)
            const kleur = TYPE_KLEUREN[i % TYPE_KLEUREN.length]
            return (
              <div key={t.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-bold">{t.naam}</span>
                  <span className="text-[13px] text-[#64748B] tabular-nums">
                    <span className="font-extrabold text-[#0F172A]">
                      {t.uitgegeven}
                    </span>{' '}
                    / {t.capaciteit} · {p}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, p)}%`, background: kleur }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Paneel>
  )
}

// ── Verkoop over tijd ────────────────────────────────────────────────────────

const TIJDVAK_LABEL: Record<Tijdvak, string> = {
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  alles: 'Alles',
}

/** Bucket de verkoopmomenten voor het gekozen tijdvak. */
function bouwReeks(
  momenten: Array<string>,
  tijdvak: Tijdvak,
): Array<{ label: string; aantal: number }> {
  const tijden = momenten
    .map((m) => new Date(m).getTime())
    .sort((a, b) => a - b)
  const nu = new Date()

  if (tijdvak === '7d') {
    const buckets: Array<{
      label: string
      aantal: number
      van: number
      tot: number
    }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - i)
      buckets.push({
        label: WEEKDAGEN[d.getDay()],
        aantal: 0,
        van: d.getTime(),
        tot: d.getTime() + DAG_MS,
      })
    }
    return vul(buckets, tijden)
  }

  if (tijdvak === '30d') {
    const buckets: Array<{
      label: string
      aantal: number
      van: number
      tot: number
    }> = []
    const middernacht = new Date(
      nu.getFullYear(),
      nu.getMonth(),
      nu.getDate() + 1,
    ).getTime()
    for (let i = 3; i >= 0; i--) {
      const tot = middernacht - i * 7 * DAG_MS
      buckets.push({
        label: i === 0 ? 'Nu' : `−${i}w`,
        aantal: 0,
        van: tot - 7 * DAG_MS,
        tot,
      })
    }
    return vul(buckets, tijden)
  }

  // 90d en 'alles' bucketen per maand; 'alles' start bij het eerste ticket.
  const eerste = tijden.length > 0 ? new Date(tijden[0]) : nu
  const aantalMaanden =
    tijdvak === '90d'
      ? 3
      : Math.min(
          12,
          Math.max(
            1,
            (nu.getFullYear() - eerste.getFullYear()) * 12 +
              nu.getMonth() -
              eerste.getMonth() +
              1,
          ),
        )
  const buckets: Array<{
    label: string
    aantal: number
    van: number
    tot: number
  }> = []
  for (let i = aantalMaanden - 1; i >= 0; i--) {
    const van = new Date(nu.getFullYear(), nu.getMonth() - i, 1)
    const tot = new Date(nu.getFullYear(), nu.getMonth() - i + 1, 1)
    buckets.push({
      label: MAANDEN[van.getMonth()],
      aantal: 0,
      van: van.getTime(),
      tot: tot.getTime(),
    })
  }
  return vul(buckets, tijden)
}

function vul(
  buckets: Array<{ label: string; aantal: number; van: number; tot: number }>,
  tijden: Array<number>,
): Array<{ label: string; aantal: number }> {
  for (const t of tijden) {
    const b = buckets.find((x) => t >= x.van && t < x.tot)
    if (b) b.aantal++
  }
  return buckets.map((b) => ({ label: b.label, aantal: b.aantal }))
}

/** Aantal in een venster van `dagen` dagen, `terug` vensters geleden. */
function inVenster(momenten: Array<string>, dagen: number, terug = 0): number {
  const eind = Date.now() - terug * dagen * DAG_MS
  const van = eind - dagen * DAG_MS
  return momenten.filter((m) => {
    const t = new Date(m).getTime()
    return t >= van && t < eind
  }).length
}

function VerkoopGrafiek({
  data,
  tijdvak,
  onTijdvak,
}: {
  data: EventDashboardData
  tijdvak: Tijdvak
  onTijdvak: (t: Tijdvak) => void
}) {
  const reeks = useMemo(
    () => bouwReeks(data.verkoopmomenten, tijdvak),
    [data.verkoopmomenten, tijdvak],
  )
  const max = Math.max(1, ...reeks.map((r) => r.aantal))
  const gem =
    reeks.length > 0
      ? Math.round(reeks.reduce((s, r) => s + r.aantal, 0) / reeks.length)
      : 0

  const knoppen = (
    <div className="flex gap-1 rounded-[9px] bg-[#F1F5F9] p-1">
      {(['7d', '30d', '90d', 'alles'] as const).map((t) => (
        <button
          key={t}
          onClick={() => onTijdvak(t)}
          className={`rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-bold ${
            tijdvak === t
              ? 'bg-white text-[#0F172A] shadow-sm'
              : 'text-[#64748B]'
          }`}
        >
          {TIJDVAK_LABEL[t]}
        </button>
      ))}
    </div>
  )

  return (
    <Paneel
      titel="Uitgifte over tijd"
      sub={`Gemiddeld ${gem} per staaf`}
      extra={knoppen}
    >
      <div className="flex h-[130px] items-end gap-1.5">
        {reeks.map((r, i) => (
          <div
            key={`${r.label}-${i}`}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="text-[11px] font-bold tabular-nums text-[#64748B]">
              {r.aantal || ''}
            </span>
            <div
              className="w-full max-w-[28px] rounded-t-[5px] bg-[#2563EB]"
              style={{
                height: `${r.aantal > 0 ? Math.max(4, (r.aantal / max) * 100) : 2}%`,
                background: i === reeks.length - 1 ? '#2563EB' : '#BFDBFE',
              }}
            />
            <span className="text-[11px] text-[#94A3B8]">{r.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#F1F5F9] pt-4 sm:grid-cols-4">
        <Mini
          label="Vandaag"
          waarde={vandaagUitgegeven(data.verkoopmomenten)}
        />
        <Mini label="Gisteren" waarde={inVenster(data.verkoopmomenten, 1, 1)} />
        <Mini
          label="Laatste 7 dagen"
          waarde={inVenster(data.verkoopmomenten, 7)}
        />
        <Mini
          label="7 dagen daarvoor"
          waarde={inVenster(data.verkoopmomenten, 7, 1)}
        />
      </div>
    </Paneel>
  )
}

function Mini({ label, waarde }: { label: string; waarde: number }) {
  return (
    <div>
      <div className="text-[11.5px] text-[#94A3B8]">{label}</div>
      <div className="text-[15px] font-extrabold tabular-nums">{waarde}</div>
    </div>
  )
}

// ── Financieel (indicatief) ──────────────────────────────────────────────────

function FinancieelPaneel({ data }: { data: EventDashboardData }) {
  const marge = data.brutoSrd - data.inkoopSrd
  const regels: Array<{
    label: string
    waarde: string
    dik?: boolean
    kleur?: string
  }> = [
    {
      label: 'Bruto waarde uitgegeven',
      waarde: formatPrice(data.brutoSrd, 'SRD'),
      dik: true,
    },
    {
      label: 'Inkoopwaarde',
      waarde: `− ${formatPrice(data.inkoopSrd, 'SRD')}`,
      kleur: ROOD,
    },
    {
      label: 'Marge',
      waarde: formatPrice(marge, 'SRD'),
      dik: true,
      kleur: marge >= 0 ? GROEN : ROOD,
    },
    {
      label: 'Waarde ingetrokken tickets',
      waarde: `− ${formatPrice(data.ingetrokkenSrd, 'SRD')}`,
      kleur: ORANJE,
    },
    {
      label: 'Nog te verkopen waarde',
      waarde: formatPrice(data.openstaandSrd, 'SRD'),
    },
    {
      label: 'Volledig uitverkocht',
      waarde: formatPrice(data.brutoSrd + data.openstaandSrd, 'SRD'),
      kleur: GRIJS,
    },
  ]
  return (
    <Paneel
      titel="Financieel overzicht"
      sub="Indicatie uit de ticketprijzen — geen betalingen, uitbetalingen of restituties"
    >
      <div className="flex flex-col">
        {regels.map((r) => (
          <div
            key={r.label}
            className="flex justify-between gap-3 border-b border-[#F1F5F9] py-3 last:border-0"
          >
            <span
              className={`text-[14px] ${r.dik ? 'font-extrabold' : 'text-[#64748B]'}`}
            >
              {r.label}
            </span>
            <span
              className={`text-[14px] tabular-nums ${r.dik ? 'font-extrabold' : 'font-semibold'}`}
              style={{ color: r.kleur }}
            >
              {r.waarde}
            </span>
          </div>
        ))}
      </div>
    </Paneel>
  )
}

// ── Verkoopkanalen ───────────────────────────────────────────────────────────

function KanalenPaneel({ data }: { data: EventDashboardData }) {
  const totaal = data.kanalen.reduce((s, k) => s + k.aantal, 0)
  return (
    <Paneel
      titel="Verkoopkanalen"
      sub="Waar de uitgegeven tickets vandaan komen"
    >
      {data.kanalen.length === 0 ? (
        <Leeg tekst="Nog geen tickets uitgegeven." />
      ) : (
        <div className="flex flex-col gap-3">
          {data.kanalen.map((k, i) => {
            const p = pct(k.aantal, totaal)
            const kleur = TYPE_KLEUREN[i % TYPE_KLEUREN.length]
            return (
              <div key={k.naam} className="flex items-center gap-2.5">
                <span
                  className="h-2 w-2 flex-none rounded-full"
                  style={{ background: kleur }}
                />
                <span className="w-[96px] flex-none truncate text-[13.5px] font-semibold">
                  {verkoopkanaalLabel(k.naam) ?? 'Onbekend'}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F1F5F9]">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${p}%`, background: kleur }}
                  />
                </span>
                <span className="w-[38px] flex-none text-right text-[13px] font-extrabold tabular-nums">
                  {p}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </Paneel>
  )
}

// ── Trechter (reserveringen → deur) ──────────────────────────────────────────

function TrechterPaneel({ data }: { data: EventDashboardData }) {
  const r = data.reserveringen
  const stappen = [
    { label: 'Reserveringen aangevraagd', waarde: r.aangevraagd, basis: 0 },
    {
      label: 'Reserveringen afgehandeld',
      waarde: r.afgehandeld,
      basis: r.aangevraagd,
    },
    { label: 'Tickets uitgegeven', waarde: data.uitgegeven, basis: 0 },
    {
      label: 'Ingecheckt aan de deur',
      waarde: data.gebruikt,
      basis: data.uitgegeven,
    },
  ]
  return (
    <Paneel
      titel="Trechter"
      sub="Van aanvraag tot binnen — bezoekersstatistieken worden niet bijgehouden"
    >
      <div className="flex flex-col">
        {stappen.map((s, i) => (
          <div key={s.label}>
            <div
              className={`flex items-center justify-between gap-3 rounded-[10px] px-4 py-2.5 ${
                i === stappen.length - 1 ? 'bg-[#EFF6FF]' : 'bg-[#F8FAFC]'
              }`}
            >
              <span className="text-[13.5px] font-semibold text-[#334155]">
                {s.label}
              </span>
              <span className="flex items-center gap-2.5">
                <span className="text-[15px] font-extrabold tabular-nums">
                  {s.waarde}
                </span>
                {s.basis > 0 && (
                  <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[12px] font-bold text-[#2563EB] tabular-nums">
                    {pct(s.waarde, s.basis)}%
                  </span>
                )}
              </span>
            </div>
            {i < stappen.length - 1 && (
              <div className="grid h-4 place-items-center text-[13px] text-[#CBD5E1]">
                ↓
              </div>
            )}
          </div>
        ))}
      </div>
    </Paneel>
  )
}

// ── Ticketprestaties ─────────────────────────────────────────────────────────

function PrestatiesPaneel({ data }: { data: EventDashboardData }) {
  const tegels = prestatieTegels(data)
  return (
    <Paneel titel="Ticketprestaties" sub="Opvallende types voor dit event">
      {tegels.length === 0 ? (
        <Leeg tekst="Nog te weinig gegevens." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tegels.map((t) => (
            <div
              key={t.tag}
              className="rounded-xl border border-[#F1F5F9] p-3.5"
            >
              <div
                className="mb-2 text-[11.5px] font-extrabold uppercase tracking-wide"
                style={{ color: t.kleur }}
              >
                {t.tag}
              </div>
              <div className="text-[14.5px] font-extrabold">{t.type}</div>
              <div className="mt-0.5 text-[12.5px] text-[#64748B]">
                {t.detail}
              </div>
            </div>
          ))}
        </div>
      )}
    </Paneel>
  )
}

function prestatieTegels(data: EventDashboardData) {
  const types = data.perType.filter((t) => t.capaciteit > 0)
  if (types.length === 0) return []
  const tegels: Array<{
    tag: string
    type: string
    detail: string
    kleur: string
  }> = []

  const best = [...types].sort((a, b) => b.uitgegeven - a.uitgegeven)[0]
  if (best.uitgegeven > 0) {
    tegels.push({
      tag: 'Bestverkocht',
      type: best.naam,
      detail: `${best.uitgegeven} uitgegeven`,
      kleur: GROEN,
    })
  }

  const groei = [...types].sort(
    (a, b) => b.laatste7 - b.vorige7 - (a.laatste7 - a.vorige7),
  )[0]
  if (groei.laatste7 > groei.vorige7) {
    tegels.push({
      tag: 'Snelst groeiend',
      type: groei.naam,
      detail: `+${groei.laatste7 - groei.vorige7} deze week`,
      kleur: BLAUW,
    })
  }

  const bijnaOpLijst = types
    .filter((t) => t.uitgegeven > 0 && pct(t.uitgegeven, t.capaciteit) >= 80)
    .sort(
      (a, b) =>
        pct(b.uitgegeven, b.capaciteit) - pct(a.uitgegeven, a.capaciteit),
    )
  const bijnaOp = bijnaOpLijst.length > 0 ? bijnaOpLijst[0] : null
  if (bijnaOp) {
    tegels.push({
      tag: 'Bijna uitverkocht',
      type: bijnaOp.naam,
      detail: `Nog ${bijnaOp.capaciteit - bijnaOp.uitgegeven} beschikbaar`,
      kleur: ORANJE,
    })
  }

  const traag = [...types].sort(
    (a, b) => pct(a.uitgegeven, a.capaciteit) - pct(b.uitgegeven, b.capaciteit),
  )[0]
  if (
    types.length > 1 &&
    pct(traag.uitgegeven, traag.capaciteit) < 40 &&
    traag.id !== bijnaOp?.id
  ) {
    tegels.push({
      tag: 'Aandacht nodig',
      type: traag.naam,
      detail: `Pas ${pct(traag.uitgegeven, traag.capaciteit)}% weg`,
      kleur: ROOD,
    })
  }

  return tegels
}

// ── Health score ─────────────────────────────────────────────────────────────

function HealthPaneel({ data }: { data: EventDashboardData }) {
  const { score, punten } = health(data)
  const kleur = score >= 70 ? GROEN : score >= 45 ? ORANJE : ROOD
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-extrabold">Event Health Score</h2>
        <div
          className="text-[20px] font-extrabold tabular-nums"
          style={{ color: kleur }}
        >
          {score}
          <span className="text-[12px] font-semibold text-[#94A3B8]">/100</span>
        </div>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#F1F5F9]">
        <div
          className="h-full rounded-full"
          style={{ width: `${score}%`, background: kleur }}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        {punten.map((p) => (
          <div
            key={p.tekst}
            className="flex items-start gap-2 text-[12.5px] leading-snug text-[#475569]"
          >
            <span className="font-extrabold" style={{ color: p.kleur }}>
              {p.mark}
            </span>
            {p.tekst}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Health score uit vier gelijk wegende signalen: hoeveel van de capaciteit weg
 * is, of de uitgifte versnelt, of de tickets ook echt geleverd zijn en hoeveel
 * er is ingetrokken. Bewust een simpele heuristiek, geen model.
 */
function health(data: EventDashboardData) {
  const punten: Array<{ mark: string; tekst: string; kleur: string }> = []
  const wegPct = pct(data.uitgegeven, data.capaciteit)
  const laatste7 = inVenster(data.verkoopmomenten, 7)
  const vorige7 = inVenster(data.verkoopmomenten, 7, 1)
  const geleverdPct = pct(data.geleverd, data.uitgegeven)
  const introkPct = pct(data.ingetrokken, data.uitgegeven + data.ingetrokken)

  const verkoopScore = Math.min(25, Math.round((wegPct / 100) * 25))
  punten.push(
    wegPct >= 60
      ? {
          mark: '✓',
          tekst: `${wegPct}% van de capaciteit is uitgegeven.`,
          kleur: GROEN,
        }
      : {
          mark: '!',
          tekst: `Pas ${wegPct}% van de capaciteit is uitgegeven.`,
          kleur: ORANJE,
        },
  )

  const momentumScore =
    vorige7 === 0
      ? laatste7 > 0
        ? 25
        : 10
      : Math.min(25, Math.round((laatste7 / vorige7) * 15))
  punten.push(
    laatste7 >= vorige7
      ? {
          mark: '✓',
          tekst: `Uitgifte houdt aan: ${laatste7} deze week tegen ${vorige7} vorige week.`,
          kleur: GROEN,
        }
      : {
          mark: '!',
          tekst: `Uitgifte zakt: ${laatste7} deze week tegen ${vorige7} vorige week.`,
          kleur: ORANJE,
        },
  )

  const leveringScore = Math.min(25, Math.round((geleverdPct / 100) * 25))
  punten.push(
    geleverdPct >= 90
      ? {
          mark: '✓',
          tekst: `${geleverdPct}% van de tickets is afgeleverd.`,
          kleur: GROEN,
        }
      : {
          mark: '!',
          tekst: `${data.uitgegeven - data.geleverd} tickets zijn nog niet afgeleverd.`,
          kleur: ORANJE,
        },
  )

  const introkScore = Math.max(0, 25 - Math.round((introkPct / 100) * 25 * 3))
  punten.push(
    introkPct <= 5
      ? {
          mark: '✓',
          tekst: `Weinig ingetrokken tickets (${introkPct}%).`,
          kleur: GROEN,
        }
      : {
          mark: '!',
          tekst: `${introkPct}% van de tickets is ingetrokken.`,
          kleur: ROOD,
        },
  )

  return {
    score: verkoopScore + momentumScore + leveringScore + introkScore,
    punten,
  }
}

// ── Inzichten ────────────────────────────────────────────────────────────────

function InzichtenPaneel({
  data,
  start,
}: {
  data: EventDashboardData
  start: Date
}) {
  const inzichten = useMemo(() => bouwInzichten(data, start), [data, start])
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-[15px] font-extrabold">Inzichten</h2>
      {inzichten.length === 0 ? (
        <Leeg tekst="Nog te weinig gegevens voor inzichten." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {inzichten.map((i) => (
            <div
              key={i}
              className="flex items-start gap-2 rounded-[10px] bg-[#F8FAFC] px-3 py-2.5 text-[13px] leading-snug text-[#334155]"
            >
              <span className="flex-none text-[#2563EB]">→</span>
              {i}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function bouwInzichten(data: EventDashboardData, start: Date): Array<string> {
  const uit: Array<string> = []
  const laatste7 = inVenster(data.verkoopmomenten, 7)
  const vorige7 = inVenster(data.verkoopmomenten, 7, 1)
  const snelheid = snelheidPerDag(data.verkoopmomenten)
  const dagenTeGaan = Math.max(
    0,
    Math.ceil((start.getTime() - Date.now()) / DAG_MS),
  )

  if (vorige7 > 0) {
    const verschil = Math.round(((laatste7 - vorige7) / vorige7) * 100)
    uit.push(
      verschil >= 0
        ? `Uitgifte ligt ${verschil}% hoger dan vorige week.`
        : `Uitgifte ligt ${Math.abs(verschil)}% lager dan vorige week.`,
    )
  }

  const kanaalTotaal = data.kanalen.reduce((s, k) => s + k.aantal, 0)
  if (data.kanalen.length > 0 && kanaalTotaal > 0) {
    const top = data.kanalen[0]
    uit.push(
      `${verkoopkanaalLabel(top.naam) ?? 'Onbekend kanaal'} levert ${pct(top.aantal, kanaalTotaal)}% van de uitgegeven tickets.`,
    )
  }

  if (data.beschikbaar > 0 && snelheid > 0 && dagenTeGaan > 0) {
    const nodig = Math.ceil(data.beschikbaar / snelheid)
    uit.push(
      nodig <= dagenTeGaan
        ? `Bij dit tempo uitverkocht over ongeveer ${nodig} dagen.`
        : `Bij dit tempo blijft er ongeveer ${Math.max(0, data.beschikbaar - Math.round(snelheid * dagenTeGaan))} over op de eventdag.`,
    )
  }

  const nietGeleverd = data.uitgegeven - data.geleverd
  if (nietGeleverd > 0) {
    uit.push(
      `${nietGeleverd} uitgegeven tickets zijn nog niet als afgeleverd gemarkeerd.`,
    )
  }

  if (data.reserveringen.aangevraagd > 0) {
    const open =
      data.reserveringen.aangevraagd -
      data.reserveringen.afgehandeld -
      data.reserveringen.afgewezen
    if (open > 0) uit.push(`${open} reserveringen wachten nog op verwerking.`)
  }

  if (data.gebruikt > 0) {
    uit.push(
      `${pct(data.gebruikt, data.uitgegeven)}% van de uitgegeven tickets is gescand aan de deur.`,
    )
  }

  const margePct =
    data.brutoSrd > 0 ? pct(data.brutoSrd - data.inkoopSrd, data.brutoSrd) : 0
  if (data.brutoSrd > 0) {
    uit.push(`Indicatieve marge is ${margePct}% van de brutowaarde.`)
  }

  return uit
}

// ── Recente kopers ───────────────────────────────────────────────────────────

const thCls = 'bg-[#F8FAFC] px-4 py-2.5 font-bold'

function KopersPaneel({ data }: { data: EventDashboardData }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-extrabold">Recente kopers</h2>
        <Link
          to="/admin/events/$eventId"
          params={{ eventId: data.event.id }}
          className="text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
        >
          Alle tickets →
        </Link>
      </div>
      {data.kopers.length === 0 ? (
        <Leeg tekst="Nog geen tickets uitgegeven voor dit event." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-left text-[#64748B]">
                <th className={`${thCls} rounded-l-[9px]`}>Naam</th>
                <th className={thCls}>Type</th>
                <th className={thCls}>Bedrag</th>
                <th className={thCls}>Datum</th>
                <th className={thCls}>Levering</th>
                <th className={`${thCls} rounded-r-[9px]`}>Check-in</th>
              </tr>
            </thead>
            <tbody>
              {data.kopers.map((k, i) => (
                <tr
                  key={k.code}
                  className={i > 0 ? 'border-t border-[#E5E7EB]' : ''}
                >
                  <td className="px-4 py-3.5 font-semibold">{k.naam ?? '—'}</td>
                  <td className="px-4 py-3.5 text-[#64748B]">{k.type_naam}</td>
                  <td className="px-4 py-3.5 font-semibold tabular-nums">
                    {formatPrice(k.prijs_srd, 'SRD')}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-[#94A3B8]">
                    {k.verkocht_op
                      ? new Date(k.verkocht_op).toLocaleString('nl-NL', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge {...leveringBadge(k)} />
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge {...checkinBadge(k)} />
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

function Badge({ tekst, cls }: { tekst: string; cls: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-bold ${cls}`}
    >
      {tekst}
    </span>
  )
}

function leveringBadge(k: EventDashboardData['kopers'][number]) {
  if (k.ingetrokken_op)
    return { tekst: 'Ingetrokken', cls: 'bg-[#FEE2E2] text-[#DC2626]' }
  if (k.geleverd_op)
    return {
      tekst: k.geleverd_via ?? 'Geleverd',
      cls: 'bg-[#DCFCE7] text-[#16A34A]',
    }
  return { tekst: 'Nog niet', cls: 'bg-[#F1F5F9] text-[#64748B]' }
}

function checkinBadge(k: EventDashboardData['kopers'][number]) {
  if (k.ingetrokken_op)
    return { tekst: 'N.v.t.', cls: 'bg-[#F1F5F9] text-[#64748B]' }
  if (k.gebruikt_op)
    return { tekst: 'Binnen', cls: 'bg-[#DBEAFE] text-[#2563EB]' }
  return { tekst: 'Nog niet', cls: 'bg-[#F1F5F9] text-[#64748B]' }
}
