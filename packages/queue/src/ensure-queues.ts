import { CreateQueueCommand, GetQueueAttributesCommand, type SQSClient } from '@aws-sdk/client-sqs'

export async function ensureQueues(
  sqs: SQSClient,
  opts: {
    queue: string
    dlq: string
    maxReceiveCount?: number
    visibilityTimeoutSeconds?: number
  },
): Promise<{ queueUrl: string; dlqUrl: string }> {
  const { queue, dlq, maxReceiveCount = 5, visibilityTimeoutSeconds = 300 } = opts

  const dlqRes = await sqs.send(new CreateQueueCommand({ QueueName: dlq }))
  const dlqUrl = dlqRes.QueueUrl
  if (!dlqUrl) throw new Error(`SQS did not return a URL for ${dlq}`)
  const attrs = await sqs.send(
    new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ['QueueArn'] }),
  )
  const dlqArn = attrs.Attributes?.QueueArn
  if (!dlqArn) throw new Error(`SQS did not return an ARN for ${dlq}`)

  // CreateQueue is idempotent only when attributes match, so we always send identical ones.
  const res = await sqs.send(
    new CreateQueueCommand({
      QueueName: queue,
      Attributes: {
        VisibilityTimeout: String(visibilityTimeoutSeconds),
        RedrivePolicy: JSON.stringify({ deadLetterTargetArn: dlqArn, maxReceiveCount }),
      },
    }),
  )
  if (!res.QueueUrl) throw new Error(`SQS did not return a URL for ${queue}`)
  return { queueUrl: res.QueueUrl, dlqUrl }
}
