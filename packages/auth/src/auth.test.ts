import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { createDb, invitation, resetTestDb } from '@bhidubot/db'
import { createMemoryMailer } from '@bhidubot/email'
import { eq, sql } from 'drizzle-orm'
import { getMembership } from './authorize'
import { createAuth } from './create-auth'

const { db, close } = createDb(process.env.DATABASE_URL_TEST!)
const mailer = createMemoryMailer()
const env = {
  APP_URL: 'http://localhost:5173',
  BETTER_AUTH_SECRET: 's'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:5173',
  ALLOWED_SIGNUP_DOMAINS: ['partner.dev'],
}
const auth = createAuth({ db, mailer, env })
const signUp = (email: string) =>
  auth.api.signUpEmail({
    body: { email, password: 'correct-horse-9', name: email.split('@')[0]! },
    asResponse: false,
  })

async function adminWithTeam() {
  const res = await auth.api.signUpEmail({
    body: { email: 'boss@acme.dev', password: 'correct-horse-9', name: 'Boss' },
    returnHeaders: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie')! })
  const team = await auth.api.createOrganization({ body: { name: 'Acme', slug: 'acme' }, headers })
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
  test('allowed domain may sign up without an invite', async () => {
    await signUp('boss@acme.dev')
    const { user } = await signUp('someone@partner.dev')
    expect(user.email).toBe('someone@partner.dev')
  })
  test('concurrent first sign-ups yield exactly one admin', async () => {
    const results = await Promise.allSettled([signUp('a@x.dev'), signUp('b@x.dev')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const admins = await db.execute(
      sql`select count(*)::int as n from "user" where is_instance_admin`,
    )
    expect((admins[0] as { n: number }).n).toBe(1)
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
