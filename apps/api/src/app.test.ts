import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { createApp } from './app'
import { makeTestApp } from './test-helpers'

const t = await makeTestApp()
beforeEach(() => t.resetAll())
afterAll(() => t.close())
const get = (path: string, cookie?: string) =>
  t.app.handle(new Request(`http://localhost${path}`, { headers: cookie ? { cookie } : {} }))
const ping = (cookie?: string, app = t.app) =>
  app.handle(
    new Request('http://localhost/api/dev/ping', {
      method: 'POST',
      headers: { ...(cookie ? { cookie } : {}), 'content-type': 'application/json' },
      body: JSON.stringify({ note: 'hi' }),
    }),
  )

describe('api', () => {
  test('health reports db and queue up', async () => {
    const res = await get('/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, db: 'up', queue: 'up' })
  })
  test('/api/me requires a session', async () => {
    expect((await get('/api/me')).status).toBe(401)
  })
  test('/api/me returns the signed-in instance admin', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const body = await (await get('/api/me', cookie)).json()
    expect(body).toMatchObject({
      email: 'boss@acme.dev',
      isInstanceAdmin: true,
      activeTeamId: null,
    })
  })
  test('team route needs an active team', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const res = await get('/api/teams/current', cookie)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'no_active_team' })
  })
  test('removed member gets 404 on team route', async () => {
    const { ownerCookie, memberCookie, teamId, memberId } = await t.teamWithMember()
    expect((await get('/api/teams/current', memberCookie)).status).toBe(200)
    await t.auth.api.removeMember({
      body: { memberIdOrEmail: memberId, organizationId: teamId },
      headers: new Headers({ cookie: ownerCookie }),
    })
    const res = await get('/api/teams/current', memberCookie)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'team_not_found' })
  })
  test('dev ping enqueues a job carrying the trace id', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const res = await t.app.handle(
      new Request('http://localhost/api/dev/ping', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'hi' }),
      }),
    )
    expect(res.status).toBe(202)
    const { jobId } = await res.json()
    expect(typeof jobId).toBe('string')
  })
})

describe('api edges', () => {
  test('unauthorized body is { error: unauthorized }', async () => {
    const res = await get('/api/teams/current')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })
  test('team route returns the active team with the caller role', async () => {
    const { ownerCookie, teamId } = await t.teamWithMember()
    const res = await get('/api/teams/current', ownerCookie)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: teamId, name: 'Acme', role: 'owner' })
  })
  test('health is 503 when the queue is unreachable', async () => {
    const app = createApp({ ...t.deps, queueUrl: `${t.queueUrl}-missing` })
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, db: 'up', queue: 'down' })
  })
  test('dev ping returns the request trace id', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const res = await ping(cookie)
    expect(res.status).toBe(202)
    expect((await res.json()).traceId).toMatch(/^[0-9a-f]{32}$/)
  })
  test('dev ping requires a session', async () => {
    expect((await ping()).status).toBe(401)
  })
  test('CORS admits only APP_URL, with credentials', async () => {
    const preflight = (origin: string) =>
      t.app.handle(
        new Request('http://localhost/api/me', {
          method: 'OPTIONS',
          headers: { origin, 'access-control-request-method': 'GET' },
        }),
      )
    const ok = await preflight('http://localhost:5173')
    expect(ok.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(ok.headers.get('access-control-allow-credentials')).toBe('true')
    const evil = await preflight('https://evil.example')
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
  })
  test('dev ping is not registered in production', async () => {
    const cookie = await t.signUpAndCookie('boss@acme.dev')
    const prod = createApp({ ...t.deps, env: { ...t.deps.env, NODE_ENV: 'production' } })
    expect((await ping(cookie, prod)).status).toBe(404)
  })
})
