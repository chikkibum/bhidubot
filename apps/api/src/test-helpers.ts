import { DeleteQueueCommand } from '@aws-sdk/client-sqs'
import { createAuth } from '@bhidubot/auth'
import { apiEnvSchema, loadEnv } from '@bhidubot/config'
import { createDb, member, resetTestDb, user } from '@bhidubot/db'
import { createMemoryMailer } from '@bhidubot/email'
import { createLogger, initTracing } from '@bhidubot/observability'
import { createQueue, createSqsClient, ensureQueues } from '@bhidubot/queue'
import { and, eq } from 'drizzle-orm'
import { createApp } from './app'
import type { AppDeps } from './deps'

const PASSWORD = 'correct-horse-9'
const APP_URL = 'http://localhost:5173'

/**
 * Builds the api against `bhidubot_test` (DATABASE_URL_TEST) and a uniquely named Floci queue pair,
 * with an in-memory mailer and a silent logger. Requests go through `app.handle`, no port is bound.
 * Shared with apps/worker's e2e test via `@bhidubot/api/testing`.
 */
export async function makeTestApp() {
  initTracing({ serviceName: 'api-test' })
  const id = runId()
  const env = loadEnv(apiEnvSchema, {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    APP_URL,
    DATABASE_URL:
      process.env.DATABASE_URL_TEST ?? 'postgres://bhidubot:bhidubot@localhost:5432/bhidubot_test',
    AWS_ENDPOINT_URL: process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test',
    AWS_SECRET_ACCESS_KEY: 'test',
    SQS_JOBS_QUEUE: `api-test-${id}`,
    SQS_JOBS_DLQ: `api-test-${id}-dlq`,
    BETTER_AUTH_SECRET: 's'.repeat(32),
    BETTER_AUTH_URL: APP_URL,
  })

  const { db, close: closeDb } = createDb(env.DATABASE_URL)
  const mailer = createMemoryMailer()
  const auth = createAuth({ db, mailer, env })
  const sqs = createSqsClient(env)
  const { queueUrl, dlqUrl } = await ensureQueues(sqs, {
    queue: env.SQS_JOBS_QUEUE,
    dlq: env.SQS_JOBS_DLQ,
  })
  const deps: AppDeps = {
    db,
    auth,
    queue: createQueue(sqs, queueUrl),
    sqs,
    queueUrl,
    logger: createLogger('api-test', 'silent'),
    env,
  }
  const app = createApp(deps)

  const authRequest = (path: string, body: unknown) =>
    app.handle(
      new Request(`http://localhost/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: APP_URL },
        body: JSON.stringify(body),
      }),
    )

  /**
   * Signs up through the mounted Better Auth routes, marks the email verified directly in the DB
   * (sign-up requires verification and returns no session), signs in and returns a `cookie` header.
   */
  async function signUpAndCookie(email: string, name = email.split('@')[0] ?? email) {
    const signUp = await authRequest('/sign-up/email', { email, password: PASSWORD, name })
    if (!signUp.ok)
      throw new Error(`sign-up ${email} failed: ${signUp.status} ${await signUp.text()}`)
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, email))
    const signIn = await authRequest('/sign-in/email', { email, password: PASSWORD })
    if (!signIn.ok)
      throw new Error(`sign-in ${email} failed: ${signIn.status} ${await signIn.text()}`)
    return toCookieHeader(signIn.headers.getSetCookie())
  }

  /**
   * boss@acme.dev creates team "Acme" (made active), invites ana@acme.dev, who signs up, accepts and
   * makes it her active team. `memberId` is Ana's `member` row id.
   */
  async function teamWithMember() {
    const ownerCookie = await signUpAndCookie('boss@acme.dev', 'Boss')
    const owner = new Headers({ cookie: ownerCookie })
    const team = await auth.api.createOrganization({
      body: { name: 'Acme', slug: 'acme' },
      headers: owner,
    })
    if (!team) throw new Error('team creation failed')
    const invite = await auth.api.createInvitation({
      body: { email: 'ana@acme.dev', role: 'member', organizationId: team.id },
      headers: owner,
    })

    const memberCookie = await signUpAndCookie('ana@acme.dev', 'Ana')
    const ana = new Headers({ cookie: memberCookie })
    await auth.api.acceptInvitation({ body: { invitationId: invite.id }, headers: ana })
    await auth.api.setActiveOrganization({ body: { organizationId: team.id }, headers: ana })

    const [anaUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, 'ana@acme.dev'))
    const [row] = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, team.id), eq(member.userId, anaUser?.id ?? '')))
    if (!row) throw new Error('membership missing after accepting the invitation')
    return { ownerCookie, memberCookie, teamId: team.id, memberId: row.id }
  }

  async function resetAll() {
    await resetTestDb(db)
    mailer.sent.length = 0
  }

  /** Deletes this run's queues and closes the DB pool. */
  async function close() {
    await Promise.allSettled([
      sqs.send(new DeleteQueueCommand({ QueueUrl: queueUrl })),
      sqs.send(new DeleteQueueCommand({ QueueUrl: dlqUrl })),
    ])
    await closeDb()
  }

  return {
    app,
    deps,
    db,
    auth,
    mailer,
    sqs,
    queueUrl,
    signUpAndCookie,
    teamWithMember,
    resetAll,
    close,
  }
}

export type TestApp = Awaited<ReturnType<typeof makeTestApp>>

let counter = 0
function runId(): string {
  counter += 1
  return `${Date.now()}-${process.pid}-${counter}`
}

/** `Set-Cookie` values → a request `Cookie` header (`name=value; name2=value2`). */
function toCookieHeader(setCookies: string[]): string {
  const pairs = setCookies.map((c) => c.split(';', 1)[0]).filter(Boolean)
  if (pairs.length === 0) throw new Error('sign-in returned no cookies')
  return pairs.join('; ')
}
