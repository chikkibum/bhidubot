# 0011. Dedicated worker process, `job_runs` bookkeeping, fail-fast dependency checks

## Status

Accepted

## Context

Meeting processing and calendar sync are long-running and must survive restarts. Failures must be visible, not
silently lost (meeting-bot69 D7 and D8).

## Decision

- A dedicated long-running process, `apps/worker`, consumes the SQS jobs queue via `startConsumer` and dispatches by
  job type through a typed `Handlers` map. Unknown types throw `unknown_job_type: <type>`, so SQS retries and then
  dead-letters them.
- `runJob` upserts a `job_runs` row keyed on the SQS message id (`running` → `succeeded` | `failed` with
  `last_error`, plus attempt and trace id). The upsert makes redelivery (at-least-once) idempotent. Handler errors
  are recorded, marked on the active span (`recordException`, status ERROR) and rethrown so the message is not deleted.
- `assertDependencies` (Postgres `select 1`, SQS queue attributes), each bounded by a timeout (default 5s) and
  raising `DependencyError` naming the dependency. Both the API and the worker call it at startup and exit 1 on failure.
  It lives in `@bhidubot/queue` (with `getQueueUrl`) so the API does not depend on the worker app.
- On SIGINT/SIGTERM the worker aborts the consumer, lets the in-flight job finish, closes the DB, flushes tracing
  and exits 0.

## Why

No serverless timeouts, and failures are visible in `job_runs` and in traces.

## Pros

- Simple to run, debug and scale horizontally.

## Cons

- One more process to deploy.
- Scheduler ticks need leader election (Plan 3: advisory lock).
- `@bhidubot/queue` now depends on `@bhidubot/db` for the Postgres check.

## Alternatives considered

- Processing inside the API with `after()` (loses work on restart).
- Lambda consumers (cold starts and a split codebase, as in meeting-bot69).

## Consequences / follow-ups

- Plans 2-3 add real job types by extending `JobMap` and `Handlers`.
