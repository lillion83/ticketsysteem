import { maakConfig } from './drizzle.shared'

// Dev/productie: leest `.env`. De test-variant staat in `drizzle.config.test.ts`.
// ENV_FILE blijft ondersteund voor wie drizzle-kit handmatig aanroept.
export default maakConfig(process.env.ENV_FILE ?? '.env')
