import { expect, test } from 'bun:test'
import { cn } from './cn'

test('keeps a DESIGN.md text size next to a text colour', () => {
  expect(cn('text-body-sm text-ink')).toBe('text-body-sm text-ink')
})

test('later classes win within the same group', () => {
  expect(cn('text-body text-caption', 'text-ink text-ink-muted', 'rounded-md rounded-pill')).toBe(
    'text-caption text-ink-muted rounded-pill',
  )
  expect(cn('px-3.5', false, undefined, 'px-2')).toBe('px-2')
})
