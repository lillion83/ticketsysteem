import { defineConfig } from 'drizzle-kit'

// Laad .env in (net als het seed-script), zodat DATABASE_URL beschikbaar is
// bij `db:generate` en `db:migrate`. process.loadEnvFile is een Node-builtin
// (>= 20.12) en vereist geen extra dependency. In omgevingen waar de env al
// gezet is (CI, PM2) en er geen .env-bestand staat, negeren we de fout.
try {
  process.loadEnvFile()
} catch {
  // geen .env-bestand aanwezig — env komt dan uit de omgeving zelf
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
