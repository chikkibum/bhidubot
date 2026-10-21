import { expect, test } from 'bun:test'
import { assertDependencies, createSqsClient } from '@bhidubot/queue'

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
