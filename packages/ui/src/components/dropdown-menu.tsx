import { Menu } from '@base-ui/react/menu'
import type { ComponentProps } from 'react'
import { cn } from '../lib/cn'
import type { PartProps } from '../lib/types'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger
export const DropdownMenuGroup = Menu.Group
export const DropdownMenuRadioGroup = Menu.RadioGroup

export interface DropdownMenuContentProps extends PartProps<typeof Menu.Popup> {
  side?: ComponentProps<typeof Menu.Positioner>['side']
  align?: ComponentProps<typeof Menu.Positioner>['align']
  sideOffset?: number
}

/**
 * DESIGN.md level 3 (popover surface, hairline, floating shadow). Scales in from its trigger via
 * Base UI's --transform-origin: 150ms in, 100ms out, opacity + 0.96 scale.
 */
export function DropdownMenuContent({
  className,
  side = 'bottom',
  align = 'start',
  sideOffset = 4,
  ...props
}: DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        className="z-50 outline-none"
        side={side}
        align={align}
        sideOffset={sideOffset}
      >
        <Menu.Popup
          className={cn(
            'min-w-48 max-w-[calc(100vw-32px)] origin-(--transform-origin) rounded-md border border-hairline bg-popover p-1 text-ink shadow-popover outline-none',
            'transition-[opacity,scale] duration-150 ease-out data-ending-style:duration-100',
            'data-ending-style:scale-[0.96] data-ending-style:opacity-0 data-starting-style:scale-[0.96] data-starting-style:opacity-0',
            className,
          )}
          {...props}
        />
      </Menu.Positioner>
    </Menu.Portal>
  )
}

const itemClass = [
  'flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-body-sm text-ink outline-none',
  'pointer-coarse:h-11 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-subtle',
  'data-highlighted:bg-hairline data-disabled:pointer-events-none data-disabled:text-ink-tertiary',
]

export interface DropdownMenuItemProps extends PartProps<typeof Menu.Item> {
  /** Destructive actions read in the danger colour. */
  variant?: 'default' | 'danger'
}

export function DropdownMenuItem({
  className,
  variant = 'default',
  ...props
}: DropdownMenuItemProps) {
  return (
    <Menu.Item
      data-variant={variant}
      className={cn(
        itemClass,
        variant === 'danger' && 'text-danger [&_svg]:text-danger data-highlighted:bg-danger/10',
        className,
      )}
      {...props}
    />
  )
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: PartProps<typeof Menu.RadioItem>) {
  return (
    <Menu.RadioItem
      className={cn(itemClass, 'data-checked:[&_svg]:text-ink', className)}
      {...props}
    >
      {children}
      <Menu.RadioItemIndicator className="ml-auto flex items-center">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M3.5 8.5l3 3 6-7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Menu.RadioItemIndicator>
    </Menu.RadioItem>
  )
}

export function DropdownMenuLabel({ className, ...props }: PartProps<typeof Menu.GroupLabel>) {
  return (
    <Menu.GroupLabel
      className={cn('px-2 pt-2 pb-1 font-medium text-caption text-ink-subtle', className)}
      {...props}
    />
  )
}

export function DropdownMenuSeparator({ className, ...props }: PartProps<typeof Menu.Separator>) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-hairline', className)} {...props} />
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('ml-auto text-caption text-ink-subtle', className)} {...props} />
}
