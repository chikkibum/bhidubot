import { expect, test } from 'bun:test'
import { renderVerificationEmail } from './verification'

test('verification email contains the verify link, escapes HTML and has a fixed subject', () => {
  const m = renderVerificationEmail({
    name: '<b>Ana</b>',
    verifyUrl: 'http://localhost:5173/api/auth/verify-email?token=abc&callbackURL=%2F',
  })
  expect(m.subject).toBe('Verify your email for bhidubot')
  expect(m.html).toContain(
    'href="http://localhost:5173/api/auth/verify-email?token=abc&amp;callbackURL=%2F"',
  )
  expect(m.html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
  expect(m.html).not.toContain('<b>Ana')
  expect(m.text).toContain('http://localhost:5173/api/auth/verify-email?token=abc&callbackURL=%2F')
})
