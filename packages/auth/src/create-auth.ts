import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { type Db, schema } from '@bhidubot/db'
import { type Mailer, renderInvitationEmail } from '@bhidubot/email'
import { betterAuth } from 'better-auth'
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

export function createAuth({ db, mailer, env }: AuthDeps) {
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : {}

  return betterAuth({
    basePath: '/api/auth',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: { enabled: true },
    socialProviders: google,
    user: {
      additionalFields: {
        isInstanceAdmin: { type: 'boolean', defaultValue: false, input: false },
      },
    },
    hooks: {
      // Better Auth lower-cases invitation emails but rejects surrounding whitespace; trim first.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/organization/invite-member' && typeof ctx.body?.email === 'string') {
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
            if (!decision.allowed) {
              throw new APIError('FORBIDDEN', { message: NOT_INVITED_MESSAGE, code: 'NOT_INVITED' })
            }
            return { data: { ...user, isInstanceAdmin: decision.isInstanceAdmin } }
          },
        },
      },
    },
    plugins: [
      organization({
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
