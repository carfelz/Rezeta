# Rezeta — Improvements and Recommendations

This document is for things that _work_ but could be done better. Not bugs (those are in the audit). Architectural and product-level alternatives worth considering once the bug list is clear.

Items are ordered by leverage — biggest payoff first.

---

## 1. Replace the dual `protocol-recommendations` / `protocol-suggestions` modules with one clear concept

### Today

Two backend modules with different purposes but collision-prone names:

- `ProtocolRecommendationsModule` (`/v1/patients/:patientId/protocol-suggestions`) — ranks protocols a doctor might want for a _specific patient_. Powers the gate.
- `ProtocolSuggestionsModule` (`/v1/protocols/:protocolId/suggestions`) — accumulates _doctor edits_ to a protocol, so improvements bubble up to the template owner. Powers the learning system.

The frontend hook is `useProtocolSuggestions` regardless of which one's meant. There's also a `pattern-detection.scheduler.ts` and a `weekly-summary.scheduler.ts` inside the suggestions module that have nothing to do with the gate. The naming makes the codebase harder to navigate.

### Proposed

Two clear concepts with clear names:

- **Recommendations** — "what protocol should I use next for this patient?" Per-patient, per-doctor, ranked. URL: `/v1/patients/:id/protocol-recommendations`. Hook: `useProtocolRecommendations(patientId)`.
- **Improvements** — "what edits have doctors made to this protocol that should bubble up?" Per-protocol, aggregated. URL: `/v1/protocols/:id/improvements`. Hook: `useProtocolImprovements(protocolId)`.

This kills the "suggestions" word in this codebase. Every reader, future LLM, and new contributor immediately knows which one is meant.

### Effort

~2 hours of rename work. Update controllers, routes, hook names, type names. Run tests. Update docs. The rename is mechanical because today's frontend doesn't actually call either endpoint correctly (see fake-suggestions bug), so there are no consumer migration concerns yet — do it before that lands.

### Why now

Naming costs compound. Today there are zero correct callers; tomorrow there's one and it gets cargo-culted. The rename is essentially free _right now_ and increasingly expensive every week.

---

## 2. Rethink view-mode persistence as a User Preferences subsystem

### Today

View-mode is one preference, in `localStorage`, on one frontend file. The handoff Q3 asked about it; the answer was supposed to be `User.preferences` but ended up being localStorage.

### Proposed

A real preferences subsystem — because there will be more preferences, and getting the first one wrong sets the pattern for all of them.

Schema:

```prisma
model User {
  ...
  preferences Json @default("{}")
}
```

Shared type:

```ts
// packages/shared/src/types/preferences.ts
export interface UserPreferences {
  consultationViewMode: 'soap' | 'canvas'
  language: 'es' | 'en'
  defaultLocationId: string | null
  notifications: { email: boolean; push: boolean }
  // ...future preferences
}

export const DEFAULT_PREFERENCES: UserPreferences = { ... }
```

API endpoints:

- `GET /v1/users/me/preferences` — full object, with defaults filled in
- `PATCH /v1/users/me/preferences` — accepts a partial, merges and validates against a Zod schema

Frontend:

- `useUserPreferences()` returns the merged object (server preference + localStorage offline cache)
- `useUpdatePreferences()` mutates with optimistic update + write-through to localStorage
- localStorage stays as a _cache_ for snappy first paint, never as the source of truth

### Why it matters

- View-mode is the first of probably ten preferences. If we add language, default location, notification settings, dashboard layout, etc. one at a time, the system fragments.
- A doctor working at multiple health centers benefits more than usual from cross-device sync (per CLAUDE.md, target users have 2–4 locations per week).
- Sets the pattern correctly for the next preference and the one after that.

### Effort

A day. Worth doing before the Hybrid redesign ships, so view-mode is the first user of the system rather than a retrofit.

---

## 3. Make the gate the only entry point — kill the legacy form

### Today

Two ways to start a consultation: the gate (when `?patientId=X&locationId=Y` are both in URL) and the legacy patient+location picker (when one or both are missing). The legacy form is a vestige.

### Proposed

One entry point. The gate handles all states gracefully:

- No params → gate with both pickers shown inline
- `?patientId=X` → gate with patient pre-filled, location picker inline
- `?locationId=Y` → gate with location pre-filled, patient picker inline
- Both → gate as it works today

The location picker can be a small chip-style mini-select that expands inline rather than a full form. The patient picker similarly.

### Why

Two flows means twice the UI, twice the bugs, twice the surface area to keep visually consistent. The gate is well-designed; let it absorb the few cases where it currently doesn't render.

### Effort

Same as Code Prompt 1 — the kill-the-legacy-form work. Half a day if the inline pickers are designed well; longer if they need a Design pass first.

---

## 4. Establish a "primary location" per doctor

### Today

Doctors have multiple locations (target user works at 2–4 health centers). When the system needs a default location, there's no clear way to pick one. Today the location stays empty until the user manually selects it.

### Proposed

Add `User.primaryLocationId` (nullable foreign key). On first onboarding or first time having multiple locations, prompt the doctor to mark one as primary. Use it as the default everywhere a location is needed:

- Gate's location pre-fill
- Agenda's "current location" view
- Dashboard's stats scope ("today's consultations" defaults to primary location)
- New appointment defaults

### Why

The location-picker friction shows up in every flow that touches scheduling, billing, or consultations. A primary-location concept removes that friction in 80% of cases (the doctor at their main practice) without taking away the ability to pick a different one when needed.

The `Location` model already has an `isOwned` flag. That's not quite the same as primary — owned vs. external is about ownership, primary is about default-selection. They can coexist.

### Effort

Half a day for schema + endpoint + onboarding question + UI hookups in the various places that need a default. Some of it can be deferred (just dashboard + gate) and the rest backfilled later.

---

## 5. Replace `ProtocolUsage.checkedState` with `modifications` cleanly

### Today

`ProtocolUsage` has both:

- `checkedState Json @default("{}")` — legacy, simple boolean map
- `modifications Json @default("{}")` — current, structured event log

Schema comment acknowledges the duplication: `// Legacy field kept for backward compat with existing code`. Some consumers read `checkedState`, some read `modifications`.

### Proposed

A migration plan with three phases:

**Phase 1 — Make `modifications` authoritative (~1 day).**

- Add a deriving function: `getCheckedStateFromModifications(usage: ProtocolUsage): Record<string, boolean>` in `packages/shared/src/protocol/`.
- All read sites use the deriving function. No site reads `checkedState` directly anymore.
- Writes go through `modifications`; the legacy `checkedState` column gets updated as a secondary effect.

**Phase 2 — Stop writing to `checkedState` (~1 day).**

- Remove `checkedState` from write paths.
- Add a backfill script that ensures every existing row has its `checkedState` representable in `modifications` (one-time migration).

**Phase 3 — Drop the column (~1 hour).**

- Migration removes `checkedState` from the schema.
- Type drops the field.
- All consumers have already been migrated in Phase 1.

### Why

Dual storage is the kind of thing that produces "the dashboard says 6 of 8 done but the export says 5" bugs six months from now. Cleaning it up while there are few consumers is much cheaper.

### Effort

~2 days spread over a couple of weeks. Each phase is independent and can ship separately.

---

## 6. Promote `protocolsApplied String[]` to a derived view

### Today

`Consultation.protocolsApplied String[]` exists alongside the `protocolUsages` relation. Two sources of truth. Not annotated as legacy. Future analytics could pick the wrong one.

### Proposed

Drop the `protocolsApplied` column. Replace it with a database view (or a Prisma computed field) that derives the array from `protocolUsages` at read time. Anyone querying the consultation gets the convenience of the array; the storage truth is the relation.

Or: keep `protocolsApplied` as a denormalized cache, but add a database trigger that keeps it in sync with `protocolUsages` writes. This is uglier but means existing consumers don't have to change.

### Why

Two sources of truth that aren't enforced by anything is a bug factory. Either pick the relation (which is more flexible) or pick the array (which is faster for some queries) — but not both.

### Effort

Half a day if you can drop the column outright. A day if you need to keep the cache and add the trigger.

---

## 7. Make the right rail composition view-mode-aware

### Today

The right rail in SOAP mode shows: PROTOCOLOS (or empty card), CONSULTAS PREVIAS, ÓRDENES MÉDICAS. In canvas mode, the right rail disappears entirely.

### Proposed

The right rail is always present. Its content varies by view mode and consultation state:

| Panel                           | SOAP, no protocol     | SOAP + protocol | Canvas + protocol    |
| ------------------------------- | --------------------- | --------------- | -------------------- |
| ALERTAS (allergies, conditions) | ✓                     | ✓               | ✓                    |
| PASOS DEL PROTOCOLO             | —                     | ✓               | — (body shows steps) |
| CONSULTAS PREVIAS               | ✓                     | ✓               | —                    |
| ÓRDENES MÉDICAS                 | ✓                     | ✓               | ✓                    |
| Add-protocol CTA                | ✓ (dashed empty card) | —               | —                    |

Implementation: a `<RightRail>` component that takes `viewMode`, `protocol`, `patient` and decides which panels to render. Single composition point.

### Why

- ALERTAS being hidden in canvas mode is genuinely unsafe — allergy info should always be visible.
- A single composition point makes future panels (referrals, attachments) easy to add.
- The current SOAP-only right rail with everything mixed together is harder to reason about as new panel types are added.

### Effort

~1 day, alongside the SoapView extraction in Code Prompt 4.

---

## 8. Centralize date and money formatting in `lib/format.ts`

### Today

Date formatting happens inline in `ConsultaNueva.tsx`, `Agenda.tsx`, and other places. Each place re-implements the same logic with slight variations (capitalization, weekday inclusion, etc.). Currency formatting probably has the same drift.

### Proposed

A `apps/web/src/lib/format.ts` (or `apps/web/src/lib/strings.ts` if expanding the existing file) with:

```ts
export function formatDateLong(date: Date): string
export function formatDateShort(date: Date): string
export function formatDateOverline(date: Date, locationName: string): string
export function formatTimeShort(date: Date): string
export function formatRelative(date: Date): string // "hace 3 minutos"
export function formatCurrency(amount: number, currency: 'DOP' | 'USD'): string
export function formatDocument(value: string, type: 'cedula' | 'rnc' | 'passport'): string
```

Use these everywhere. Delete inline formatting helpers in pages and components.

### Why

- A single fix for the "Title Case De" Agenda bug.
- A single point of localization when (not if) English UI gets added.
- A test surface — these helpers are pure functions and easy to unit-test in isolation.
- Removes copy-paste from page components.

### Effort

~2 hours to extract + migrate the existing call sites. Worth doing as soon as someone is touching dates anyway.

---

## 9. Move the gate's "MÁS PROBABLE" logic to the backend

### Today (assuming Prompt 2's fix is done)

The frontend will call `/v1/patients/:id/protocol-suggestions` and receive a list of recommendations. Where does the "MÁS PROBABLE" badge logic live? If the frontend computes "highest score = MÁS PROBABLE," that decision is duplicated wherever recommendations are consumed.

### Proposed

The backend response includes a `mostLikely: boolean` flag on at most one item. The frontend just renders the badge if the flag is true.

```ts
type ProtocolRecommendation = {
  protocol: ProtocolSummary
  score: number
  reason: 'previous-with-patient' | 'common-for-condition' | 'recently-active'
  lastUsedWithPatient: Date | null
  mostLikely: boolean // exactly 0 or 1 entries have this true
}
```

The "Última: hace 3 meses · v2" subtitle comes from `lastUsedWithPatient`. If null (patient never seen this protocol before), the subtitle should say something else — "Sin uso previo" or just the protocol type.

### Why

- The "MÁS PROBABLE" badge today is misleading because the data behind it is wrong (see audit L2). Moving the logic to the backend with proper data forces honesty: if the patient has never seen any protocol, no badge.
- Different consumers (gate, agenda widget, dashboard "next likely consultation" feature) can all use the same flag.
- Easier to A/B test ranking algorithms server-side.

### Effort

~1 day. Most of the backend infrastructure (`ProtocolRecommendationsService`) probably already computes a score; just expose it and add the boolean flag.

---

## 10. Single source of truth for status enums and their labels

### Today

Status values like `active`, `draft`, `archived` for protocols, `draft`/`signed` for consultations, `pending`/`paid`/`emitted` for invoices, etc. live as string unions in TypeScript and as varchar columns in Postgres. The Spanish labels are usually inline at render sites.

### Proposed

For each enum, one source of truth that produces both the type and the labels:

```ts
// packages/shared/src/enums/protocol-status.ts
export const PROTOCOL_STATUSES = [
  { value: 'active', label_es: 'activo', label_en: 'active' },
  { value: 'draft', label_es: 'borrador', label_en: 'draft' },
  { value: 'archived', label_es: 'archivado', label_en: 'archived' },
] as const

export type ProtocolStatus = (typeof PROTOCOL_STATUSES)[number]['value']
export const PROTOCOL_STATUS_LABELS_ES = Object.fromEntries(
  PROTOCOL_STATUSES.map((s) => [s.value, s.label_es]),
) as Record<ProtocolStatus, string>
```

Render sites use `PROTOCOL_STATUS_LABELS_ES[status]`. When English is added, swap the lookup.

### Why

- Solves the live-audit bug L6 (`active` showing in English) at the system level.
- Makes the UI exhaustive — adding a new status forces the label to be added too.
- Makes future i18n a one-pass change.

### Effort

~1 hour per enum. Worth doing as a single PR once you have 3–4 enums to migrate.

---

## 11. Move autosave behind a real status indicator

### Today

The consultation page shows a "Sin guardar" pill, a "Guardar borrador" button, and a "Firmar y cerrar" button. The user never sees explicit autosave activity. Whether the system is actually preserving their work is opaque.

### Proposed

A single status pill that reflects autosave state in real time:

| State                   | Pill text                       | Color         |
| ----------------------- | ------------------------------- | ------------- |
| Idle, all changes saved | `Guardado · hace 12s`           | Neutral       |
| In flight               | `Guardando…`                    | Subtle accent |
| Failed                  | `Error al guardar · Reintentar` | Danger        |
| Offline                 | `Sin conexión · Borrador local` | Warning       |

Drop "Guardar borrador" once autosave is reliable. Keep "Firmar y cerrar" as the primary action.

Implementation: the consultation page already has change-detection logic; tie it to a debounced PATCH (every 2s after last keystroke, or on blur of any field). Use a `useAutosave(consultation, { debounceMs: 2000 })` hook so the same pattern can be reused for protocol editor, template editor, etc.

### Why

- Doctors filling out a long consultation deserve confidence that their work is preserved without thinking about it.
- The current "Sin guardar" → "Guardar borrador" pattern is from a pre-autosave era.
- Autosave with visible state is now the norm in any serious productivity tool.

### Effort

~2 days for a robust implementation. Defer if there are more critical bugs in the queue, but plan for it.

---

## 12. Make the protocol editor block-add UX more discoverable

### Today

The protocol editor shows a fixed right-side palette of "Bloques disponibles" with 9 options (Texto, Sección, Checklist, Tabla de dosis, Árbol de decisión, Alerta clínica, Pasos, Orden de imagen, Orden de laboratorio). Each is clickable. Clicking adds the block at the bottom (or maybe at the cursor position — I didn't test).

The flow is reasonable but slow if you know what you want. There's no keyboard shortcut, no slash-command, no drag-and-drop visible.

### Proposed

Two complementary improvements:

**A. Slash command in any block.**
Type `/` in any text field → autocomplete menu of block types. Select one to insert below. Common in Notion-style editors and would feel right at home.

**B. Drag-from-palette.**
The current right-side palette becomes draggable. Drop a block at any position in the document. Visual cue with a placeholder line where it'll land.

### Why

- Doctors authoring protocols are typically not full-time content authors. They want to add a block, write the content, move on. Saving them clicks compounds.
- Drag-and-drop also clarifies the spatial model — protocols are documents, blocks have positions.

### Effort

A week for both, well-separated PRs. Slash commands first (smaller scope, immediate payoff). Drag-and-drop later if needed.

---

## 13. Build a "consultation preview" route for QA

### Today

Visual states like the gate empty-state, the strip with progress, the canvas with multiple protocols, the missing-fields panel, etc. exist as `_preview/*` routes (gate, strip, canvas, edge, order-queue). These are excellent for design QA.

The full consultation page itself (`/consultas/:id`) doesn't have a preview route. To see the actual SOAP layout you have to log in, create a patient, create a consultation, etc.

### Proposed

A `_preview/consulta-soap` and `_preview/consulta-canvas` that mount the full Consulta page with mock data covering several scenarios:

- Empty draft consultation (no protocol, no SOAP content)
- Filled draft (all SOAP fields filled, no protocol)
- Active protocol mid-flow (some steps done, decision pending)
- Multi-protocol consultation (parent + child via decision tree)
- Signed consultation (read-only)
- Signed consultation with one amendment

These become the regression-checking surfaces for any layout work in the future. No auth, no seeding, no real DB needed.

### Why

- The most complex page in the app deserves the same preview rigor the gate has.
- After Code Prompt 5 extracts components from `Consulta.tsx`, the page becomes thin enough to mount with arbitrary props.
- Catches "did this PR break the signed-consultation read-only state?" without manual reproduction.

### Effort

~Half a day. Reuses fixtures from existing tests.

---

## 14. Add a "skill file" for the Rezeta domain

### Today

The CLAUDE.md is a single file with project instructions. As the project grows, it'll either become unreadable or be missing detail.

### Proposed

A `skills/` directory with skill files for specific concerns. For example:

- `skills/protocol-engine/SKILL.md` — how the block model works, how `modifications` are structured, how versioning interacts with usages
- `skills/clinical-vocabulary/SKILL.md` — Spanish medical vocabulary the app uses, common abbreviations (PA, SatO₂, FC, etc.), what they mean
- `skills/dr-conventions/SKILL.md` — Dominican Republic-specific conventions (cédula vs RNC vs passport, currency display, business hour conventions)
- `skills/audit-log/SKILL.md` — what gets audited, how to add new audit categories, redaction rules
- `skills/data-model/SKILL.md` — the ERD with explanations of why certain decisions were made (multi-tenancy, doctor-owned patients, etc.)

CLAUDE.md becomes a thin index pointing to these.

### Why

- These work across Claude Code, Claude Desktop, and Claude.ai — write once, get them everywhere.
- New contributors (human or AI) can read the relevant skill rather than the whole CLAUDE.md.
- Skills can be updated independently and have their own commit history.

### Effort

~2 hours per skill. Don't write them all at once; create one when you notice the same explanation appearing in two different sessions.

---

## 15. Consider a server-driven onboarding state machine

### Today (presumed, since I didn't fully audit)

The onboarding flow appears to live at `/bienvenido` and `/bienvenido/personalizar`, gated by `BienvenidoGate.tsx`. The gating logic is presumably "user has tenant.seededAt set" or similar.

### Proposed

A server-driven state machine where the onboarding step is a discrete enum on the user (or tenant): `not_started | basic_info | locations | first_protocol | done`. The frontend always asks the API for the next step and renders the corresponding screen.

### Why

- New onboarding steps can be added server-side without frontend changes.
- Pause-and-resume works naturally — the user logs out mid-onboarding and picks up where they left off.
- A/B testing different onboarding orderings is straightforward.

### Effort

~3 days, but worth deferring until the onboarding flow has been re-audited and any current bugs found. Don't refactor what hasn't been observed.

---

## Summary

If you only do three things from this document:

1. **#1** — rename the suggestion modules. Cheapest, highest clarity payoff.
2. **#2** — preferences subsystem. Sets the pattern correctly for the next ten preferences.
3. **#3** — gate as the only entry point. Removes a UI you didn't intend to keep.

The rest are good ideas that can be picked up opportunistically when their nearby code is touched anyway.
