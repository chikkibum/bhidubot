import { afterAll, beforeEach, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createDb, jobRuns, resetTestDb } from './index'

const { db, close } = createDb(process.env.DATABASE_URL_TEST!)
beforeEach(() => resetTestDb(db))
afterAll(() => close())

test('pgvector extension is installed by migrations', async () => {
  const rows = await db.execute(sql`select extname from pg_extension where extname = 'vector'`)
  expect(rows.length).toBe(1)
})

test('job_runs round-trips a row', async () => {
  await db
    .insert(jobRuns)
    .values({ id: 'job-1', type: 'system.ping', status: 'running', attempt: 1 })
  const [row] = await db.select().from(jobRuns)
  expect(row?.status).toBe('running')
  expect(row?.traceId).toBeNull()
})
