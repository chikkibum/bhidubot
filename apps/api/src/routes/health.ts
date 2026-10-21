import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { sql } from 'drizzle-orm'
import { Elysia } from 'elysia'
import type { AppDeps } from '../deps'

const CHECK_TIMEOUT_MS = 2000

type Probe = 'up' | 'down'

/** `GET /health`: 200 when Postgres and the jobs queue both answer, 503 otherwise. Public. */
export function healthRoutes({ db, sqs, queueUrl, logger }: AppDeps) {
  const probe = async (name: string, check: () => Promise<unknown>): Promise<Probe> => {
    try {
      await withTimeout(check(), CHECK_TIMEOUT_MS)
      return 'up'
    } catch (error) {
      logger.warn({ err: error, dependency: name }, 'health check failed')
      return 'down'
    }
  }

  return new Elysia().get('/health', async ({ status }) => {
    const [dbState, queueState] = await Promise.all([
      probe('postgres', () => db.execute(sql`select 1`)),
      probe('sqs', () =>
        sqs.send(
          new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ['QueueArn'] }),
        ),
      ),
    ])
    const ok = dbState === 'up' && queueState === 'up'
    return status(ok ? 200 : 503, { ok, db: dbState, queue: queueState })
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
