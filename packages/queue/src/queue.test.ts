import { expect, test } from 'bun:test'
import { createLogger, initTracing, tracer } from '@bhidubot/observability'
import { createQueue, createSqsClient, ensureQueues, startConsumer } from './index'

initTracing({ serviceName: 'queue-test' })
const env = {
  AWS_ENDPOINT_URL: 'http://localhost:4566',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
}
const sqs = createSqsClient(env as never)
const logger = createLogger('queue-test', 'silent')
const names = (s: string) => ({ queue: `t-${s}-${Date.now()}`, dlq: `t-${s}-dlq-${Date.now()}` })

test('enqueued job is consumed with the producer trace id', async () => {
  const { queueUrl } = await ensureQueues(sqs, names('ok'))
  const { traceId } = await tracer('t').startActiveSpan('api', async (s) => {
    const r = await createQueue(sqs, queueUrl).enqueue('system.ping', { note: 'hi' })
    s.end()
    return r
  })
  const ac = new AbortController()
  let seen: { type: string; payload: unknown; traceId?: string } | undefined
  await startConsumer({
    sqs,
    queueUrl,
    logger,
    signal: ac.signal,
    waitTimeSeconds: 1,
    handle: async (type, payload, ctx) => {
      seen = { type, payload, traceId: ctx.traceId }
      ac.abort()
    },
  })
  expect(seen).toEqual({ type: 'system.ping', payload: { note: 'hi' }, traceId })
})

test.skipIf(!!process.env.FLOCI_NO_REDRIVE)(
  'a job that always fails lands in the DLQ after maxReceiveCount',
  async () => {
    const { queueUrl, dlqUrl } = await ensureQueues(sqs, {
      ...names('dlq'),
      maxReceiveCount: 2,
      visibilityTimeoutSeconds: 1,
    })
    await createQueue(sqs, queueUrl).enqueue('system.ping', { note: 'boom' })
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 8000)
    await startConsumer({
      sqs,
      queueUrl,
      logger,
      signal: ac.signal,
      waitTimeSeconds: 1,
      handle: async () => {
        throw new Error('boom')
      },
    })
    const { ReceiveMessageCommand } = await import('@aws-sdk/client-sqs')
    const dlq = await sqs.send(new ReceiveMessageCommand({ QueueUrl: dlqUrl, WaitTimeSeconds: 2 }))
    expect(dlq.Messages?.length).toBe(1)
  },
  15000,
)

test('ensureQueues is idempotent', async () => {
  const n = names('idem')
  const a = await ensureQueues(sqs, n)
  const b = await ensureQueues(sqs, n)
  expect(b).toEqual(a)
})

test('a non-abort TimeoutError is logged and retried, not treated as a clean exit', async () => {
  const errors: unknown[] = []
  const log = { error: (...args: unknown[]) => errors.push(args) } as never
  let calls = 0
  const ac = new AbortController()
  const fake = {
    send: async (cmd: { constructor: { name: string } }) => {
      if (cmd.constructor.name === 'DeleteMessageCommand') return {}
      calls++
      if (calls === 1) {
        const e = new Error('socket timeout')
        e.name = 'TimeoutError'
        throw e
      }
      return {
        Messages: [
          {
            MessageId: 'm1',
            ReceiptHandle: 'r1',
            Body: JSON.stringify({ type: 'system.ping', payload: { note: 'x' } }),
          },
        ],
      }
    },
  }
  let handled = 0
  await startConsumer({
    sqs: fake as never,
    queueUrl: 'http://x/q',
    logger: log,
    signal: ac.signal,
    handle: async () => {
      handled++
      ac.abort()
    },
  })
  expect(errors.length).toBe(1)
  expect(handled).toBe(1)
  expect(calls).toBe(2)
})
