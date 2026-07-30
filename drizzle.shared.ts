import { readFileSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Gedeelde drizzle-kit-configuratie, geparametriseerd op het env-bestand én op de
// omgeving die daarin verwacht wordt:
//
//   drizzle.config.ts       .env              development
//   drizzle.config.test.ts  .env.test         test
//   drizzle.config.prod.ts  .env.production   production
//
// Welke van de drie draait, kiest drizzle-kit via `--config`.
//
// Bewust via losse configbestanden en niet via een omgevingsvariabele vooraf
// (`ENV_FILE=.env.test drizzle-kit migrate`): npm draait scripts op Windows via
// cmd.exe, ook vanuit Git Bash, en cmd kent die prefix niet. Met `--config`
// werkt hetzelfde script op Windows en op InterServer.
//
// Belangrijk: drizzle-kit laadt zélf al `.env` in vóórdat deze config draait, en
// process.loadEnvFile OVERSCHRIJFT bestaande process.env-waarden niet. Daardoor
// zou het test-env-bestand genegeerd worden en zou migrate tegen de
// dev-database draaien. We parsen het gekozen bestand daarom zelf en zetten de
// waarden geforceerd — geen extra dependency nodig.
//
// De APP_ENV-controle hieronder is de reden dat één verkeerd commando niet meer
// de verkeerde database kan migreren: het env-bestand moet zeggen dat het bij
// deze config hoort. Vroeger viel dit stil terug op `.env` (= productie).
export function maakConfig(envFile: string, verwachteOmgeving: string) {
  let inhoud: string
  try {
    inhoud = readFileSync(envFile, 'utf8')
  } catch {
    // Hard falen, niet stil doorgaan: zonder env-bestand zou de config de
    // omgevingsvariabelen van de shell pakken, en dan weet je niet welke
    // database je migreert. Dit is precies de fout die we willen zien.
    throw new Error(
      `Env-bestand ${envFile} niet gevonden (verwacht een ${verwachteOmgeving}-omgeving).\n` +
        `Draai je in de goede map? Productie is /home/amresh/ticketsysteem,\n` +
        `dev is /home/amresh/dev/ticketsysteem.`,
    )
  }

  for (const regel of inhoud.split('\n')) {
    if (/^\s*(#|$)/.test(regel)) continue
    const m = regel.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
    if (m) process.env[m[1]] = m[2]
  }

  const appEnv = process.env.APP_ENV
  if (appEnv !== verwachteOmgeving) {
    throw new Error(
      `${envFile} hoort bij een ${verwachteOmgeving}-omgeving, maar APP_ENV is ` +
        `${appEnv ? `'${appEnv}'` : 'niet gezet'}.\n` +
        `Gebruik het juiste script: db:migrate (dev), db:migrate:test, db:migrate:prod.`,
    )
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(`DATABASE_URL ontbreekt in ${envFile}.`)
  }

  return defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: { url },
    casing: 'snake_case',
  })
}
