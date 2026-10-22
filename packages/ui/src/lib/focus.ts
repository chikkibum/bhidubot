/**
 * The one focus treatment: a 2px solid primary-focus ring. DESIGN.md draws it at 50% opacity,
 * which drops below 3:1 on canvas, so it is drawn solid (4.4:1 on canvas, 4.0:1 on surface-1).
 */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

/** Fields sit on surfaces, so the ring hugs the border instead of leaving a canvas-coloured gap. */
export const fieldFocusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:border-transparent'

/**
 * The highlighted row in a menu or the command palette. The hairline fill alone is about 1.2:1
 * against the popover, so the row also gets a 2px primary-focus bar on its leading edge
 * (3.7:1 dark / 4.75:1 light against the popover, tested in contrast.test.ts).
 */
export const highlightIndicator = {
  menu: 'data-highlighted:bg-hairline data-highlighted:shadow-[inset_2px_0_0_0_var(--primary-focus)]',
  palette:
    'data-[selected=true]:bg-hairline data-[selected=true]:shadow-[inset_2px_0_0_0_var(--primary-focus)]',
} as const

/** The palette's search field: its bottom rule becomes a 2px primary-focus line while focused. */
export const fieldFocusWithin =
  'focus-within:border-primary-focus focus-within:shadow-[inset_0_-1px_0_0_var(--primary-focus)]'
