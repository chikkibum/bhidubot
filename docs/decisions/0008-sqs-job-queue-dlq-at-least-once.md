# 0008. SQS job queue with DLQ; at-least-once delivery; idempotent handlers

## Status

Accepted

## Context

The meeting pipeline needs background jobs with retries and a place to inspect failures (spec section 6.3). The
local stack already runs Floci, which emulates SQS and S3 with AWS parity.

## Decision

`packages/queue` wraps SQS: `ensureQueues` creates a main queue and a DLQ with a `RedrivePolicy` (default
`maxReceiveCount` 5, visibility timeout 300s); `createQueue(...).enqueue` sends `{ type, payload }` with trace
context in message attributes; `startConsumer` long-polls one message at a time, runs it inside the extracted trace
context, deletes it on success and leaves it for redelivery on error. `attempt` comes from
`ApproximateReceiveCount`. The loop backs off for 1s on receive errors, and aborting the signal cancels an in-flight
long poll. `packages/storage` provides the S3 client (`forcePathStyle` when a custom endpoint is set) and an
idempotent `ensureBucket`. `bun run infra:bootstrap` (workspace `scripts/`) creates the bucket and queues from the
worker env.

## Why

Retries and a DLQ without new infrastructure, plus AWS parity through Floci.

## Pros

- Durable; visibility-timeout retries; a DLQ for inspection.

## Cons

- At-least-once delivery: every handler must be idempotent.
- SQS caps visibility timeout at 12 hours (default here 300s), so long jobs must extend visibility.
- No built-in scheduling (the worker has interval ticks, in Plan 3).

## Alternatives considered

- pg-boss: Postgres-only and simpler, but no AWS parity.
- BullMQ: needs Redis.
- Inngest: hosted.

## Consequences / follow-ups

- Handlers must be idempotent; the job id (SQS `MessageId`) and `attempt` are available in `JobContext`.
- Floci 2.3.0 implements redrive: the DLQ integration test passes, so `FLOCI_NO_REDRIVE` skip is available but not
  needed. No spec section 14 entry required.
- Floci returns queue URLs as `http://localhost:4566/000000000000/<name>`, which work from the host. If a deployment
  returns a different host, resolve against `AWS_ENDPOINT_URL`.
- Later plans extend `JobMap` via declaration merging.
