# 0002. Validated environment config with zod

## Status

Accepted

## Context

The API and worker read many environment variables (database, AWS, auth, SMTP, telemetry). Reading
`process.env` ad hoc means a missing or malformed value surfaces late, for example at the first webhook,
instead of at boot (meeting-bot69 D18).

## Decision

`@bhidubot/config` defines zod schema fragments per concern (`appEnv`, `dbEnv`, `awsEnv`, `authEnv`,
`smtpEnv`, `otelEnv`) and composes them into `apiEnvSchema` and `workerEnvSchema`. `loadEnv(schema)`
validates `process.env` once at startup and throws an `EnvError` listing every missing and invalid variable.

## Why

Fail at boot rather than at the first webhook.

## Pros

- One documented list of variables (`.env.example`), and typed access.
- All problems are reported at once, not one per restart.

## Cons

- The schema has to be updated whenever a variable is added.

## Alternatives considered

- t3-env: an extra dependency, oriented to the web side.
- Reading `process.env` ad hoc (the meeting-bot69 approach).

## Consequences / follow-ups

- Apps call `loadEnv` once at startup and pass the typed result down.
- Empty strings are treated as unset, so `FOO=` in a `.env` file behaves like an absent variable.
