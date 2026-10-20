import { context, propagation, type Tracer, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import { W3CTraceContextPropagator } from '@opentelemetry/core'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor, NoopSpanProcessor, TracerProvider } from '@opentelemetry/sdk-trace'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

export interface TracingHandle {
  shutdown(): Promise<void>
}

let active: TracingHandle | undefined

/**
 * Registers the global tracer provider, AsyncLocalStorage context manager and W3C propagator.
 * Idempotent per process: while tracing is active, further calls return the same handle and their
 * options are ignored (the global OpenTelemetry registrations can only be set once). `shutdown()`
 * flushes, unregisters the globals and allows a later `initTracing` to start afresh.
 * Without `otlpEndpoint` no exporter is created, so nothing is sent or printed.
 */
export function initTracing(opts: { serviceName: string; otlpEndpoint?: string }): TracingHandle {
  if (active) return active

  const spanProcessors = opts.otlpEndpoint
    ? [
        new BatchSpanProcessor({
          exporter: new OTLPTraceExporter({
            url: `${opts.otlpEndpoint.replace(/\/+$/, '')}/v1/traces`,
          }),
        }),
      ]
    : [new NoopSpanProcessor()]
  const provider = new TracerProvider({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: opts.serviceName }),
    spanProcessors,
  })
  const contextManager = new AsyncLocalStorageContextManager().enable()

  trace.setGlobalTracerProvider(provider)
  context.setGlobalContextManager(contextManager)
  propagation.setGlobalPropagator(new W3CTraceContextPropagator())

  const handle: TracingHandle = {
    async shutdown() {
      if (active !== handle) return
      active = undefined
      try {
        await provider.shutdown()
      } finally {
        contextManager.disable()
        trace.disable()
        context.disable()
        propagation.disable()
      }
    },
  }
  active = handle
  return handle
}

export function tracer(name: string): Tracer {
  return trace.getTracer(name)
}

export function currentTraceId(): string | undefined {
  return trace.getActiveSpan()?.spanContext().traceId
}
