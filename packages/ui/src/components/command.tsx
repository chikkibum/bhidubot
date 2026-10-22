import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import { Command as Cmdk } from 'cmdk'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '../lib/cn'

export function Command({ className, ...props }: ComponentProps<typeof Cmdk>) {
  return (
    <Cmdk
      className={cn('flex size-full flex-col overflow-hidden bg-popover text-ink', className)}
      {...props}
    />
  )
}

export function CommandInput({ className, ...props }: ComponentProps<typeof Cmdk.Input>) {
  return (
    <div className="flex items-center border-hairline border-b px-4">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="mr-2.5 size-4 shrink-0 text-ink-subtle"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <Cmdk.Input
        className={cn(
          'h-12 w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function CommandList({ className, ...props }: ComponentProps<typeof Cmdk.List>) {
  return (
    <Cmdk.List
      className={cn(
        'max-h-[min(360px,calc(100dvh-160px))] scroll-py-2 overflow-y-auto overscroll-contain p-2',
        className,
      )}
      {...props}
    />
  )
}

export function CommandEmpty({ className, ...props }: ComponentProps<typeof Cmdk.Empty>) {
  return (
    <Cmdk.Empty
      className={cn('py-8 text-center text-body-sm text-ink-subtle', className)}
      {...props}
    />
  )
}

export function CommandGroup({ className, ...props }: ComponentProps<typeof Cmdk.Group>) {
  return (
    <Cmdk.Group
      className={cn(
        '**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:pt-2 **:[[cmdk-group-heading]]:pb-1',
        '**:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-caption **:[[cmdk-group-heading]]:text-ink-subtle',
        className,
      )}
      {...props}
    />
  )
}

export function CommandItem({ className, ...props }: ComponentProps<typeof Cmdk.Item>) {
  return (
    <Cmdk.Item
      className={cn(
        'flex h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2 text-body-sm text-ink',
        'pointer-coarse:h-11 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle',
        'data-[selected=true]:bg-hairline data-[disabled=true]:pointer-events-none data-[disabled=true]:text-ink-tertiary',
        className,
      )}
      {...props}
    />
  )
}

export function CommandSeparator({ className, ...props }: ComponentProps<typeof Cmdk.Separator>) {
  return <Cmdk.Separator className={cn('-mx-2 my-1 h-px bg-hairline', className)} {...props} />
}

export function CommandShortcut({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn('ml-auto flex items-center gap-1 text-caption text-ink-subtle', className)}
      {...props}
    />
  )
}

export interface CommandDialogProps
  extends Omit<ComponentProps<typeof Cmdk>, 'children' | 'className'> {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Accessible dialog title, visually hidden. */
  title?: string
  className?: string
  children: ReactNode
}

/**
 * The ⌘K palette. Opened by keyboard many times a day, so it has no open or close animation
 * (Emil Kowalski: never animate keyboard-initiated, high-frequency actions).
 */
export function CommandDialog({
  open,
  onOpenChange,
  title = 'Command palette',
  className,
  children,
  ...props
}: CommandDialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-overlay" />
        <BaseDialog.Popup
          className={cn(
            'fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[640px] -translate-x-1/2',
            'overflow-hidden rounded-lg border border-hairline bg-popover shadow-popover outline-none',
            className,
          )}
        >
          <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
          <Command label={title} loop {...props}>
            {children}
          </Command>
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
