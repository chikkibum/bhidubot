import { Elysia, t } from 'elysia'
import type { AppDeps } from '../deps'
import type { authPlugin } from '../plugins/auth'

/**
 * Development-only routes; `createApp` registers them only when `NODE_ENV !== 'production'`.
 * `POST /api/dev/ping` (auth) enqueues a `system.ping` job inside the request span, so the job
 * carries the request's trace id end to end.
 */
export function devRoutes({ queue }: AppDeps, auth: ReturnType<typeof authPlugin>) {
  return new Elysia()
    .use(auth)
    .post(
      '/api/dev/ping',
      async ({ body, status }) =>
        status(202, await queue.enqueue('system.ping', { note: body.note })),
      { auth: true, body: t.Object({ note: t.String({ maxLength: 500 }) }) },
    )
}
