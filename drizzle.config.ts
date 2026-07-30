import { maakConfig } from './drizzle.shared'

// Dev: leest `.env` en eist APP_ENV=development. De test- en productievarianten
// staan in `drizzle.config.test.ts` en `drizzle.config.prod.ts`.
//
// De oude ENV_FILE-fallback is weg. Die viel terug op `.env`, en omdat `.env` en
// `.env.local` naar dezelfde database wezen, kon `npm run db:migrate` productie
// migreren zonder dat je dat vroeg. Nu kiest elk script zijn eigen config.
export default maakConfig('.env', 'development')
