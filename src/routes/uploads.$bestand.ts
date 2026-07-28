import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { contentTypeVoor, uploadDir } from '#/lib/uploads'

// Serveert de geüploade afbeeldingen uit UPLOAD_DIR. Die map ligt buiten de
// build-output, dus een deploy (git pull + build) raakt de bestanden niet.
// Publiek: cover-afbeeldingen staan op de publieke event-pagina's.
export const Route = createFileRoute('/uploads/$bestand')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { bestand: string } }) => {
        const naam = params.bestand
        // Alleen kale bestandsnamen: geen mappen, geen `..` (path traversal).
        if (naam !== path.basename(naam) || naam.startsWith('.')) {
          return new Response('Niet gevonden', { status: 404 })
        }
        const type = contentTypeVoor(naam)
        if (!type) return new Response('Niet gevonden', { status: 404 })

        try {
          const bytes = await readFile(path.join(uploadDir(), naam))
          return new Response(new Uint8Array(bytes), {
            headers: {
              'content-type': type,
              // De naam is willekeurig en de inhoud verandert nooit, dus lang cachen.
              'cache-control': 'public, max-age=31536000, immutable',
              'x-content-type-options': 'nosniff',
            },
          })
        } catch {
          return new Response('Niet gevonden', { status: 404 })
        }
      },
    },
  },
})
