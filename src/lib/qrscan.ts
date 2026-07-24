import jsQR from 'jsqr'

// QR-decodering uit één camframe. Gebruikt de ingebouwde BarcodeDetector waar
// die bestaat (snel, 0 kB extra op moderne Android/Chrome) en valt anders terug
// op jsQR (pure JS, werkt op oude Android en iOS Safari — PLAN §6). Puur browser.

// BarcodeDetector staat niet in de TS-libs; minimale ambient typering.
type DetectedBarcode = { rawValue: string }
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<DetectedBarcode>>
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: Array<string>
}) => BarcodeDetectorLike

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null
  return (
    (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector ?? null
  )
}

// Eén keer bepalen welk pad we nemen; null = jsQR-fallback.
let detector: BarcodeDetectorLike | null | undefined

function ensureDetector(): BarcodeDetectorLike | null {
  if (detector === undefined) {
    const Ctor = getDetectorCtor()
    detector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null
  }
  return detector
}

/**
 * Probeert één QR-code uit het huidige videoframe te lezen. Geeft de ruwe
 * string terug, of null als er (nog) geen leesbare QR in beeld is. `canvas`
 * wordt hergebruikt als teken-buffer voor de jsQR-fallback.
 */
export async function decodeFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) return null

  const det = ensureDetector()
  if (det) {
    try {
      const codes = await det.detect(video)
      return codes[0]?.rawValue ?? null
    } catch {
      // Detector kan incidenteel gooien (frame nog niet klaar); volgende tick.
      return null
    }
  }

  // Fallback: frame naar canvas, pixels naar jsQR.
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const beeld = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const gevonden = jsQR(beeld.data, beeld.width, beeld.height, {
    inversionAttempts: 'dontInvert',
  })
  return gevonden?.data ?? null
}
