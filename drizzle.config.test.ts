import { maakConfig } from './drizzle.shared'

// Test-omgeving: leest `.env.test` (database `ticketsysteem_test`). Gebruikt
// door `npm run db:migrate:test` via `drizzle-kit migrate --config`.
export default maakConfig('.env.test')
