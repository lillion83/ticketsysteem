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

/**
 * Schrijft een geüploade afbeelding weg en geeft het publieke pad terug
 * (`/uploads/{naam}`), klaar om als cover_afbeelding_url op te slaan.
 * Gooit met een Nederlandse melding als type of grootte niet deugt.
 */
export async function bewaarAfbeelding(file: File): Promise<string> {
  const ext = TOEGESTAAN[file.type]
  if (!ext) throw new Error('Alleen PNG-, JPG- of WEBP-afbeeldingen')
  if (file.size === 0) throw new Error('Leeg bestand')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('Afbeelding is groter dan 5 MB')

  const dir = uploadDir()
  await mkdir(dir, { recursive: true })
  const naam = `${randomUUID()}${ext}`
  await writeFile(
    path.join(dir, naam),
    new Uint8Array(await file.arrayBuffer()),
  )
  return `/uploads/${naam}`
}

// Content-type om mee terug te serveren, op basis van de extensie die wij zelf
// hebben gezet. Onbekend = niet serveren.
export function contentTypeVoor(bestand: string): string | null {
  const ext = path.extname(bestand).toLowerCase()
  const match = Object.entries(TOEGESTAAN).find(([, e]) => e === ext)
  return match ? match[0] : null
}
