import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { signIn } from '#/lib/auth-client'
import { getCurrentUser } from '#/server/session'
import { homePathForRole } from '#/lib/rol'

export const Route = createFileRoute('/login')({
  // Optioneel pad om na inloggen naar terug te keren (bv. de organiseer-flow).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginPage,
})

/**
 * Vertaalt de foutcode van Better Auth. Een verkeerd wachtwoord en een
 * configuratiefout gaven eerder dezelfde tekst, waardoor een poortmismatch
 * (BETTER_AUTH_URL ≠ de poort waarop de app draait) eruitzag als een
 * wachtwoordprobleem. Alleen de inloggegevens blijven bewust vaag.
 */
function foutTekst(code: string | undefined): string {
  switch (code) {
    case 'INVALID_ORIGIN':
      return 'Configuratiefout: BETTER_AUTH_URL in .env komt niet overeen met het adres waarop de app draait. Zet daar dezelfde poort neer en herstart de server.'
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Inloggen mislukt. Controleer e-mail en wachtwoord.'
    default:
      return `Inloggen mislukt${code ? ` (${code})` : ''}. Controleer e-mail en wachtwoord, of kijk in de serverlog.`
  }
}

function LoginPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const { redirect } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const { error } = await signIn.email({ email, password: wachtwoord })
    setBezig(false)
    if (error) {
      setFout(foutTekst(error.code))
      return
    }
    // De router heeft /admin al beoordeeld toen we nog uitgelogd waren en houdt
    // dat oordeel vast. Zonder invalidate draait beforeLoad niet opnieuw en
    // stuurt /admin je terug naar /login, hoe geldig de nieuwe sessie ook is.
    await router.invalidate()
    // Kwam je via een beschermde pagina? Keer daarheen terug. Anders naar het
    // dashboard dat bij je rol hoort (admin → /platform, organisator → /admin).
    if (redirect) {
      navigate({ to: redirect })
      return
    }
    const user = await getCurrentUser()
    navigate({ to: homePathForRole(user?.rol) })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-bold">Inloggen</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Wachtwoord</span>
          <input
            type="password"
            required
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {fout && <p className="text-sm text-red-600">{fout}</p>}
        <button
          type="submit"
          disabled={bezig}
          className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {bezig ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}
