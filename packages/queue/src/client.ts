import { SQSClient } from '@aws-sdk/client-sqs'
import type { AwsEnv } from '@bhidubot/config'

export function createSqsClient(env: AwsEnv): SQSClient {
  return new SQSClient({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
}
