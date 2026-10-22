import { createAuth } from '@bhidubot/auth'
import { apiEnvSchema, loadEnv } from '@bhidubot/config'
import { createDb } from '@bhidubot/db'
import { createSmtpMailer } from '@bhidubot/email'
import { createLogger, initTracing } from '@bhidubot/observability'
import { checkDependencies, createQueue, createSqsClient, DependencyError } from '@bhidubot/queue'
import { createApp } from './app'

const env = loadEnv(apiEnvSchema)
const tracing = initTracing({ serviceName: 'api', otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT })
const logger = createLogger('api', env.LOG_LEVEL)

const { db, close: closeDb } = createDb(env.DATABASE_URL)
const sqs = createSqsClient(env)

// Fail fast, naming the dependency.
let queueUrl: string
try {
  queueUrl = await checkDependencies({
    databaseUrl: env.DATABASE_URL,
    sqs,
    queueName: env.SQS_JOBS_QUEUE,
  })
} catch (error) {
  if (!(error instanceof DependencyError)) throw error
  logger.fatal({ err: error }, error.message)
  process.exit(1)
}

const mailer = createSmtpMailer({ smtpUrl: env.SMTP_URL, from: env.EMAIL_FROM })
const auth = createAuth({ db, mailer, env })
const app = createApp({
  db,
  auth,
  queue: createQueue(sqs, queueUrl),
  sqs,
  queueUrl,
  logger,
  env,
}).listen(env.API_PORT)

logger.info({ port: env.API_PORT }, 'api listening')

async function shutdown(signal: string) {
  logger.info({ signal }, 'api shutting down')
  await app.stop()
  await closeDb()
  await tracing.shutdown()
  process.exit(0)
}
process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
