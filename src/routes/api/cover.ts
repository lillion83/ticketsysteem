import { createFileRoute } from '@tanstack/react-router'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'
import { bewaarAfbeelding } from '#/lib/uploads'

// Upload-endpoint voor cover-afbeeldingen. Een gewone route (geen server
// function) omdat we een multipart-body met een bestand ontvangen.
// Antwoord: { url } — dat pad gaat als cover_afbeelding_url mee in het
// event-formulier. Het bestand zelf is niet org-gescoopt: het staat pas in de
// database zodra het event wordt opgeslagen, en dáár geldt de org-scope.
export const Route = createFileRoute('/api/cover')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Login vereist, anders kan iedereen de schijf volschrijven.
        const session = await auth.api.getSession({
          headers: getRequest().headers,
        })
        if (!session?.user) {
          return Response.json({ error: 'Niet ingelogd' }, { status: 401 })
        }

        try {
          const form = await request.formData()
          const file = form.get('bestand')
          if (!(file instanceof File)) {
            return Response.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
          }
          // Antwoord: { url, breedte, hoogte } — de afmetingen bepalen straks of
          // de banner de afbeelding bijsnijdt of hem heel laat zien.
          return Response.json(await bewaarAfbeelding(file))
        } catch (err) {
          const bericht = err instanceof Error ? err.message : 'Upload mislukt'
          return Response.json({ error: bericht }, { status: 400 })
        }
      },
    },
  },
})
