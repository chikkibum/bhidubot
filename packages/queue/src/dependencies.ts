import { GetQueueAttributesCommand, GetQueueUrlCommand, type SQSClient } from '@aws-sdk/client-sqs'
import { createDb } from '@bhidubot/db'
import { sql } from 'drizzle-orm'

export type Dependency = 'postgres' | 'sqs'

export class DependencyError extends Error {
  constructor(
    readonly dependency: Dependency,
    cause: unknown,
  ) {
    super(`Cannot reach ${dependency}: ${cause instanceof Error ? cause.message : String(cause)}`, {
      cause,
    })
    this.name = 'DependencyError'
  }
}

/** Rejects with `Error('timed out after Nms')` if `work` has not settled in time. */
async function within<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${timeoutMs}ms`)), timeoutMs)
  })
  try {
    return await Promise.race([work, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Resolves a queue name to its URL, failing as a `DependencyError` for `sqs`. */
export async function getQueueUrl(sqs: SQSClient, queueName: string): Promise<string> {
  try {
    const res = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }))
    if (!res.QueueUrl) throw new Error(`no URL for queue ${queueName}`)
    return res.QueueUrl
  } catch (error) {
    throw new DependencyError(
      'sqs',
      error instanceof Error
        ? new Error(`${error.message} (run \`bun run infra:bootstrap\` to create queues)`)
        : error,
    )
  }
}

/** Fail-fast startup check: Postgres answers `select 1` and the queue exists, each within `timeoutMs`. */
export async function assertDependencies(opts: {
  databaseUrl: string
  sqs: SQSClient
  queueUrl: string
  timeoutMs?: number
}): Promise<void> {
  const { databaseUrl, sqs, queueUrl, timeoutMs = 5000 } = opts

  const { db, close } = createDb(databaseUrl)
  try {
    await within(db.execute(sql`select 1`), timeoutMs)
  } catch (error) {
    throw new DependencyError('postgres', error)
  } finally {
    // Don't await: an unreachable server could make `end()` hang past the timeout.
    void close().catch(() => {})
  }

  const abort = new AbortController()
  try {
    await within(
      sqs.send(new GetQueueAttributesCommand({ QueueUrl: queueUrl }), {
        abortSignal: abort.signal,
      }),
      timeoutMs,
    )
  } catch (error) {
    abort.abort()
    throw new DependencyError('sqs', error)
  }
}
