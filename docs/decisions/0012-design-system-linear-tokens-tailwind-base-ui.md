# 0012. Design system: Linear DESIGN.md as the source of truth, CSS variables + Tailwind v4 `@theme`, Base UI primitives

## Status

Accepted

## Context

The user chose Linear's DESIGN.md (getdesign.md, `npx getdesign@latest add linear.app`) as the binding visual
source of truth: a near-black canvas, one lavender accent, dense and precise type (spec §9). The spec also requires
a light theme that follows the system, WCAG 2.2 AA contrast in both themes, visible accent focus rings, full
keyboard operability and `prefers-reduced-motion`. Task 12 builds the whole SPA shell from this package, and the
spec's anti-goal is a UI that looks like a generic template. The user asked that UI work use taste-skill and Emil
Kowalski's skills.

## Decision

- **Source.** `docs/design/DESIGN.md` is checked in unchanged. `packages/ui` (`@bhidubot/ui`) turns it into code.
- **Tokens as CSS variables** (`src/styles/tokens.css`) on `:root[data-theme="dark"]` and
  `:root[data-theme="light"]`. Dark is also the default for a bare `:root`, so the first paint before the app
  resolves the theme is dark, not a white flash. The web app owns resolving `system` and setting `data-theme`.
- **Dark values are verbatim from DESIGN.md** (canvas `#010102`, surface ladder `#0f1011`–`#191a1b`, hairlines
  `#23252a`/`#34343a`, ink `#f7f8f8`/`#d0d6e0`/`#8a8f98`/`#62666d`, primary `#5e6ad2`/`#828fff`/`#5e69d1`,
  success `#27a644`). Every pair the brief names passes; no dark token was changed.
- **Light values are derived** from DESIGN.md's inverse tokens: canvas `#ffffff`, surface-1 `#f5f6f6` (verbatim),
  then a ladder that steps darker (`#eff0f1`, `#e9eaec`, `#e4e5e7`). `#f6f7f7` (inverse-surface-2) is within one
  level of `#f5f6f6`, too close to be a separate step, so it is not used. Ink is `#08090a` rather than the inverse
  `#000000`, carrying the canvas's faint blue tint. The ink ladder mirrors the dark one (light `ink-subtle` =
  dark `ink-tertiary` `#62666d`; light `ink-tertiary` = dark `ink-subtle` `#8a8f98`).
- **Tokens DESIGN.md does not define**, added because the components need them: `--danger` (dark `#f06060`,
  a Linear-like red; light `#bf2626`; both hold 4.5:1 on the highlighted-row fill), `--primary-fill-hover`, `--popover` (floating surfaces: surface-3 in
  dark, white in light), `--popover-shadow`, `--overlay` (DESIGN.md's black scrim), `--edge-highlight` (DESIGN.md's
  "subtle white edge highlight" on lifted panels).
- **Contrast is a test.** `src/styles/contrast.test.ts` parses `tokens.css` and computes WCAG 2.2 ratios for both
  themes: the brief's body-text pairs (4.5:1), tertiary ink and focus ring (3:1), plus every pair a component
  relies on (button hover, accent text, danger/success text, placeholder, disabled label, popover text, focus ring
  on raised surfaces), and that both themes define the same token names.
- **Tailwind CSS v4, CSS-first.** `src/styles/theme.css` maps the variables with `@theme inline` and _replaces_
  Tailwind's palette, radii, shadows and type scale, so only DESIGN.md values exist as utilities (`bg-canvas`,
  `text-ink-muted`, `border-hairline`, `rounded-md`, `text-body-sm`, `shadow-popover`). Spacing keeps Tailwind's 4px
  base, which is DESIGN.md's base unit. Apps import `tailwindcss` then `@bhidubot/ui/theme.css`; the file
  `@source`s the package's components. A test compiles it with `@tailwindcss/node`.
- **Fonts.** Linear's faces are proprietary. Substitutes, as DESIGN.md recommends: **Inter Variable** with the
  optical-size axis (`@fontsource-variable/inter/opsz.css`, `font-optical-sizing: auto`) for text and display, and
  **JetBrains Mono Variable** for mono (IDs and code only).
- **Primitives (pick-ui-library, Emil Kowalski's curated list).** The skill's answer: **Base UI** (`@base-ui/react`)
  for unstyled accessible components (Dialog, Menu, Avatar), **cmdk** for the ⌘K palette, **Sonner** for toasts,
  **cva** for variant-driven Tailwind styling and **clsx** (with `tailwind-merge`, taught the DESIGN.md scale names)
  for class composition. Radix was the alternative; Base UI is the list's pick and exposes
  `data-starting-style`/`data-ending-style` and `--transform-origin` for CSS-only, interruptible motion.
- **Components we own**, one file each, exported from `src/index.ts`: `Button` (`primary | secondary | ghost |
  danger`, `sm | md`, `data-variant`), `Input`, `Card`, `Kbd`, `Skeleton`, `Avatar`, `Dialog`, `DropdownMenu`,
  `Command*`, `Toaster`/`toast`.
- **Motion** (Emil Kowalski's rules): custom curves (`--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`); only
  `transform`/`opacity`; dialog 200ms in / 150ms out from the centre; menus 150ms in / 100ms out from their trigger
  (`--transform-origin`), starting at `scale(0.96)` never `scale(0)`; buttons press to `scale(0.97)`; toasts retimed
  to 200ms ease-out; colour changes on hover are instant; the ⌘K palette has no animation at all (keyboard-opened,
  used many times a day). Under `prefers-reduced-motion` all transitions and animations are switched off.

### Deviations from DESIGN.md, and why

| DESIGN.md                                      | Here                                                                                                                                                  | Why                                                                                                                   |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `button-primary-hover`: white on `#828fff`     | Hover fill `--primary-fill-hover` (dark `#5360c9`, 5.4:1); `#828fff` kept verbatim as `--primary-hover` and used as accent text (7.3:1 on canvas)     | White on `#828fff` is 2.9:1, an AA failure on the most-used control.                                                  |
| Focus ring: 2px `primary-focus` at 50% opacity | 2px solid `primary-focus`                                                                                                                             | At 50% it is about 1.8:1 on canvas, under the 3:1 non-text minimum; solid it is 4.4:1.                                |
| `text-input`: surface-1, no border named       | surface-1 with a `hairline-strong` border                                                                                                             | On a surface-1 card the field would otherwise vanish (taste-skill: controls one step stronger than structural lines). |
| `eyebrow` (13px/500, +0.4px tracking)          | `text-label` (13px/500, no tracking) for form and menu labels                                                                                         | taste-skill bans eyebrow labels above headings; the size is kept for labels.                                          |
| Danger/error styling not documented            | `--danger`, outlined danger buttons (no red fill)                                                                                                     | DESIGN.md's Known Gaps; destructive actions as outlined negative buttons (taste-skill).                               |
| Menu highlight: a subtle fill only             | Hairline fill plus a 2px `primary-focus` bar on the row's leading edge; the palette search field gets a 2px `primary-focus` bottom line while focused | The fill alone is about 1.2:1 against the popover; keyboard focus must be visible at 3:1 (spec §9).                   |

## Why

The user chose Linear's look; a token layer plus our own components gives a consistent, dense UI that is not a
template, and a contrast test turns "WCAG AA in both themes" from a promise into a check.

## Pros

- Themeable at runtime by one attribute, with no class duplication per theme.
- Contrast is tested for both themes, including the derived light mode.
- The components belong to us; the primitives handle focus, dismissal and ARIA.
- Only DESIGN.md values exist as utilities, which keeps screens on the system.

## Cons

- Light mode is partly derived rather than specified.
- The fonts are not Linear's.
- Replacing Tailwind's palette means stock utilities like `bg-gray-100` do not exist (on purpose).
- taste-skill's owner bans violet/indigo accents; the user's binding choice of Linear's lavender overrides that.

## Alternatives considered

- shadcn/ui defaults: a generic look, which is the spec's anti-goal.
- A full component kit (MUI, Mantine): fights DESIGN.md at every component.
- Radix primitives instead of Base UI: equally capable; not the pick-ui-library choice.
- JS theme objects / CSS-in-JS: runtime cost, and the tokens could not be contrast-tested from a stylesheet.

## Consequences / follow-ups

- Task 12 imports `@bhidubot/ui/theme.css`, sets `data-theme` (with a no-flash inline script) and passes the
  resolved theme to `<Toaster theme>`.
- New colours go into `tokens.css` for both themes and into the contrast test before any component uses them.
