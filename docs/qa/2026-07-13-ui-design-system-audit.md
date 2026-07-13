# UI / design-system audit — findings (2026-07-13)

Second dogfooding pass, this time a **visual / design-system audit** rather than a functional one.
Trigger: fonts in the **vital-signs block** and the **allergy badge** render noticeably larger than
the design intends. Driven live against the running app (`http://localhost:5173`) with computed-style
measurements, plus a full-tree source sweep of `apps/web/src`.

**Nothing here was fixed** — this document enumerates the mismatches for review. A companion functional
pass is in `docs/qa/2026-07-13-live-e2e-findings.md`.

---

## Headline: one config decision breaks every default Tailwind text size and breakpoint

`apps/web/tailwind.config.ts` sets `theme.fontSize`, `theme.screens`, `theme.fontWeight` (and others)
**directly on `theme`, not under `theme.extend`**. In Tailwind, assigning a key on `theme` *replaces*
that key's defaults entirely. The intent was deliberate for the type scale (`text-display … text-overline`)
and the two breakpoints (`lg`, `xl`) — but the side effect is that **all of Tailwind's stock utilities in
those families no longer exist**:

- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl … text-9xl` → **deleted**
- `sm:`, `md:`, `2xl:` responsive variants → **deleted**

Any component still using one of those classes gets **no CSS rule at all**, so the element silently
**inherits its parent's font-size (16px from `<body>`)** or, for breakpoints, the responsive layout
**never activates**. This is invisible in code review (the class name looks valid) and invisible to the
type-check/lint/test gates (they don't compile Tailwind or assert computed styles).

### Proof (measured live, consultation `830f9c00`, viewport ~800px)

Probe elements injected into the live DOM:

| Class | Computed font-size | Intended |
|---|---|---|
| `text-xs` | **16px** | (should be ~12px) |
| `text-sm` | **16px** | (should be ~13–14px) |
| `text-base` | **16px** | — |
| `text-caption` (real token) | 12px | 12px ✓ |
| `text-body-sm` (real token) | 13px | 13px ✓ |
| `text-h3` (real token) | 18px | 18px ✓ |

Compiled-CSS scan for media queries: `min-width:640px` (sm) — **absent**; `min-width:768px` (md) —
**absent**; `min-width:1536px` (2xl) — **absent**. Only `lg` (1024px) and `xl` (1440px) exist.

So the rule is simple: **every `text-[..px]` arbitrary value works; every stock `text-xs/sm/base/lg`
renders at 16px; every `sm:`/`md:` class does nothing.**

---

## Summary of findings

| ID | Severity | Area | One-liner |
|----|----------|------|-----------|
| U1 | **High** | Vital-signs block | Labels, units & value inputs render at **16px** (`text-xs`/`text-sm` dead) — should be ~12/13px |
| U2 | **High** | Allergy / chronic header chips | Chip text renders at **16px** (`text-xs` dead) — the "odd, oversized" badge |
| U3 | Medium | Clinical-notes block | Note text/textarea render at **16px** (`text-sm` dead) — should be ~13px |
| U4 | Medium | Root cause (config) | `theme.fontSize`/`theme.screens` replace (not extend) defaults → all stock utilities deleted |
| U5 | Medium | Responsive layout | Every `sm:`/`md:` class is dead (Dashboard grid, Protocols, VitalsSection, AppLayout, calendar) |
| U6 | Low | Calendar / date-picker | `text-sm`/`text-xs` in `calendar.tsx` render at 16px |
| U7 | Low | Sidebar | `text-base` at `Sidebar.tsx:140` renders at 16px (inherited — coincidentally matches, but off-scale) |
| U8 | Low | Error screen | `text-5xl`/`text-2xl` in `ErrorBoundary` collapse to 16px — crash screen looks unstyled |
| U9 | Advisory | Whole app | Vitals/allergy/badge bypass the type scale with raw `text-[..px]` values instead of `text-caption`/`text-body-sm` |
| U10 | Advisory | Vital signs | Two separate vitals renderers (`VitalsBlock` vs `VitalsSection`) with different type styling |

Every "16px render" below is a **regression the user can see today**, not a theoretical one.

---

## Findings

### U1 — Vital-signs block: labels, units, and value inputs are oversized [HIGH]
- **Observed (measured live):** in the consultation, the vitals value inputs `120/80` and `72` compute to
  **`font-size: 16px`** (IBM Plex Mono); the unit spans `(mmHg)`/`(lpm)`/`(°C)` also **16px**. Next to the
  block-type chip "SIGNOS VITALES" (correctly 10.5px), the numbers look oversized — the reported symptom.
- **Where / why:** `apps/web/src/components/protocols/blocks/VitalsBlock.tsx`
  - line 23 — field label uses `text-xs` (dead → 16px)
  - line 28 — computed value box uses `text-sm` (dead → 16px)
  - line 34 — editable value input uses `text-sm` (dead → 16px)
  - line 25 — unit span `ml-1 text-n-400` has **no size class at all** → inherits 16px
- **Intended:** per the type scale, labels ≈ `text-caption` (12px) / units smaller; values ≈ `text-body-sm`
  (13px). The block chips ("SIGNOS VITALES") already use `text-[10.5px]` and render correctly for contrast.
- **Bonus (same file):** line 34 also references `focus:ring-p-400` and `text-p-400`, but the `p` color
  scale is `50/100/300/500/700/900` (no `400`) — so that focus ring color is also dead.

### U2 — Allergy & chronic header chips render at 16px — the "odd" badge [HIGH]
- **Observed (measured live):** the `⚠ Penicilina` chip under the consultation title computes to
  **`font-size: 16px`, weight 500**. The equivalent alert in the right rail ("Alergia · Penicilina")
  correctly renders at **12.5px** — so the same allergy shows at two different sizes on one screen, and the
  header one is the oversized/odd one.
- **Where / why:** `apps/web/src/pages/Consultation/PageHeader.tsx`
  - line 63 — allergy chip: `... text-danger-text text-xs font-medium` (`text-xs` dead → 16px)
  - line 72 — chronic-condition chip: same pattern, `text-xs` → 16px
  Because the text is 16px, the Phosphor `ph-warning` icon (sized by font-size) is enlarged too.
- **Intended:** ~12px (`text-caption`), matching the sidebar alert. Also note (U9) the header chip does not
  use the shared `Badge` component, so it diverges in size/padding from every other badge in the app.

### U3 — Clinical-notes block text is oversized [MEDIUM]
- **Observed (measured live):** the "Motivo de consulta" note text / textarea computes to **16px**.
- **Where / why:** `apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx`
  - line 21 — `text-sm` (dead → 16px)
  - line 22 — `text-xs` (dead → 16px)
  - line 25 — `text-sm` (dead → 16px)
- **Intended:** body copy ≈ `text-body`/`text-body-sm` (13–14px).

### U4 — Root cause: `theme` keys replace defaults instead of extending them [MEDIUM — config]
- **Where:** `apps/web/tailwind.config.ts`
  - `fontSize:` at line 108 (custom scale) — replaces stock `text-xs … text-9xl`
  - `screens:` at line 139 (`lg`, `xl` only) — replaces stock `sm`/`md`/`2xl`
  - `fontWeight:` at line 122, `borderWidth:` at line 146 similarly replace defaults (lower blast radius).
- **Why it matters:** the replacement is intentional and fine *if nothing uses the removed utilities* — but
  the codebase does, in 17 spots (U1–U3, U5–U8). The safest options are (a) restore the removed names as
  explicit aliases so stray usages don't silently break, or (b) add a lint rule banning stock
  `text-xs/sm/base/lg` and `sm:/md:/2xl:` so they can never be reintroduced. (Decision left to you — not fixed.)

### U5 — Every `sm:` / `md:` responsive class is dead [MEDIUM — layout]
- **Observed (measured live):** the compiled stylesheet contains **no** `min-width:640px`, `768px`, or
  `1536px` media queries. So these responsive utilities never activate:
  - `pages/Dashboard/index.tsx:101,149,154` — `sm:grid-cols-*` (dashboard cards stay single-column below `lg`)
  - `pages/Dashboard/PageHeader.tsx:18` — `sm:flex/items/justify`
  - `pages/Protocols/index.tsx:77` (`sm:`), `:94` (`md:`)
  - `components/consultations/VitalsSection.tsx:24` — `sm:grid-cols-4` (this vitals grid never reaches 4-up)
  - `components/layout/AppLayout.tsx:60` — `sm:p*`
  - `components/ui/calendar.tsx:45` — `md:*`
- **Impact:** medium-width layouts fall back to the base (usually 1-column) until the `lg` (1024px)
  breakpoint, so there's a dead zone between ~640–1024px where intended multi-column layouts don't apply.

### U6 — Calendar / date-picker uses dead text sizes [LOW]
- **Where:** `components/ui/calendar.tsx:68,82,83` (`text-sm`), `:202` (`text-xs`) → all 16px; `:45` (`md:`) dead.
- **Impact:** date-picker cells/labels render larger than intended wherever the calendar appears (agenda,
  appointment forms).

### U7 — Sidebar nav label off-scale [LOW]
- **Where:** `components/layout/Sidebar.tsx:140` — `text-base` (dead → inherits 16px).
- **Impact:** cosmetically it lands near the intended size by inheritance, but it's off the type scale and
  will break if the parent size changes. Should be an explicit scale token.

### U8 — Error boundary collapses to body size [LOW]
- **Where:** `components/ErrorBoundary.tsx:31` (`text-5xl`), `:32` (`text-2xl`), `:33,37` (`text-sm`).
- **Impact:** on a render crash, the fallback's big heading/icon collapse to 16px, so the error screen looks
  unstyled. Low priority (only on crash) but it's the one screen you least want looking broken.

### U9 — Type scale is bypassed app-wide with raw `text-[..px]` values [ADVISORY]
- The vitals, allergy, badge, and input components almost never consume the real scale
  (`text-caption`/`text-body-sm`/…). Instead they hard-code arbitrary pixel values:
  `text-[10.5px]`, `text-[11.5px]`, `text-[12.5px]`, `text-[13px]`, `text-[28px]`, etc.
  (e.g. `Badge.tsx:5` `text-[11.5px]`, `Input.tsx:18/123` `text-[13px]`, `ConsultationSidebar.tsx:49`
  `text-[12.5px]`, `PageHeader.tsx:48` `text-[28px]`).
- These **work** (arbitrary values compile), but they violate the CLAUDE.md rule *"Every … type size must
  reference a token … never write raw … sizes in component code."* The result is ~7 one-off sizes
  (10, 10.5, 11, 11.5, 12, 12.5, 13, 28 px) that don't map to the 8-step scale — which is *why* it's hard to
  tell a bug (U1–U3, a wrong 16px) from an intentional off-scale value at a glance.
- **Advisory:** consolidate onto the named scale, or formally add the half-step sizes (10.5/11.5/12.5) to the
  scale as tokens if they're deliberate. Not fixed.

### U10 — Two divergent vital-signs renderers [ADVISORY]
- `components/protocols/blocks/VitalsBlock.tsx` (mono, `text-xs`/`text-sm` — the broken one that renders in
  the consultation) and `components/consultations/VitalsSection.tsx` + `VitalInput.tsx` (sans, `text-[12px]`/
  `text-[13px]` — works) are two separate implementations of the same "vital signs" UI with different type,
  font family, and layout. Worth consolidating so vitals look identical everywhere and there's one place to
  fix sizing.

---

## Suggested order of attack (when you decide to fix)
1. **U4 first** — decide the config policy (alias the removed utilities back, or lint-ban them). This
   determines whether U1/U2/U3/U5/U6 are "swap the class" fixes or "the class works now" fixes.
2. **U1 + U2 + U3** — the three visible oversizing bugs on the consultation screen (the reported symptom).
3. **U5** — audit the `sm:`/`md:` usages; convert to base + `lg:` or a real intermediate breakpoint.
4. **U6–U8** — mop up the remaining dead classes.
5. **U9 + U10** — design-system hygiene (token consolidation, single vitals component).

## Test-gap note
No gate catches any of this: unit tests don't render Tailwind, and there's no visual/computed-style
assertion. A cheap guard is a lint rule (or a tiny compiled-CSS assertion) that fails on stock
`text-xs|sm|base|lg|xl` and `sm:|md:|2xl:` usage — it would have caught all of U1–U8 at author time.
