import { GetQueueAttributesCommand, GetQueueUrlCommand, type SQSClient } from '@aws-sdk/client-sqs'
import { createDb } from '@bhidubot/db'
import { sql } from 'drizzle-orm'

export type Dependency = 'postgres' | 'sqs'

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

/** `dependency` is the first failed dependency; `failures` lists every one that failed. */
export class DependencyError extends Error {
  readonly failures: { dependency: Dependency; cause: unknown }[]

  constructor(
    readonly dependency: Dependency,
    cause: unknown,
    failures?: { dependency: Dependency; cause: unknown }[],
  ) {
    const all = failures ?? [{ dependency, cause }]
    super(all.map((f) => `Cannot reach ${f.dependency}: ${describe(f.cause)}`).join('; '), {
      cause,
    })
    this.name = 'DependencyError'
    this.failures = all
  }
}

/** Runs `work` with an abort signal; rejects with a timeout error (and aborts) if it overruns. */
async function within<T>(work: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const abort = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`timed out after ${timeoutMs}ms`))
      abort.abort()
    }, timeoutMs)
  })
  const pending = work(abort.signal)
  pending.catch(() => {}) // a late rejection after the timeout must not be unhandled
  try {
    return await Promise.race([pending, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Adds the bootstrap hint only when the queue does not exist; the original error stays as `cause`. */
function sqsError(error: unknown): unknown {
  const missing =
    error instanceof Error &&
    (error.name === 'QueueDoesNotExist' || error.name === 'AWS.SimpleQueueService.NonExistentQueue')
  return missing
    ? new Error(`${error.message} (run \`bun run infra:bootstrap\` to create queues)`, {
        cause: error,
      })
    : error
}

async function resolveQueueUrl(
  sqs: SQSClient,
  queueName: string,
  abortSignal: AbortSignal,
): Promise<string> {
  const res = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }), { abortSignal })
  if (!res.QueueUrl) throw new Error(`no URL for queue ${queueName}`)
  return res.QueueUrl
}

/** Resolves a queue name to its URL, failing as a `DependencyError` for `sqs`, bounded by `timeoutMs`. */
export async function getQueueUrl(
  sqs: SQSClient,
  queueName: string,
  timeoutMs = 5000,
): Promise<string> {
  try {
    return await within((signal) => resolveQueueUrl(sqs, queueName, signal), timeoutMs)
  } catch (error) {
    throw new DependencyError('sqs', sqsError(error))
  }
}

async function checkPostgres(databaseUrl: string, timeoutMs: number): Promise<void> {
  const { db, close } = createDb(databaseUrl)
  try {
    await within(() => db.execute(sql`select 1`), timeoutMs)
  } finally {
    // Not awaited: end() on an unresponsive server could hang past the timeout.
    void close().catch(() => {})
  }
}

/**
 * Fail-fast startup check: Postgres answers `select 1` and the queue exists. The two legs run concurrently;
 * the SQS leg resolves the queue URL (when given `queueName`) and reads its attributes under ONE timer, so total
 * time is about `timeoutMs`. Every failure is reported in one `DependencyError`. Resolves to the queue URL.
 */
export async function checkDependencies(opts: {
  databaseUrl: string
  sqs: SQSClient
  queueName?: string
  queueUrl?: string
  timeoutMs?: number
}): Promise<string> {
  const { databaseUrl, sqs, queueName, timeoutMs = 5000 } = opts
  const sqsLeg = within(async (abortSignal) => {
    const queueUrl = opts.queueUrl ?? (await resolveQueueUrl(sqs, queueName ?? '', abortSignal))
    await sqs.send(new GetQueueAttributesCommand({ QueueUrl: queueUrl }), { abortSignal })
    return queueUrl
  }, timeoutMs).catch((error) => {
    throw sqsError(error)
  })
  const [pg, queue] = await Promise.allSettled([checkPostgres(databaseUrl, timeoutMs), sqsLeg])
  const failures: { dependency: Dependency; cause: unknown }[] = []
  if (pg.status === 'rejected') failures.push({ dependency: 'postgres', cause: pg.reason })
  if (queue.status === 'rejected') failures.push({ dependency: 'sqs', cause: queue.reason })
  const first = failures[0]
  if (first) throw new DependencyError(first.dependency, first.cause, failures)
  return (queue as PromiseFulfilledResult<string>).value
}

export async function assertDependencies(opts: {
  databaseUrl: string
  sqs: SQSClient
  queueUrl: string
  timeoutMs?: number
}): Promise<void> {
  await checkDependencies(opts)
}
