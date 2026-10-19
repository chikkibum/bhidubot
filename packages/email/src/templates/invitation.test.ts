import { expect, test } from 'bun:test'
import { renderInvitationEmail } from './invitation'

test('invitation contains accept link and team, and escapes HTML', () => {
  const m = renderInvitationEmail({
    inviterName: 'Bhaskar',
    teamName: '<script>x</script>',
    acceptUrl: 'http://localhost:5173/accept-invite/abc',
  })
  expect(m.subject).toBe('Bhaskar invited you to <script>x</script> on bhidubot')
  expect(m.html).toContain('href="http://localhost:5173/accept-invite/abc"')
  expect(m.html).toContain('&lt;script&gt;x&lt;/script&gt;')
  expect(m.html).not.toContain('<script>x')
  expect(m.text).toContain('http://localhost:5173/accept-invite/abc')
})
