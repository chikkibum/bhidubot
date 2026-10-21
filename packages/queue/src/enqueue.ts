import { SendMessageCommand, type SQSClient } from '@aws-sdk/client-sqs'
import { currentTraceId, injectTraceContext } from '@bhidubot/observability'
import type { JobMap, JobType } from './jobs'

export function createQueue(sqs: SQSClient, queueUrl: string) {
  return {
    async enqueue<K extends JobType>(
      type: K,
      payload: JobMap[K],
      opts: { delaySeconds?: number } = {},
    ): Promise<{ jobId: string; traceId: string | undefined }> {
      const traceId = currentTraceId()
      const attributes = Object.fromEntries(
        Object.entries(injectTraceContext()).map(([name, value]) => [
          name,
          { DataType: 'String', StringValue: value },
        ]),
      )
      const res = await sqs.send(
        new SendMessageCommand({
          QueueUrl: queueUrl,
          MessageBody: JSON.stringify({ type, payload }),
          MessageAttributes: attributes,
          DelaySeconds: opts.delaySeconds,
        }),
      )
      if (!res.MessageId) throw new Error('SQS did not return a MessageId')
      return { jobId: res.MessageId, traceId }
    },
  }
}
