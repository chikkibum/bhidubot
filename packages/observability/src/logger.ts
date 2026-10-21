import pino from 'pino'
import { currentTraceId } from './tracing'

export type Logger = pino.Logger

/**
 * JSON logger tagged with `service`. While a span is active every line also carries `trace_id`, so
 * logs can be joined to traces; outside a span the field is omitted. `destination` defaults to
 * stdout (tests pass a stream to capture output).
 */
export function createLogger(
  service: string,
  level = 'info',
  destination?: pino.DestinationStream,
): Logger {
  const options: pino.LoggerOptions = {
    level,
    base: { service },
    mixin() {
      const traceId = currentTraceId()
      return traceId ? { trace_id: traceId } : {}
    },
  }
  return destination ? pino(options, destination) : pino(options)
}
