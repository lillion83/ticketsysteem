import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL ontbreekt in de omgeving (.env)')
}

const client = postgres(connectionString)

export const db = drizzle(client, { schema })

export const closeDb = () => client.end()

export { schema }
