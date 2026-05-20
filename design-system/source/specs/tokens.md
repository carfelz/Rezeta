# Design Tokens

> Single source of truth for all design values.
> CSS custom properties live in `design-system/tokens.css`.
> Import order: `tokens.css` → `components.css`.

---

## Color — Neutrals

Cool true-grey with a hair of warmth at the light end. Optimized for long reading sessions without eye fatigue. All text/background combinations meet WCAG AA.

| Token | Value | Semantic use |
|---|---|---|
| `--color-n-0` | `#FFFFFF` | Pure white |
| `--color-n-25` | `#FAFAF7` | App background ("paper") |
| `--color-n-50` | `#F4F4F0` | Subtle row alternates, disabled backgrounds |
| `--color-n-100` | `#EBEBE6` | Soft borders |
| `--color-n-200` | `#D8D8D2` | Default borders |
| `--color-n-300` | `#B9B9B3` | Strong dividers |
| `--color-n-400` | `#8E8E88` | Muted / placeholder text |
| `--color-n-500` | `#6B6B66` | Secondary text, captions |
| `--color-n-600` | `#4A4A46` | Body text |
| `--color-n-700` | `#2E2E2B` | Primary text |
| `--color-n-800` | `#1C1C1A` | Headings |
| `--color-n-900` | `#0E0E0D` | Maximum contrast |

---

## Color — Primary (Brand Teal)

One brand color, restrained saturation. Avoids generic SaaS blue and obvious clinical green. Used sparingly: primary actions, active rule, links.

| Token | Value | Use |
|---|---|---|
| `--color-p-50` | `#EAF0F1` | Avatar background, chip background |
| `--color-p-100` | `#C9D7DA` | Chip border |
| `--color-p-300` | `#6A8B91` | Focus ring outer |
| `--color-p-500` | `#2D5760` | **Brand anchor** — buttons, active rule, focus border |
| `--color-p-700` | `#1B3A41` | Button hover, deep text on p-bg |
| `--color-p-900` | `#0E2429` | Button active pressed |

---

## Color — Semantic

Reserved exclusively for clinical or administrative state — never decorative. Muted saturation, high contrast.

### Success

| Token | Value |
|---|---|
| `--color-success-bg` | `#EDF3EC` |
| `--color-success-border` | `#B8CFB2` |
| `--color-success-text` | `#2F5C28` |

### Warning

| Token | Value |
|---|---|
| `--color-warning-bg` | `#F7F1E3` |
| `--color-warning-border` | `#DCC89A` |
| `--color-warning-text` | `#6E5319` |

### Danger

| Token | Value |
|---|---|
| `--color-danger-bg` | `#F6EAE8` |
| `--color-danger-border` | `#D9B4AE` |
| `--color-danger-text` | `#7A2B22` |
| `--color-danger-solid` | `#8C2A20` | Destructive buttons, error borders |

### Info

| Token | Value |
|---|---|
| `--color-info-bg` | `#ECF0F3` |
| `--color-info-border` | `#B8C6D0` |
| `--color-info-text` | `#2B435A` |

---

## Typography

Three typefaces, three weights. No other combinations.

| Token | Value |
|---|---|
| `--font-serif` | `"Source Serif 4", ui-serif, Georgia, serif` |
| `--font-sans` | `"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `"IBM Plex Mono", ui-monospace, monospace` |
| `--font-weight-regular` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |

**Typeface roles:**
- **Source Serif 4** — display, headings, protocol titles, patient names. Editorial with scientific heritage.
- **IBM Plex Sans** — UI, body, tables, forms, data. Humanist, excellent at small sizes.
- **IBM Plex Mono** — overlines, labels, code, numeric data, kbd shortcuts.

### Type Scale

| Class | Size | Line height | Letter spacing | Font | Weight | Color |
|---|---|---|---|---|---|---|
| `.text-display` | 56px | 1.05 | −0.02em | Serif | 500 | n-900 |
| `.text-h1` | 40px | 1.10 | −0.015em | Serif | 500 | n-900 |
| `.text-h2` | 28px | 1.20 | −0.01em | Serif | 500 | n-800 |
| `.text-h3` | 18px | 1.35 | −0.005em | Sans | 600 | n-800 |
| `.text-body-lg` | 16px | 1.55 | — | Sans | 400 | n-700 |
| `.text-body` | 14px | 1.55 | — | Sans | 400 | n-700 |
| `.text-body-sm` | 13px | 1.50 | — | Sans | 400 | n-600 |
| `.text-caption` | 12px | 1.40 | — | Sans | 500 | n-500 |
| `.text-overline` | 11px | 1.40 | 0.10em | Mono | 500 | n-500, uppercase |

---

## Spacing

Base unit: 4px. Use only these steps — no arbitrary values.

| Token | Value | Common use |
|---|---|---|
| `--space-1` | `4px` | Icon gap, tight nudge |
| `--space-2` | `8px` | Item gap, small pad |
| `--space-3` | `12px` | Button pad, field gap |
| `--space-4` | `16px` | Default pad |
| `--space-5` | `20px` | Card pad, panel |
| `--space-6` | `24px` | Section gap |
| `--space-8` | `32px` | Page section |
| `--space-10` | `40px` | Large gap |
| `--space-12` | `48px` | Empty state pad |
| `--space-16` | `64px` | Page hero |

---

## Border Radius

Three values only. Never deviate.

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `3px` | Buttons, inputs, chips, badges |
| `--radius-md` | `5px` | Cards, modals, toasts |
| `--radius-lg` | `8px` | Large containers |

---

## Borders

Borders carry hierarchy. Shadows are secondary.

| Token | Value | Use |
|---|---|---|
| `--border-default` | `1px solid #D8D8D2` | Cards, inputs, separators |
| `--border-soft` | `1px solid #EBEBE6` | Subtle dividers inside cards |
| `--border-strong` | `1px solid #B9B9B3` | Emphasized dividers |
| `--border-accent` | `2px solid #2D5760` | Active state signature rule |
| `--border-dashed` | `1px dashed #D8D8D2` | Empty states, drop targets |
| `--border-focus` | `1px solid #2D5760` | Input focus border |

---

## Elevation

Three levels only. Typography and borders handle hierarchy first.

| Token | Value | Use |
|---|---|---|
| `--shadow-flat` | `none` | Default surface — most cards, rows, containers |
| `--shadow-raised` | `0 1px 0 rgba(14,14,13,.04), 0 1px 2px rgba(14,14,13,.04)` | Subtle lift — sticky bars |
| `--shadow-floating` | `0 1px 0 rgba(14,14,13,.04), 0 8px 24px -8px rgba(14,14,13,.12), 0 2px 6px rgba(14,14,13,.06)` | Modals, toasts, popovers |
| `--shadow-focus` | `0 0 0 2px #FFF, 0 0 0 4px #6A8B91` | Keyboard focus ring (primary) |
| `--shadow-focus-danger` | `0 0 0 2px #FFF, 0 0 0 4px #D9B4AE` | Keyboard focus ring (destructive) |

---

## Layout

| Token | Value |
|---|---|
| `--layout-max-width` | `1440px` |
| `--layout-sidebar-width` | `240px` |
| `--layout-topbar-height` | `56px` |
| `--layout-margin-xl` | `48px` (1440px breakpoint) |
| `--layout-margin-lg` | `32px` (1024px breakpoint) |
| `--layout-gutter-xl` | `24px` |
| `--layout-gutter-lg` | `20px` |

Grid: 12 columns at 1440px, 8 columns at 1024px.

---

## Component Sizes

Minimum touch target: 44px (WCAG).

| Token | Value | Use |
|---|---|---|
| `--size-btn-sm` | `28px` | Small button height |
| `--size-btn-md` | `32px` | Default button height |
| `--size-btn-lg` | `40px` | Large button height |
| `--size-input-md` | `34px` | Input height |
| `--size-touch-min` | `44px` | Minimum interactive area |

---

## Iconography

Library: **Phosphor Icons** (`@phosphor-icons/web`), Regular weight by default.

| Token | Value | Use |
|---|---|---|
| `--icon-size-sm` | `15px` | Inside buttons |
| `--icon-size-md` | `16px` | Inline with text, sidebar |
| `--icon-size-lg` | `18px` | Callouts, modal icons |
| `--icon-size-xl` | `22px` | Domain grid |

Fill variant reserved for active nav item only.

**Domain icon map:**

| Concept | Phosphor name |
|---|---|
| Patient | `ph-user` |
| Appointment | `ph-calendar-blank` |
| Prescription | `ph-prescription` |
| Protocol | `ph-stack` |
| Location | `ph-map-pin` |
| Consultation | `ph-notepad` |
| Billing | `ph-receipt` |
| Search | `ph-magnifying-glass` |
| Filter | `ph-funnel` |
| Add | `ph-plus` |
| Edit | `ph-pencil-simple` |
| Archive | `ph-archive` |

---

## Transitions

| Token | Value | Use |
|---|---|---|
| `--transition-fast` | `100ms ease` | Hover, focus, color changes |
| `--transition-medium` | `150ms ease` | Panel open, collapse |
