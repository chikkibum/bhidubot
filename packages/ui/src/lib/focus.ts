/**
 * The one focus treatment: a 2px solid primary-focus ring. DESIGN.md draws it at 50% opacity,
 * which drops below 3:1 on canvas, so it is drawn solid (4.4:1 on canvas, 4.0:1 on surface-1).
 */
export const focusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

/** Fields sit on surfaces, so the ring hugs the border instead of leaving a canvas-coloured gap. */
export const fieldFocusRing =
  'outline-none focus-visible:ring-2 focus-visible:ring-primary-focus focus-visible:border-transparent'
