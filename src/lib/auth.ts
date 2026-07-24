import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db, schema } from '#/db/index'

// Core-auth (user/session), zonder organization-plugin — die komt pas in fase 2.
// Eén gebruiker in fase 1: Amresh (aangemaakt via `npm run db:seed-admin`).
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Ids als uuid zodat ze aansluiten op het uuid-schema (o.a. de FK
  // tickets.verkocht_door_user_id → user.id).
  advanced: {
    // Eigen cookienaam (`ticketsysteem.session_token`). Cookies worden niet
    // gescheiden per poort, alleen per host: op localhost deelt deze app z'n
    // cookies met elk ander project dat daar draait. Met de standaardnaam
    // `better-auth.session_token` overschrijven twee Better Auth-apps elkaars
    // sessie, wat zich uit als "inloggen lukt, maar /admin stuurt je terug".
    cookiePrefix: 'ticketsysteem',
    database: {
      generateId: () => randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    // Geen open registratie richting het event; accounts alleen via het
    // seed-script. Zet dit tijdelijk op false om het admin-account aan te maken.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // Tenant van de gebruiker; komt mee in de sessie zodat server-functies
      // erop kunnen scopen (harde regel 3).
      organizationId: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  // Moet de laatste plugin zijn (zet cookies via TanStack Start server-API).
  plugins: [tanstackStartCookies()],
})
