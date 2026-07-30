import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { closeDb, db, schema } from './index'
import { GuardFout, weigerOpProductie } from './guard'

// Maakt het admin-account (Amresh) aan en koppelt het aan de geseede organisatie.
// Draaien met: npm run db:seed-admin  (na db:migrate en db:seed)
//
// Gebruikt een losse Better Auth-instance met signup aan, puur voor deze seed:
// de echte `auth` heeft signup uit (geen open registratie richting het event) en
// hangt aan de request-gebonden cookie-plugin, die buiten een request niet werkt.
const seedAuth = betterAuth({
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

async function seedAdmin() {
  await weigerOpProductie('db:seed-admin')

  const email = process.env.ADMIN_EMAIL ?? 'amresh@example.com'
  const password = process.env.ADMIN_PASSWORD ?? 'verander-mij-nu'
  const name = process.env.ADMIN_NAME ?? 'Amresh'

  // Koppel aan de (enige) organisatie uit de seed.
  const orgs = await db.select().from(schema.organizations).limit(1)
  if (orgs.length === 0) {
    throw new Error('Geen organisatie gevonden — draai eerst `npm run db:seed`.')
  }
  const organisatie = orgs[0]

  const bestaand = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  // Rol 'organisator' hoort bij dit account: het beheert één organisatie via
  // /admin. De rol wordt expliciet gezet omdat de kolom op 'koper' default —
  // zonder dit belandt het account na inloggen op /mijn-ticket in plaats van in
  // de beheeromgeving. (Een platform-admin is iets anders: die heeft juist géén
  // organisatie en leest cross-org.)
  const rol = 'organisator' as const

  // Bestaat het account al, dan alleen de koppeling en de rol bijwerken. Zo
  // herstelt een tweede run een account dat op de verkeerde rol staat, zonder
  // het wachtwoord of de sessies aan te tasten.
  if (bestaand.length > 0) {
    await db
      .update(schema.user)
      .set({ organizationId: organisatie.id, rol })
      .where(eq(schema.user.id, bestaand[0].id))

    console.log(`Admin bestond al: ${email}`)
    console.log(`  rol:          ${rol} (bijgewerkt)`)
    console.log(`  organisatie:  ${organisatie.naam} (${organisatie.id})`)
    return
  }

  const result = await seedAuth.api.signUpEmail({
    body: { email, password, name },
  })

  await db
    .update(schema.user)
    .set({ organizationId: organisatie.id, rol })
    .where(eq(schema.user.id, result.user.id))

  console.log('Admin-account klaar:')
  console.log(`  e-mail:       ${email}`)
  console.log(`  wachtwoord:   ${password}`)
  console.log(`  rol:          ${rol}`)
  console.log(`  organisatie:  ${organisatie.naam} (${organisatie.id})`)
  console.log('Log hiermee in op /login en wijzig het wachtwoord daarna.')
}

seedAdmin()
  .then(async () => {
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    if (err instanceof GuardFout) console.error(err.message)
    else console.error('Admin-seed mislukt:', err)
    await closeDb()
    process.exit(1)
  })
