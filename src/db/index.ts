import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
// Controleert op module-scope of deze omgeving met de juiste sleutels draait.
// Puur voor het side effect; staat hier omdat elke server-route de db importeert.
import '../lib/env-assert'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL ontbreekt in de omgeving (.env)')
}

const client = postgres(connectionString)

export const db = drizzle(client, { schema })

export const closeDb = () => client.end()

export { schema }
