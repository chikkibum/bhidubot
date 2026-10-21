import { expect, test } from 'bun:test'
import { Writable } from 'node:stream'
import { createLogger } from './logger'
import { initTracing, tracer } from './tracing'

function capture() {
  const lines: Record<string, unknown>[] = []
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(String(chunk)))
      done()
    },
  })
  return { lines, stream }
}

test('log lines carry trace_id inside a span and omit it outside', async () => {
  const tracing = initTracing({ serviceName: 'logger-test' })
  const { lines, stream } = capture()
  const logger = createLogger('svc', 'info', stream)

  logger.info('outside')
  const traceId = await tracer('t').startActiveSpan('work', async (span) => {
    logger.info('inside')
    span.end()
    return span.spanContext().traceId
  })
  await tracing.shutdown()

  expect(lines[0]).toMatchObject({ service: 'svc', msg: 'outside' })
  expect(lines[0]).not.toHaveProperty('trace_id')
  expect(lines[1]).toMatchObject({ service: 'svc', msg: 'inside', trace_id: traceId })
})
