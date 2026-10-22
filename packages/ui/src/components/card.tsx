import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

/**
 * DESIGN.md level-1 lift: surface-1 on canvas, 1px hairline, radius lg, and the faint top-edge
 * highlight. No drop shadow at rest.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-hairline bg-surface-1 text-ink shadow-[inset_0_1px_0_0_var(--edge-highlight)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1 px-6 pt-6', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return (
    <h3 className={cn('font-medium text-body text-ink tracking-[-0.01em]', className)} {...props} />
  )
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-body-sm text-ink-subtle', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-6 py-6 [[data-slot=card-header]+&]:pt-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-hairline border-t px-6 py-4', className)}
      {...props}
    />
  )
}
