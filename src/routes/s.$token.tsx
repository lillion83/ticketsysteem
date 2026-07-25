import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { resolveScannerToken } from '#/server/scannerSessions'
import { bewaarToken } from '#/lib/scannerStore'

// Koppelroute (fase F, PLAN §3.5). Deurpersoneel opent /s/{token} via de QR of
// link uit de admin. We wisselen het token in voor het event-id, bewaren het
// lokaal en sturen door naar het scannerscherm. Geen login nodig.
export const Route = createFileRoute('/s/$token')({
  component: Koppelen,
})

function Koppelen() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const [fout, setFout] = useState<string | null>(null)

  useEffect(() => {
    // Mutabel object i.p.v. losse `let`: de vlag wordt in de cleanup gezet, en zo
    // ziet de type-checker hem niet als constant (zelfde patroon als de scanlus).
    const staat = { afgebroken: false }
    ;(async () => {
      try {
        const { eventId } = await resolveScannerToken({ data: token })
        if (staat.afgebroken) return
        bewaarToken(eventId, token)
        navigate({ to: '/scan/$eventId', params: { eventId }, replace: true })
      } catch (err) {
        if (!staat.afgebroken) {
          setFout(err instanceof Error ? err.message : 'Koppelen mislukt')
        }
      }
    })()
    return () => {
      staat.afgebroken = true
    }
  }, [token, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="max-w-sm text-center">
        {fout ? (
          <>
            <div className="mb-2 text-4xl">⚠️</div>
            <p className="text-sm text-white/90">{fout}</p>
            <p className="mt-2 text-xs text-white/50">
              Vraag de organisator om een nieuwe koppel-link.
            </p>
          </>
        ) : (
          <p className="text-sm text-white/80">Scanner koppelen…</p>
        )}
      </div>
    </div>
  )
}
