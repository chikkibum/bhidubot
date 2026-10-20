import { expect, test } from 'bun:test'
import {
  currentTraceId,
  initTracing,
  injectTraceContext,
  tracer,
  withExtractedContext,
} from './index'

initTracing({ serviceName: 'test' })

test('injected traceparent is restored by withExtractedContext', async () => {
  let carrier: Record<string, string> = {}
  let traceId = ''
  await tracer('t').startActiveSpan('producer', async (span) => {
    carrier = injectTraceContext()
    traceId = span.spanContext().traceId
    span.end()
  })
  expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/)
  const seen = await withExtractedContext(carrier, async () =>
    tracer('t').startActiveSpan('consumer', async (span) => {
      const id = currentTraceId()
      span.end()
      return id
    }),
  )
  expect(seen).toBe(traceId)
})

test('initTracing is idempotent and outside any span there is no trace', async () => {
  const a = initTracing({ serviceName: 'test' })
  const b = initTracing({ serviceName: 'test' })
  expect(b).toBe(a)
  expect(currentTraceId()).toBeUndefined()
  expect(injectTraceContext()).toEqual({})
})

test('shutdown releases the globals so tracing can be re-initialised', async () => {
  await initTracing({ serviceName: 'test' }).shutdown()
  const again = initTracing({ serviceName: 'test' })
  await tracer('t').startActiveSpan('after-restart', async (span) => {
    expect(currentTraceId()).toBe(span.spanContext().traceId)
    span.end()
  })
  await again.shutdown()
})
