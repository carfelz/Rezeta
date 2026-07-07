# Run-Mode Vitals & Clinical Notes Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let doctors fill in `vitals` and `clinical_notes` protocol blocks during a consultation, persisting entered values into the usage content (feeding sign-validation and the historia médica mapper) with audit events alongside.

**Architecture:** Reuse the existing editor components (`VitalsBlock`, `ClinicalNotesBlock` — both already accept `onChange`) inside `BlockRendererRunMode`'s two missing cases. Extend the existing `usePendingModifications` buffer with a content-edits channel: edits update the local usage content overlay immediately (sign-validation and MissingFieldsPanel react live) and flush in the same `PATCH /v1/consultations/:cid/protocols/:usageId` call as modification events (`{ content, modifications }` — the schema already accepts both). Audit events (`vitals_entered`, `notes_edited`) append to the established event arrays.

**Design decisions (locked):**
1. **Dual persistence.** Usage `content` is the source of truth (mapper + sign-validation read it); `modifications.vitals_entered`/`notes_edited` are audit events. One PATCH carries both.
2. **Computed vitals fields:** only the BMI case is evaluated (a field with `id: 'bmi'` recomputes when sibling `weight` and `height` fields have numeric values, mirroring `computeBMI` in `apps/web/src/lib/consultation/vitals.ts`); all other `input_type: 'computed'` fields stay read-only `'—'`. The `formula` string stays inert (no evaluator — YAGNI).
3. `isSigned` → components render `readOnly`; no edits, no events.
4. Notes audit events record that/when a block's note changed (block_id + timestamp + final length), not every keystroke — one event per flush per touched block.

**Tech Stack:** React + TanStack Query + Zustand-adjacent buffer hook, Zod, Vitest + Testing Library.

**Branch:** `feat/run-mode-vitals-notes` (stacked on feat/historia-medica, PR #27).

## Global Constraints

- Token classes only; Spanish strings colocated; 2-space indent; no TODO/FIXME; lower-case commit subjects; ESM `.js` imports in packages/shared.
- `pnpm lint` + touched-package tests green per task; final task runs `pnpm test:coverage` (95% per-file; `src/hooks/**/use-*.ts`, `src/pages/**`, repositories, pdf.service are exempt — components and shared code are NOT).
- After editing packages/shared: `pnpm --filter @rezeta/shared build` before workspace typecheck.
- Existing behavior contract: modification events are append-only; the server merge in `consultations.repository.ts` concatenates arrays — never send already-persisted events twice.

---

### Task 1: Shared event types + web event plumbing

**Files:**
- Modify: `packages/shared/src/types/consultation.ts` (typed `VitalsEnteredEvent`, `NotesEditedEvent`; wire into `ProtocolUsageModifications`)
- Modify: `packages/shared/src/schemas/consultation.ts` (tighten `vitals_entered`/`notes_edited` array item schemas to the new shapes — they are currently `z.record(z.string(), z.unknown())`; keep passthrough-compat by making new fields required but not rejecting extra keys)
- Modify: `apps/web/src/lib/consultation/modifications.ts` (extend `BlockModificationEvent` union + `appendModification()` cases)
- Test: `packages/shared/src/schemas/__tests__/` (extend the consultation schema spec) and `apps/web/src/lib/consultation/__tests__/modifications.test.ts` (extend; find the existing file — if none exists for modifications.ts, create it mirroring the dir's harness)

**Interfaces:**
- Produces (shared):

```typescript
export interface VitalsEnteredEvent {
  block_id: string
  values: Record<string, string | number> // the block's values at flush time
  timestamp: string
}
export interface NotesEditedEvent {
  block_id: string
  length: number // chars after edit — content itself lives in usage content
  timestamp: string
}
// ProtocolUsageModifications gains:
//   vitals_entered?: VitalsEnteredEvent[]
//   notes_edited?: NotesEditedEvent[]
```

- Produces (web `modifications.ts`):

```typescript
export type BlockModificationEvent =
  | /* existing members unchanged */
  | { type: 'vitals_entered'; block_id: string; values: Record<string, string | number> }
  | { type: 'notes_edited'; block_id: string; length: number }
// appendModification() maps them to modifications.vitals_entered / notes_edited
// with a new Date().toISOString() timestamp, same as the existing cases.
```

- [ ] **Step 1: Write failing tests** — schema accepts a valid `vitals_entered`/`notes_edited` event and the typed shapes round-trip; `appendModification` appends both event kinds to their arrays (assert array contents incl. timestamp presence), mirroring the existing `checklist_item` test style.
- [ ] **Step 2: Run to verify failure** — `pnpm --filter @rezeta/shared test -- consultation` and `pnpm --filter @rezeta/web test -- modifications` (expect: missing exports / missing cases).
- [ ] **Step 3: Implement** the types, schema tightening, union members, and `appendModification` cases exactly per the Interfaces block. Check `packages/shared/src/types/consultation.ts` for the existing `ChecklistItemEvent`/`DecisionBranchSelected` definitions and match their style/placement.
- [ ] **Step 4: Verify** — both test commands pass; `pnpm --filter @rezeta/shared build && pnpm -r typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `feat(shared): typed vitals/notes modification events`

---

### Task 2: Content-edits channel in the pending buffer

**Files:**
- Modify: `apps/web/src/hooks/consultations/use-pending-modifications.ts`
- Test: `apps/web/src/hooks/consultations/__tests__/use-pending-modifications.test.tsx` (extend)

**Interfaces:**
- Consumes: the hook's existing `record(usageId, event)` / `flush()` / `applyPendingToConsultation()` internals — READ THE FILE FIRST; the shapes below adapt to its actual structure.
- Produces (added to the hook's return):

```typescript
recordContentEdit(usageId: string, blockId: string, edit:
  | { kind: 'vitals'; values: Record<string, string | number> }   // full values object for the block
  | { kind: 'notes'; content: string },
): void
// - buffers per usage+block (last-write-wins per block)
// - the pending overlay (applyPendingToConsultation) applies these edits into the
//   usage content blocks so sign-validation/MissingFieldsPanel see live state
// - flush() builds the PATCH body: when a usage has content edits, send the FULL
//   merged content object ({ ...usage.content, blocks: blocksWithEditsApplied })
//   alongside the modifications delta in ONE apiClient.patch call
// - after successful flush, clear the content buffer for that usage
```

- [ ] **Step 1: Write failing tests** — (a) `recordContentEdit` + overlay: a vitals edit shows up in the overlaid consultation's usage content (assert the block's `values`); (b) notes edit likewise (block `content`); (c) `flush()` PATCHes `{ content: expect.objectContaining({ blocks: … }), modifications: … }` in one call and clears the buffer; (d) last-write-wins per block; (e) no content key in the PATCH when only events are pending (existing behavior preserved — do not regress the current flush tests).
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** inside the existing buffer structure (do not fork a second hook — one flush lifecycle). Merging edits into blocks must recurse into `section` blocks (blocks nest) — write one small pure helper `applyContentEdits(blocks, editsByBlockId)` and unit-test it directly, including a nested-section case.
- [ ] **Step 4: Verify** — extended suite green; existing pending-modification tests untouched and green; `pnpm lint`.
- [ ] **Step 5: Commit** — `feat(web): content-edit channel in pending consultation buffer`

---

### Task 3: Run-mode render cases

**Files:**
- Modify: `apps/web/src/components/protocols/BlockRendererRunMode.tsx` (add `vitals` + `clinical_notes` cases; extend `RunModeProps` with `onContentEdit?: (blockId, edit) => void` matching Task 2's edit union)
- Modify: `apps/web/src/components/protocols/blocks/VitalsBlock.tsx` (only if needed for BMI: accept an optional `computeDerived` behavior — prefer implementing BMI derivation in the run-mode case's onChange handler and passing complete `values` down, leaving VitalsBlock untouched)
- Test: `apps/web/src/components/protocols/__tests__/BlockRendererRunMode.vitals-notes.test.tsx` (create; RTL render, mirror harness of neighboring component tests)

**Interfaces:**
- Consumes: `VitalsBlock` / `ClinicalNotesBlock` (both accept `values`/`content`, `readOnly`, `onChange` — verified), `onModification` (existing prop), Task 2's edit union.
- Behavior contract:
  - `vitals` case: renders `VitalsBlock` with the block's current `values`; each field change calls `onContentEdit(block.id, { kind: 'vitals', values: nextValues })` where `nextValues` includes the BMI recomputation rule (decision 2); also emits ONE `onModification({ type: 'vitals_entered', block_id, values: nextValues })` — but debounce event emission to blur/last-change per interaction burst if the existing pattern supports it; if not, emit per change and rely on flush-time coalescing: check how `appendModification` coalesces (if it appends raw, coalesce in the run-mode case via onBlur emission — pick the approach that keeps ONE event per editing burst and document it in the test).
  - `clinical_notes` case: renders `ClinicalNotesBlock`; onChange → `onContentEdit(block.id, { kind: 'notes', content })`; `onModification({ type: 'notes_edited', block_id, length })` on blur (not per keystroke).
  - `isSigned` → `readOnly`, no callbacks.

- [ ] **Step 1: Write failing tests** — vitals field input updates propagate `onContentEdit` with merged values; BMI derives when weight+height set and field id `bmi` exists; computed non-bmi field stays read-only; notes textarea edits propagate content and emit `notes_edited` on blur with correct length; `isSigned` renders inputs disabled and no callbacks fire.
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** the two cases; keep them as small local subcomponents in the file if the existing cases do that (match file convention).
- [ ] **Step 4: Verify + lint.**
- [ ] **Step 5: Commit** — `feat(web): run-mode input for vitals and clinical notes blocks`

---

### Task 4: Wire the consultation canvas

**Files:**
- Modify: the run-mode parent that renders `BlockRendererRunMode` and owns `usePendingModifications` (CanvasView — `apps/web/src/components/consultations/CanvasView.tsx` region identified at lines ~67-76; READ IT and its parent wiring in the Consultation page first)
- Test: extend the existing CanvasView (or nearest parent) test file with the new pass-through; plus one integration-style test: edit a vitals field → flush → `apiClient.patch` body contains the merged content.

**Interfaces:**
- Consumes: Task 2's `recordContentEdit`, Task 3's `onContentEdit` prop.
- Produces: `onContentEdit` threaded from the hook into every `BlockRendererRunMode` instance (including nested/section rendering paths if they render the component separately).

- [ ] **Step 1: Failing test** (pass-through + PATCH body integration).
- [ ] **Step 2: Verify failure.**
- [ ] **Step 3: Implement** the wiring (one prop drill; no new state).
- [ ] **Step 4: Verify** — also manually confirm `computeMissingRequiredFields` reacts: a required clinical_notes block disappears from MissingFieldsPanel once text is entered (add an assertion-level test at whatever layer the panel derives from the overlay).
- [ ] **Step 5: Commit** — `feat(web): wire content edits from run mode into pending buffer`

---

### Task 5: End-to-end into the historia + api guard

**Files:**
- Modify: `apps/api/src/modules/consultation-records/__tests__/consultation-records.service.spec.ts` (one new case)
- Test-only task.

**Interfaces:**
- Consumes: existing `ensureDraft` + `generateRecordSections`.

- [ ] **Step 1: Add the test** — consultation row whose usage content contains a vitals block WITH `values` (as the run-mode UI now writes) and a filled clinical_notes block labeled "Motivo de consulta"; assert the generated draft's `examen_fisico` contains the formatted vitals line and `motivo_consulta` the note text. (This pins the full chain: what the UI writes is exactly what the mapper reads.)
- [ ] **Step 2: Run** — `pnpm --filter @rezeta/api test -- consultation-records.service` green (no production code should need changes; if it does, STOP and report — that's a contract break, not a test fix).
- [ ] **Step 3: Commit** — `test(api): historia draft reflects run-mode vitals and notes content`

---

### Task 6: Changelog + full gates

- [ ] **Step 1:** Prepend `CHANGELOG.md` entry (`## [YYYY-MM-DD] Captura de vitales y notas clínicas en consulta` — Added: run-mode inputs for vitals/clinical_notes blocks, dual persistence content+events, BMI derivation; note historia integration).
- [ ] **Step 2:** `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage` — all green (re-run flaky web timeouts in isolation once before judging).
- [ ] **Step 3:** Commit — `docs: changelog for run-mode vitals and notes capture`
