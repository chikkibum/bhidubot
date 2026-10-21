import { GetQueueUrlCommand } from '@aws-sdk/client-sqs'
import { createAuth } from '@bhidubot/auth'
import { apiEnvSchema, loadEnv } from '@bhidubot/config'
import { createDb } from '@bhidubot/db'
import { createSmtpMailer } from '@bhidubot/email'
import { createLogger, initTracing } from '@bhidubot/observability'
import { createQueue, createSqsClient } from '@bhidubot/queue'
import { sql } from 'drizzle-orm'
import { createApp } from './app'

const env = loadEnv(apiEnvSchema)
const tracing = initTracing({ serviceName: 'api', otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT })
const logger = createLogger('api', env.LOG_LEVEL)

const { db, close: closeDb } = createDb(env.DATABASE_URL)
const sqs = createSqsClient(env)

// Fail fast, naming the dependency. Task 10 replaces this with `assertDependencies`.
let queueUrl: string
try {
  await db.execute(sql`select 1`)
} catch (error) {
  logger.fatal({ err: error }, 'Cannot reach postgres')
  process.exit(1)
}
try {
  const res = await sqs.send(new GetQueueUrlCommand({ QueueName: env.SQS_JOBS_QUEUE }))
  if (!res.QueueUrl) throw new Error(`no URL for queue ${env.SQS_JOBS_QUEUE}`)
  queueUrl = res.QueueUrl
} catch (error) {
  logger.fatal({ err: error }, 'Cannot reach sqs (run `bun run infra:bootstrap` to create queues)')
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
