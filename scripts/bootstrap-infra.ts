import { loadEnv, workerEnvSchema } from '@bhidubot/config'
import { createSqsClient, ensureQueues } from '@bhidubot/queue'
import { createS3Client, ensureBucket } from '@bhidubot/storage'

// Bun auto-loads `.env` from the cwd; copy `.env.example` to `.env` first.
const env = loadEnv(workerEnvSchema)

await ensureBucket(createS3Client(env), env.S3_BUCKET)
const { queueUrl, dlqUrl } = await ensureQueues(createSqsClient(env), {
  queue: env.SQS_JOBS_QUEUE,
  dlq: env.SQS_JOBS_DLQ,
})
console.log(`bucket ${env.S3_BUCKET} ready`)
console.log(`queue ${queueUrl}`)
console.log(`dlq ${dlqUrl}`)
