import { readFileSync } from 'node:fs'

export type Theme = 'dark' | 'light'

const TOKENS_CSS = new URL('./tokens.css', import.meta.url)

/** Parses `--name: value;` declarations from every rule in tokens.css whose selector targets `theme`. */
export function readTokens(
  theme: Theme,
  css = readFileSync(TOKENS_CSS, 'utf8'),
): Record<string, string> {
  const tokens: Record<string, string> = {}
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, selector = '', body = ''] of withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.includes(`[data-theme="${theme}"]`)) continue
    for (const [, name = '', value = ''] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      tokens[name] = value.trim()
    }
  }
  return tokens
}

function channels(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m?.[1]) throw new Error(`contrast: expected a #rgb or #rrggbb colour, got "${hex}"`)
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ]
}

/** WCAG 2.2 relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.2 contrast ratio between two hex colours, 1–21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}
