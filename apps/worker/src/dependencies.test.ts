import { expect, test } from 'bun:test'
import {
  assertDependencies,
  checkDependencies,
  createSqsClient,
  DependencyError,
  getQueueUrl,
} from '@bhidubot/queue'

const sqs = createSqsClient({
  AWS_ENDPOINT_URL: 'http://localhost:4566',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
} as never)
const queueUrl = 'http://localhost:4566/000000000000/none'

test('assertDependencies names the unreachable dependency', async () => {
  const started = Date.now()
  await expect(
    assertDependencies({
      databaseUrl: 'postgres://x:y@localhost:5999/none',
      sqs,
      queueUrl,
      timeoutMs: 2000,
    }),
  ).rejects.toThrow('Cannot reach postgres')
  expect(Date.now() - started).toBeLessThan(5000)
})

test('assertDependencies names sqs when the queue is missing', async () => {
  await expect(
    assertDependencies({
      databaseUrl: process.env.DATABASE_URL_TEST as string,
      sqs,
      queueUrl,
      timeoutMs: 2000,
    }),
  ).rejects.toThrow('Cannot reach sqs')
})

/** A TCP server that accepts connections and never answers. */
function hangingServer() {
  const server = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {}, open() {} } })
  return { port: server.port, stop: () => server.stop(true) }
}

test('a hanging postgres hits the timer path and is named', async () => {
  const hang = hangingServer()
  try {
    const started = Date.now()
    await expect(
      assertDependencies({
        databaseUrl: `postgres://x:y@127.0.0.1:${hang.port}/none`,
        sqs,
        queueUrl: 'http://localhost:4566/000000000000/none',
        timeoutMs: 500,
      }),
    ).rejects.toThrow('Cannot reach postgres: timed out after 500ms')
    expect(Date.now() - started).toBeLessThan(1500)
  } finally {
    hang.stop()
  }
})

test('a hanging sqs endpoint is bounded and reported alongside a postgres failure', async () => {
  const hang = hangingServer()
  try {
    const hungSqs = createSqsClient({
      AWS_ENDPOINT_URL: `http://127.0.0.1:${hang.port}`,
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
    } as never)
    const started = Date.now()
    const err = await assertDependencies({
      databaseUrl: 'postgres://x:y@localhost:5999/none',
      sqs: hungSqs,
      queueUrl: `http://127.0.0.1:${hang.port}/000000000000/q`,
      timeoutMs: 500,
    }).catch((e) => e)
    expect(err.message).toContain('Cannot reach postgres')
    expect(err.message).toContain('Cannot reach sqs: timed out after 500ms')
    expect(err.dependency).toBe('postgres')
    expect(Date.now() - started).toBeLessThan(1500)
    await expect(getQueueUrl(hungSqs, 'q', 500)).rejects.toThrow('Cannot reach sqs')
  } finally {
    hang.stop()
  }
})

test('checkDependencies bounds resolve-then-attributes under one timer, and reports both failures', async () => {
  // Answers GetQueueUrl after 300ms, then hangs on everything else.
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const body = await req.text()
      const target = req.headers.get('x-amz-target') ?? ''
      if (target.includes('GetQueueUrl') || body.includes('GetQueueUrl')) {
        await Bun.sleep(300)
        return Response.json(
          { QueueUrl: `${new URL(req.url).origin}/000000000000/q` },
          { headers: { 'content-type': 'application/x-amz-json-1.0' } },
        )
      }
      return new Promise<Response>(() => {})
    },
  })
  try {
    const slowSqs = createSqsClient({
      AWS_ENDPOINT_URL: `http://127.0.0.1:${server.port}`,
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test',
      AWS_SECRET_ACCESS_KEY: 'test',
    } as never)
    const started = Date.now()
    const err = await checkDependencies({
      databaseUrl: 'postgres://x:y@localhost:5999/none',
      sqs: slowSqs,
      queueName: 'q',
      timeoutMs: 500,
    }).catch((e) => e)
    expect(err).toBeInstanceOf(DependencyError)
    expect(err.failures.map((f: { dependency: string }) => f.dependency)).toEqual([
      'postgres',
      'sqs',
    ])
    expect(err.message).toContain('Cannot reach sqs: timed out after 500ms')
    expect(Date.now() - started).toBeLessThan(2000)
  } finally {
    server.stop(true)
  }
})
