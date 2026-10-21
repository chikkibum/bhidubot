import { type Db, jobRuns } from '@bhidubot/db'
import type { Logger } from '@bhidubot/observability'
import type { JobContext, JobHandler, JobType } from '@bhidubot/queue'
import { SpanStatusCode, trace } from '@opentelemetry/api'
import type { Handlers } from './handlers'

export type { Handlers } from './handlers'

/**
 * Runs one job and records it in `job_runs` (upsert keyed on the SQS message id, so redeliveries
 * update the same row). Rethrows handler failures so the consumer leaves the message for SQS to retry.
 */
export async function runJob(
  deps: { db: Db; logger: Logger; handlers: Handlers },
  type: string,
  payload: unknown,
  ctx: JobContext,
): Promise<void> {
  const { db, logger, handlers } = deps
  const handler = Object.hasOwn(handlers, type) ? handlers[type as JobType] : undefined

  const record = (status: 'running' | 'succeeded' | 'failed', lastError: string | null) => {
    const values = {
      type,
      status,
      attempt: ctx.attempt,
      traceId: ctx.traceId ?? null,
      lastError,
      updatedAt: new Date(),
    }
    return db
      .insert(jobRuns)
      .values({ id: ctx.jobId, ...values })
      .onConflictDoUpdate({ target: jobRuns.id, set: values })
  }

  try {
    if (!handler) throw new Error(`unknown_job_type: ${type}`)
    await record('running', null)
    await (handler as JobHandler<JobType>)(payload as never, ctx)
    await record('succeeded', null)
    logger.info({ jobId: ctx.jobId, type, attempt: ctx.attempt }, 'job succeeded')
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    const span = trace.getActiveSpan()
    span?.recordException(error)
    span?.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
    await record('failed', error.message).catch((recordErr) =>
      logger.error({ err: recordErr, jobId: ctx.jobId }, 'could not record job failure'),
    )
    throw err
  }
}
