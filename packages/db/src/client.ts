import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import * as schema from './schema'

export type Db = PostgresJsDatabase<typeof schema>

export function createDb(url: string): { db: Db; client: Sql; close(): Promise<void> } {
  const client = postgres(url)
  const db = drizzle(client, { schema })
  return { db, client, close: () => client.end() }
}
