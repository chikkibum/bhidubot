import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

/** A keyboard key, e.g. <Kbd>⌘</Kbd><Kbd>K</Kbd>. Text face, not mono: keys are glyphs, not code. */
export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 select-none items-center justify-center rounded-xs border border-hairline bg-surface-2 px-1',
        'font-sans font-medium text-[11px] text-ink-subtle leading-none',
        className,
      )}
      {...props}
    />
  )
}
