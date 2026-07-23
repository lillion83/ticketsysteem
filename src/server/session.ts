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
 * redirecten naar /login.
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session?.user) return null
    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }
  },
)
