import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { closeDb, db, schema } from './index'
import { GuardFout, weigerOpProductie } from './guard'

// Maakt het platform-adminaccount aan: de rol 'admin', die na inloggen op
// /platform uitkomt en cross-org leest.
// Draaien met: npm run db:seed-platform-admin  (test: db:seed-platform-admin:test)
//
// Verschil met `seed-admin.ts`: dat script maakt een ORGANISATOR, die aan één
// organisatie hangt en /admin beheert. Deze hangt juist aan GEEN organisatie —
// `organization_id` blijft expliciet null. Dat is niet slordigheid maar het punt
// van de rol: harde regel 3 (elke query filtert op organization_id) kent precies
// één uitzondering, en dat is dit platform-brede overzicht. Zou dit account wél
// een org dragen, dan is het een organisator met een andere naam.
//
// Draait daarom ook niet vast als er nog geen organisatie geseed is.
//
// Losse Better Auth-instance met signup aan, om dezelfde reden als in
// seed-admin.ts: de echte `auth` heeft open registratie uit en hangt aan de
// request-gebonden cookie-plugin, die buiten een request niet werkt.
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

async function seedPlatformAdmin() {
  await weigerOpProductie('db:seed-platform-admin')

  const email = process.env.PLATFORM_ADMIN_EMAIL ?? 'platform@example.com'
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? 'verander-mij-nu'
  const name = process.env.PLATFORM_ADMIN_NAME ?? 'Platformbeheer'

  const rol = 'admin' as const

  const bestaand = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1)

  // Bestaat het account al, dan alleen de rol zetten en de org losmaken. Zo
  // herstelt een tweede run een account dat op de verkeerde rol staat of dat
  // ooit aan een organisatie is gekoppeld, zonder het wachtwoord of de lopende
  // sessies aan te tasten.
  if (bestaand.length > 0) {
    await db
      .update(schema.user)
      .set({ organizationId: null, rol })
      .where(eq(schema.user.id, bestaand[0].id))

    console.log(`Platform-admin bestond al: ${email}`)
    console.log(`  rol:          ${rol} (bijgewerkt)`)
    console.log('  organisatie:  (geen — platform-breed)')
    console.log('Log hiermee in op /login; je komt uit op /platform.')
    return
  }

  const result = await seedAuth.api.signUpEmail({
    body: { email, password, name },
  })

  await db
    .update(schema.user)
    .set({ organizationId: null, rol })
    .where(eq(schema.user.id, result.user.id))

  console.log('Platform-adminaccount klaar:')
  console.log(`  e-mail:       ${email}`)
  console.log(`  wachtwoord:   ${password}`)
  console.log(`  rol:          ${rol}`)
  console.log('  organisatie:  (geen — platform-breed)')
  console.log('Log hiermee in op /login en wijzig het wachtwoord daarna.')
}

seedPlatformAdmin()
  .then(async () => {
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    if (err instanceof GuardFout) console.error(err.message)
    else console.error('Platform-admin-seed mislukt:', err)
    await closeDb()
    process.exit(1)
  })
