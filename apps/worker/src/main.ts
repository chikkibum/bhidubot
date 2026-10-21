import { loadEnv, workerEnvSchema } from '@bhidubot/config'
import { createDb } from '@bhidubot/db'
import { createLogger, initTracing } from '@bhidubot/observability'
import {
  assertDependencies,
  createSqsClient,
  DependencyError,
  getQueueUrl,
  startConsumer,
} from '@bhidubot/queue'
import { createHandlers } from './handlers'
import { runJob } from './run-job'

const env = loadEnv(workerEnvSchema)
const tracing = initTracing({
  serviceName: 'worker',
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
})
const logger = createLogger('worker', env.LOG_LEVEL)
const sqs = createSqsClient(env)

let queueUrl: string
try {
  queueUrl = await getQueueUrl(sqs, env.SQS_JOBS_QUEUE)
  await assertDependencies({ databaseUrl: env.DATABASE_URL, sqs, queueUrl })
} catch (error) {
  if (!(error instanceof DependencyError)) throw error
  logger.fatal({ err: error }, error.message)
  process.exit(1)
}

const { db, close: closeDb } = createDb(env.DATABASE_URL)
const handlers = createHandlers(logger)
const abort = new AbortController()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    logger.info({ signal }, 'worker shutting down; finishing the current job')
    abort.abort()
  })
}

logger.info({ queueUrl }, 'worker started')
await startConsumer({
  sqs,
  queueUrl,
  logger,
  signal: abort.signal,
  handle: (type, payload, ctx) => runJob({ db, logger, handlers }, type, payload, ctx),
})

await closeDb()
await tracing.shutdown()
logger.info('worker stopped')
process.exit(0)
