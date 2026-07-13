# UI / design-system follow-ups (2026-07-13)

Tracked items deferred out of the 2026-07-13 typography-token migration and the E2E/UI fixes.
Each is scoped enough to pick up as its own change. Context:
`docs/qa/2026-07-13-ui-design-system-audit.md` and `docs/qa/2026-07-13-live-e2e-findings.md`.

## Done in this pass (for reference)
- Tailwind `fontSize`/`screens` moved to `extend` (no more dead `text-xs`/`text-sm`/`sm:`/`md:`).
- App-wide typography migration: ~669 raw `text-[..px]` classes → the token scale
  (`text-2xs`/`overline`/`xs`/`sm`/`base`/`body-lg`/`h3`/`h2`/`h1`/`display`); `text-sm` (13) / `text-xs`
  (12) are the canonical base sizes (see CLAUDE.md).
- ESLint guardrail bans raw `text-[..px|rem]` font sizes.
- Dead `font-normal` → `font-regular` and undefined `p-400`/`p-600` → `p-500` in app code.
- Registered the custom font-size tokens with `cn()`'s tailwind-merge config so they aren't stripped as
  text-colors (they were, which made `Badge` inherit 16px); `Badge` moved off composite `text-overline`
  to plain `text-xs`.

## Follow-ups (open)

### FU1 — Consolidate the two vital-signs components (audit U10)
`components/protocols/blocks/VitalsBlock.tsx` (mono, used in the consultation/protocol blocks) and
`components/consultations/VitalsSection.tsx` + `VitalInput.tsx` (sans) are two implementations of the
same "vital signs" UI with different type and layout. Consolidate to one component so vitals look
identical everywhere and sizing lives in one place. Medium effort, no user-visible change intended.

### FU2 — Normalize the vendored shadcn `calendar.tsx`
`components/ui/calendar.tsx` is a shadcn/react-day-picker island still using non-design-system
conventions: `font-normal` (dead weight — should be `font-regular`), `text-muted-foreground`,
`bg-primary`, `min-w-[--cell-size]`, `[&>span]:text-xs`, data-attribute variants. Its `text-[0.8rem]`
was already migrated to `text-sm`. Decide whether to (a) normalize it onto the design tokens or
(b) formally treat `components/ui/calendar.tsx` as vendored and add an ESLint override documenting that.
Low priority; the date-picker renders fine.

### FU3 — Collapse the redundant empty `/v1/auth/provision` write (F1 follow-up)
`providers/AuthProvider.tsx` fires an empty-body `/v1/auth/provision` on every `onAuthStateChanged`
(so it also runs on plain logins, not just signup). The backend backfill (commit `1d0c09b`) makes this
harmless for correctness, but the redundant write could be removed by threading the signup profile
through the store into a single provision call. Low priority; purely an efficiency/cleanup item.

### FU4 — Residual off-token hygiene (audit U9 tail, U7)
- `font-normal` remains only in the vendored `calendar.tsx` (see FU2).
- A few semantic-token conversions were intentionally NOT applied because they change weight, e.g.
  converting a `text-xs` label to `text-caption` adds `font-medium`. If a uniform "caption = medium"
  look is wanted, apply it deliberately and verify per component.
- Raw arbitrary values in NON-font properties (`leading-[..]`, `min-w-[..]`, `w-[..px]`, `px-[..px]`,
  `tracking-[..]`) were left as-is; the migration and guardrail cover font-size only. A separate pass
  could extend token discipline (and the guardrail) to spacing/line-height if desired.

### FU5 — Custom font-size tokens have a two-file coupling (maintenance trap)
Adding a new custom font-size token requires editing **two** files, or the token is silently stripped
and the element inherits the body's 16px:
1. `apps/web/tailwind.config.ts` — define it in `theme.extend.fontSize`.
2. `apps/web/src/lib/utils.ts` — register the name in the `font-size` class group of
   `extendTailwindMerge`. `cn()` runs tailwind-merge, which only knows the stock size names; an
   unregistered custom token is misclassified as a text-*color* and dropped whenever a `cn()`-composed
   element also sets a color class.
The same coupling applies to any custom token whose name collides with a standard utility prefix
(`text-`/`font-`/`h-`/`w-`). This is now documented in CLAUDE.md (Design System). No open work — logged
here so anyone extending the scale from the follow-ups sees it. Related: `text-overline`/`caption`/`h*`
are **composite** type styles (they set family/weight/color/casing, not just size) — use the numeric
tokens (`2xs`/`xs`/`sm`/`base`) for plain text, which is why FU-era `Badge` uses `text-xs`.

## Test-gap note (addressed)
The typography guardrail (`eslint.config.js` `no-restricted-syntax`) now fails CI on any new
`text-[..px|rem]`. Extending similar guardrails to spacing/radius is possible but out of scope here.
