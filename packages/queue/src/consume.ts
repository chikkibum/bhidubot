import {
  DeleteMessageCommand,
  type Message,
  ReceiveMessageCommand,
  type SQSClient,
} from '@aws-sdk/client-sqs'
import { type Logger, tracer, withExtractedContext } from '@bhidubot/observability'
import type { JobContext } from './jobs'

const ERROR_BACKOFF_MS = 1000

function isAbort(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === 'AbortError' || name === 'TimeoutError'
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', done)
      resolve()
    }, ms)
    function done() {
      clearTimeout(timer)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export async function startConsumer(opts: {
  sqs: SQSClient
  queueUrl: string
  handle: (type: string, payload: unknown, ctx: JobContext) => Promise<void>
  logger: Logger
  signal: AbortSignal
  waitTimeSeconds?: number
}): Promise<void> {
  const { sqs, queueUrl, handle, logger, signal, waitTimeSeconds = 20 } = opts

  async function processMessage(message: Message): Promise<void> {
    const carrier: Record<string, string> = {}
    for (const [name, attr] of Object.entries(message.MessageAttributes ?? {})) {
      if (attr.StringValue !== undefined) carrier[name] = attr.StringValue
    }
    const jobId = message.MessageId ?? ''
    const attempt = Number(message.Attributes?.ApproximateReceiveCount ?? '1')
    try {
      const parsed = JSON.parse(message.Body ?? '') as { type: string; payload: unknown }
      await withExtractedContext(carrier, () =>
        tracer('queue').startActiveSpan(`job ${parsed.type}`, async (span) => {
          try {
            const traceId = span.spanContext().traceId
            await handle(parsed.type, parsed.payload, { jobId, attempt, traceId })
          } finally {
            span.end()
          }
        }),
      )
      await sqs.send(
        new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }),
      )
    } catch (err) {
      // Not deleted: it reappears after the visibility timeout and moves to the DLQ after maxReceiveCount.
      logger.error({ err, jobId, attempt }, 'job failed')
    }
  }

  while (!signal.aborted) {
    try {
      const res = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: waitTimeSeconds,
          MessageAttributeNames: ['All'],
          MessageSystemAttributeNames: ['ApproximateReceiveCount'],
        }),
        { abortSignal: signal },
      )
      for (const message of res.Messages ?? []) await processMessage(message)
    } catch (err) {
      if (signal.aborted || isAbort(err)) break
      logger.error({ err }, 'queue receive failed; backing off')
      await sleep(ERROR_BACKOFF_MS, signal)
    }
  }
}
