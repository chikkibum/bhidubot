import type { z } from 'zod'

export class EnvError extends Error {
  constructor(
    readonly missing: string[],
    readonly invalid: string[],
    details: string[] = [],
  ) {
    const parts: string[] = []
    if (missing.length) parts.push(`Missing environment variables: ${missing.join(', ')}`)
    if (invalid.length) {
      const detail = details.length ? ` (${details.join('; ')})` : ''
      parts.push(`Invalid environment variables: ${invalid.join(', ')}${detail}`)
    }
    super(parts.join('. '))
    this.name = 'EnvError'
  }
}

/**
 * Validates `source` (default `process.env`) against a zod object schema.
 * Empty strings are treated as unset. Throws one EnvError listing every offender.
 */
export function loadEnv<T extends z.ZodObject>(
  schema: T,
  source: Record<string, string | undefined> = process.env,
): z.infer<T> {
  const input: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(source)) {
    input[key] = value === '' ? undefined : value
  }

  const result = schema.safeParse(input)
  if (result.success) return result.data

  const missing = new Set<string>()
  const invalid = new Set<string>()
  const details: string[] = []
  for (const issue of result.error.issues) {
    const name = String(issue.path[0] ?? '')
    if (!name) continue
    if (input[name] === undefined) {
      missing.add(name)
    } else if (!invalid.has(name)) {
      invalid.add(name)
      details.push(`${name}: ${issue.message}`)
    }
  }
  throw new EnvError([...missing], [...invalid], details)
}
