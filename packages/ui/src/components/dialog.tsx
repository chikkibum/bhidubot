import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'
import type { PartProps } from '../lib/types'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogClose = BaseDialog.Close

/**
 * Portal + scrim + centred popup on the popover surface. Enters in 200ms and leaves in 150ms with
 * opacity and a 0.96 scale from the centre (modals are not anchored, so no trigger origin).
 */
export function DialogContent({ className, ...props }: PartProps<typeof BaseDialog.Popup>) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-overlay',
          'transition-opacity duration-200 ease-out data-ending-style:duration-150',
          'data-ending-style:opacity-0 data-starting-style:opacity-0',
        )}
      />
      <BaseDialog.Popup
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100dvh-32px)] overflow-y-auto rounded-lg border border-hairline bg-popover p-6 text-ink shadow-popover outline-none',
          'transition-[opacity,scale] duration-200 ease-out data-ending-style:duration-150',
          'data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0',
          className,
        )}
        {...props}
      />
    </BaseDialog.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mb-5 flex flex-col gap-1.5', className)} {...props} />
}

export function DialogTitle({ className, ...props }: PartProps<typeof BaseDialog.Title>) {
  return (
    <BaseDialog.Title
      className={cn('font-semibold text-body text-ink tracking-[-0.01em]', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: PartProps<typeof BaseDialog.Description>) {
  return (
    <BaseDialog.Description className={cn('text-body-sm text-ink-subtle', className)} {...props} />
  )
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}
