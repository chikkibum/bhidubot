import type { Auth } from '@bhidubot/auth'
import { Elysia } from 'elysia'

/**
 * Serves Better Auth under `/api/auth/*` and provides the `auth: true` macro, which resolves
 * `{ user, session }` from the session cookie or answers 401 `{ error: 'unauthorized' }`.
 *
 * Better Auth's basePath is `/api/auth`, so it needs the full, unstripped URL: the route forwards the
 * raw request (`parse: 'none'` leaves the body unread) instead of `.mount('/api/auth', …)`, which would
 * strip the prefix, or `.mount(handler)`, which would claim every unmatched path in the app.
 */
export function authPlugin(auth: Auth) {
  return new Elysia({ name: 'auth' })
    .all('/api/auth/*', ({ request }) => auth.handler(request), { parse: 'none' })
    .macro('auth', {
      async resolve({ status, request: { headers } }) {
        const result = await auth.api.getSession({ headers })
        if (!result) return status(401, { error: 'unauthorized' as const })
        return { user: result.user, session: result.session }
      },
    })
}
