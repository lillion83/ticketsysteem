import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getEvent } from '#/server/events'
import { syncTickets, uploadScans } from '#/server/sync'
import { bepaalLokaal, isGroen } from '#/lib/scanResult'
import type { ScanUitkomst } from '#/lib/scanResult'
import {
  bewaarLijst,
  laadLijst,
  laadQueue,
  laadToken,
  markeerGebruikt,
  voegToeAanQueue,
  verwijderUitQueue,
} from '#/lib/scannerStore'
import type { Lijst } from '#/lib/scannerStore'
import { decodeFrame } from '#/lib/qrscan'

// Scannerscherm (fase D + E). Aparte volscherm-route, mobiel-first: dit draait
// aan de deur op een telefoon. Camera leest de QR; het oordeel valt lokaal
// (offline-first, PLAN §3.3), de server krijgt de scan via een idempotente
// uploadqueue.
export const Route = createFileRoute('/scan/$eventId')({
  // Geen harde login-guard: de scanner wordt óf door de ingelogde admin geopend,
  // óf door deurpersoneel via een scannertoken (fase F, PLAN §3.5) dat alleen
  // client-side in localStorage staat — server-side hier niet zichtbaar. De
  // sync/upload-endpoints doen de echte autorisatie (token óf sessie). Zonder
  // beide krijgt de gebruiker gewoon "geen lijst" te zien, geen data lekt.
  loader: async ({ params }) => {
    // Offline valt getEvent weg; de component leest de eventnaam dan uit de
    // gesyncte lijst in localStorage.
    try {
      return await getEvent({ data: params.eventId })
    } catch {
      return null
    }
  },
  component: Scanner,
})

// Weiger te scannen als de lijst ouder is dan dit (PLAN risico's: ">2 uur oud").
const MAX_SYNC_LEEFTIJD_MS = 2 * 60 * 60 * 1000
// Volledige re-sync met de server (PLAN §3.4: scanners zien elkaars scans).
const SYNC_INTERVAL_MS = 10_000

// --- weergave per resultaat ---

type Weergave = { groen: boolean; titel: string; subtitel?: string }

function weergaveVoor(uitkomst: ScanUitkomst): Weergave {
  switch (uitkomst.resultaat) {
    case 'groen':
      return { groen: true, titel: 'Welkom' }
    case 'groen_re_entry':
      return { groen: true, titel: 'Welkom terug', subtitel: 'Re-entry' }
    case 'rood_al_gebruikt':
      return {
        groen: false,
        titel: 'Al gebruikt',
        subtitel: uitkomst.gebruikt_op
          ? `Gescand om ${new Date(uitkomst.gebruikt_op).toLocaleString('nl-NL')}`
          : undefined,
      }
    case 'rood_ingetrokken':
      return { groen: false, titel: 'Ingetrokken' }
    case 'rood_verkeerd_event':
      return { groen: false, titel: 'Verkeerd event' }
    case 'rood_ongeldig':
    default:
      return { groen: false, titel: 'Ongeldig' }
  }
}

// --- feedback: korte piep + trilling ---

function speelPiep(ctx: AudioContext | null, groen: boolean) {
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = groen ? 880 : 220
  osc.connect(gain)
  gain.connect(ctx.destination)
  const duur = groen ? 0.15 : 0.4
  gain.gain.setValueAtTime(0.15, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duur)
  osc.start()
  osc.stop(ctx.currentTime + duur)
}

function tril(groen: boolean) {
  if ('vibrate' in navigator) navigator.vibrate(groen ? 80 : [120, 60, 120])
}

function uitlegCamerafout(err: unknown): string {
  const naam = err instanceof Error ? err.name : ''
  if (naam === 'NotAllowedError' || naam === 'SecurityError') {
    return 'Cameratoegang geweigerd. Sta de camera toe in je browser, of tik de code hieronder handmatig in.'
  }
  if (naam === 'NotFoundError' || naam === 'OverconstrainedError') {
    return 'Geen (achter)camera gevonden. Tik de code hieronder handmatig in.'
  }
  return 'Camera kon niet starten. Werkt dit scherm via https of localhost? Tik anders de code handmatig in.'
}

function leeftijdTekst(gesyncedOp: string | null): string {
  if (!gesyncedOp) return 'nog niet gesynct'
  const ms = Date.now() - new Date(gesyncedOp).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'zojuist'
  if (min < 60) return `${min} min geleden`
  const uur = Math.floor(min / 60)
  return `${uur} uur geleden`
}

function nieuwUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  // Fallback voor oude toestellen zonder crypto.randomUUID.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function Scanner() {
  const event = Route.useLoaderData()
  const { eventId } = Route.useParams()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const pauzeRef = useRef(false)
  const laatsteCodeRef = useRef<string | null>(null)
  const lijstRef = useRef<Lijst | null>(null)
  const flushBezigRef = useRef(false)

  const [overlay, setOverlay] = useState<Weergave | null>(null)
  const [cameraFout, setCameraFout] = useState<string | null>(null)
  const [handmatig, setHandmatig] = useState('')
  const [naam, setNaam] = useState<string>(event?.naam ?? '')
  const [gesyncedOp, setGesyncedOp] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [queueAantal, setQueueAantal] = useState(0)
  const [heeftLijst, setHeeftLijst] = useState(false)
  // Ververst de "X min geleden"-tekst zonder een nieuwe sync te forceren.
  const [, setTik] = useState(0)

  const isVerouderd = gesyncedOp
    ? Date.now() - new Date(gesyncedOp).getTime() > MAX_SYNC_LEEFTIJD_MS
    : true

  // --- uploadqueue legen ---
  const flush = useCallback(async () => {
    if (flushBezigRef.current) return
    const queue = laadQueue(eventId)
    if (queue.length === 0) return
    flushBezigRef.current = true
    try {
      const res = await uploadScans({
        data: { eventId, token: laadToken(eventId) ?? undefined, scans: queue },
      })
      // De server geeft per verzonden scan een resultaat terug; die zijn nu
      // verwerkt (idempotent) en mogen uit de queue.
      const gedaan = res.resultaten.map((r) => r.client_scan_uuid)
      verwijderUitQueue(eventId, gedaan)
      setQueueAantal(laadQueue(eventId).length)
      setOnline(true)
    } catch {
      // Mislukt (offline?): alles blijft in de queue, volgende poging pakt 't op.
      setOnline(false)
    } finally {
      flushBezigRef.current = false
    }
  }, [eventId])

  // --- volledige sync ---
  const syncNu = useCallback(async () => {
    try {
      const data = await syncTickets({
        data: { eventId, token: laadToken(eventId) ?? undefined },
      })
      const l = bewaarLijst(eventId, {
        gesyncedOp: data.gesyncedOp,
        naam: data.naam,
        reEntry: data.reEntry,
        tickets: data.tickets,
      })
      lijstRef.current = l
      setHeeftLijst(true)
      setGesyncedOp(l.gesyncedOp)
      setNaam(l.naam)
      setOnline(true)
      void flush()
    } catch {
      // Offline: val terug op de localStorage-back-up (PLAN §3.3).
      setOnline(false)
      const l = laadLijst(eventId)
      if (l) {
        lijstRef.current = l
        setHeeftLijst(true)
        setGesyncedOp(l.gesyncedOp)
        setNaam(l.naam)
      }
    }
  }, [eventId, flush])

  function toon(w: Weergave) {
    setOverlay(w)
    if (!audioRef.current) {
      const win = window as unknown as {
        AudioContext?: typeof AudioContext
        webkitAudioContext?: typeof AudioContext
      }
      const Ctor = win.AudioContext ?? win.webkitAudioContext
      if (Ctor) audioRef.current = new Ctor()
    }
    speelPiep(audioRef.current, w.groen)
    tril(w.groen)
    window.setTimeout(() => {
      setOverlay(null)
      pauzeRef.current = false
    }, 1500)
  }

  // Lokaal oordeel + (bij groen) markeren en in de queue zetten (PLAN §3.3).
  function verwerk(code: string) {
    pauzeRef.current = true
    const lijst = lijstRef.current
    if (!lijst) {
      toon({
        groen: false,
        titel: 'Geen lijst',
        subtitel: 'Wacht op de eerste sync met internet',
      })
      return
    }
    const uitkomst = bepaalLokaal(lijst.tickets[code], lijst.reEntry)
    toon(weergaveVoor(uitkomst))

    if (isGroen(uitkomst.resultaat)) {
      const nu = new Date().toISOString()
      const bijgewerkt = markeerGebruikt(eventId, code, nu)
      if (bijgewerkt) lijstRef.current = bijgewerkt
      voegToeAanQueue(eventId, {
        client_scan_uuid: nieuwUuid(),
        code,
        tijdstip_client: nu,
        resultaat: uitkomst.resultaat,
      })
      setQueueAantal(laadQueue(eventId).length)
      void flush()
    }
  }

  function handmatigVersturen(e: React.FormEvent) {
    e.preventDefault()
    const code = handmatig.trim()
    if (!code || pauzeRef.current || isVerouderd) return
    setHandmatig('')
    verwerk(code)
  }

  // Lijst + queue meteen uit localStorage (offline start), dan syncen en een
  // interval opzetten. Plus reageren op online/offline en de tijd-tekst tikken.
  useEffect(() => {
    const l = laadLijst(eventId)
    if (l) {
      lijstRef.current = l
      setHeeftLijst(true)
      setGesyncedOp(l.gesyncedOp)
      setNaam((prev) => prev || l.naam)
    }
    setQueueAantal(laadQueue(eventId).length)
    if (typeof navigator !== 'undefined') setOnline(navigator.onLine)

    void syncNu()
    const syncTimer = window.setInterval(() => void syncNu(), SYNC_INTERVAL_MS)
    const tikTimer = window.setInterval(() => setTik((n) => n + 1), 30_000)

    const bijOnline = () => {
      setOnline(true)
      void syncNu()
    }
    const bijOffline = () => setOnline(false)
    window.addEventListener('online', bijOnline)
    window.addEventListener('offline', bijOffline)

    return () => {
      window.clearInterval(syncTimer)
      window.clearInterval(tikTimer)
      window.removeEventListener('online', bijOnline)
      window.removeEventListener('offline', bijOffline)
    }
  }, [eventId, syncNu])

  // Cameralus (fase D, ongewijzigd behalve dat verwerk nu lokaal beslist).
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const staat: { gestopt: boolean; stream: MediaStream | null } = {
      gestopt: false,
      stream: null,
    }
    let timer: number | undefined

    const isGestopt = () => staat.gestopt
    const isPauze = () => pauzeRef.current

    async function lus(v: HTMLVideoElement, c: HTMLCanvasElement) {
      if (isGestopt()) return
      if (!isPauze()) {
        const code = await decodeFrame(v, c)
        if (isGestopt()) return
        if (!code) {
          laatsteCodeRef.current = null
        } else if (code !== laatsteCodeRef.current && !isPauze()) {
          laatsteCodeRef.current = code
          verwerk(code)
        }
      }
      if (!isGestopt()) timer = window.setTimeout(() => void lus(v, c), 200)
    }

    async function start(v: HTMLVideoElement, c: HTMLCanvasElement) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        staat.stream = stream
        if (isGestopt()) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        v.srcObject = stream
        await v.play()
        void lus(v, c)
      } catch (err) {
        if (!isGestopt()) setCameraFout(uitlegCamerafout(err))
      }
    }

    void start(video, canvas)
    return () => {
      staat.gestopt = true
      if (timer) window.clearTimeout(timer)
      if (staat.stream) staat.stream.getTracks().forEach((t) => t.stop())
    }
  }, [eventId])

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">
            {naam || 'Scanner'}
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                online ? 'bg-green-400' : 'bg-yellow-400'
              }`}
            />
            <span>{online ? 'Online' : 'Offline'}</span>
            <span>·</span>
            <span>Sync {leeftijdTekst(gesyncedOp)}</span>
            {queueAantal > 0 && (
              <>
                <span>·</span>
                <span>{queueAantal} te versturen</span>
              </>
            )}
          </div>
        </div>
        <Link
          to="/admin/events/$eventId"
          params={{ eventId }}
          className="rounded border border-white/30 px-3 py-1 text-sm"
        >
          Stoppen
        </Link>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Richtkader */}
        {!overlay && !cameraFout && !isVerouderd && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-2xl border-4 border-white/70" />
          </div>
        )}

        {/* Groen/rood-resultaat over het hele beeld */}
        {overlay && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2 text-center ${
              overlay.groen ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            <div className="text-6xl">{overlay.groen ? '✓' : '✕'}</div>
            <div className="text-3xl font-bold">{overlay.titel}</div>
            {overlay.subtitel && (
              <div className="px-6 text-sm text-white/90">
                {overlay.subtitel}
              </div>
            )}
          </div>
        )}

        {/* Verouderde of ontbrekende lijst: weiger te scannen (PLAN risico's) */}
        {!overlay && isVerouderd && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6">
            <div className="max-w-sm text-center">
              <div className="mb-2 text-4xl">⚠️</div>
              <p className="text-sm text-white/90">
                {heeftLijst
                  ? `De ticketlijst is ${leeftijdTekst(gesyncedOp)} gesynct. Verbind met internet en ververs voordat je scant.`
                  : 'Nog geen ticketlijst. Verbind eerst met internet om te synchroniseren.'}
              </p>
              <button
                onClick={() => void syncNu()}
                className="mt-4 rounded bg-white px-4 py-2 text-sm font-medium text-black"
              >
                Opnieuw synchroniseren
              </button>
            </div>
          </div>
        )}

        {cameraFout && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <p className="max-w-sm text-center text-sm text-white/90">
              {cameraFout}
            </p>
          </div>
        )}
      </div>

      {/* Handmatige invoer als fallback (oude Android / camera geweigerd) */}
      <form
        onSubmit={handmatigVersturen}
        className="flex gap-2 border-t border-white/15 p-3"
      >
        <input
          value={handmatig}
          onChange={(e) => setHandmatig(e.target.value)}
          placeholder="Code handmatig invoeren"
          disabled={isVerouderd}
          className="min-w-0 flex-1 rounded bg-white/10 px-3 py-2 text-sm placeholder:text-white/40 disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={isVerouderd}
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
        >
          Check
        </button>
      </form>
    </div>
  )
}
