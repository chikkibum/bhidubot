import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@tailwindcss/node'

const here = dirname(fileURLToPath(import.meta.url))

async function build(candidates: string[]): Promise<string> {
  const entry = `@import "tailwindcss";\n${readFileSync(`${here}/theme.css`, 'utf8')}`
  const compiler = await compile(entry, { base: here, onDependency: () => {} })
  return compiler.build(candidates)
}

test('token utilities resolve to the theme variables', async () => {
  const css = await build([
    'bg-canvas',
    'text-ink-muted',
    'border-hairline',
    'rounded-md',
    'text-body-sm',
    'shadow-popover',
  ])
  expect(css).toMatch(/\.bg-canvas\s*\{\s*background-color:\s*var\(--canvas\)/)
  expect(css).toMatch(/\.text-ink-muted\s*\{\s*color:\s*var\(--ink-muted\)/)
  expect(css).toMatch(/\.border-hairline\s*\{\s*border-color:\s*var\(--hairline\)/)
  expect(css).toMatch(/\.rounded-md\s*\{\s*border-radius:\s*var\(--radius-md\)/)
  expect(css).toContain('--radius-md: 8px')
  expect(css).toContain('--text-body-sm: 14px')
  expect(css).toMatch(/\.shadow-popover\s*\{[^}]*var\(--popover-shadow\)/)
})

test("Tailwind's default palette is replaced, not extended", async () => {
  const css = await build(['bg-blue-500', 'text-gray-400', 'rounded-3xl'])
  expect(css).not.toContain('.bg-blue-500')
  expect(css).not.toContain('.text-gray-400')
  expect(css).not.toContain('.rounded-3xl')
})

test('motion uses the custom ease-out curve and is disabled under reduced motion', async () => {
  const css = await build(['ease-out'])
  expect(css).toContain('--ease-out: cubic-bezier(0.23, 1, 0.32, 1)')
  expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*transition-duration:\s*0s !important/)
})

test('radii are verbatim from DESIGN.md', async () => {
  const css = await build([
    'rounded-xs',
    'rounded-sm',
    'rounded-md',
    'rounded-lg',
    'rounded-xl',
    'rounded-2xl',
    'rounded-pill',
  ])
  for (const decl of [
    '--radius-xs: 4px',
    '--radius-sm: 6px',
    '--radius-md: 8px',
    '--radius-lg: 12px',
    '--radius-xl: 16px',
    '--radius-2xl: 24px',
    '--radius-pill: 9999px',
  ]) {
    expect(css).toContain(decl)
  }
})
