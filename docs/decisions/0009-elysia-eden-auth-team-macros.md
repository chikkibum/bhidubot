# 0009. Elysia + Eden Treaty; auth and team macros as the only identity source

## Status

Accepted

## Context

`apps/api` is the system's identity boundary. meeting-bot69 took user ids from request bodies (D1) and repeated
ownership checks route by route, forgetting some (D15); spec §5 makes "identity only from a verified session" and
"authorization in one shared helper" requirements. The web app (Task 12) should call the API with end-to-end types
and no hand-written client.

## Decision

The API is an Elysia app built by `createApp(deps)`; `type App = ReturnType<typeof createApp>` is exported from
`@bhidubot/api` (`./app`), and the web app uses Eden Treaty (`@elysia/eden`) against it.

Identity comes only from two macros:

- `auth: true` (`plugins/auth.ts`) resolves `{ user, session }` from the Better Auth session cookie, or answers
  401 `{ error: 'unauthorized' }`. The same plugin serves Better Auth at `/api/auth/*`, forwarding the unparsed
  request with its full path (Better Auth's `basePath` is `/api/auth`).
- `team: true` (`plugins/team.ts`, implies `auth`) takes the team from `session.activeOrganizationId` and checks
  membership with `getMembership` on every request; it resolves `{ team: { id, role } }`. No active team → 409
  `{ error: 'no_active_team' }`; not a member (including a member removed after the session started) → 404
  `{ error: 'team_not_found' }`.

Routes never read a user or team id from body, query or params. Team-scoped routes use `team: true` and the
resolved `team.id`.

The `@elysia/opentelemetry` plugin wraps every request in a server span on the tracer provider registered by
`packages/observability` (`createApp` calls the idempotent `initTracing` first, so the plugin never starts its own
SDK). Unexpected errors are logged and answered with 500 `{ error: 'internal_error' }`, without the error text.

## Why

End-to-end types with no client code; meeting-bot69 D1 and D15.

## Pros

- One place enforces authentication and team membership; a route opts in with one flag.
- 404 rather than 403 for non-members avoids confirming that a team id exists.
- Membership is re-read per request, so removal takes effect immediately, not at session expiry.

## Cons

- Eden type inference slows the TypeScript server on very large APIs.
- It ties the web app to the api's types (a shared monorepo makes that acceptable).
- One extra membership query per team-scoped request.
- Elysia validates the body before macros resolve, so an unauthenticated request with an invalid body gets 422
  (revealing the body schema) rather than 401. No identity or data is exposed.

## Alternatives considered

- Hono + RPC client.
- tRPC.
- OpenAPI with generated clients.

## Consequences / follow-ups

- Every new team-scoped route must use `team: true`; data queries filter by the resolved `team.id`.
- Development-only routes (`POST /api/dev/ping`) are registered only when `NODE_ENV !== 'production'`. `App`'s type
  always includes them so Eden sees one shape; in production they 404.
- The Elysia packages moved from the `@elysiajs/*` scope to `@elysia/*`; we use `@elysia/opentelemetry`,
  `@elysia/cors` and (web) `@elysia/eden`.
