import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'
import { fieldFocusRing } from '../lib/focus'

/**
 * DESIGN.md text-input: surface-1, 16px body type, padding 8px 12px, radius md (40px tall).
 * 16px also stops iOS from zooming on focus. Placeholder uses ink-subtle so it stays above 4.5:1.
 * The border is hairline-strong (controls one step above structural lines) so the field still reads
 * on a surface-1 card. Set `aria-invalid` to show the error state.
 */
export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-10 w-full min-w-0 rounded-md border border-hairline-strong bg-surface-1 px-3 py-2 text-body text-ink',
        'placeholder:text-ink-subtle hover:border-ink-tertiary',
        'file:mr-3 file:border-0 file:bg-transparent file:text-button file:text-ink',
        'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger',
        'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-subtle',
        fieldFocusRing,
        className,
      )}
      {...props}
    />
  )
}
