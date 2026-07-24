import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { getEvent } from '#/server/events'
import { getCurrentUser } from '#/server/session'
import { recordScan } from '#/server/scan'
import type { ScanResultaat } from '#/server/scan'
import { decodeFrame } from '#/lib/qrscan'

// Scannerscherm (fase D). Aparte volscherm-route, mobiel-first: dit draait aan
// de deur op een telefoon. Camera leest de QR, het endpoint beslist groen/rood.
export const Route = createFileRoute('/scan/$eventId')({
  beforeLoad: async () => {
    // Zelfde guard als /admin: geen sessie → naar /login. Token-toegang zonder
    // account komt in fase F.
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
  },
  loader: ({ params }) => getEvent({ data: params.eventId }),
  component: Scanner,
})

// --- weergave per resultaat ---

type Weergave = { groen: boolean; titel: string; subtitel?: string }

function weergaveVoor(
  resultaat: ScanResultaat,
  gebruiktOp: string | null,
): Weergave {
  switch (resultaat) {
    case 'groen':
      return { groen: true, titel: 'Welkom' }
    case 'groen_re_entry':
      return { groen: true, titel: 'Welkom terug', subtitel: 'Re-entry' }
    case 'rood_al_gebruikt':
      return {
        groen: false,
        titel: 'Al gebruikt',
        subtitel: gebruiktOp
          ? `Gescand om ${new Date(gebruiktOp).toLocaleString('nl-NL')}`
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

function Scanner() {
  const event = Route.useLoaderData()
  const { eventId } = Route.useParams()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const pauzeRef = useRef(false)
  const laatsteCodeRef = useRef<string | null>(null)

  const [overlay, setOverlay] = useState<Weergave | null>(null)
  const [cameraFout, setCameraFout] = useState<string | null>(null)
  const [handmatig, setHandmatig] = useState('')

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

  async function verwerk(code: string) {
    pauzeRef.current = true
    try {
      const res = await recordScan({ data: { eventId, code } })
      toon(weergaveVoor(res.resultaat, res.gebruikt_op))
    } catch {
      toon({
        groen: false,
        titel: 'Netwerkfout',
        subtitel: 'Niet verstuurd — probeer opnieuw',
      })
    }
  }

  async function handmatigVersturen(e: React.FormEvent) {
    e.preventDefault()
    const code = handmatig.trim()
    if (!code || pauzeRef.current) return
    setHandmatig('')
    await verwerk(code)
  }

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    // Mutabel status-object i.p.v. losse `let`: de vlag wordt in de cleanup
    // gezet, en zo ziet de type-checker hem niet als constant.
    const staat: { gestopt: boolean; stream: MediaStream | null } = {
      gestopt: false,
      stream: null,
    }
    let timer: number | undefined

    // De vlaggen worden gemuteerd (cleanup, resultaat-timeout) terwijl de lus in
    // een await hangt. Via accessors gelezen, zodat de type-checker ze niet als
    // constant beschouwt en er echte runtime-checks van maakt.
    const isGestopt = () => staat.gestopt
    const isPauze = () => pauzeRef.current

    // video/canvas als parameters: zo behouden ze hun non-null-type in deze
    // geneste async-closures (narrowing lekt daar anders weg).
    async function lus(v: HTMLVideoElement, c: HTMLCanvasElement) {
      if (isGestopt()) return
      // Niet scannen terwijl er een resultaat op het scherm staat.
      if (!isPauze()) {
        const code = await decodeFrame(v, c)
        if (isGestopt()) return
        if (!code) {
          // Frame leeg: sta toe dat dezelfde QR straks opnieuw telt (weghalen
          // en terugbrengen = bewuste herscan → checkpoint "nogmaals → rood").
          laatsteCodeRef.current = null
        } else if (code !== laatsteCodeRef.current && !isPauze()) {
          laatsteCodeRef.current = code
          await verwerk(code)
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
          <div className="truncate text-sm font-semibold">{event.naam}</div>
          <div className="text-xs text-white/60">Scannen</div>
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
        {!overlay && !cameraFout && (
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
          className="min-w-0 flex-1 rounded bg-white/10 px-3 py-2 text-sm placeholder:text-white/40"
        />
        <button
          type="submit"
          className="rounded bg-white px-4 py-2 text-sm font-medium text-black"
        >
          Check
        </button>
      </form>
    </div>
  )
}
