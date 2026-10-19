import { expect, test } from 'bun:test'
import { createSmtpMailer } from './mailer'

test('smtp mailer delivers to mailpit', async () => {
  const to = `mailer-${Date.now()}@test.dev`
  await createSmtpMailer({
    smtpUrl: 'smtp://localhost:1025',
    from: 'bhidubot <no-reply@bhidubot.local>',
  }).send({ to, subject: 'hello', html: '<p>hi</p>', text: 'hi' })
  const res = await fetch(
    `http://localhost:8025/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
  )
  const body = (await res.json()) as { messages: Array<{ Subject: string }> }
  expect(body.messages[0]?.Subject).toBe('hello')
})
