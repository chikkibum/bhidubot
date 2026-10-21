import type { Logger } from '@bhidubot/observability'
import type { JobHandler } from '@bhidubot/queue'

export function systemPing(logger: Logger): JobHandler<'system.ping'> {
  return async ({ note }, ctx) => {
    logger.info({ note, jobId: ctx.jobId, traceId: ctx.traceId }, 'system.ping')
  }
}
