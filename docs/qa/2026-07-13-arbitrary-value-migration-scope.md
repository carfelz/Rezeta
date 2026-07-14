# Scope — full arbitrary-value (`..-[…]`) migration to tokens

**Goal:** eliminate every arbitrary Tailwind value class (`prop-[value]`) that encodes a *design value*,
replacing it with a named token from `tailwind.config.ts`. **Rule (per request): keep the rendered design
exactly as-is** — preserve every value; only swap to an existing token when the value already matches one;
otherwise **add the token to the config** with the same value. Reference for names/values:
`specs/design-system/tokens.md`.

This is the remaining open item of **FU4** (`docs/qa/2026-07-13-ui-followups.md`). Executing it closes FU4.

---

## Inventory (measured, `apps/web/src`)

**483** total `prop-[…]` occurrences. They split into two groups:

### Keep as-is — NOT design values (~75) → allowlist, never tokenize
| Kind | Examples | Count |
|---|---|---|
| Radix/state **variant selectors** | `data-[state=open]:…`, `group-data-[focused=true]:…`, `peer-…` | ~66 |
| **Animation** utilities (tailwindcss-animate) | `slide-in-from-top-2`, `fade-…`, `zoom-…`, `ease-[…]`, `origin-[--radix-…]` | ~5 |
| **Runtime CSS-var bindings** (can't be static) | `w-[--cell-size]`, `h-[--cell-size]`, `w-[var(--radix-select-trigger-width)]`, `origin-[--radix-popover-content-transform-origin]` | ~11 |

These are Tailwind's legitimate escape hatch (dynamic values / selectors). The guardrail must **exempt**
`[--…]`, `[var(--…)]`, and arbitrary *variant* selectors.

### Migrate to tokens (~408 design-value classes)

---

## Migration table (distinct values + disposition)

Disposition: **SWAP** = value already has a token, just use it · **SCALE** = add a shared named scale ·
**DIM** = add a named dimension token · **COLOR** = add a color token.

| Property | Uses | Distinct values | Disposition |
|---|---|---|---|
| `tracking-` (letter-spacing) | 99 | `0.06 · 0.08 · 0.05 · 0.10/0.1 · 0.12 · 0.02 · -0.005 · -0.01 · -0.015` em (9) | **SCALE** — new `letterSpacing`. The negative values match the type scale (h1 −0.015, h2 −0.01, h3 −0.005); positives are eyebrow/label tracking (overline is 0.10). |
| `duration-` | 34 | `100ms` | **SWAP** → `duration-fast` (already in config: fast 100 / medium 150). |
| `w-` (width) | 79 | ~38: px (28,30,36,44,52,56,110,120,180,200,380,440,460,480,520,540,560…), `%` (8,10,15,22,25,26,34,50), `2px`/`5px`/`6px`/`14px`/`16px`/`18px`/`20px` | **SWAP** 28/32/40/44 → `w-btn-sm/md/lg`, `w-touch-min`; **DIM** for the rest (panels/rails/modals); `%` → fractions or grid (see D3). |
| `h-` (height) | 40 | 28,30,32,34,36,40,44,52 · 2,5,6,14,16,18,20 · 200,256 | **SWAP** 28/32/34/40/44 → `h-btn-*`/`h-input-md`/`h-touch-min`; **DIM** panels (200/256) + small (2/5/6/14/16/18/20). |
| `max-w-` | 24 | 260,320,400,440,480,560,640,800,880 px · 28/36/42/56 ch | **DIM** — container/modal widths + `ch` reading measures. |
| `min-w-` | 9 | 18,72,80,168,180,200,220 px · 8rem | **DIM** — menu/dropdown min-widths. |
| `min-h-` | 8 | 60,80,120,300,400 px · 60vh | **SWAP** 44→`min-h-touch`; **DIM** panels + `60vh`. |
| `max-h-` | 4 | 200,240,260,320 px | **DIM** — scroll-area caps. |
| `py-/px-/p-/pl-/pb-/mb-/mt-/gap-` (spacing) | ~55 | off-grid: 2,3,6,7,9,10,14,18 px (+ `20`→`p-5`, shorthand `p-[14px_16px]`, `p-[12px_16px]`) | **SWAP** 20→`p-5`; **SCALE/decision D1** for the off-grid steps. |
| `leading-` (line-height) | 15 | `1.15 · 1.4 · 1.45 · 1.5 · 1.55` | **SCALE** — new `lineHeight` (1.4/1.5/1.55 mirror the type scale). |
| `rounded-` | 4 | `3px · 5px` | **SWAP** → `rounded-sm` / `rounded-md`. |
| `z-` | 4 | `500 · 600` | **SCALE** — new `zIndex` (modal/overlay stacking). |
| `shadow-` | 6 | `0_0_0_3px_rgba(45,87,96,.12)`, `0_0_0_2px_…` | **SCALE** — new `boxShadow` (subtle teal focus glow; distinct from `--shadow-focus`). |
| `transition-` (property) | 8 | `border-color,box-shadow` · `left` · `border-color` · `background-color,border-color,color` | **SCALE** — new `transitionProperty`. |
| `ring-` | 2 | `3px` | **SWAP/SCALE** — ring width (Tailwind default ring is 3px; likely `ring` or a `ringWidth` token). |
| `top-/bottom-/left-` (inset) | ~9 | `2,6,12 px` · `-1px` | **SCALE/decision D1** — small inset tokens (share the spacing extension). |
| `bg-` (color) | 4 | `rgba(14,14,13,.35)` (n-900 @35% scrim) · `#6E2018` · `#52170F` (dark danger shades) | **COLOR** — add `overlay`/scrim + danger-hover shades to the palette. |

---

## Proposed config additions (`tailwind.config.ts` → `theme.extend`)

Concrete, value-preserving. Names follow `tokens.md` conventions.

```ts
letterSpacing: {
  tighter: '-0.015em', tight: '-0.01em', snug: '-0.005em',   // = h1/h2/h3
  normal2: '0.02em', wide: '0.05em', wider: '0.06em',
  widest: '0.08em', overline: '0.10em', ultra: '0.12em',
},
lineHeight: { snug2: '1.15', tight2: '1.4', normal2: '1.45', relaxed2: '1.5', loose2: '1.55' },
zIndex: { overlay: '500', modal: '600' },
boxShadow: { 'focus-subtle': '0 0 0 3px rgba(45,87,96,0.12)', 'focus-subtle-sm': '0 0 0 2px rgba(45,87,96,0.12)' },
transitionProperty: {
  'border-shadow': 'border-color, box-shadow',
  'colors-border': 'background-color, border-color, color',
  border: 'border-color', left: 'left',
},
colors: { overlay: 'rgba(14,14,13,0.35)', 'danger-hover': '#6E2018', 'danger-active': '#52170F' },
// spacing / dimensions — see decisions below
```

Plus **dimension** tokens for width/height/maxWidth/minWidth/min-height/maxHeight (the DIM rows). Naming
proposal in **D2**.

---

## Decisions — RESOLVED (2026-07-13)

- **D1 → Add exact tokens (keep pixel-identical).** Off-grid spacing/inset (2/3/6/7/9/10/14/18px) get real
  tokens under an "off-grid" block; zero visual change. (Chosen over rounding to the 4px scale.)
- **D2 → Hybrid naming.** Semantic tokens for recurring roles (`overlay`, `max-w-modal`, `max-w-prose*`,
  `min-w-menu`, `w-rail`, panel heights), by-value (`w-440`, `h-256`) for true one-offs.
- **D3 → Tokenize percentages as-is** now (keep design); `50%`→`w-1/2`. Grid refactor of table columns is an
  optional later cleanup, not part of this migration.
- **D4 → Guardrail allowlist:** exempt `[--…]`, `[var(--…)]`, and arbitrary *variant* selectors
  (`data-`/`group-`/`peer-`/`aria-`/`has-`/`*:`) + animation utilities; flag every other `prop-[…]`.

## Decisions (detail)

**D1 — Off-grid spacing & inset (2, 3, 6, 7, 9, 10, 14, 18 px).**
`tokens.md` states spacing is *"only these steps — no arbitrary values"* (4/8/12/16/20/24/32/40/48/64).
These app values are drift. Two ways to honor "keep design as-is":
- **(a) Add exact tokens** (byte-identical; but the spacing scale grows past the documented one). ← matches the literal "keep design as-is" rule.
- **(b) Round to the nearest documented step** (aligns to `tokens.md`; ≤2px shifts on some paddings). ← matches "when in doubt, refer to the design system."
*Recommendation:* **(a)** per the explicit rule, added under a clearly-marked "off-grid (legacy drift)" block so it's visible and can be tightened later. Confirm.

**D2 — Naming for dimension tokens (widths/heights/max-widths/etc.).**
- **(a) Semantic** where a role is clear (`max-w-modal`, `max-w-prose-sm` for ch, `w-rail`, `min-w-menu`), by-value otherwise.
- **(b) Pure by-value** (`w-440`, `h-256`, `max-w-880`) — mechanical, no false semantics.
*Recommendation:* **(a) hybrid** — semantic for the recurring roles (overlay, modal, dropdown, reading-measure, panel), by-value for true one-offs.

**D3 — Percentage widths (`8/10/15/22/25/26/34/50 %`).** These are table/column widths.
- `50%` → `w-1/2` (existing fraction). Odd ones (22/25/26/34%) → add fraction-ish tokens, **or** convert the table to a `grid-template-columns` (cleaner, removes the per-cell widths). *Recommendation:* tokenize as-is now (keep design), note grid refactor as optional later.

**D4 — Guardrail scope.** Extend the ESLint `no-restricted-syntax` rule to flag any `prop-[…]` **except** the
allowlist: `[--…]`, `[var(--…)]`, arbitrary *variant* selectors (`data-`/`group-`/`peer-`/`aria-`/`has-`/`*:`),
and animation utilities. Confirm the allowlist shape.

---

## Execution plan (once D1–D4 are settled)

1. Add all token scales to `tailwind.config.ts` (+ register any that collide with a standard prefix in
   `cn`'s tailwind-merge config, per the FU5 coupling — letterSpacing/lineHeight/zIndex/shadow are safe;
   custom `w-`/`h-`/`max-w-` names **must** be registered or they'll be stripped like `text-overline` was).
2. Codemod per category (deterministic value→token map), **excluding** the allowlist. Same approach as the
   font migration; one commit per category group for reviewability.
3. Gates each commit (`lint`, `test`, `test:coverage` ≥95%/file) + **visual verify** the dense screens
   (dashboard, consultation, billing, patients, modals, calendar, dropdowns) at desktop + a narrow width.
4. Extend the guardrail (D4) — lands last, after zero arbitrary design classes remain.
5. Update `docs/qa/2026-07-13-ui-followups.md` to mark FU4 fully closed.

**Size:** ~408 edits across ~130 files; ~70–100 new tokens across ~12 scales; ~8–10 commits. Larger and more
decision-heavy than the font migration (more property types; genuine one-offs; color/shadow edge cases).
**Risks:** token-name bloat; the tailwind-merge coupling for custom `w-/h-/max-w-` names (FU5); not touching
variant selectors; percentage/ch edge cases. Verification-heavy.

---

## Does this complete FU4?

**Yes.** FU4 had three parts: `font-normal` (✅ done, FU2), the caption→medium weight change (✅ decided,
won't-do), and **the non-font arbitrary values — this scope.** Executing this migration closes FU4 entirely.
Nothing else is needed for FU4 beyond the decisions above and running the plan.
