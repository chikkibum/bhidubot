import { Avatar as BaseAvatar } from '@base-ui/react/avatar'
import { cn } from '../lib/cn'

const sizes = {
  sm: 'size-5 text-[10px]',
  md: 'size-6 text-[11px]',
  lg: 'size-8 text-caption',
} as const

export type AvatarSize = keyof typeof sizes

export interface AvatarProps {
  /** Person or team name; used for the initials and the image's alt text. */
  name: string
  src?: string | null
  size?: AvatarSize
  className?: string
}

/** Up to two initials: "Ana Lima" → "AL", "ana@team.dev" → "A". */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/[\s@._-]+/)
    .filter(Boolean)
  const letters = words.length > 1 && !name.includes('@') ? [words[0], words[1]] : [words[0]]
  return letters
    .map((w) => (w ? [...w][0] : ''))
    .join('')
    .toUpperCase()
}

/**
 * A neutral circle (DESIGN.md rounded.full). Initials sit on surface-3 rather than a per-person
 * hue: DESIGN.md allows a single chromatic accent.
 */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  return (
    <BaseAvatar.Root
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full',
        'bg-surface-3 align-middle font-medium text-ink-muted leading-none',
        sizes[size],
        className,
      )}
    >
      {src ? <BaseAvatar.Image src={src} alt={name} className="size-full object-cover" /> : null}
      <BaseAvatar.Fallback aria-label={name} role="img">
        {initials(name)}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  )
}
