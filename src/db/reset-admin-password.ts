import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { closeDb, db, schema } from './index'
import { GuardFout, weigerOpProductie } from './guard'

// Zet het wachtwoord van het admin-account op de waarde van ADMIN_PASSWORD.
// Draaien met: npm run db:reset-admin-password
//
// Nodig omdat `db:seed-admin` een bestaand account bewust overslaat: het
// wachtwoord staat gehasht in de database en verandert niet mee als je
// ADMIN_PASSWORD in .env aanpast. De gebruikersrij blijft staan — verwijderen
// kan niet zodra tickets.verkocht_door_user_id ernaar verwijst.
//
// Losse Better Auth-instance, net als in seed-admin: de echte `auth` hangt aan
// de request-gebonden cookie-plugin en werkt buiten een request niet.
const resetAuth = betterAuth({
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
  advanced: { database: { generateId: () => randomUUID() } },
  emailAndPassword: { enabled: true },
})

async function resetAdminPassword() {
  await weigerOpProductie('db:reset-admin-password')

  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL of ADMIN_PASSWORD ontbreekt in .env')
  }

  const gevonden = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)
  if (gevonden.length === 0) {
    throw new Error(
      `Geen account gevonden voor ${email} — draai eerst \`npm run db:seed-admin\`.`,
    )
  }
  const gebruiker = gevonden[0]

  const ctx = await resetAuth.$context
  const hash = await ctx.password.hash(password)
  await ctx.internalAdapter.updatePassword(gebruiker.id, hash)

  // Oude sessies ongeldig maken: een wachtwoordreset hoort overal uit te loggen.
  await db.delete(schema.session).where(eq(schema.session.userId, gebruiker.id))

  console.log(`Wachtwoord bijgewerkt voor ${email}.`)
  console.log('Log opnieuw in met het wachtwoord uit ADMIN_PASSWORD (.env).')
}

resetAdminPassword()
  .then(async () => {
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    if (err instanceof GuardFout) console.error(err.message)
    else console.error('Wachtwoordreset mislukt:', err)
    await closeDb()
    process.exit(1)
  })
