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

function DeurPagina() {
  const { event } = Route.useLoaderData()
  const { eventId } = Route.useParams()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.naam}</h1>
          <p className="text-sm text-gray-500">Deurbeheer &amp; rapportage</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/events/$eventId"
            params={{ eventId }}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            ← Event
          </Link>
          <Link
            to="/scan/$eventId"
            params={{ eventId }}
            className="rounded bg-black px-3 py-1 text-sm font-medium text-white"
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
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Kaart label="Binnen" waarde={stats.binnen} accent="text-green-700" />
      <Kaart label="Nog buiten" waarde={stats.buiten} />
      <Kaart label="Verkocht" waarde={stats.verkocht} />
      <Kaart
        label="Ingetrokken"
        waarde={stats.ingetrokken}
        accent="text-red-600"
      />
    </section>
  )
}

function Kaart({
  label,
  waarde,
  accent,
}: {
  label: string
  waarde: number
  accent?: string
}) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <div className={`text-3xl font-bold ${accent ?? ''}`}>{waarde}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}

// --- scanner-sessies ---

function sessieStatus(s: {
  ingetrokken_op: string | null
  vervalt_op: string | null
}): { tekst: string; kleur: string } {
  if (s.ingetrokken_op) return { tekst: 'ingetrokken', kleur: 'text-red-600' }
  if (s.vervalt_op && new Date(s.vervalt_op) < new Date()) {
    return { tekst: 'verlopen', kleur: 'text-gray-500' }
  }
  return { tekst: 'actief', kleur: 'text-green-700' }
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
    <section>
      <h2 className="mb-3 text-lg font-semibold">Scanners</h2>

      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Laatste sync</th>
            <th className="px-3 py-2">Scans</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {sessies.map((s) => {
            const st = sessieStatus(s)
            return (
              <tr key={s.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{s.label || '—'}</td>
                <td className={`px-3 py-2 ${st.kleur}`}>{st.tekst}</td>
                <td className="px-3 py-2 text-gray-600">
                  {s.laatste_sync
                    ? new Date(s.laatste_sync).toLocaleString('nl-NL')
                    : 'nog niet'}
                </td>
                <td className="px-3 py-2">{s.aantal_scans}</td>
                <td className="px-3 py-2 text-right">
                  {!s.ingetrokken_op && (
                    <button
                      onClick={() => intrekken(s.id)}
                      className="text-red-600 hover:underline"
                    >
                      intrekken
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
          {sessies.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-3 text-gray-500">
                Nog geen scanners gekoppeld.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <form onSubmit={koppelen} className="mt-3 flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Label (bv. Ingang, VIP)</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ingang"
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={bezig}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {bezig ? 'Bezig…' : 'Scanner koppelen'}
        </button>
      </form>
      {fout && <p className="mt-2 text-sm text-red-600">{fout}</p>}

      {nieuw && <KoppelKaart nieuw={nieuw} onSluiten={() => setNieuw(null)} />}
    </section>
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
    <div className="mt-4 rounded border border-green-300 bg-green-50 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-green-900">
            Scanner gekoppeld. Laat de deurtelefoon deze QR scannen of open de
            link.
          </p>
          <p className="mt-1 text-xs text-green-800">
            Deze link is nu éénmalig te zien — daarna niet meer op te vragen.
          </p>
        </div>
        <button
          onClick={onSluiten}
          className="text-sm text-green-900 hover:underline"
        >
          sluiten
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <div
          className="h-40 w-40 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
          // QR server-side gegenereerd; qrcode blijft uit de client-bundel.
          dangerouslySetInnerHTML={{ __html: nieuw.qrSvg }}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <code className="max-w-full break-all rounded bg-white px-2 py-1 text-xs">
            {nieuw.url}
          </code>
          <button
            onClick={kopieer}
            className="self-start rounded border border-green-400 px-3 py-1 text-sm text-green-900 hover:bg-green-100"
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
        r.tijdstip_client
          ? new Date(r.tijdstip_client).toLocaleString('nl-NL')
          : '',
        RESULTAAT_LABEL[r.resultaat],
        r.koper_naam,
        r.sessie_label,
      ]),
    )
    const slug = event.naam.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    downloadCsv(`scanlog-${slug}.csv`, csv)
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Scanlog ({lijst.length})</h2>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as 'alle' | 'groen' | 'rood')
            }
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            <option value="alle">Alle</option>
            <option value="groen">Alleen groen</option>
            <option value="rood">Alleen rood</option>
          </select>
          <button
            onClick={() => exporteer(lijst)}
            disabled={lijst.length === 0}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
      </div>

      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Tijd</th>
            <th className="px-3 py-2">Resultaat</th>
            <th className="px-3 py-2">Naam</th>
            <th className="px-3 py-2">Scanner</th>
          </tr>
        </thead>
        <tbody>
          {lijst.map((r) => (
            <tr key={r.id} className="border-t border-gray-200">
              <td className="px-3 py-2 text-gray-600">
                {new Date(r.tijdstip_server).toLocaleString('nl-NL')}
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    isGroenResultaat(r.resultaat)
                      ? 'text-green-700'
                      : 'text-red-600'
                  }
                >
                  {RESULTAAT_LABEL[r.resultaat]}
                </span>
              </td>
              <td className="px-3 py-2">{r.koper_naam || '—'}</td>
              <td className="px-3 py-2 text-gray-600">
                {r.sessie_label || '—'}
              </td>
            </tr>
          ))}
          {lijst.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-3 text-gray-500">
                Nog geen scans.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
