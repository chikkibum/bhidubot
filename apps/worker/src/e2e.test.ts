import { afterAll, beforeAll, expect, test } from 'bun:test'
import { makeTestApp, type TestApp } from '@bhidubot/api/testing'
import { jobRuns } from '@bhidubot/db'
import { createLogger } from '@bhidubot/observability'
import { startConsumer } from '@bhidubot/queue'
import { eq } from 'drizzle-orm'
import { createHandlers } from './handlers'
import { runJob } from './run-job'

let t: TestApp
beforeAll(async () => {
  t = await makeTestApp()
  await t.resetAll()
})
afterAll(() => t.close())

test('dev ping flows api → sqs → worker with one trace id', async () => {
  const cookie = await t.signUpAndCookie('ping@acme.dev')
  const res = await t.app.handle(
    new Request('http://localhost/api/dev/ping', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ note: 'hello' }),
    }),
  )
  expect(res.status).toBe(202)
  const { jobId, traceId } = (await res.json()) as { jobId: string; traceId: string }
  expect(traceId).toBeTruthy()

  const logger = createLogger('worker-test', 'silent')
  const ac = new AbortController()
  await startConsumer({
    sqs: t.sqs,
    queueUrl: t.queueUrl,
    logger,
    signal: ac.signal,
    waitTimeSeconds: 1,
    handle: async (type, payload, ctx) => {
      try {
        await runJob({ db: t.db, logger, handlers: createHandlers(logger) }, type, payload, ctx)
      } finally {
        ac.abort()
      }
    },
  })

  const [row] = await t.db.select().from(jobRuns).where(eq(jobRuns.id, jobId))
  expect(row).toMatchObject({ id: jobId, status: 'succeeded', traceId })
})
