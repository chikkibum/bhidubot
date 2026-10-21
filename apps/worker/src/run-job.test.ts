import { afterAll, beforeEach, expect, test } from 'bun:test'
import { createDb, jobRuns, resetTestDb } from '@bhidubot/db'
import { createLogger } from '@bhidubot/observability'
import { eq } from 'drizzle-orm'
import { createHandlers } from './handlers'
import { runJob } from './run-job'

const { db, close } = createDb(process.env.DATABASE_URL_TEST as string)
const logger = createLogger('worker-test', 'silent')
const deps = { db, logger, handlers: createHandlers(logger) }

beforeEach(() => resetTestDb(db))
afterAll(close)

test('records success with attempt and trace id', async () => {
  await runJob(deps, 'system.ping', { note: 'x' }, { jobId: 'j1', attempt: 1, traceId: 'abc' })
  const [row] = await db.select().from(jobRuns)
  expect(row).toMatchObject({
    id: 'j1',
    status: 'succeeded',
    attempt: 1,
    traceId: 'abc',
    lastError: null,
  })
})

test('records failure and rethrows so SQS retries', async () => {
  const failing = {
    ...deps,
    handlers: {
      'system.ping': async () => {
        throw new Error('nope')
      },
    },
  }
  await expect(
    runJob(failing, 'system.ping', { note: 'x' }, { jobId: 'j2', attempt: 3, traceId: undefined }),
  ).rejects.toThrow('nope')
  const [row] = await db.select().from(jobRuns)
  expect(row).toMatchObject({ id: 'j2', status: 'failed', attempt: 3, lastError: 'nope' })
})

test('unknown job type fails loudly', async () => {
  await expect(
    runJob(deps, 'nope.job', {}, { jobId: 'j3', attempt: 1, traceId: undefined }),
  ).rejects.toThrow('unknown_job_type: nope.job')
})

test('is idempotent per job id: a retry updates the same row', async () => {
  let calls = 0
  const flaky = {
    ...deps,
    handlers: {
      'system.ping': async () => {
        calls += 1
        if (calls === 1) throw new Error('first')
      },
    },
  }
  const ctx = { jobId: 'j4', traceId: 't1' }
  await expect(runJob(flaky, 'system.ping', { note: 'x' }, { ...ctx, attempt: 1 })).rejects.toThrow(
    'first',
  )
  await runJob(flaky, 'system.ping', { note: 'x' }, { ...ctx, attempt: 2 })
  const rows = await db.select().from(jobRuns).where(eq(jobRuns.id, 'j4'))
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ status: 'succeeded', attempt: 2, lastError: null })
})
