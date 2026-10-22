import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

export { toast } from 'sonner'

// Sonner reads its palette from these variables; pointing them at our tokens follows the theme
// without !important on every part.
const tokenStyle = {
  '--normal-bg': 'var(--popover)',
  '--normal-bg-hover': 'var(--surface-2)',
  '--normal-border': 'var(--hairline)',
  '--normal-border-hover': 'var(--hairline-strong)',
  '--normal-text': 'var(--ink)',
  '--border-radius': 'var(--radius-md)',
  fontFamily: 'var(--font-sans)',
} as CSSProperties

/**
 * Mount once at the app root; call `toast()` from anywhere. Pass the resolved theme so sonner's
 * own secondary colours match. Motion is retimed to the system's 200ms ease-out.
 */
export function Toaster({ theme = 'dark', toastOptions, style, ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      style={{ ...tokenStyle, ...style }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast: '!shadow-popover !text-body-sm !duration-200 !ease-out',
          description: '!text-ink-subtle',
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  )
}
