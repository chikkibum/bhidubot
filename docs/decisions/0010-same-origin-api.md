# 0010. Same-origin `/api`

## Status

Accepted

## Context

The web SPA and the API need to share the Better Auth session cookie. Cross-origin cookies need `SameSite=None`,
CORS with credentials, and are increasingly blocked by browsers as third-party cookies.

## Decision

The API is served under `/api` on the web app's origin: the Vite dev server proxies `/api` → `localhost:3001` in
development, and Caddy routes `/api` to the API in production. `BETTER_AUTH_URL` is the web origin
(`APP_URL`), and Better Auth lives at `/api/auth`. `/health` is not under `/api`; it is for probes, not the browser.

The API still enables CORS, but only for `APP_URL` with credentials (no wildcard origin, explicit methods, only the
`content-type` request header), as a fallback for tools that call the API port directly.

## Why

Cookies are first-party, so there's no cross-site cookie configuration and no CORS on the normal path.

## Pros

- First-party, `SameSite=Lax` session cookies.
- No preflight requests in the normal path.
- One public origin to deploy and secure.

## Cons

- The API isn't on its own subdomain.
- Development needs the proxy; opening the API port in a browser is a different origin.

## Alternatives considered

- `api.` subdomain with CORS and a parent-domain cookie.
- Bearer tokens in `localStorage` (exposed to XSS).

## Consequences / follow-ups

- Task 12 configures the Vite proxy; Plan 5's Caddyfile routes `/api/*` to the API.
