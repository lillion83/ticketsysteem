import { readFileSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Laad het env-bestand in, zodat DATABASE_URL beschikbaar is bij `db:generate`
// en `db:migrate`. Welk bestand geladen wordt is instelbaar via ENV_FILE:
// standaard `.env`, maar `db:migrate:test` zet ENV_FILE=.env.test om de
// migraties tegen de test-database te draaien.
//
// Belangrijk: drizzle-kit laadt zélf al `.env` in vóórdat deze config draait, en
// process.loadEnvFile OVERSCHRIJFT bestaande process.env-waarden niet. Daardoor
// zou ENV_FILE=.env.test genegeerd worden en zou migrate tegen de dev-database
// draaien. We parsen het gekozen bestand daarom zelf en zetten de waarden
// geforceerd — geen extra dependency nodig.
const envFile = process.env.ENV_FILE ?? '.env'
try {
  for (const regel of readFileSync(envFile, 'utf8').split('\n')) {
    if (/^\s*(#|$)/.test(regel)) continue
    const m = regel.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
    if (m) process.env[m[1]] = m[2]
  }
} catch {
  // geen env-bestand aanwezig — env komt dan uit de omgeving zelf
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  casing: 'snake_case',
})
