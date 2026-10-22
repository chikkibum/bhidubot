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

/** Resolves a queue name to its URL, failing as a `DependencyError` for `sqs`, bounded by `timeoutMs`. */
export async function getQueueUrl(
  sqs: SQSClient,
  queueName: string,
  timeoutMs = 5000,
): Promise<string> {
  try {
    const res = await within(
      (abortSignal) => sqs.send(new GetQueueUrlCommand({ QueueName: queueName }), { abortSignal }),
      timeoutMs,
    )
    if (!res.QueueUrl) throw new Error(`no URL for queue ${queueName}`)
    return res.QueueUrl
  } catch (error) {
    const missing =
      error instanceof Error &&
      (error.name === 'QueueDoesNotExist' ||
        error.name === 'AWS.SimpleQueueService.NonExistentQueue')
    throw new DependencyError(
      'sqs',
      missing
        ? new Error(`${error.message} (run \`bun run infra:bootstrap\` to create queues)`, {
            cause: error,
          })
        : error,
    )
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
 * Fail-fast startup check: Postgres answers `select 1` and the queue exists. Both run concurrently, each
 * bounded by `timeoutMs`, so total time is about `timeoutMs`; every failure is reported.
 */
export async function assertDependencies(opts: {
  databaseUrl: string
  sqs: SQSClient
  queueUrl: string
  timeoutMs?: number
}): Promise<void> {
  const { databaseUrl, sqs, queueUrl, timeoutMs = 5000 } = opts
  const checks: [Dependency, Promise<unknown>][] = [
    ['postgres', checkPostgres(databaseUrl, timeoutMs)],
    [
      'sqs',
      within(
        (abortSignal) =>
          sqs.send(new GetQueueAttributesCommand({ QueueUrl: queueUrl }), { abortSignal }),
        timeoutMs,
      ),
    ],
  ]
  const results = await Promise.allSettled(checks.map(([, p]) => p))
  const failures = results.flatMap((r, i) =>
    r.status === 'rejected' ? [{ dependency: checks[i]?.[0] ?? 'postgres', cause: r.reason }] : [],
  )
  const first = failures[0]
  if (first) throw new DependencyError(first.dependency, first.cause, failures)
}
