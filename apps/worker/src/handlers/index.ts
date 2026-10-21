import { createLogger } from '@bhidubot/observability'
import type { JobHandler, JobType } from '@bhidubot/queue'
import { systemPing } from './system-ping'

export type Handlers = { [K in JobType]: JobHandler<K> }

export function createHandlers(logger = createLogger('worker')): Handlers {
  return { 'system.ping': systemPing(logger) }
}

export const handlers: Handlers = createHandlers()
