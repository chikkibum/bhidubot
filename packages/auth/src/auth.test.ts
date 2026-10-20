import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { createDb, invitation, organization, resetTestDb, user } from '@bhidubot/db'
import { createMemoryMailer } from '@bhidubot/email'
import { eq, sql } from 'drizzle-orm'
import { getMembership } from './authorize'
import { createAuth } from './create-auth'
import { evaluateSignup } from './signup-policy'

const { db, close } = createDb(process.env.DATABASE_URL_TEST!)
const mailer = createMemoryMailer()
const env = {
  APP_URL: 'http://localhost:5173',
  BETTER_AUTH_SECRET: 's'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:5173',
  ALLOWED_SIGNUP_DOMAINS: ['partner.dev'],
}
const auth = createAuth({ db, mailer, env })
const password = 'correct-horse-9'
const signUp = (email: string) =>
  auth.api.signUpEmail({
    body: { email, password, name: email.split('@')[0]! },
    asResponse: false,
  })

/** Signs up, marks the email verified directly in the DB, signs in, and returns session headers. */
async function verifiedSession(email: string, name: string) {
  await auth.api.signUpEmail({ body: { email, password, name } })
  await db.update(user).set({ emailVerified: true }).where(eq(user.email, email))
  const res = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
  return new Headers({ cookie: res.headers.get('set-cookie')! })
}

async function adminWithTeam() {
  const headers = await verifiedSession('boss@acme.dev', 'Boss')
  const team = await auth.api.createOrganization({ body: { name: 'Acme', slug: 'acme' }, headers })
  mailer.sent.length = 0 // drop the admin's verification email
  return { headers, teamId: team!.id }
}

beforeEach(async () => {
  await resetTestDb(db)
  mailer.sent.length = 0
})
afterAll(() => close())

describe('invite-only sign-up', () => {
  test('first sign-up becomes instance admin', async () => {
    const { user } = await signUp('boss@acme.dev')
    expect(user.isInstanceAdmin).toBe(true)
  })
  test('uninvited sign-up is rejected with the invite-only message', async () => {
    await signUp('boss@acme.dev')
    await expect(signUp('stranger@else.dev')).rejects.toThrow(
      'Sign-up is invite-only. Ask your team admin for an invite.',
    )
  })
  test('invite matches email case-insensitively and sends the accept link', async () => {
    const { headers, teamId } = await adminWithTeam()
    const inv = await auth.api.createInvitation({
      body: { email: ' Ana@Team.DEV ', role: 'member', organizationId: teamId },
      headers,
    })
    expect(mailer.sent[0]?.html).toContain(`http://localhost:5173/accept-invite/${inv.id}`)
    const { user } = await signUp('ana@team.dev')
    expect(user.isInstanceAdmin).toBe(false)
  })
  test('expired or cancelled invitation does not allow sign-up', async () => {
    const { headers, teamId } = await adminWithTeam()
    const inv = await auth.api.createInvitation({
      body: { email: 'late@team.dev', role: 'member', organizationId: teamId },
      headers,
    })
    await auth.api.cancelInvitation({ body: { invitationId: inv.id }, headers })
    await expect(signUp('late@team.dev')).rejects.toThrow('invite-only')
  })
  test('expired invitation does not allow sign-up', async () => {
    const { headers, teamId } = await adminWithTeam()
    const inv = await auth.api.createInvitation({
      body: { email: 'old@team.dev', role: 'member', organizationId: teamId },
      headers,
    })
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await db.update(invitation).set({ expiresAt: yesterday }).where(eq(invitation.id, inv.id))
    await expect(signUp('old@team.dev')).rejects.toThrow('invite-only')
  })
  test('already accepted invitation does not allow sign-up', async () => {
    const { headers, teamId } = await adminWithTeam()
    const inv = await auth.api.createInvitation({
      body: { email: 'done@team.dev', role: 'member', organizationId: teamId },
      headers,
    })
    await db.update(invitation).set({ status: 'accepted' }).where(eq(invitation.id, inv.id))
    await expect(signUp('done@team.dev')).rejects.toThrow(
      'Sign-up is invite-only. Ask your team admin for an invite.',
    )
  })
  test('allowed domain may sign up without an invite', async () => {
    await signUp('boss@acme.dev')
    const { user } = await signUp('someone@partner.dev')
    expect(user.email).toBe('someone@partner.dev')
  })
  test('sign-up email is trimmed and lower-cased', async () => {
    await signUp('boss@acme.dev')
    const { user } = await signUp('  Someone@Partner.DEV ')
    expect(user.email).toBe('someone@partner.dev')
  })
  test('a later sign-up cannot make itself instance admin', async () => {
    await signUp('boss@acme.dev')
    const res = await auth.api.signUpEmail({
      body: {
        email: 'sneaky@partner.dev',
        password,
        name: 'Sneaky',
        isInstanceAdmin: true,
      } as never,
    })
    expect(res.user.isInstanceAdmin).toBe(false)
    const [row] = await db.select().from(user).where(eq(user.email, 'sneaky@partner.dev'))
    expect(row?.isInstanceAdmin).toBe(false)
  })
  test('concurrent first sign-ups yield exactly one admin', async () => {
    const results = await Promise.allSettled([signUp('a@x.dev'), signUp('b@x.dev')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const admins = await db.execute(
      sql`select count(*)::int as n from "user" where is_instance_admin`,
    )
    expect((admins[0] as { n: number }).n).toBe(1)
  })
  test('every loser of a first sign-up race gets the invite-only message', async () => {
    const emails = ['r1@x.dev', 'r2@x.dev', 'r3@x.dev', 'r4@x.dev', 'r5@x.dev']
    const results = await Promise.allSettled(emails.map(signUp))
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rejected).toHaveLength(emails.length - 1)
    for (const r of rejected) expect(String(r.reason?.message)).toContain('invite-only')
  })
})

describe('email verification', () => {
  test('sign-up returns no session and emails a verify link until verified', async () => {
    const res = await signUp('boss@acme.dev')
    expect(res.token).toBeNull()
    expect(res.user.emailVerified).toBe(false)
    await expect(
      auth.api.signInEmail({ body: { email: 'boss@acme.dev', password } }),
    ).rejects.toThrow()

    const mail = mailer.sent.find((m) => m.to === 'boss@acme.dev')
    expect(mail?.subject).toBe('Verify your email for bhidubot')
    const link = mail?.text.match(/http\S+\/api\/auth\/verify-email\?\S+/)?.[0]
    expect(link).toBeDefined()
    const url = new URL(link!)
    expect(url.searchParams.get('callbackURL')).toBe('http://localhost:5173/')

    await auth.api.verifyEmail({ query: { token: url.searchParams.get('token')! } })
    const [row] = await db.select().from(user).where(eq(user.email, 'boss@acme.dev'))
    expect(row?.emailVerified).toBe(true)
  })
})

describe('team creation', () => {
  test('an unverified allowed-domain user cannot create a team', async () => {
    await signUp('boss@acme.dev')
    // Unverified email users cannot sign in with a password, but a session can still exist for an
    // unverified user (e.g. a social account whose provider did not verify the email): simulate it.
    const headers = await verifiedSession('someone@partner.dev', 'Someone')
    await db.update(user).set({ emailVerified: false }).where(eq(user.email, 'someone@partner.dev'))
    await expect(
      auth.api.createOrganization({ body: { name: 'Side', slug: 'side' }, headers }),
    ).rejects.toThrow('not allowed to create a new organization')
  })
  test('a verified allowed-domain user can create a team', async () => {
    await signUp('boss@acme.dev')
    const headers = await verifiedSession('someone@partner.dev', 'Someone')
    const team = await auth.api.createOrganization({
      body: { name: 'Partner', slug: 'partner' },
      headers,
    })
    expect(team?.slug).toBe('partner')
  })
})

describe('evaluateSignup', () => {
  test('matches stored invitation emails ignoring case and surrounding whitespace', async () => {
    const [admin] = await db
      .insert(user)
      .values({ id: 'u-admin', name: 'Admin', email: 'admin@acme.dev', isInstanceAdmin: true })
      .returning()
    await db
      .insert(organization)
      .values({ id: 'org-1', name: 'Acme', slug: 'acme', createdAt: new Date() })
    await db.insert(invitation).values({
      id: 'inv-1',
      organizationId: 'org-1',
      email: ' Ana@Team.DEV ',
      role: 'member',
      status: 'pending',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      inviterId: admin!.id,
    })
    expect(await evaluateSignup(db, 'ANA@team.dev', [])).toEqual({
      allowed: true,
      isInstanceAdmin: false,
    })
    expect(await evaluateSignup(db, 'bob@team.dev', [])).toEqual({ allowed: false })
  })
})

describe('getMembership', () => {
  test('returns role for members and null for non-members', async () => {
    const { teamId } = await adminWithTeam()
    const boss = await db.query.user.findFirst()
    expect(await getMembership(db, boss!.id, teamId)).toEqual({ role: 'owner' })
    expect(await getMembership(db, 'nobody', teamId)).toBeNull()
  })
})
