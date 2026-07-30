import { eq } from 'drizzle-orm'
import { closeDb, db, schema } from './index'
import { GuardFout, weigerOpProductie } from './guard'

// Wijzigt het e-mailadres van één account, zonder het account zelf aan te raken.
//
//   npm run db:wijzig-email:test -- --van oud@example.com --naar nieuw@echt.nl
//
// Waarom dit veilig is voor het wachtwoord: Better Auth bewaart de inloggegevens
// in `account`, met `account_id` = de user-id, niet het e-mailadres. Het adres
// staat alleen in `user.email`. Eén UPDATE daar is dus genoeg; de hash, de
// sessies en alles wat naar `user.id` verwijst (zoals
// tickets.verkocht_door_user_id) blijven staan. Sessies bewust laten leven: een
// adreswijziging is geen wachtwoordwijziging en hoeft niemand uit te loggen.
//
// PRODUCTIE: `weigerOpProductie()` blokkeert dit script daar, zoals bij elk
// script dat data wijzigt. Dat is opzet, en tegelijk is een adres corrigeren juist
// iets wat je op productie wil kunnen. Daarvoor is de ontsnapping uit guard.ts:
//
//   ALLOW_PRODUCTION_WRITE=ik-weet-het-zeker npm run db:wijzig-email:prod -- \
//     --van amresh@example.com --naar amresh@kalenda.sr
//
// Draai daar eerst een `pg_dump` voor, zie infra/DEPLOY.md.

type Argumenten = { van: string; naar: string }

function leesArgumenten(): Argumenten {
  const argv = process.argv.slice(2)
  const waarde = (vlag: string): string | undefined => {
    const i = argv.indexOf(vlag)
    return i === -1 ? undefined : argv[i + 1]
  }

  const van = waarde('--van')
  const naar = waarde('--naar')

  if (!van || !naar) {
    throw new Error(
      'Gebruik: npm run db:wijzig-email:test -- --van <oud adres> --naar <nieuw adres>',
    )
  }
  // Better Auth normaliseert bij inloggen naar kleine letters, maar deze kolom
  // bewaart wat we hier schrijven — en dat adres komt in beheerschermen en mails
  // terecht. Eén schrijfwijze afdwingen.
  return { van: van.trim().toLowerCase(), naar: naar.trim().toLowerCase() }
}

async function wijzigEmail() {
  await weigerOpProductie('db:wijzig-email')

  const { van, naar } = leesArgumenten()

  if (van === naar) {
    throw new Error('Oud en nieuw adres zijn gelijk — niets te doen.')
  }

  const gevonden = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, van))
    .limit(1)

  if (gevonden.length === 0) {
    throw new Error(`Geen account gevonden met adres ${van}.`)
  }
  const gebruiker = gevonden[0]

  // `user.email` is uniek: zonder deze controle loopt de UPDATE stuk op een
  // constraint-fout die niet uitlegt wat er aan de hand is.
  const bezet = await db
    .select()
    .from(schema.user)
    .where(eq(schema.user.email, naar))
    .limit(1)

  if (bezet.length > 0) {
    throw new Error(
      `${naar} is al in gebruik door een ander account (rol ${bezet[0].rol}). ` +
        'Twee accounts kunnen niet hetzelfde adres hebben.',
    )
  }

  await db
    .update(schema.user)
    .set({ email: naar })
    .where(eq(schema.user.id, gebruiker.id))

  console.log('E-mailadres gewijzigd:')
  console.log(`  van:   ${van}`)
  console.log(`  naar:  ${naar}`)
  console.log(`  rol:   ${gebruiker.rol}`)
  console.log('')
  console.log(
    'Het wachtwoord verandert niet mee — log in met het adres hierboven',
  )
  console.log('en het wachtwoord dat je al had.')
}

wijzigEmail()
  .then(async () => {
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    if (err instanceof GuardFout) console.error(err.message)
    else console.error(err instanceof Error ? err.message : err)
    await closeDb()
    process.exit(1)
  })
