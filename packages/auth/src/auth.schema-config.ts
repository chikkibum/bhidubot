/**
 * Schema-generation entry for the Better Auth CLI only; not exported from the package.
 * Builds `createAuth` with throwaway deps so the CLI sees the full plugin/field configuration:
 *   bun run auth:generate   (from packages/auth)
 * postgres.js connects lazily, so the placeholder URL is never dialled.
 */
import { createDb } from '@bhidubot/db'
import { createMemoryMailer } from '@bhidubot/email'
import { createAuth } from './create-auth'

export const auth = createAuth({
  db: createDb('postgres://schema-generation@localhost:5432/unused').db,
  mailer: createMemoryMailer(),
  env: {
    APP_URL: 'http://localhost:5173',
    BETTER_AUTH_SECRET: 'schema-generation-only-secret-000000',
    BETTER_AUTH_URL: 'http://localhost:5173',
    ALLOWED_SIGNUP_DOMAINS: [],
  },
})
