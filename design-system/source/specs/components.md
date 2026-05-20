# Component Specifications

> Every component in the design system, with states, variants, and sizing.
> CSS lives in `design-system/components.css`. Requires `tokens.css`.
> Live examples: `design-system/reference.html`.

---

## Avatar

Circular initials display for user identity.

| Variant | Size | Font size | Token class |
|---|---|---|---|
| Default | 36×36px | 13px | `.avatar` |
| Small | 30×30px | 11px | `.avatar--sm` |
| Extra small | 28×28px | 11px | `.avatar--xs` |

**Styles:** `background: --color-p-50`, `color: --color-p-700`, `font-weight: 600`.

---

## Button

### Variants

| Variant | Class | Default bg | Hover bg | Active bg | Text |
|---|---|---|---|---|---|
| Primary | `.btn--primary` | `--color-p-500` | `--color-p-700` | `--color-p-900` | White |
| Secondary | `.btn--secondary` | `--color-n-0` | `--color-n-50` | `--color-n-100` | `--color-n-800` |
| Ghost | `.btn--ghost` | transparent | `--color-n-100` | `--color-n-200` | `--color-n-700` |
| Destructive | `.btn--danger` | `--color-danger-solid` (`#8C2A20`) | `#6E2018` | `#52170F` | White |

### Sizes

| Size | Height | Font | Padding | Class modifier |
|---|---|---|---|---|
| SM | 28px | 12.5px | 0 12px | `.btn--sm` |
| MD (default) | 32px | 13px | 0 16px | — |
| LG | 40px | 14px | 0 18px | `.btn--lg` |

### Icon-only

Width equals height. Add `.btn--icon-only`. Icon font-size: `--icon-size-sm` (15px).

### States

| State | Behavior |
|---|---|
| Default | Base styles |
| Hover | Darker background (variant-specific) |
| Active | Darkest background |
| Focus | `box-shadow: --shadow-focus` (or `--shadow-focus-danger` for destructive) |
| Disabled | `--color-n-200` bg, `--color-n-400` text, `cursor: not-allowed` |

**Base styles shared across all variants:** `font-family: sans`, `font-weight: 500`, `font-size: 13px`, `border-radius: --radius-sm`, `transition: 100ms`.

---

## Form — Input

Single-line text, textarea, and select.

| State | Border | Shadow |
|---|---|---|
| Default | `1px solid --color-n-300` | none |
| Focus | `1px solid --color-p-500` | `0 0 0 3px rgba(45,87,96,.12)` |
| Error | `1px solid --color-danger-solid` | none |
| Disabled | `1px solid --color-n-200` | none — bg `--color-n-50`, text `--color-n-400` |
| Read-only | `1px solid --color-n-200` | none — bg `--color-n-25`, cursor default |

**Sizing:** height `34px`, padding `0 12px`, font `13px`, `border-radius: --radius-sm`.

Textarea: `padding: 12px`, `resize: vertical`, auto height.

Select: custom chevron via CSS `background-image`, `padding-right: 30px`.

### Input Group (adornments + icons)

Wrapper class: `.input-group`. The border and focus ring live on the group, not the inner input.

| Sub-element | Class | Description |
|---|---|---|
| Leading adornment | `.input-adorn.input-adorn--leading` | Text prefix (e.g. "RD$"), bg `--color-n-50`, left border |
| Trailing adornment | `.input-adorn` | Text suffix, bg `--color-n-50`, left border |
| Plain adornment | `.input-adorn--plain` | No background, no border — icon-like text |
| Leading icon | `.input-icon.input-icon--leading` | 32px wide, `--color-n-400` |
| Trailing icon | `.input-icon.input-icon--trailing` | 32px wide, `--color-n-400` |
| Action icon | `.input-icon--action` | Clickable, hover `--color-n-800` + `--color-n-50` bg |

### Field (label + input + helper/error)

```
.field
  .field__label          12.5px sans 500, --color-n-700
  .field__required       --color-danger-solid asterisk
  input.input
  .field__helper         11.5px --color-n-500
  .field__error          11.5px --color-danger-solid, with icon
```

---

## Form — Checkbox

| State | Visual |
|---|---|
| Unchecked | 16×16px, border `--color-n-400`, bg white |
| Checked | `--color-p-500` fill, white checkmark (8×4px) |
| Indeterminate | `--color-p-500` fill, white horizontal bar |

Class: `.checkbox`. Control element: `.checkbox__box`. States via `.checkbox--checked`, `.checkbox--indeterminate`.

---

## Form — Radio

| State | Visual |
|---|---|
| Unchecked | 16×16px circle, border `--color-n-400` |
| Checked | Border `--color-p-500`, inner dot 8px `--color-p-500` |

Class: `.radio`. Control element: `.radio__dot`. State via `.radio--checked`.

---

## Form — Toggle

Track: 30×18px, border-radius 999px.  
Knob: 14×14px white circle, transitions left.

| State | Track bg | Knob left |
|---|---|---|
| Off | `--color-n-300` | 2px |
| On | `--color-p-500` | 14px |

Class: `.toggle`. State via `.toggle--on`.

---

## Card

### Standard Card

```
.card
  padding: --space-5 (20px)
  background: --color-n-0
  border: 1px solid --color-n-200
  border-radius: --radius-md (5px)
```

Inner elements: `.card__title` (14px sans 600, `--color-n-800`) and `.card__subtitle` (12.5px, `--color-n-500`).

### List Item Card

`.card-item` — horizontal layout with avatar/icon, main content block, and trailing metadata.

| Sub-element | Class | Styles |
|---|---|---|
| Main content | `.card-item__main` | flex 1, overflow hidden |
| Name | `.card-item__name` | 13.5px sans 600, `--color-n-800` |
| Meta | `.card-item__meta` | 12px, `--color-n-500`, margin-top 2px |

Hover: bg `--color-n-25`.

### Selected/Highlighted Card

`.card--selected` — same as `.card` but with:
- Border: `1px solid --color-p-500`
- 3px teal rule on left edge (absolute, inset 12px top/bottom)

---

## Table

```
.table
  width: 100%
  border: 1px solid --color-n-200
  border-radius: --radius-md
  background: --color-n-0
  border-collapse: collapse
```

| Part | Styles |
|---|---|
| `thead th` | bg `--color-n-50`, 11.5px sans 600 uppercase, letter-spacing 0.06em, `--color-n-600` |
| `tbody td` | 13px, border-bottom `1px solid --color-n-100` |
| Row hover | bg `--color-n-25` |
| `.table td--name` | `font-weight: 600`, `--color-n-800` |
| `.table td--mono` | `font-family: mono`, 12px, `--color-n-600` |

---

## Badge / Status Chip

Small inline indicators for clinical and administrative state.

**Base:** `font-size: 11.5px`, `font-weight: 500`, `padding: 4px 8px`, `border-radius: 3px`, 6px dot.

| Variant | Class | Bg | Border | Text |
|---|---|---|---|---|
| Draft | `.badge--draft` | `--color-n-50` | `--color-n-200` | `--color-n-600` |
| Active | `.badge--active` | `--color-success-bg` | `--color-success-border` | `--color-success-text` |
| Signed | `.badge--signed` | `--color-p-50` | `--color-p-100` | `--color-p-700` |
| Review | `.badge--review` | `--color-warning-bg` | `--color-warning-border` | `--color-warning-text` |
| Archived | `.badge--archived` | `--color-n-50` | `--color-n-200` | `--color-n-500` |
| Paid | `.badge--paid` | `--color-success-bg` | `--color-success-border` | `--color-success-text` |
| Overdue | `.badge--overdue` | `--color-danger-bg` | `--color-danger-border` | `--color-danger-text` |

Dot color matches the text color of each variant.

---

## Tabs

```
.tabs          border-bottom: 1px solid --color-n-200
  .tab         13px sans 500, --color-n-500, padding 12px 16px
  .tab:hover   --color-n-800
  .tab--active --color-n-900, border-bottom: 2px solid --color-p-500
  .tab__count  11px mono --color-n-400
```

Active tab sits at `margin-bottom: -1px` to cover the tabs container border.

---

## Sidebar Navigation

Fixed left panel, 240px wide, full viewport height.

| Sub-element | Class | Styles |
|---|---|---|
| Container | `.sidebar` | `bg: --color-n-25`, `border-right: 1px solid --color-n-200`, `padding: 20px 0 16px` |
| Brand area | `.sidebar__brand` | Avatar + name, `border-bottom: 1px solid --color-n-100`, `margin-bottom: 14px` |
| Logo mark | `.sidebar__logo` | 28×28px, `bg: --color-p-500`, `border-radius: 4px`, white serif letter |
| Brand name | `.sidebar__brand-name` | 18px serif 500, `--color-n-900`, letter-spacing −0.01em |
| Section label | `.sidebar__section-label` | 10px mono uppercase, `--color-n-400`, letter-spacing 0.12em |
| Nav item | `.sidebar__item` | 13px sans, `--color-n-600`, `padding: 7px 20px`, icon 16px |
| Nav hover | `.sidebar__item:hover` | bg `--color-n-50`, text `--color-n-800` |
| Nav active | `.sidebar__item--active` | bg `--color-n-0`, text `--color-n-900`, weight 500, **2px teal rule** on left (inset 6px) |
| Active icon | `.sidebar__item--active i` | `--color-p-500` |
| Count | `.sidebar__item__count` | 11px mono `--color-n-400`, margin-left auto |
| Footer | `.sidebar__footer` | `border-top: 1px solid --color-n-100`, user block |
| User | `.sidebar__user` | Avatar + name/role row, hover bg `--color-n-50` |
| User name | `.sidebar__user-name` | 12.5px sans 600, `--color-n-800`, truncate |
| User role | `.sidebar__user-role` | 11px, `--color-n-500` |

---

## Top Bar

Fixed, 56px tall, spans from sidebar right edge to viewport right.

| Sub-element | Class | Description |
|---|---|---|
| Container | `.topbar` | bg `--color-n-0`, `border-bottom: 1px solid --color-n-200`, `left: 240px` |
| Location switcher | `.topbar__location-switcher` | Border-radius `--radius-sm`, hover bg `--color-n-50`, 6px teal dot |
| Location name | `.topbar__location-name` | 13px sans 500, `--color-n-800` |
| Location sub | `.topbar__location-sub` | 12px, `--color-n-500` |
| Search | `.topbar__search` | max-width 480px, leading icon 16px, trailing `⌘K` kbd chip |
| Kbd chip | `.topbar__search-kbd` | 10px mono, `border: 1px solid --color-n-200`, `bg: --color-n-25` |
| Icon button | `.topbar__icon-btn` | 34×34px, `--radius-sm`, hover bg `--color-n-50` |
| Notification dot | `.topbar__icon-btn__indicator` | 7px circle, `--color-danger-solid`, `border: 1.5px solid white` |
| Doctor block | `.topbar__doctor` | Avatar + name/role, `border-left: 1px solid --color-n-200` |

---

## Modal

```
.modal-overlay   position:fixed, inset:0, bg rgba(14,14,13,.35), z-index:500
  .modal         440px wide, --radius-md, --shadow-floating, bg --color-n-0
  .modal--lg     560px wide
```

| Part | Class | Styles |
|---|---|---|
| Header | `.modal__header` | `padding: 20px 24px 14px`, `border-bottom: 1px solid --color-n-100` |
| Icon | `.modal__icon` | 34×34px circle, semantic bg + text color (e.g. danger) |
| Title | `.modal__title` | 19px serif 500, `--color-n-900`, letter-spacing −0.005em |
| Subtitle | `.modal__subtitle` | 13px sans, `--color-n-600` |
| Body | `.modal__body` | `padding: 20px 24px` |
| Footer | `.modal__footer` | `padding: 14px 20px`, bg `--color-n-25`, `border-top: 1px solid --color-n-100`, flex end, gap 12px |

---

## Toast / Notification

Width 380px, floating above content (z-index as needed).

**Base:** bg `--color-n-0`, `border: 1px solid --color-n-200`, `--shadow-floating`, `--radius-md`, `padding: 12px 16px`.

| Part | Class | Styles |
|---|---|---|
| Icon | first `i` | 18px, color set by variant modifier |
| Title | `.toast__title` | 13px sans 600, `--color-n-800` |
| Description | `.toast__description` | 12.5px, `--color-n-500`, line-height 1.45 |
| Close | `.toast__close` | 16px, `--color-n-400` |

Variant modifiers (set icon color only):

| Modifier | Icon color |
|---|---|
| `.toast--success` | `--color-success-text` |
| `.toast--warning` | `--color-warning-text` |
| `.toast--danger` | `--color-danger-text` |
| `.toast--info` | `--color-info-text` |

---

## Callout (Inline Alert)

Inline contextual messages within page content.

**Base:** `display: flex`, `gap: --space-3`, `padding: 14px 16px`, `border-radius: --radius-md`.

| Variant | Class | Bg | Border | Text |
|---|---|---|---|---|
| Success | `.callout--success` | `--color-success-bg` | `--color-success-border` | `--color-success-text` |
| Warning | `.callout--warning` | `--color-warning-bg` | `--color-warning-border` | `--color-warning-text` |
| Danger | `.callout--danger` | `--color-danger-bg` | `--color-danger-border` | `--color-danger-text` |
| Info | `.callout--info` | `--color-info-bg` | `--color-info-border` | `--color-info-text` |

Icon: 18px, first child. Title: `.callout__title` 13px 600. Body: `.callout__body` 13px line-height 1.45.

---

## Empty State

Used when a list or section has no content yet.

```
.empty-state
  bg: --color-n-0
  border: 1px dashed --color-n-200
  border-radius: --radius-md
  padding: 48px 32px
  flex column, center aligned
```

| Part | Class | Styles |
|---|---|---|
| Icon circle | `.empty-state__icon` | 56px, bg `--color-n-50`, `--color-n-500`, 24px icon |
| Title | `.empty-state__title` | 20px serif 500, `--color-n-800` |
| Description | `.empty-state__description` | 13px, `--color-n-500`, max-width 42ch |

---

## Protocol Block

The product's signature component. Every clinical content block uses this pattern.

### Protocol Container

```
.protocol-container
  bg: --color-n-0
  border: 1px solid --color-n-200
  border-radius: --radius-md
  padding: 28px 32px
```

Header elements:
- `.protocol-kicker` — 11px mono uppercase, `--color-n-400`, letter-spacing 0.10em
- `.protocol-title` — 26px serif 500, `--color-n-900`, letter-spacing −0.005em
- `.protocol-meta` — 12.5px sans, `--color-n-500`

### Protocol Block (pblock)

Each block (section, checklist, steps, decision, dosage table, alert) renders as a `.pblock`.

```
.pblock
  bg: --color-n-0
  border: 1px solid --color-n-200
  border-radius: --radius-md
  margin-bottom: --space-3
```

**Header (`.pblock__header`):**
- bg `--color-n-25`, `border-bottom: 1px solid --color-n-100`
- **2px teal rule** on left edge via `::before` (full header height, rounded top-left)
- Padding: `12px 16px 12px 18px`

| Element | Class | Styles |
|---|---|---|
| Drag handle | `.pblock__handle` | `--color-n-300`, `cursor: grab` |
| Type chip | `.pblock__type-chip` | 10.5px mono uppercase, `--color-p-700`, bg `--color-p-50`, border `--color-p-100` |
| Title | `.pblock__title` | 17px serif 500, `--color-n-900` |
| Actions | `.pblock__actions` | flex row, gap 2px, margin-left auto |

Body: `.pblock__body` — `padding: 16px 18px`.

### Nested Blocks

`.pblock-nested` — `margin-left: 28px`, `border-left: 1px solid --color-n-200`. Nested `.pblock__header` uses bg `--color-n-0`.

### Protocol Checklist Items

```
.plist
  .plist__item           flex, gap --space-3, padding --space-2, hover bg --color-n-25
    .plist__text         13.5px, --color-n-700, line-height 1.5
    .plist__critical     "CRÍTICO" label, 11.5px mono, --color-danger-solid, uppercase
```

Done state: `.plist__item--done` — text `--color-n-400`, `text-decoration: line-through`.

### Add Block Button

`.pblock-add-btn` — dashed border `1px dashed --color-n-200`, 12.5px sans, `--color-n-500`. Hover: border `--color-n-400`, text `--color-n-800`.

---

## Anchor Rule

The 2px vertical teal signature — not a standalone component, but an applied modifier.

```
.anchor-rule
  position: relative
  padding-left: --space-4

.anchor-rule::before
  position: absolute
  left: 0
  top: 4px / bottom: 4px
  width: 2px
  background: --color-p-500
```

Applied to: active sidebar item, selected cards, protocol block headers, section headings.

---

## Page Layout

```
.app-layout          display: flex, min-height: 100vh
  .sidebar           240px fixed left
  .app-main          margin-left: 240px, padding-top: 56px, flex: 1
    .topbar          56px fixed
    .page-content    padding: 32px 48px, max-width: 1440px
```

---

## Utilities

| Class | CSS |
|---|---|
| `.stack` | `display: flex; flex-direction: column` |
| `.row` | `display: flex; align-items: center` |
| `.gap-1` through `.gap-8` | `gap: --space-{n}` |
| `.grid-2` | `display: grid; grid-template-columns: 1fr 1fr; gap: --space-6` |
| `.grid-3` | `display: grid; grid-template-columns: repeat(3, 1fr); gap: --space-6` |
| `.truncate` | `overflow: hidden; white-space: nowrap; text-overflow: ellipsis` |
| `.sr-only` | Visually hidden, accessible |
| `.text-mono` | `font-family: mono; font-size: 12px; --color-n-600` |
