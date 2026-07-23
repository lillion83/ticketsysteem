import { createAuthClient } from 'better-auth/react'

// Client voor de loginpagina. baseURL leeg → zelfde origin als de app.
export const authClient = createAuthClient()

export const { signIn, signOut, useSession } = authClient
