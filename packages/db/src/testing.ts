import { sql } from 'drizzle-orm'
import type { Db } from './client'

/** Truncates every table in `public` except drizzle's migration bookkeeping. */
export async function resetTestDb(db: Db): Promise<void> {
  const rows = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`,
  )
  if (rows.length === 0) return
  const names = sql.join(
    rows.map((r) => sql.identifier(r.tablename)),
    sql`, `,
  )
  await db.execute(sql`truncate table ${names} restart identity cascade`)
}
