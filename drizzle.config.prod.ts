import { maakConfig } from './drizzle.shared'

// Productie: leest `.env.production` (database `ticketsysteem` op InterServer).
// Gebruikt door `npm run db:migrate:prod`, de enige manier om productie te
// migreren — zie de deployprocedure in `infra/DEPLOY.md`.
//
// Dit bestand werkt alleen in de productiemap, want alleen daar bestaat
// `.env.production`. In een dev-map faalt het meteen, en dat is de bedoeling.
export default maakConfig('.env.production', 'production')
