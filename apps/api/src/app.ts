import { initTracing } from '@bhidubot/observability'
import { cors } from '@elysia/cors'
import { opentelemetry } from '@elysia/opentelemetry'
import { Elysia } from 'elysia'
import type { AppDeps } from './deps'
import { authPlugin } from './plugins/auth'
import { teamPlugin } from './plugins/team'
import { devRoutes } from './routes/dev'
import { healthRoutes } from './routes/health'
import { meRoutes } from './routes/me'

export type { AppDeps } from './deps'

type DevRoutes = ReturnType<typeof devRoutes>

export function createApp(deps: AppDeps) {
  const { auth, db, env, logger } = deps
  // The Elysia plugin starts its own NodeSDK when no tracer provider is registered. Register ours
  // first (a no-op when main.ts already did) so every span goes through packages/observability.
  initTracing({ serviceName: 'api', otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT })

  const authP = authPlugin(auth)
  const teamP = teamPlugin(db, authP)
  // Production never registers the dev routes. The cast keeps `App` a single type (dev routes
  // included) so Eden Treaty sees one shape; in production those calls simply 404.
  const dev = env.NODE_ENV === 'production' ? new Elysia() : devRoutes(deps, authP)

  return (
    new Elysia()
      .use(opentelemetry({ serviceName: 'api' }))
      // Same-origin in dev (Vite proxy) and prod (Caddy); CORS only admits the web app's origin.
      .use(
        cors({
          origin: env.APP_URL,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          allowedHeaders: ['content-type'],
          exposeHeaders: [],
        }),
      )
      .onError(({ code, error, request }) => {
        if (code !== 'UNKNOWN' && code !== 'INTERNAL_SERVER_ERROR') return
        logger.error({ err: error, method: request.method, url: request.url }, 'request failed')
        return Response.json({ error: 'internal_error' }, { status: 500 })
      })
      .use(healthRoutes(deps))
      .use(meRoutes(db, teamP))
      .use(dev as DevRoutes)
  )
}

export type App = ReturnType<typeof createApp>
