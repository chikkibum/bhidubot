import { describe, expect, test } from 'bun:test'
import { EnvError, loadEnv } from './load-env'
import { apiEnvSchema, authEnv } from './schemas'

const valid = {
  APP_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgres://u:p@localhost:5432/bhidubot',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:5173',
}

describe('loadEnv', () => {
  test('reports every missing variable at once', () => {
    const { DATABASE_URL, BETTER_AUTH_SECRET, ...rest } = valid
    try {
      loadEnv(apiEnvSchema, rest)
      throw new Error('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError)
      expect((e as EnvError).missing.sort()).toEqual(['BETTER_AUTH_SECRET', 'DATABASE_URL'])
      expect((e as EnvError).message).toContain('DATABASE_URL')
      expect((e as EnvError).message).toContain('BETTER_AUTH_SECRET')
    }
  })
  test('applies defaults', () => {
    const env = loadEnv(apiEnvSchema, valid)
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.API_PORT).toBe(3001)
    expect(env.SQS_JOBS_QUEUE).toBe('bhidubot-jobs')
  })
  test('parses ALLOWED_SIGNUP_DOMAINS into trimmed lower-case list', () => {
    const env = loadEnv(authEnv, { ...valid, ALLOWED_SIGNUP_DOMAINS: ' Acme.com, x.IO ,' })
    expect(env.ALLOWED_SIGNUP_DOMAINS).toEqual(['acme.com', 'x.io'])
  })
  test('rejects a short auth secret as invalid, not missing', () => {
    try {
      loadEnv(authEnv, { ...valid, BETTER_AUTH_SECRET: 'short' })
      throw new Error('no')
    } catch (e) {
      expect((e as EnvError).invalid).toEqual(['BETTER_AUTH_SECRET'])
    }
  })

  test('treats empty strings as unset', () => {
    const env = loadEnv(apiEnvSchema, { ...valid, AWS_ENDPOINT_URL: '' })
    expect(env.AWS_ENDPOINT_URL).toBeUndefined()
  })
  test('reports an empty required variable as missing, not invalid', () => {
    try {
      loadEnv(apiEnvSchema, { ...valid, DATABASE_URL: '' })
      throw new Error('no')
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError)
      expect((e as EnvError).missing).toEqual(['DATABASE_URL'])
      expect((e as EnvError).invalid).toEqual([])
    }
  })
  test('empty ALLOWED_SIGNUP_DOMAINS yields an empty list', () => {
    const env = loadEnv(authEnv, { ...valid, ALLOWED_SIGNUP_DOMAINS: '' })
    expect(env.ALLOWED_SIGNUP_DOMAINS).toEqual([])
  })
})
