import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge the DESIGN.md scale names, otherwise `text-body-sm` would be read as a
// colour and dropped next to `text-ink`.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display-xl',
        'display-lg',
        'display-md',
        'headline',
        'card-title',
        'subhead',
        'body-lg',
        'body',
        'body-sm',
        'caption',
        'button',
        'label',
        'mono',
      ],
      radius: ['pill'],
      shadow: ['popover'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
