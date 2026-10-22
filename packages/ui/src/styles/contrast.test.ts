import { expect, test } from 'bun:test'
import { contrast, readTokens } from './contrast-utils'

for (const theme of ['dark', 'light'] as const) {
  const t = readTokens(theme)
  test(`${theme}: body text pairs meet AA (4.5:1)`, () => {
    expect(contrast(t['--ink']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink-muted']!, t['--surface-1']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink-subtle']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--on-primary']!, t['--primary']!)).toBeGreaterThanOrEqual(4.5)
  })
  test(`${theme}: tertiary ink and focus ring meet non-text 3:1`, () => {
    expect(contrast(t['--ink-tertiary']!, t['--canvas']!)).toBeGreaterThanOrEqual(3)
    expect(contrast(t['--primary-focus']!, t['--canvas']!)).toBeGreaterThanOrEqual(3)
  })
}
test('dark tokens are verbatim from DESIGN.md', () => {
  const t = readTokens('dark')
  expect(t['--canvas']).toBe('#010102')
  expect(t['--primary']).toBe('#5e6ad2')
  expect(t['--hairline']).toBe('#23252a')
})

// Pairs the components rely on beyond the brief's minimum.
for (const theme of ['dark', 'light'] as const) {
  const t = readTokens(theme)
  test(`${theme}: component text pairs meet AA (4.5:1)`, () => {
    // Primary button hover, accent text, status text
    expect(contrast(t['--on-primary']!, t['--primary-fill-hover']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--primary-hover']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--danger']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--danger']!, t['--surface-1']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--success']!, t['--canvas']!)).toBeGreaterThanOrEqual(4.5)
    // Input placeholder on surface-1, disabled button label on surface-2, menu text on popover
    expect(contrast(t['--ink-subtle']!, t['--surface-1']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink-subtle']!, t['--surface-2']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink']!, t['--popover']!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(t['--ink-subtle']!, t['--popover']!)).toBeGreaterThanOrEqual(4.5)
  })
  test(`${theme}: focus ring stays visible on raised surfaces (3:1)`, () => {
    expect(contrast(t['--primary-focus']!, t['--surface-1']!)).toBeGreaterThanOrEqual(3)
    expect(contrast(t['--primary-focus']!, t['--popover']!)).toBeGreaterThanOrEqual(3)
  })
}

test('both themes define the same token names', () => {
  expect(Object.keys(readTokens('light')).sort()).toEqual(Object.keys(readTokens('dark')).sort())
})

test('contrast matches known WCAG reference values', () => {
  expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
  expect(contrast('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2)
  expect(contrast('#fff', '#000')).toBeCloseTo(21, 5)
})

test('readTokens only reads the requested theme block', () => {
  const css =
    ':root, :root[data-theme="dark"] { --a: #000000; } :root[data-theme="light"] { --a: #ffffff; }'
  expect(readTokens('dark', css)).toEqual({ '--a': '#000000' })
  expect(readTokens('light', css)).toEqual({ '--a': '#ffffff' })
})
