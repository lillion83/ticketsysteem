import { sql } from 'drizzle-orm'
import { db } from './index'

// Vangrail tegen "per ongeluk op productie". Twee markeringen die onafhankelijk
// van elkaar gezet worden en die met elkaar moeten kloppen:
//
//   1. APP_ENV in het env-bestand (development | test | production)
//   2. een comment op de database zelf:
//        COMMENT ON DATABASE ticketsysteem IS 'app_env=production';
//
// Waarom een database-comment en niet een tabel: een tabel buiten schema.ts wil
// `drizzle-kit generate` in de volgende migratie droppen, en een tabel die wél in
// het schema staat heeft in elke database dezelfde inhoud — dan markeert hij
// niets. Een comment is onzichtbaar voor Drizzle en kost geen migratie.
//
// Waarom niet raden op de databasenaam: dat faalt juist in het gevaarlijke geval.
// Zet je een productie-dump terug in `ticketsysteem_dev`, dan ziet een naam-check
// "dev" terwijl er echte data staat. `pg_dump` zonder --create neemt de comment
// niet mee, dus na zo'n restore is de marker weg en weigert de guard — precies
// wat je wil.
//
// De guard zit hier en NIET in drizzle.shared.ts, omdat migreren op productie
// moet blijven werken: drizzle-kit importeert niets uit src/, dus `db:migrate:prod`
// komt hier nooit langs.

export type Omgeving = 'development' | 'test' | 'production'

/**
 * Eigen fouttype, zodat de aanroepende scripts alléén de melding printen en niet
 * de stacktrace: bij een geweigerde guard is de melding het hele punt, en een
 * stack eronder leidt af van wat je moet doen.
 */
export class GuardFout extends Error {
  override name = 'GuardFout'
}

/** Bewuste ontsnapping, alleen voor het eenmalig opzetten van een productie-DB. */
const ONTSNAPPING = 'ik-weet-het-zeker'

export type OmgevingsInfo = {
  /** APP_ENV uit het env-bestand, of null als die niet gezet is. */
  appEnv: string | null
  /** De marker die als comment op de database staat, of null als die ontbreekt. */
  dbMarker: string | null
  database: string
  host: string
  /** true als beide markeringen bekend zijn én hetzelfde zeggen. */
  klopt: boolean
}

/**
 * Leest de omgevingsmarker uit het comment op de huidige database.
 * null als er geen comment staat of als het comment niet het verwachte
 * `app_env=…`-formaat heeft.
 */
export async function leesDbMarker(): Promise<string | null> {
  const rijen = (await db.execute(sql`
    select shobj_description(oid, 'pg_database') as commentaar
    from pg_database
    where datname = current_database()
  `)) as unknown as Array<{ commentaar: string | null }>

  const commentaar = rijen[0]?.commentaar
  if (!commentaar) return null
  return commentaar.match(/app_env\s*=\s*([\w-]+)/)?.[1] ?? null
}

/** Waar zijn we, volgens beide markeringen? Doet één query, verandert niets. */
export async function omgevingsInfo(): Promise<OmgevingsInfo> {
  const rijen = (await db.execute(sql`
    select current_database() as database
  `)) as unknown as Array<{ database: string }>

  const appEnv = process.env.APP_ENV ?? null
  const dbMarker = await leesDbMarker()

  return {
    appEnv,
    dbMarker,
    database: rijen[0]?.database ?? '(onbekend)',
    host: hostUitUrl(process.env.DATABASE_URL),
    klopt: appEnv !== null && dbMarker !== null && appEnv === dbMarker,
  }
}

/**
 * Weigert als dit script op een productiedatabase zou schrijven. Aan te roepen
 * als eerste regel van elk script dat rijen aanmaakt, wijzigt of verwijdert.
 *
 * Weigert bij:
 *   - marker `production` op de database
 *   - APP_ENV=production in de omgeving
 *   - onenigheid tussen die twee (verkeerd env-bestand bij de juiste database,
 *     of andersom — beide richtingen)
 *   - een ontbrekende marker: onbekend is niet hetzelfde als veilig. Dit vangt
 *     de restore-val, want een teruggezette dump heeft geen marker.
 *
 * Te overrulen met ALLOW_PRODUCTION_WRITE=ik-weet-het-zeker. Bewust een lange
 * waarde die je niet per ongeluk typt.
 */
export async function weigerOpProductie(script: string): Promise<void> {
  const info = await omgevingsInfo()

  if (process.env.ALLOW_PRODUCTION_WRITE === ONTSNAPPING) {
    console.warn(
      `[guard] ${script}: ALLOW_PRODUCTION_WRITE gezet — controle overgeslagen ` +
        `op ${info.database} (${info.host}).`,
    )
    return
  }

  const reden = bepaalReden(info)
  if (!reden) return

  // De marker-hint alleen tonen als de marker écht ontbreekt. Zou hij er ook
  // staan bij een database die als productie gemarkeerd is, dan zou de melding
  // voorstellen om die markering weg te schrijven — precies het verkeerde advies.
  const markerHint =
    info.dbMarker === null
      ? [
          '',
          'Is dit een dev- of test-database zonder marker? Zet hem dan één keer:',
          `  sudo -u postgres psql -c "COMMENT ON DATABASE ${info.database} IS 'app_env=development';"`,
        ]
      : []

  throw new GuardFout(
    [
      `${script} is geweigerd: ${reden}`,
      '',
      `  database   ${info.database}`,
      `  host       ${info.host}`,
      `  APP_ENV    ${info.appEnv ?? '(niet gezet)'}`,
      `  DB-marker  ${info.dbMarker ?? '(niet gezet)'}`,
      '',
      'Dit script wijzigt of verwijdert data en hoort alleen op dev of test te draaien.',
      'Draai je in de goede map? Productie is /home/amresh/ticketsysteem, dev is',
      '/home/amresh/dev/ticketsysteem. Controleer met: npm run db:omgeving',
      ...markerHint,
    ].join('\n'),
  )
}

function bepaalReden(info: OmgevingsInfo): string | null {
  if (info.dbMarker === 'production') {
    return 'deze database is gemarkeerd als productie.'
  }
  if (info.appEnv === 'production') {
    return 'APP_ENV staat op production.'
  }
  if (info.dbMarker === null) {
    return 'deze database heeft geen omgevingsmarker, dus we weten niet of het productie is.'
  }
  if (info.appEnv === null) {
    return 'APP_ENV is niet gezet, dus we weten niet in welke omgeving we zitten.'
  }
  if (info.appEnv !== info.dbMarker) {
    return `APP_ENV (${info.appEnv}) en de DB-marker (${info.dbMarker}) spreken elkaar tegen — waarschijnlijk het verkeerde env-bestand bij deze database.`
  }
  return null
}

/** Host uit een postgres-URL halen, puur om in de melding te tonen. */
function hostUitUrl(url: string | undefined): string {
  if (!url) return '(geen DATABASE_URL)'
  try {
    return new URL(url).host
  } catch {
    return '(onleesbare DATABASE_URL)'
  }
}
