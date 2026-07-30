import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { closeDb, db, schema } from './index'
import { GuardFout, weigerOpProductie } from './guard'
import type { Rol } from '../lib/rol'

// De drie testgebruikers: één per rol, zodat je in de testomgeving elke rol kunt
// bekijken zonder je af te vragen wie je nu bent.
// Draaien met: npm run db:seed-testgebruikers:test
//
// Dit script vervangt voor de TESTOMGEVING het duo db:seed-admin +
// db:seed-platform-admin. Die twee zijn gebouwd rond één account per script en
// zoeken op e-mailadres; daardoor kunnen ze een adres niet wijzigen, alleen een
// tweede account naast het bestaande zetten.
//
// Dit script zoekt daarom op ROL, niet op e-mail. In de testomgeving hoort er per
// rol precies één account te zijn, dus dat is hier de identiteit van een rij — en
// alleen zo kun je een adres corrigeren zonder het account (en zijn koppelingen
// vanuit tickets.verkocht_door_user_id) weg te gooien.
//
// De adressen staan hier hardgecodeerd en niet in .env: het zijn fixtures, net als
// de organisatie en het event in seed.ts. Alleen het wachtwoord komt uit de
// omgeving, want dat is het enige wat je zou willen variëren.
const WACHTWOORD = process.env.TEST_WACHTWOORD ?? 'dev-wachtwoord'

type Testgebruiker = {
  email: string
  naam: string
  rol: Rol
  /**
   * Hangt deze rol aan een organisatie? De organisator beheert er één; de admin
   * leest juist cross-org en mag er géén hebben (de enige uitzondering op harde
   * regel 3), en een koper heeft er van nature geen.
   */
  metOrganisatie: boolean
}

// Adressen in kleine letters. Inloggen is hoofdletterongevoelig — Better Auth
// normaliseert het ingevoerde adres, 'Amresh@kalenda.sr' en 'amresh@kalenda.sr'
// werken allebei — maar de kolom bewaart wat hier staat, en dat adres komt in
// beheerschermen en mails terecht. Eén schrijfwijze scheelt verwarring.
const TESTGEBRUIKERS: Array<Testgebruiker> = [
  {
    email: 'amresh@kalenda.sr',
    naam: 'Amresh (admin)',
    rol: 'admin',
    metOrganisatie: false,
  },
  {
    email: 'testorganisator@email.com',
    naam: 'Test Organisator',
    rol: 'organisator',
    metOrganisatie: true,
  },
  {
    email: 'testkoper@email.com',
    naam: 'Test Koper',
    rol: 'koper',
    metOrganisatie: false,
  },
]

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

async function seedTestgebruikers() {
  await weigerOpProductie('db:seed-testgebruikers')

  // De organisator moet ergens aan hangen. Alleen ophalen als iemand hem nodig
  // heeft, zodat een omgeving zonder events toch een admin en koper kan krijgen.
  let organisatieId: string | null = null
  if (TESTGEBRUIKERS.some((g) => g.metOrganisatie)) {
    const orgs = await db.select().from(schema.organizations).limit(1)
    if (orgs.length === 0) {
      throw new Error(
        'Geen organisatie gevonden — draai eerst `npm run db:seed:test`.',
      )
    }
    organisatieId = orgs[0].id
  }

  const ctx = await seedAuth.$context

  for (const gebruiker of TESTGEBRUIKERS) {
    const organizationId = gebruiker.metOrganisatie ? organisatieId : null

    const bestaandeRol = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.rol, gebruiker.rol))

    // Meer dan één account in dezelfde rol: dan is "de organisator" niet meer één
    // rij en zou dit script willekeurig één ervan hernoemen. Liever stoppen en het
    // laten opruimen dan gokken.
    if (bestaandeRol.length > 1) {
      throw new Error(
        `Meerdere accounts met rol '${gebruiker.rol}': ` +
          bestaandeRol.map((r) => r.email).join(', ') +
          '\nRuim ze eerst op tot er één over is; dit script hernoemt er niet zomaar een.',
      )
    }

    let userId: string
    let actie: string

    if (bestaandeRol.length === 1) {
      const bestaand = bestaandeRol[0]
      userId = bestaand.id
      actie =
        bestaand.email === gebruiker.email
          ? 'bijgewerkt'
          : `hernoemd (was ${bestaand.email})`

      await db
        .update(schema.user)
        .set({ email: gebruiker.email, name: gebruiker.naam, organizationId })
        .where(eq(schema.user.id, userId))
    } else {
      // Geen account in deze rol. Bestaat het adres al onder een ándere rol, dan
      // is dat een bestaand account dat we omzetten in plaats van dupliceren —
      // e-mail is uniek, een insert zou toch stuklopen.
      const opEmail = await db
        .select()
        .from(schema.user)
        .where(eq(schema.user.email, gebruiker.email))
        .limit(1)

      if (opEmail.length === 1) {
        userId = opEmail[0].id
        actie = `rol gewijzigd (was ${opEmail[0].rol})`
        await db
          .update(schema.user)
          .set({ name: gebruiker.naam, rol: gebruiker.rol, organizationId })
          .where(eq(schema.user.id, userId))
      } else {
        const result = await seedAuth.api.signUpEmail({
          body: {
            email: gebruiker.email,
            password: WACHTWOORD,
            name: gebruiker.naam,
          },
        })
        userId = result.user.id
        actie = 'aangemaakt'
        await db
          .update(schema.user)
          .set({ rol: gebruiker.rol, organizationId })
          .where(eq(schema.user.id, userId))
      }
    }

    // Wachtwoord altijd terugzetten op WACHTWOORD. Dat is het punt van een
    // testomgeving: alle drie de accounts zijn voorspelbaar, ook als er ooit in
    // de UI een ander wachtwoord op is gezet.
    const hash = await ctx.password.hash(WACHTWOORD)
    await ctx.internalAdapter.updatePassword(userId, hash)

    // Een wachtwoordwijziging hoort overal uit te loggen.
    await db.delete(schema.session).where(eq(schema.session.userId, userId))

    console.log(
      `  ${gebruiker.rol.padEnd(11)} ${gebruiker.email.padEnd(26)} ${actie}`,
    )
  }

  console.log('')
  console.log(`Drie testgebruikers klaar, wachtwoord: ${WACHTWOORD}`)
  console.log('Inloggen op /login; elke rol landt op zijn eigen dashboard.')
}

seedTestgebruikers()
  .then(async () => {
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    if (err instanceof GuardFout) console.error(err.message)
    else console.error('Seed testgebruikers mislukt:', err)
    await closeDb()
    process.exit(1)
  })
