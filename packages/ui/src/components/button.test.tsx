import { expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Button } from './button'

test('renders variant, disables accessibly, shows focus ring class', () => {
  const { getByRole } = render(
    <Button variant="primary" disabled>
      Send bot
    </Button>,
  )
  const b = getByRole('button', { name: 'Send bot' })
  expect(b.dataset.variant).toBe('primary')
  expect(b).toBeDisabled()
  expect(b.className).toContain('focus-visible:ring')
})

test('defaults to a secondary, md, type="button" button so it never submits forms by accident', () => {
  const { getByRole } = render(<Button>Cancel</Button>)
  const b = getByRole('button', { name: 'Cancel' })
  expect(b.getAttribute('type')).toBe('button')
  expect(b.dataset.variant).toBe('secondary')
  expect(b.dataset.size).toBe('md')
  expect(b).toBeEnabled()
})

test('caller classes override variant classes instead of stacking', () => {
  const { getByRole } = render(
    <Button variant="ghost" className="px-2">
      Edit
    </Button>,
  )
  const cls = getByRole('button', { name: 'Edit' }).className
  expect(cls).toContain('px-2')
  expect(cls).not.toContain('px-3.5')
})

test('hover colour does not animate; only the press scale transitions', () => {
  const { getByRole } = render(<Button variant="primary">Send bot</Button>)
  const cls = getByRole('button', { name: 'Send bot' }).className
  expect(cls).toContain('transition-transform')
  expect(cls).not.toMatch(/transition-(all|colors)\b/)
  expect(cls).toContain('motion-reduce:enabled:active:scale-100')
})
