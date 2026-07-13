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
- Follow-up pass (this doc): removed the dead pre-v2 vitals code (FU1), cleared the last `font-normal`
  in the vendored calendar (FU2), and collapsed signup to a single provision write (FU3).

## Follow-ups

**Status (2026-07-13):** FU1–FU3 done, FU4 done except one deferred item, FU5 was documentation only.
The only work left open is the optional spacing/line-height token pass (see FU4).

### FU1 — Consolidate the two vital-signs components (audit U10) — ✅ DONE
**Resolved:** on investigation `VitalsSection.tsx` + `VitalInput.tsx` (and their `lib/consultation/vitals.ts`
helper) were **dead code** — nothing imported them; `components/protocols/blocks/VitalsBlock.tsx` is the
only live vitals component (v2 moved clinical content into protocol blocks). Deleted the obsolete
components, the helper, their tests, and the unused `vitalsSectionStrings`; reworded the
`BlockRendererRunMode` BMI comments that referenced the deleted helper. So "consolidation" was deletion,
not a merge. (typecheck confirmed no live references.)

### FU2 — Normalize the vendored shadcn `calendar.tsx` — ✅ DONE
**Resolved (option a, minimal):** the only actual defect was `font-normal` (dead weight) → changed to
`font-regular`. The remaining shadcn/react-day-picker classes (`text-muted-foreground`, `bg-primary`,
`min-w-[--cell-size]`, `[&>span]:text-xs`, data-attribute variants) resolve correctly against the config,
and the file has no raw pixel font sizes, so it passes the guardrail — no ESLint override needed.

### FU3 — Collapse the redundant empty `/v1/auth/provision` write (F1 follow-up) — ✅ DONE
**Resolved:** `signUp` now stashes the profile in a transient `_pendingProfile` (cleared if signUp
throws) instead of posting a second provision; `AuthProvider` consumes it via `_consumePendingProfile()`
so the single `onAuthStateChanged`-driven provision creates the user with its name/specialty. Logins
provision with an empty body as before (verified live: 200 OK, app authenticated).

### FU4 — Residual off-token hygiene (audit U9 tail, U7)
- `font-normal` — ✅ DONE: the last one was in `calendar.tsx`, fixed under FU2. None remain app-wide.
- Semantic-token weight change — ✅ DECIDED (won't-do): converting a plain `text-xs` label to
  `text-caption` would add `font-medium`, a deliberate style change. Left as-is; apply per component only
  if a uniform "caption = medium" look is explicitly wanted.
- **Non-font raw arbitrary values (`leading-[..]`, `min-w-[..]`, `w-[..px]`, `px-[..px]`, `tracking-[..]`)
  — ⏳ OPEN / deferred.** This is a separate, app-wide migration of the same shape as the font one and was
  not scoped here. The spacing scale is already tokenized in `tailwind.config.ts`; a future pass could
  migrate raw spacing/line-height values and extend the guardrail to cover them. Left for its own change.

### FU5 — Custom font-size tokens have a two-file coupling (maintenance trap) — ✅ DOCUMENTED
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
