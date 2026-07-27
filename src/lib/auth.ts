import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { db, schema } from '#/db/index'
import { verstuurMail } from '#/lib/mail'

// Google alleen inschakelen als de credentials er zijn, zodat de app ook zonder
// die env-vars start (dan werkt de e-mailcode-login als fallback).
const googleId = process.env.GOOGLE_CLIENT_ID
const googleSecret = process.env.GOOGLE_CLIENT_SECRET
const socialProviders =
  googleId && googleSecret ? { google: { clientId: googleId, clientSecret: googleSecret } } : undefined

// Core-auth (user/session). Organisatoren loggen in met wachtwoord (seed-admin);
// kopers loggen in met Google of een e-mailcode (fase K) en krijgen géén
// organizationId. Account-linking op geverifieerd e-mail zorgt dat Google en de
// e-mailcode met hetzelfde adres tot één koper-account leiden.
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
  socialProviders,
  account: {
    // Koppel een Google-login aan een bestaand account met hetzelfde
    // (geverifieerde) e-mail, zodat kopers niet per inlogmethode een los account
    // krijgen.
    accountLinking: {
      enabled: true,
      trustedProviders: ['google'],
    },
  },
  user: {
    additionalFields: {
      // Tenant van de gebruiker; komt mee in de sessie zodat server-functies
      // erop kunnen scopen (harde regel 3). Kopers hebben er geen.
      organizationId: {
        type: 'string',
        required: false,
        input: false,
      },
      // Rol van de gebruiker (fase J). Komt mee in de sessie zodat guards en
      // rol-landing serverside kunnen beslissen. Nooit door de client te zetten.
      rol: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    // E-mailcode-login voor kopers. In dev (zonder MAIL_API_KEY) verstuurt
    // verstuurMail niets; daarom loggen we de code ook, zodat je lokaal kunt testen.
    emailOTP({
      async sendVerificationOTP({ email, otp }) {
        console.log(`[otp] inlogcode voor ${email}: ${otp}`)
        await verstuurMail({
          naar: email,
          onderwerp: 'Je inlogcode',
          html: `<p>Je inlogcode is <strong style="font-size:20px;letter-spacing:2px">${otp}</strong>. Geldig voor enkele minuten.</p>`,
        })
      },
    }),
    // Moet de laatste plugin zijn (zet cookies via TanStack Start server-API).
    tanstackStartCookies(),
  ],
})
