import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getEvent } from '#/server/events'
import {
  createScannerSession,
  listScannerSessions,
  revokeScannerSession,
} from '#/server/scannerSessions'
import { getEventStats, listScans } from '#/server/stats'
import type { EventStats, ScanLogRegel } from '#/server/stats'
import type { ScanResultaat } from '#/lib/scanResult'
import { downloadCsv, naarCsv } from '#/lib/csv'

// Deurbeheer en rapportage (fase F). Aparte route onder /admin, los van de
// event-detailpagina (de trailing underscore in `$eventId_` haalt 'm uit de
// nesting). Scanner-sessies koppelen/intrekken, live teller, scanlog + export.
export const Route = createFileRoute('/admin/events/$eventId_/deur')({
  loader: async ({ params }) => {
    const [event, sessies, stats, scanlog] = await Promise.all([
      getEvent({ data: params.eventId }),
      listScannerSessions({ data: params.eventId }),
      getEventStats({ data: params.eventId }),
      listScans({ data: params.eventId }),
    ])
    return { event, sessies, stats, scanlog }
  },
  component: DeurPagina,
})

const inputSm =
  'rounded-[9px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-[13.5px] outline-none focus:border-[#2563EB]'

function Sectie({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">{children}</div>
}

const thCls = 'bg-[#F8FAFC] px-4 py-2.5 font-bold'

function DeurPagina() {
  const { event } = Route.useLoaderData()
  const { eventId } = Route.useParams()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1 text-[13px] text-[#64748B]">
            <Link to="/admin/events" className="hover:text-[#0F172A]">
              Events
            </Link>{' '}
            /{' '}
            <Link to="/admin/events/$eventId" params={{ eventId }} className="hover:text-[#0F172A]">
              {event.naam}
            </Link>{' '}
            / <span className="font-semibold text-[#0F172A]">Deur &amp; rapportage</span>
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight">{event.naam}</h1>
          <p className="text-[13px] text-[#64748B]">Deurbeheer &amp; rapportage</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/events/$eventId"
            params={{ eventId }}
            className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F172A] hover:border-[#CBD5E1]"
          >
            ← Event
          </Link>
          <Link
            to="/scan/$eventId"
            params={{ eventId }}
            className="rounded-full bg-[#2563EB] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1D4ED8]"
          >
            Scannen
          </Link>
        </div>
      </div>

      <TellerSectie />
      <SessiesSectie />
      <ScanlogSectie />
    </div>
  )
}

// --- live teller ---

function TellerSectie() {
  const { stats: initieel } = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const [stats, setStats] = useState<EventStats>(initieel)

  // Poll elke 10s (geen websockets in de stack). Zo zie je de deur meelopen.
  useEffect(() => {
    let gestopt = false
    const timer = window.setInterval(async () => {
      try {
        const verse = await getEventStats({ data: eventId })
        if (!gestopt) setStats(verse)
      } catch {
        // netwerk-hik: volgende tick pakt het weer op
      }
    }, 10_000)
    return () => {
      gestopt = true
      window.clearInterval(timer)
    }
  }, [eventId])

  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <TellerKaart label="Binnen" waarde={stats.binnen} accent="text-[#16A34A]" />
      <TellerKaart label="Nog buiten" waarde={stats.buiten} />
      <TellerKaart label="Verkocht" waarde={stats.verkocht} />
      <TellerKaart label="Ingetrokken" waarde={stats.ingetrokken} accent="text-[#DC2626]" />
    </section>
  )
}

function TellerKaart({
  label,
  waarde,
  accent,
}: {
  label: string
  waarde: number
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className={`text-[30px] font-extrabold tracking-tight tabular-nums ${accent ?? ''}`}>{waarde}</div>
      <div className="text-[13px] font-semibold text-[#64748B]">{label}</div>
    </div>
  )
}

// --- scanner-sessies ---

function sessieStatus(s: {
  ingetrokken_op: string | null
  vervalt_op: string | null
}): { tekst: string; cls: string } {
  if (s.ingetrokken_op) return { tekst: 'Ingetrokken', cls: 'bg-[#FEE2E2] text-[#DC2626]' }
  if (s.vervalt_op && new Date(s.vervalt_op) < new Date()) {
    return { tekst: 'Verlopen', cls: 'bg-[#F1F5F9] text-[#64748B]' }
  }
  return { tekst: 'Actief', cls: 'bg-[#DCFCE7] text-[#16A34A]' }
}

function SessiesSectie() {
  const { sessies } = Route.useLoaderData()
  const { eventId } = Route.useParams()
  const router = useRouter()
  const [label, setLabel] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [nieuw, setNieuw] = useState<{ url: string; qrSvg: string } | null>(null)

  async function koppelen(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    try {
      const res = await createScannerSession({ data: { eventId, label } })
      setNieuw({ url: res.url, qrSvg: res.qrSvg })
      setLabel('')
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Koppelen mislukt')
    } finally {
      setBezig(false)
    }
  }

  async function intrekken(sessieId: string) {
    if (!window.confirm('Deze scanner intrekken? De telefoon kan dan niet meer scannen.')) {
      return
    }
    await revokeScannerSession({ data: { sessieId } })
    await router.invalidate()
  }

  return (
    <Sectie>
      <h2 className="mb-4 text-[16px] font-extrabold">Scanners</h2>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[#64748B]">
              <th className={`rounded-l-[9px] ${thCls}`}>Label</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Laatste sync</th>
              <th className={thCls}>Scans</th>
              <th className={`rounded-r-[9px] ${thCls}`}></th>
            </tr>
          </thead>
          <tbody>
            {sessies.map((s) => {
              const st = sessieStatus(s)
              return (
                <tr key={s.id} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-3 font-semibold">{s.label || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${st.cls}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {st.tekst}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {s.laatste_sync ? new Date(s.laatste_sync).toLocaleString('nl-NL') : 'nog niet'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{s.aantal_scans}</td>
                  <td className="px-4 py-3 text-right">
                    {!s.ingetrokken_op && (
                      <button onClick={() => intrekken(s.id)} className="text-[13px] font-semibold text-[#DC2626] hover:underline">
                        intrekken
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {sessies.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-[#64748B]">
                  Nog geen scanners gekoppeld.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={koppelen} className="mt-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-bold">Label (bv. Ingang, VIP)</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ingang" className={inputSm} />
        </label>
        <button
          type="submit"
          disabled={bezig}
          className="rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
        >
          {bezig ? 'Bezig…' : 'Scanner koppelen'}
        </button>
      </form>
      {fout && <p className="mt-2 text-[14px] font-semibold text-[#DC2626]">{fout}</p>}

      {nieuw && <KoppelKaart nieuw={nieuw} onSluiten={() => setNieuw(null)} />}
    </Sectie>
  )
}

function KoppelKaart({
  nieuw,
  onSluiten,
}: {
  nieuw: { url: string; qrSvg: string }
  onSluiten: () => void
}) {
  const [gekopieerd, setGekopieerd] = useState(false)

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(nieuw.url)
      setGekopieerd(true)
      window.setTimeout(() => setGekopieerd(false), 1500)
    } catch {
      setGekopieerd(false)
    }
  }

  return (
    <div className="mt-4 rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-bold text-[#166534]">
            Scanner gekoppeld. Laat de deurtelefoon deze QR scannen of open de link.
          </p>
          <p className="mt-1 text-[12px] text-[#15803D]">
            Deze link is nu éénmalig te zien — daarna niet meer op te vragen.
          </p>
        </div>
        <button onClick={onSluiten} className="text-[13px] font-semibold text-[#166534] hover:underline">
          sluiten
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className="h-40 w-40 rounded-[10px] bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
          // QR server-side gegenereerd; qrcode blijft uit de client-bundel.
          dangerouslySetInnerHTML={{ __html: nieuw.qrSvg }}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <code className="max-w-full break-all rounded-[8px] bg-white px-2.5 py-1.5 text-[12px]">{nieuw.url}</code>
          <button
            onClick={kopieer}
            className="self-start rounded-full border border-[#86EFAC] bg-white px-4 py-1.5 text-[13px] font-semibold text-[#166534] hover:bg-[#F0FDF4]"
          >
            {gekopieerd ? 'Gekopieerd ✓' : 'Kopieer link'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- scanlog ---

const RESULTAAT_LABEL: Record<ScanResultaat, string> = {
  groen: 'Welkom',
  groen_re_entry: 'Re-entry',
  rood_al_gebruikt: 'Al gebruikt',
  rood_ongeldig: 'Ongeldig',
  rood_ingetrokken: 'Ingetrokken',
  rood_verkeerd_event: 'Verkeerd event',
}

function isGroenResultaat(r: ScanResultaat): boolean {
  return r === 'groen' || r === 'groen_re_entry'
}

function ScanlogSectie() {
  const { scanlog, event } = Route.useLoaderData()
  const [filter, setFilter] = useState<'alle' | 'groen' | 'rood'>('alle')

  const lijst = scanlog.filter((r) => {
    if (filter === 'groen') return isGroenResultaat(r.resultaat)
    if (filter === 'rood') return !isGroenResultaat(r.resultaat)
    return true
  })

  function exporteer(rijen: ScanLogRegel[]) {
    const csv = naarCsv(
      ['Tijd (server)', 'Tijd (telefoon)', 'Resultaat', 'Naam', 'Scanner'],
      rijen.map((r) => [
        new Date(r.tijdstip_server).toLocaleString('nl-NL'),
        r.tijdstip_client ? new Date(r.tijdstip_client).toLocaleString('nl-NL') : '',
        RESULTAAT_LABEL[r.resultaat],
        r.koper_naam,
        r.sessie_label,
      ]),
    )
    const slug = event.naam.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadCsv(`scanlog-${slug}.csv`, csv)
  }

  return (
    <Sectie>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">Scanlog ({lijst.length})</h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'alle' | 'groen' | 'rood')}
            className={inputSm}
          >
            <option value="alle">Alle</option>
            <option value="groen">Alleen groen</option>
            <option value="rood">Alleen rood</option>
          </select>
          <button
            onClick={() => exporteer(lijst)}
            disabled={lijst.length === 0}
            className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[#64748B]">
              <th className={`rounded-l-[9px] ${thCls}`}>Tijd</th>
              <th className={thCls}>Resultaat</th>
              <th className={thCls}>Naam</th>
              <th className={`rounded-r-[9px] ${thCls}`}>Scanner</th>
            </tr>
          </thead>
          <tbody>
            {lijst.map((r) => {
              const groen = isGroenResultaat(r.resultaat)
              return (
                <tr key={r.id} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-3 tabular-nums text-[#64748B]">
                    {new Date(r.tijdstip_server).toLocaleString('nl-NL')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${
                        groen ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {RESULTAAT_LABEL[r.resultaat]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.koper_naam || '—'}</td>
                  <td className="px-4 py-3 text-[#64748B]">{r.sessie_label || '—'}</td>
                </tr>
              )
            })}
            {lijst.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-[#64748B]">
                  Nog geen scans.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Sectie>
  )
}
