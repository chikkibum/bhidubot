import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { createDb } from './client'

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

export async function runMigrations(url: string): Promise<void> {
  // Migrations run on a dedicated single connection, closed afterwards.
  const { db, close } = createDb(url)
  try {
    await migrate(db, { migrationsFolder })
  } finally {
    await close()
  }
}

if (import.meta.main) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }
  await runMigrations(url)
  console.log('migrations applied')
}
