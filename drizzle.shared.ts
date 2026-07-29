import { readFileSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// Gedeelde drizzle-kit-configuratie, geparametriseerd op het env-bestand.
// `drizzle.config.ts` gebruikt `.env`, `drizzle.config.test.ts` gebruikt
// `.env.test` — welke van de twee draait, kiest drizzle-kit via `--config`.
//
// Bewust via twee configbestanden en niet via een omgevingsvariabele vooraf
// (`ENV_FILE=.env.test drizzle-kit migrate`): npm draait scripts op Windows via
// cmd.exe, ook vanuit Git Bash, en cmd kent die prefix niet. Met `--config`
// werkt hetzelfde script op Windows en op de VPS.
//
// Belangrijk: drizzle-kit laadt zélf al `.env` in vóórdat deze config draait, en
// process.loadEnvFile OVERSCHRIJFT bestaande process.env-waarden niet. Daardoor
// zou het test-env-bestand genegeerd worden en zou migrate tegen de
// dev-database draaien. We parsen het gekozen bestand daarom zelf en zetten de
// waarden geforceerd — geen extra dependency nodig.
export function maakConfig(envFile: string) {
  try {
    for (const regel of readFileSync(envFile, 'utf8').split('\n')) {
      if (/^\s*(#|$)/.test(regel)) continue
      const m = regel.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
      if (m) process.env[m[1]] = m[2]
    }
  } catch {
    // geen env-bestand aanwezig — env komt dan uit de omgeving zelf
  }

  return defineConfig({
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
    casing: 'snake_case',
  })
}
