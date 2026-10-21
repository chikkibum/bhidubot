import type { SQSClient } from '@aws-sdk/client-sqs'
import type { Auth } from '@bhidubot/auth'
import type { ApiEnv } from '@bhidubot/config'
import type { Db } from '@bhidubot/db'
import type { Logger } from '@bhidubot/observability'
import type { createQueue } from '@bhidubot/queue'

export type AppDeps = {
  db: Db
  auth: Auth
  queue: ReturnType<typeof createQueue>
  sqs: SQSClient
  queueUrl: string
  logger: Logger
  env: ApiEnv
}
