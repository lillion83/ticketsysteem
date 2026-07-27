import { createServerFn, createServerOnlyFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

export type AuthContext = {
  userId: string
  organizationId: string
}

/**
 * Haalt de ingelogde gebruiker + tenant op vanuit de request-headers.
 * Gooit als er geen geldige sessie is, of als de gebruiker geen organisatie
 * heeft (dan kan er niets veilig gescoopt worden — harde regel 3).
 * Gebruik dit als eerste regel in elke server-functie die data raakt.
 * Server-only: mag nooit in de client-bundle belanden (leest request-headers).
 */
export const requireAuth = createServerOnlyFn(
  async (): Promise<AuthContext> => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })

    if (!session?.user) {
      throw new Error('Niet ingelogd')
    }

    const organizationId = (session.user as { organizationId?: string })
      .organizationId
    if (!organizationId) {
      throw new Error('Gebruiker heeft geen organisatie')
    }

    return { userId: session.user.id, organizationId }
  },
)

/**
 * Lichte sessie-check voor route-guards (beforeLoad) en de layout. Geeft de
 * ingelogde gebruiker terug of null — gooit niet, zodat de guard zelf kan
 * redirecten naar /login. `organizationId` is null voor kopers (fase K).
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session?.user) return null
    const u = session.user as {
      organizationId?: string
      rol?: string
    }
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      organizationId: u.organizationId ?? null,
      rol: u.rol ?? 'koper',
    }
  },
)

/**
 * Of Google-login geconfigureerd is (server-env). De client kan dit niet zelf
 * zien, dus lezen we het serverside uit om de Google-knop te tonen of te verbergen.
 */
export const googleBeschikbaar = createServerFn({ method: 'GET' }).handler(async () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
)

/**
 * Admin-sessie (fase J). Eist rol 'admin' en geeft alléén de userId terug —
 * bewust GEEN organizationId, want de admin leest platform-breed (cross-org).
 *
 * Dit is de ENIGE plek waar cross-org gelezen mag worden: de gedocumenteerde
 * uitzondering op harde regel 3, in overleg met Amresh vastgelegd (fase J).
 * Gebruik dit uitsluitend in read-only platform-endpoints (src/server/platform.ts);
 * alle overige data-endpoints blijven org-gescoopt via requireAuth.
 * Server-only: leest request-headers.
 */
export const requireAdmin = createServerOnlyFn(
  async (): Promise<{ userId: string }> => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session?.user) throw new Error('Niet ingelogd')
    const rol = (session.user as { rol?: string }).rol
    if (rol !== 'admin') throw new Error('Geen admin-rechten')
    return { userId: session.user.id }
  },
)

/**
 * Sessie zonder org-eis, voor het kopersgedeelte (Mijn Tickets). Gooit als er
 * geen sessie is. Server-only: leest request-headers.
 */
export const requireUser = createServerOnlyFn(
  async (): Promise<{ userId: string; email: string }> => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session?.user) throw new Error('Niet ingelogd')
    return { userId: session.user.id, email: session.user.email }
  },
)
