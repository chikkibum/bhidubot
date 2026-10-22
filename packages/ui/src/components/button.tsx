import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'
import { focusRing } from '../lib/focus'

/**
 * DESIGN.md button-primary / -secondary / -tertiary: 14px/500 label, padding 8px 14px, radius md.
 * Colour changes are instant; only the press scale animates (Emil: buttons must feel responsive).
 */
export const buttonVariants = cva(
  [
    'inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border',
    'text-button leading-4 [&_svg]:size-4 [&_svg]:shrink-0',
    'transition-transform duration-150 ease-out enabled:active:scale-[0.97] motion-reduce:enabled:active:scale-100',
    'disabled:cursor-not-allowed disabled:border-hairline disabled:bg-surface-2 disabled:text-ink-subtle',
    focusRing,
  ],
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-on-primary enabled:hover:bg-primary-fill-hover enabled:active:bg-primary-focus',
        secondary:
          'border-hairline bg-surface-1 text-ink enabled:hover:border-hairline-strong enabled:hover:bg-surface-2',
        ghost: 'border-transparent bg-transparent text-ink enabled:hover:bg-surface-2',
        danger:
          'border-hairline bg-transparent text-danger enabled:hover:border-danger/40 enabled:hover:bg-danger/10',
      },
      size: {
        sm: 'h-7 px-2.5 py-1.5 pointer-coarse:h-9',
        md: 'h-8 px-3.5 py-2 pointer-coarse:h-10',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export function Button({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
