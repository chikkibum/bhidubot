import type { ComponentProps, JSXElementConstructor } from 'react'

/** Props of a Base UI part with `className` narrowed to a string, so it composes with `cn`. */
// biome-ignore lint/suspicious/noExplicitAny: mirrors React's own JSXElementConstructor<any> constraint
export type PartProps<T extends JSXElementConstructor<any>> = Omit<
  ComponentProps<T>,
  'className'
> & {
  className?: string
}
