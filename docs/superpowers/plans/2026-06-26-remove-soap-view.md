# Remove SOAP View — Protocol-First Consultations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the non-persisting SOAP fallback view and make protocols the only clinical-content surface; a consultation cannot be signed with zero protocols.

**Architecture:** Delete the SOAP/view-mode/old-gate frontend code; `ProtocolPanel` renders `CanvasView` for the active protocol and an "Agregar protocolo" empty state when none is attached. Enforce "≥1 protocol to sign" in the API (`sign()`) and disable the sign button in the UI. No "Nota libre" / free-form fallback.

**Tech Stack:** React 18 + Vite + TanStack Query + Zustand + Vitest/RTL (web); NestJS + Prisma + Vitest (api); Zod + shared `ErrorCode` enum (shared).

## Global Constraints

- Spanish for user-facing strings; English for code/identifiers. Colocate strings in the module's `strings.ts`.
- No `TODO`/`FIXME`/`HACK`/`XXX` comments (ESLint `no-warning-comments` fails CI).
- No raw hex/px in component code — use design tokens (`text-n-400`, `border-n-200`, `rounded-md`, etc.).
- Repository layer filters by `tenant_id`. Soft deletes via `deleted_at` where applicable.
- Gates before "done": `pnpm lint` clean, `pnpm test` green, coverage ≥ 90% (statements/branches/functions/lines).
- Canonical behavior spec: `specs/updated-specs/01-consultation-workflow.md` (§4.1, §4.4, §5) — already updated for this change.
- Error responses use the closed `ErrorCode` enum in `packages/shared/src/errors.ts`.

---

## File Structure

**Delete (source):**
- `apps/web/src/components/consultations/SoapView.tsx`
- `apps/web/src/components/consultations/SoapTextarea.tsx`
- `apps/web/src/components/consultations/ViewModeToggle.tsx`
- `apps/web/src/components/consultations/ConsultationGate.tsx`
- `apps/web/src/pages/Consultation/use-soap-state.ts`
- `apps/web/src/hooks/consultations/use-consultation-view-mode.ts`
- `apps/web/src/pages/_preview/GatePreview.tsx`, `StripPreview.tsx`, `CanvasPreview.tsx` (preview-only; verify each renders removed UI before deleting — see Task 5)

**Delete (tests):**
- `apps/web/src/components/consultations/__tests__/SoapTextarea.test.tsx`
- `apps/web/src/components/consultations/__tests__/ViewModeToggle.test.tsx`
- `apps/web/src/components/consultations/__tests__/ConsultationGate.test.tsx`
- `apps/web/src/components/consultations/__tests__/ConsultationGate.source.test.tsx`
- `apps/web/src/hooks/consultations/__tests__/use-consultation-view-mode.test.ts`

**Modify:**
- `packages/shared/src/errors.ts` — add `CONSULTATION_REQUIRES_PROTOCOL`
- `apps/api/src/modules/consultations/consultations.service.ts` — sign() zero-usage guard
- `apps/web/src/store/ui.store.ts` — remove `ConsultationViewMode`, `viewMode`, `setViewMode`
- `apps/web/src/store/__tests__/ui.store.test.ts` — drop view-mode assertions
- `apps/web/src/pages/Consultation/ProtocolPanel.tsx` — canvas-only + empty state; remove soap/viewMode
- `apps/web/src/pages/Consultation/ProtocolBar.tsx` — remove `viewMode`/`onViewModeChange` props
- `apps/web/src/components/consultations/ProtocolStrip.tsx` — remove `ViewModeToggle` + props
- `apps/web/src/components/consultations/CanvasView.tsx` — remove `SoapField`/`onAutoPopulate`
- `apps/web/src/pages/Consultation/index.tsx` — remove `useSoapState`; sign-disable wiring
- `apps/web/src/components/consultations/MissingFieldsPanel.tsx` — drop SOAP-field checks
- the sign button location (PageHeader/ConsultationModals — find in Task 2)
- `apps/web/src/App.tsx` — remove routes to deleted preview pages
- `apps/web/src/components/consultations/strings.ts` — remove orphaned view-mode/gate strings
- `CHANGELOG.md`

**Already updated (this session, not part of execution):** `specs/updated-specs/01-consultation-workflow.md`, `CLAUDE.md`, design doc `docs/superpowers/specs/2026-06-26-remove-soap-view-design.md`.

---

### Task 1: Backend — block signing a consultation with zero protocols

**Files:**
- Modify: `packages/shared/src/errors.ts`
- Modify: `apps/api/src/modules/consultations/consultations.service.ts` (`sign()`, ~line 177)
- Test: `apps/api/src/modules/consultations/__tests__/consultations.service.*.spec.ts` (use the existing sign spec; if none covers sign, create `consultations.service.sign.spec.ts`)

**Interfaces:**
- Produces: `ErrorCode.CONSULTATION_REQUIRES_PROTOCOL` (string `'CONSULTATION_REQUIRES_PROTOCOL'`); `sign()` throws `BadRequestException` with this code when `protocolUsages.length === 0`.

- [ ] **Step 1: Add the error code**

In `packages/shared/src/errors.ts`, under the `// ── Consultation ──` group (next to `CONSULTATION_MISSING_REQUIRED_FIELDS`), add:

```ts
  CONSULTATION_REQUIRES_PROTOCOL: 'CONSULTATION_REQUIRES_PROTOCOL',
```

- [ ] **Step 2: Rebuild shared so the type is visible to the API**

Run: `pnpm --filter @rezeta/shared build`
Expected: exits 0.

- [ ] **Step 3: Write the failing test**

Find the existing sign test setup (search: `grep -rn "\.sign(" apps/api/src/modules/consultations/__tests__`). Mirror its mock/builder style. Add:

```ts
it('rejects signing when the consultation has zero protocol usages', async () => {
  // Arrange: getById returns an OPEN consultation with protocolUsages: []
  // (use the suite's existing consultation builder; set protocolUsages: [])
  await expect(service.sign(consultationId, tenantId, userId)).rejects.toMatchObject({
    response: { code: ErrorCode.CONSULTATION_REQUIRES_PROTOCOL },
  })
})
```

Ensure `ErrorCode` is imported from `@rezeta/shared` in the spec.

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/consultations/__tests__ -t "zero protocol usages"`
Expected: FAIL (currently signs successfully / no such error).

- [ ] **Step 5: Add the guard in `sign()`**

In `consultations.service.ts`, immediately after the `status !== 'open'` check and **before** the `computeMissingRequiredFields` block, insert:

```ts
    // Protocol-first: a consultation with no clinical content cannot be signed.
    if (c.protocolUsages.length === 0) {
      throw new BadRequestException({
        code: ErrorCode.CONSULTATION_REQUIRES_PROTOCOL,
        message: 'Agrega al menos un protocolo antes de firmar la consulta',
      })
    }
```

(`BadRequestException` and `ErrorCode` are already imported in this file.)

- [ ] **Step 6: Run tests to verify pass**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/consultations/__tests__`
Expected: PASS (new test + existing sign tests). If an existing test signed a zero-usage consultation, update it to include ≥1 usage.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/errors.ts apps/api/src/modules/consultations
git commit -m "feat(api): block signing consultations with zero protocols"
```

---

### Task 2: Frontend — disable "Firmar y cerrar" when there are zero protocols

**Files:**
- Locate the sign button: run `grep -rn "Firmar y cerrar" apps/web/src`. It is rendered in the consultation page header/action area (likely `PageHeader.tsx` or wired from `Consultation/index.tsx`). Modify that component and its caller.
- Test: the sign button's component test (create `__tests__/<Component>.test.tsx` if absent).

**Interfaces:**
- Consumes: `consultation.protocolUsages` (array) from `ConsultationWithDetails`.
- Produces: sign button receives a `disabled` (or `canSign`) boolean; disabled when `protocolUsages.length === 0`.

- [ ] **Step 1: Identify the sign button and its props**

Run: `grep -rn "Firmar y cerrar\|onShowSignChange\|showSign" apps/web/src/pages/Consultation apps/web/src/components/consultations`
Determine which component renders the button and how it gets consultation data. Read that file fully.

- [ ] **Step 2: Write the failing test**

In the button component's test, render it twice (read the component's real props first):

```tsx
it('disables "Firmar y cerrar" when there are no protocols', () => {
  render(/* component with consultation.protocolUsages = [] */)
  expect(screen.getByRole('button', { name: /Firmar y cerrar/i })).toBeDisabled()
})

it('enables "Firmar y cerrar" when at least one protocol exists', () => {
  render(/* component with consultation.protocolUsages = [oneUsage] */)
  expect(screen.getByRole('button', { name: /Firmar y cerrar/i })).toBeEnabled()
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @rezeta/web exec vitest run <path-to-test>`
Expected: FAIL (button always enabled).

- [ ] **Step 4: Implement the disable**

Add `const canSign = consultation.protocolUsages.length > 0` (or pass a `canSign` prop from the parent that has the consultation). Set the button's `disabled={!canSign}` and add `title` (tooltip) using a new string in the module `strings.ts`:

```ts
signRequiresProtocol: 'Agrega al menos un protocolo para poder firmar',
```

Apply `title={canSign ? undefined : <thatString>}` to the button. Only show the tooltip when the consultation is open (not in read-only/signed state).

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm --filter @rezeta/web exec vitest run <path-to-test>`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): disable sign button until a protocol is added"
```

---

### Task 3: Remove the view-mode system (toggle, hook, store, strip/bar props)

This makes the consultation panel canvas-only. After this task the SOAP view is the only thing the panel can fall back to; Task 4 replaces that fallback.

**Files:**
- Delete: `apps/web/src/components/consultations/ViewModeToggle.tsx` + `__tests__/ViewModeToggle.test.tsx`
- Delete: `apps/web/src/hooks/consultations/use-consultation-view-mode.ts` + `__tests__/use-consultation-view-mode.test.ts`
- Modify: `apps/web/src/store/ui.store.ts`, `apps/web/src/store/__tests__/ui.store.test.ts`
- Modify: `apps/web/src/components/consultations/ProtocolStrip.tsx`
- Modify: `apps/web/src/pages/Consultation/ProtocolBar.tsx`
- Modify: `apps/web/src/pages/Consultation/ProtocolPanel.tsx`

**Interfaces:**
- Produces: `ProtocolPanel` no longer reads `viewMode`; `ProtocolBar`/`ProtocolStrip` no longer accept `viewMode`/`onViewModeChange`. `ui.store` no longer exports `ConsultationViewMode`.

- [ ] **Step 1: Delete view-mode files**

```bash
git rm apps/web/src/components/consultations/ViewModeToggle.tsx \
  apps/web/src/components/consultations/__tests__/ViewModeToggle.test.tsx \
  apps/web/src/hooks/consultations/use-consultation-view-mode.ts \
  apps/web/src/hooks/consultations/__tests__/use-consultation-view-mode.test.ts
```

- [ ] **Step 2: Update `ui.store.ts`**

Remove the `ConsultationViewMode` type, the `viewMode` field, and `setViewMode` from `UiState` and the store body. Final file:

```ts
import { create } from 'zustand'

interface UiState {
  activeLocationId: string | null
  setActiveLocation: (id: string) => void
  missingFieldsPanelOpen: boolean
  setMissingFieldsPanelOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeLocationId: null,
  setActiveLocation: (id) => set({ activeLocationId: id }),
  missingFieldsPanelOpen: false,
  setMissingFieldsPanelOpen: (open) => set({ missingFieldsPanelOpen: open }),
}))
```

Then update `store/__tests__/ui.store.test.ts`: remove any `viewMode`/`setViewMode` assertions.

- [ ] **Step 3: Update `ProtocolStrip.tsx`**

Remove the `import { ViewModeToggle }` (line ~6) and `import type { ConsultationViewMode }` (line ~7). Remove the `viewMode?`/`onViewModeChange?` props (lines ~119-120, ~128-129) and the JSX block rendering `<ViewModeToggle ... />` (lines ~205-212). Read the file first to remove the exact lines cleanly.

- [ ] **Step 4: Update `ProtocolBar.tsx`**

Remove the `viewMode` / `onViewModeChange` props it accepts and forwards to `ProtocolStrip` (search the file for `viewMode`). Remove the `ConsultationViewMode` import if present.

- [ ] **Step 5: Update `ProtocolPanel.tsx` (view-mode only)**

- Remove `import { useConsultationViewMode } from '@/hooks/consultations/use-consultation-view-mode'` (line 17).
- Remove `const { viewMode, setViewMode } = useConsultationViewMode(hasProtocol)` (line 51). Keep `hasProtocol` for now (used in Task 4).
- Remove `viewMode={viewMode}` and `onViewModeChange={setViewMode}` from `<ProtocolBar ... />` (lines 158-159).
- Change the breadcrumb guard `viewMode === 'canvas' && activeUsage && ...` (line 166) to `activeUsage && usageIdStack.length > 0`.
- Change the main render condition `viewMode === 'canvas' && activeUsage ?` (line 190) to `activeUsage ?` (the SOAP branch stays for now — Task 4 replaces it).

- [ ] **Step 6: Typecheck + run web tests**

Run: `pnpm --filter @rezeta/web typecheck && pnpm --filter @rezeta/web exec vitest run src/components/consultations src/pages/Consultation src/store`
Expected: typecheck clean; tests pass. Fix any remaining `viewMode`/`ConsultationViewMode` references the typechecker flags (search: `grep -rn "ConsultationViewMode\|viewMode\|useConsultationViewMode" apps/web/src`).

- [ ] **Step 7: Commit**

```bash
git add -A apps/web/src
git commit -m "refactor(web): remove consultation view-mode toggle (canvas-only)"
```

---

### Task 4: Remove SOAP view + state; replace the no-protocol fallback with an empty state

**Files:**
- Delete: `apps/web/src/components/consultations/SoapView.tsx`, `SoapTextarea.tsx`, `__tests__/SoapTextarea.test.tsx`
- Delete: `apps/web/src/pages/Consultation/use-soap-state.ts`
- Modify: `apps/web/src/pages/Consultation/ProtocolPanel.tsx`
- Modify: `apps/web/src/components/consultations/CanvasView.tsx`
- Modify: `apps/web/src/pages/Consultation/index.tsx`
- Modify: `apps/web/src/components/consultations/MissingFieldsPanel.tsx`
- Test: `apps/web/src/pages/Consultation/__tests__/ProtocolPanel.test.tsx` (create)

**Interfaces:**
- Consumes: `consultation.protocolUsages`, `ProtocolPickerModal`, `CanvasView`.
- Produces: `ProtocolPanel` no longer has a `soap` prop; renders `CanvasView` when `activeUsage` exists, else the "Agregar protocolo" empty state. `CanvasView` no longer exports `SoapField` or accepts `onAutoPopulate`.

- [ ] **Step 1: Write the failing test for the no-protocol empty state**

Create `apps/web/src/pages/Consultation/__tests__/ProtocolPanel.test.tsx`. Mock the consultation hooks used by `ProtocolPanel` (mirror an existing Consultation test's mocks). Two cases:

```tsx
it('shows the "Agregar protocolo" empty state and no SOAP fields when no protocol is attached', () => {
  // render ProtocolPanel with consultation.protocolUsages = [], readOnly = false
  expect(screen.getByRole('button', { name: /Agregar protocolo/i })).toBeInTheDocument()
  expect(screen.queryByPlaceholderText(/subjetivo|objetivo|análisis|plan/i)).not.toBeInTheDocument()
})

it('renders the protocol canvas when a protocol is attached', () => {
  // render with one in_progress usage that has a blocks array → CanvasView visible
  // assert a known CanvasView element (e.g. the protocol title) is present
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/Consultation/__tests__/ProtocolPanel.test.tsx`
Expected: FAIL (SOAP fields still render in the no-protocol case).

- [ ] **Step 3: Strip SOAP from `CanvasView.tsx`**

Remove the `SoapField` type export and the `onAutoPopulate` prop and any code that calls it (the "promote block text to a SOAP field" affordance). Read the file; remove the prop from the interface, the call sites, and any now-unused imports. Keep all other block-rendering behavior.

- [ ] **Step 4: Strip SOAP from `ProtocolPanel.tsx`**

- Remove `import { SoapView }` (line 5) and `import type { useSoapState }` (line 18).
- Remove the `soap: ReturnType<typeof useSoapState>` prop from `ProtocolPanelProps` (line 25) and the `soap` param (line 37).
- Remove `handleAutoPopulate` (lines 82-95) and the `onAutoPopulate={handleAutoPopulate}` prop on `CanvasView` (line 194).
- In `handleSaveOffProtocolNote` (lines 128-150): remove the `promoteTo` parameter, the `fieldMap`/`existingSoapValue` logic, and stop passing `promoteTo`/`existingSoapValue` to the mutation. (See Task 4a for the off-protocol-note modal + mutation cleanup.)
- Update the `CanvasView` import to drop `SoapField`: `import { CanvasView, type BlockModificationEvent } from '@/components/consultations/CanvasView'`.
- Replace the `activeUsage ? <CanvasView/> : <SoapView .../>` ternary (lines 190-225) with:

```tsx
      {activeUsage ? (
        <CanvasView
          usage={activeUsage}
          onCheck={handleCheck}
          onLaunchLinkedProtocol={handleLaunchLinkedProtocol}
          onModification={handleModification}
          isSigned={readOnly}
          onContinueWithoutProtocol={() => {
            if (activeUsage) {
              removeUsageMutation.mutate(activeUsage.id, {
                onSuccess: () => setActiveUsageId(null),
              })
            }
          }}
          onEditProtocol={() => void navigate(`/protocolos/${activeUsage.protocolId}/edit`)}
        />
      ) : (
        !readOnly && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <i className="ph ph-clipboard-text text-[32px] text-n-300" />
            <p className="text-body text-n-500 m-0">{protocolPanelStrings.noProtocolTitle}</p>
            <Button variant="primary" onClick={() => onShowPickerChange(true)}>
              <i className="ph ph-plus mr-2" />
              {protocolPanelStrings.addProtocol}
            </Button>
          </div>
        )
      )}
```

Remove the now-redundant bottom "Agregar protocolo" dashed button (lines 227-237) **only** when there is no active protocol — keep an "add another protocol" affordance when a protocol IS active (it stacks multiple). Simplest: keep the dashed button block but gate it with `{!readOnly && activeUsage && (...)}` so it shows only as "add another" below an active canvas; the empty state handles the zero case. Add the strings below.

- [ ] **Step 5: Add strings**

Create or extend `apps/web/src/pages/Consultation/strings.ts` (follow the colocation pattern; if ProtocolPanel currently imports strings from `@/components/consultations/strings`, add there instead):

```ts
export const protocolPanelStrings = {
  noProtocolTitle: 'Esta consulta aún no tiene protocolos',
  addProtocol: 'Agregar protocolo',
}
```

Replace the hardcoded `Agregar protocolo` text (line 234) with `{protocolPanelStrings.addProtocol}`.

- [ ] **Step 6: Remove `useSoapState` from `index.tsx`**

In `apps/web/src/pages/Consultation/index.tsx`:
- Remove `import { useSoapState }` and the `const soap = useSoapState(...)` call.
- Remove `soap={soap}` from `<ProtocolPanel ... />`.
- Remove the SOAP-based `computeMissingFields` usage (the `ConsultationFieldCheck` built from `soap`). The missing-fields indicator is now driven by the protocol-based `computeMissingRequiredFields` from `@rezeta/shared` applied to `consultation.protocolUsages` (read `MissingFieldsPanel.tsx` to align the prop it expects).
- Fix the `hasContent`/`SaveBadge` logic that referenced `soap` — base "has content" on `consultation.protocolUsages.length > 0`.

- [ ] **Step 7: Rework `MissingFieldsPanel.tsx`**

Remove `computeMissingFields` (the SOAP-field version checking `chiefComplaint`/`assessment`/`diagnoses`) and the `ConsultationFieldCheck` type. The panel should accept the already-computed missing required fields (shape from `@rezeta/shared`'s `computeMissingRequiredFields` → `MissingRequiredField[]`) and render them. Update its tests accordingly.

- [ ] **Step 8: Delete SOAP files**

```bash
git rm apps/web/src/components/consultations/SoapView.tsx \
  apps/web/src/components/consultations/SoapTextarea.tsx \
  apps/web/src/components/consultations/__tests__/SoapTextarea.test.tsx \
  apps/web/src/pages/Consultation/use-soap-state.ts
```

- [ ] **Step 9: Typecheck, fix stragglers, run tests**

Run: `pnpm --filter @rezeta/web typecheck`
Then: `grep -rn "Soap\|soap\b\|SoapField\|useSoapState" apps/web/src` and resolve every remaining reference.
Run: `pnpm --filter @rezeta/web exec vitest run src/pages/Consultation src/components/consultations`
Expected: typecheck clean; new ProtocolPanel test passes; no dangling SOAP refs.

- [ ] **Step 10: Commit**

```bash
git add -A apps/web/src
git commit -m "feat(web): remove SOAP view; protocol-first consultation panel with empty state"
```

---

### Task 4a: Remove the "promote to SOAP" path from off-protocol notes (end to end)

The off-protocol-note feature let a note be "promoted" into a SOAP field. With SOAP gone, that target no longer exists.

**Files:**
- Modify (frontend): the off-protocol-note modal (search: `grep -rln "promoteTo\|OffProtocol\|off_protocol" apps/web/src`) and `useAddOffProtocolNote` (`apps/web/src/hooks/consultations/use-consultations.ts`).
- Modify (api): off-protocol-note handler (search: `grep -rln "promoteTo\|existingSoapValue\|off.protocol" apps/api/src`).
- Modify (shared): any DTO/zod schema for the off-protocol note that includes `promoteTo`/`existingSoapValue`.
- Tests: update the corresponding specs.

**Interfaces:**
- Produces: off-protocol-note create no longer accepts `promoteTo` or `existingSoapValue`; the note is stored as an off-protocol modification only.

- [ ] **Step 1: Map the feature**

Run: `grep -rn "promoteTo\|existingSoapValue\|off_protocol\|OffProtocol" apps/web/src apps/api/src packages/shared/src`
List every occurrence (modal UI, hook, DTO, zod schema, service, repository, tests).

- [ ] **Step 2: Update tests first (red)**

In the off-protocol-note service/hook specs, remove assertions about SOAP promotion and assert the note is stored without it. Run them to see failures where promotion is still wired.

- [ ] **Step 3: Remove the field across layers**

- Shared: remove `promoteTo`/`existingSoapValue` from the zod schema + DTO type; rebuild shared.
- API: remove the SOAP-patching branch in the service/repository; keep storing the note as a modification.
- Web: remove the "promote to SOAP" select/checkbox from the modal; stop sending those fields (aligns with the trimmed `handleSaveOffProtocolNote` from Task 4).

- [ ] **Step 4: Verify**

Run: `pnpm --filter @rezeta/shared build && pnpm --filter @rezeta/api exec vitest run && pnpm --filter @rezeta/web exec vitest run src/components/consultations`
Expected: PASS; `grep -rn "promoteTo\|existingSoapValue" apps packages` returns nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: drop off-protocol-note promote-to-SOAP path"
```

---

### Task 5: Remove orphaned old-gate + preview scaffolding

**Files:**
- Delete: `apps/web/src/components/consultations/ConsultationGate.tsx` + `__tests__/ConsultationGate.test.tsx` + `__tests__/ConsultationGate.source.test.tsx`
- Delete (after verification): `apps/web/src/pages/_preview/GatePreview.tsx`, `StripPreview.tsx`, `CanvasPreview.tsx`
- Modify: `apps/web/src/App.tsx` (remove routes/imports to deleted previews)
- Modify: `apps/web/src/components/consultations/strings.ts` (remove now-unused gate/view-mode strings)

**Interfaces:**
- Produces: no references to `ConsultationGate` or the `_preview` pages remain.

- [ ] **Step 1: Confirm the previews are dead/preview-only**

Run: `grep -rn "GatePreview\|StripPreview\|CanvasPreview\|ConsultationGate" apps/web/src`
Confirm they're referenced only by `App.tsx` (dev preview routes) and each other. If a preview renders a component that is NOT being deleted and is still wanted, keep that preview; otherwise delete. Note in the commit which were removed.

- [ ] **Step 2: Delete the gate + confirmed-dead previews**

```bash
git rm apps/web/src/components/consultations/ConsultationGate.tsx \
  apps/web/src/components/consultations/__tests__/ConsultationGate.test.tsx \
  apps/web/src/components/consultations/__tests__/ConsultationGate.source.test.tsx
# plus the verified-dead _preview files
```

- [ ] **Step 3: Clean `App.tsx` and strings**

Remove imports/routes for the deleted previews from `App.tsx`. In `components/consultations/strings.ts`, remove string objects used only by the deleted `ViewModeToggle`/`ConsultationGate` (search each string key across `apps/web/src` before removing).

- [ ] **Step 4: Verify nothing dangles**

Run: `pnpm --filter @rezeta/web typecheck && pnpm --filter @rezeta/web exec vitest run`
Expected: typecheck clean; full web suite green.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web/src
git commit -m "chore(web): remove orphaned consultation gate and preview scaffolding"
```

---

### Task 6: Changelog + final gates

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Prepend changelog entry**

Add at the top (newest first):

```markdown
## [2026-06-26] — feat: protocol-first consultations (remove SOAP view)

### Removed

- **SOAP view and view-mode toggle**: deleted `SoapView`, `SoapTextarea`, `ViewModeToggle`, `use-soap-state`, `use-consultation-view-mode`, the `ConsultationViewMode` store state, and the orphaned `ConsultationGate` + `_preview` scaffolding. The non-persisting SOAP fallback (which silently discarded input) is gone; `ProtocolPanel` is canvas-only with an "Agregar protocolo" empty state. Removed the off-protocol-note "promote to SOAP" path.

### Added

- **Protocol-first sign rule**: a consultation with zero `ProtocolUsage` records cannot be signed. API `sign()` throws `CONSULTATION_REQUIRES_PROTOCOL` (new `ErrorCode`); the "Firmar y cerrar" button is disabled until a protocol is added.

### Changed

- **Specs**: `specs/updated-specs/01-consultation-workflow.md` §4.1/§4.4/§5 and `CLAUDE.md` updated — protocols are the only content-entry surface; no "Nota libre" / free-form fallback.
```

- [ ] **Step 2: Full gates**

Run: `pnpm lint`
Expected: clean.
Run: `pnpm test`
Expected: all packages green.
Run: `pnpm test:coverage`
Expected: ≥ 90% per package (note: pre-existing `DatePicker`/`TimePicker`/`calendar` gaps are unrelated; do not regress others).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for protocol-first consultations"
```

---

## Self-Review

- **Spec coverage:** §4.1 no-protocol prompt → Task 4 (empty state); §4.4 no free-form → Tasks 3+4 (SOAP/view-mode removal) + 4a (promote path); §5 sign rule → Task 1 (api) + Task 2 (ui). Docs → already updated + Task 6.
- **Type consistency:** `CONSULTATION_REQUIRES_PROTOCOL` defined in Task 1, consumed in Tasks 1/2/6. `protocolUsages.length` used consistently. `CanvasView` loses `SoapField`/`onAutoPopulate` in Task 4 and ProtocolPanel stops importing them in the same task.
- **Ordering for green builds:** Task 3 keeps the SOAP branch as the fallback so the build stays green after view-mode removal; Task 4 then removes SOAP and supplies the empty state. Task 4a removes the cross-layer promote path. Task 5 cleans dead scaffolding last.
- **Placeholder scan:** none — exact paths, real code for new logic, and `grep` directives for the deletions an executor must enumerate per their local tree.
