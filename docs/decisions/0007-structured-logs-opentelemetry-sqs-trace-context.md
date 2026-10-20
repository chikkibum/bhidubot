# 0007. Structured logs + OpenTelemetry; trace context travels in SQS message attributes

## Status

Accepted

## Context

The meeting pipeline is asynchronous: a webhook hits the API, a job goes onto SQS, and a worker processes it and
eventually sends an email. Debugging needs one trace from webhook to email (spec section 6.6).

## Decision

`packages/observability` provides a pino JSON logger (`createLogger(service)`), OpenTelemetry tracing
(`initTracing`, `tracer`, `currentTraceId`) and propagation helpers. The tracer provider uses a batch OTLP HTTP
exporter when an endpoint is configured (Jaeger on localhost:4318 under the compose `tracing` profile) and no
exporter otherwise. The W3C trace-context propagator and an AsyncLocalStorage context manager are registered
globally. The queue producer calls `injectTraceContext()` and stores the result in SQS message attributes; the
consumer calls `withExtractedContext()` so its spans continue the same trace. `initTracing` is idempotent per
process; `shutdown()` unregisters the globals.

## Why

One trace must follow a job across the API and worker processes.

## Pros

- Vendor-neutral; Jaeger locally, any OTLP backend in production.

## Cons

- Instrumentation code to maintain; Bun's OpenTelemetry auto-instrumentation is limited, so spans are manual.

## Alternatives considered

- Logs only: cannot follow a job across processes.
- Sentry: one vendor; can be added later alongside this.

## Consequences / follow-ups

- Tasks 8-10 call `injectTraceContext`, `withExtractedContext`, `createLogger` and `initTracing`.
- Uses the OpenTelemetry JS 3.x line (`@opentelemetry/sdk-trace`, exporter 0.300).
