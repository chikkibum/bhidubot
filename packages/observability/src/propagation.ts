import { context, propagation } from '@opentelemetry/api'

/** Serialises the active trace context into a carrier (`traceparent`, optional `tracestate`). */
export function injectTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {}
  propagation.inject(context.active(), carrier)
  return carrier
}

/** Runs `fn` with the trace context found in `carrier` as the active context. */
export function withExtractedContext<T>(
  carrier: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> {
  return context.with(propagation.extract(context.active(), carrier), fn)
}
