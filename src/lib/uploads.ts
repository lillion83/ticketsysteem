import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

// Opslag van geüploade afbeeldingen (cover-afbeeldingen van events).
// Bestanden staan op de schijf van de VPS, buiten de repo, en worden
// uitgeserveerd door `src/routes/uploads.$bestand.ts` op /uploads/{bestand}.
// Bewust niet in Postgres: de database blijft zo klein en snel te dumpen.
// Let op bij backups: deze map zit NIET in de database-dump, neem hem apart mee.

// Standaard `./uploads` naast de repo-root (pm2 draait daar), te overriden met
// UPLOAD_DIR. Absoluut gemaakt zodat het niet uitmaakt vanuit welke map je start.
export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? './uploads')
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

// Alleen afbeeldingtypes die een browser veilig weergeeft. De extensie leiden we
// af uit het type — nooit uit de naam die de client meestuurt, want die kan van
// alles zijn (`.html`, `../../x`).
const TOEGESTAAN: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
}

export const TOEGESTANE_TYPES = Object.keys(TOEGESTAAN)

export type BewaardeAfbeelding = {
  url: string
  // null als het formaat niet uit de header te lezen was: de UI valt dan terug
  // op het oude gedrag (bijsnijden).
  breedte: number | null
  hoogte: number | null
}

/**
 * Schrijft een geüploade afbeelding weg en geeft het publieke pad terug
 * (`/uploads/{naam}`) plus de afmetingen, klaar om bij het event op te slaan.
 * Gooit met een Nederlandse melding als type of grootte niet deugt.
 */
export async function bewaarAfbeelding(file: File): Promise<BewaardeAfbeelding> {
  const ext = TOEGESTAAN[file.type]
  if (!ext) throw new Error('Alleen PNG-, JPG- of WEBP-afbeeldingen')
  if (file.size === 0) throw new Error('Leeg bestand')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Afbeelding is groter dan 5 MB')

  const bytes = new Uint8Array(await file.arrayBuffer())
  const afmeting = leesAfmetingen(bytes)

  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  const naam = `${randomUUID()}${ext}`
  await writeFile(path.join(dir, naam), bytes)
  return {
    url: `/uploads/${naam}`,
    breedte: afmeting?.breedte ?? null,
    hoogte: afmeting?.hoogte ?? null,
  }
}

/**
 * Leest breedte en hoogte uit de header van een PNG, JPEG of WEBP. Met de hand
 * geparsed omdat er voor deze drie formaten geen bibliotheek nodig is: we lezen
 * alleen de eerste bytes, niet de pixels. null als het formaat onbekend of het
 * bestand beschadigd is — de aanroeper valt dan terug op het oude gedrag.
 */
export function leesAfmetingen(
  b: Uint8Array,
): { breedte: number; hoogte: number } | null {
  const u16 = (i: number) => (b[i] << 8) | b[i + 1]
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0

  // PNG: vaste signature, daarna de IHDR-chunk met breedte/hoogte op 16..23.
  if (b.length > 24 && u32(0) === 0x89504e47 && u32(4) === 0x0d0a1a0a) {
    return { breedte: u32(16), hoogte: u32(20) }
  }

  // JPEG: segmenten aflopen tot een SOF-marker (start of frame), die de
  // afmetingen draagt. SOF4/8/12 zijn geen frame-headers en slaan we over.
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const marker = b[i + 1]
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        i += 2
        continue
      }
      // Begin van de beeldgegevens: verder zoeken heeft geen zin meer.
      if (marker === 0xda || marker === 0xd9) break
      const lengte = u16(i + 2)
      if (lengte < 2) break
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      if (isSof) return { hoogte: u16(i + 5), breedte: u16(i + 7) }
      i += 2 + lengte
    }
    return null
  }

  // WEBP: RIFF-container met drie mogelijke varianten (lossy, lossless, extended).
  if (b.length >= 30 && u32(0) === 0x52494646 && u32(8) === 0x57454250) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (chunk === 'VP8 ') {
      // 14-bits breedte/hoogte achter de 3-byte start-code.
      return {
        breedte: ((b[27] << 8) | b[26]) & 0x3fff,
        hoogte: ((b[29] << 8) | b[28]) & 0x3fff,
      }
    }
    if (chunk === 'VP8L') {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)
      return { breedte: (bits & 0x3fff) + 1, hoogte: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (chunk === 'VP8X') {
      return {
        breedte: (b[24] | (b[25] << 8) | (b[26] << 16)) + 1,
        hoogte: (b[27] | (b[28] << 8) | (b[29] << 16)) + 1,
      }
    }
  }

  return null
}

// Content-type om mee terug te serveren, op basis van de extensie die wij zelf
// hebben gezet. Onbekend = niet serveren.
export function contentTypeVoor(bestand: string): string | null {
  const ext = path.extname(bestand).toLowerCase()
  const match = Object.entries(TOEGESTAAN).find(([, e]) => e === ext)
  return match ? match[0] : null
}
