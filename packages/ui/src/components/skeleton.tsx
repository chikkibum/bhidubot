import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'

/**
 * A flat placeholder bar at the size of the content it stands in for. No shimmer: loading states
 * should not move (taste-skill app-screen rule), and it is hidden from assistive tech.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('rounded-sm bg-surface-2', className)}
      {...props}
    />
  )
}
