import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { type Db, schema } from '@bhidubot/db'
import { type Mailer, renderInvitationEmail, renderVerificationEmail } from '@bhidubot/email'
import { betterAuth, type DBAdapter, type DBTransactionAdapter } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { organization } from 'better-auth/plugins'
import { evaluateSignup } from './signup-policy'

export interface AuthDeps {
  db: Db
  mailer: Mailer
  env: {
    APP_URL: string
    BETTER_AUTH_SECRET: string
    BETTER_AUTH_URL: string
    ALLOWED_SIGNUP_DOMAINS: string[]
    GOOGLE_CLIENT_ID?: string
    GOOGLE_CLIENT_SECRET?: string
  }
}

export const NOT_INVITED_MESSAGE = 'Sign-up is invite-only. Ask your team admin for an invite.'

/**
 * The invite-only rejection. Status is 400, not 403: with `requireEmailVerification` on, Better
 * Auth's sign-up turns any 403 thrown during user creation into a fake "check your email" success,
 * which would hide this message from the user.
 */
const notInvited = () =>
  new APIError('BAD_REQUEST', { message: NOT_INVITED_MESSAGE, code: 'NOT_INVITED' })

/** Paths whose body `email` is trimmed before Better Auth validates it. */
const TRIM_EMAIL_PATHS = new Set(['/sign-up/email', '/organization/invite-member'])

export function createAuth({ db, mailer, env }: AuthDeps) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}
  const baseAdapter = drizzleAdapter(db, { provider: 'pg', schema })

  return betterAuth({
    basePath: '/api/auth',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: (options) => mapAdminRaceToNotInvited(baseAdapter(options)),
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      async sendVerificationEmail({ user, url }) {
        const verifyUrl = withAppCallback(url, env.APP_URL)
        await mailer.send({
          to: user.email,
          ...renderVerificationEmail({ name: user.name, verifyUrl }),
        })
      },
    },
    socialProviders: google,
    user: {
      additionalFields: {
        isInstanceAdmin: { type: 'boolean', defaultValue: false, input: false },
      },
    },
    hooks: {
      // Better Auth lower-cases these emails but rejects surrounding whitespace; trim first.
      before: createAuthMiddleware(async (ctx) => {
        if (TRIM_EMAIL_PATHS.has(ctx.path) && typeof ctx.body?.email === 'string') {
          return { context: { body: { ...ctx.body, email: ctx.body.email.trim() } } }
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          // Runs for every user-creation path (email+password and social sign-in).
          before: async (user) => {
            const decision = await evaluateSignup(db, user.email, env.ALLOWED_SIGNUP_DOMAINS)
            if (!decision.allowed) throw notInvited()
            return { data: { ...user, isInstanceAdmin: decision.isInstanceAdmin } }
          },
        },
      },
    },
    plugins: [
      organization({
        allowUserToCreateOrganization: (user) => user.emailVerified === true,
        requireEmailVerificationOnInvitation: true,
        async sendInvitationEmail(data) {
          const message = renderInvitationEmail({
            inviterName: data.inviter.user.name,
            teamName: data.organization.name,
            acceptUrl: `${env.APP_URL}/accept-invite/${data.invitation.id}`,
          })
          await mailer.send({ to: data.email, ...message })
        },
      }),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>

/**
 * Better Auth builds verify links with a relative `callbackURL` (default `/`), which would resolve
 * against BETTER_AUTH_URL. Resolve relative callbacks against APP_URL so users land in the web app.
 */
function withAppCallback(verifyUrl: string, appUrl: string): string {
  const url = new URL(verifyUrl)
  const callback = url.searchParams.get('callbackURL') ?? '/'
  if (callback.startsWith('/') && !callback.startsWith('//')) {
    url.searchParams.set('callbackURL', new URL(callback, appUrl).toString())
  }
  return url.toString()
}

/**
 * Two concurrent "first" sign-ups both pass the policy as instance admin; the `one_instance_admin`
 * partial unique index rejects the second insert. Surface that as the invite-only rejection rather
 * than Better Auth's generic "Failed to create user".
 */
function mapAdminRaceToNotInvited(adapter: DBAdapter): DBAdapter {
  return {
    ...withMappedCreate(adapter),
    transaction: (cb) => adapter.transaction((trx) => cb(withMappedCreate(trx))),
  }
}

function withMappedCreate<A extends DBTransactionAdapter>(adapter: A): A {
  const create: A['create'] = async (args) => {
    try {
      return await adapter.create(args)
    } catch (error) {
      if (isOneInstanceAdminViolation(error)) throw notInvited()
      throw error
    }
  }
  return { ...adapter, create }
}

function isOneInstanceAdminViolation(error: unknown): boolean {
  for (let e: unknown = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const pg = e as { code?: unknown; constraint_name?: unknown }
    if (pg.code === '23505' && pg.constraint_name === 'one_instance_admin') return true
  }
  return false
}
