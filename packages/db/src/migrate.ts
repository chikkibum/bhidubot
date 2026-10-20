import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

export async function runMigrations(url: string): Promise<void> {
  // Migrations run on a dedicated single connection, closed afterwards. Postgres NOTICEs
  // ("schema drizzle already exists, skipping") are expected on re-runs and silenced.
  const client = postgres(url, { max: 1, onnotice: () => {} })
  try {
    await migrate(drizzle(client), { migrationsFolder })
  } finally {
    await client.end()
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
