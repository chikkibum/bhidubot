# 0003. Docker Compose for infrastructure, apps on the host; Floci for S3/SQS

## Status

Accepted

## Context

Local development needs Postgres (with pgvector), S3, SQS and an SMTP sink. The apps (web, api, worker) need
hot reload, and the same AWS SDK code should run locally and in production without an AWS account.

## Decision

`docker-compose.yml` runs only infrastructure; the apps run on the host with Bun. Pinned images:

- `pgvector/pgvector:pg17` (Postgres 17; creates `bhidubot`, plus `bhidubot_test` and `bhidubot_e2e` via init SQL)
- `floci/floci:2.3.0` (S3/SQS emulator on 4566, hybrid storage persisted to the `floci-data` volume)
- `axllent/mailpit:v1.32.0` (SMTP 1025, UI 8025)
- Optional profiles: `tracing` (`jaegertracing/jaeger:2.22.0`), `tunnel` (`cloudflare/cloudflared`),
  `ollama` (`ollama/ollama`, Linux/NVIDIA only; on Windows Ollama runs natively).

Floci's image has no curl, so its healthcheck uses bash `/dev/tcp` against `/_localstack/health`.

## Why

Hot reload for the apps; production parity for the AWS APIs; no AWS account needed locally.

## Pros

- About 100 MB of RAM for all of AWS; the same SDK code runs against real AWS.
- Mailpit means no real email is sent.

## Cons

- Floci is young, so parity gaps are possible (spec section 14 lists what to check).
- Apps on the host differ slightly from production containers (Plan 5 closes that gap).
- `cloudflared` and `ollama` are unpinned (`latest`) because they are optional, non-default tooling.

## Alternatives considered

- LocalStack: the community edition now needs an auth token.
- MinIO + ElasticMQ: two tools, and not AWS-identical.
- A Postgres-backed queue (pg-boss): fewer moving parts, but no AWS parity, and the user chose Floci.

## Consequences / follow-ups

- Init SQL only runs on first volume creation; use `docker compose down -v` to re-run it.
- Init SQL must keep LF endings (enforced by `.gitattributes`).
