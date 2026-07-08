# E2E Findings Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 17 findings from the 2026-07-07 live E2E test of the consultation flow: 2 critical (protocol-editor save dead with zero feedback; queued prescriptions silently dropped at sign), 3 major (template palette missing block types; no Editar for vitals/nota clínica blocks; DOB off-by-one), and the consistency/polish batch.

**Architecture:** Web-heavy fixes on one branch `fix/e2e-consultation-flow-findings`. The prescription fix flushes the client order queue through the *existing* create endpoints inside the SignModal's existing `onBeforeSign` abort-capable hook (no API contract change). The save fix hardens the transport layer (timeouts so mutations always settle) and makes pending state visible. Editor fixes extend the existing `DosageTableEditor` inline-edit pattern and complete the existing label maps. One API-side fix (audit-log singularizer).

**Tech Stack:** React 18 + TanStack Query + Zustand, NestJS, Zod in `@rezeta/shared`. No schema/prisma changes anywhere in this plan.

## Global Constraints

- Token classes only (`text-n-700`, `bg-p-500`, `rounded-sm`…); Spanish user-facing strings colocated in each page/component's `strings.ts`; 2-space indent; no TODO/FIXME comments; lower-case commit subjects.
- Gates per task: `pnpm --filter @rezeta/web test` (or `--filter @rezeta/api` / `--filter @rezeta/shared` when touched), `pnpm lint`, `pnpm -r typecheck`. Final task adds `pnpm test` + `pnpm test:coverage` (95% per-file; `src/pages/**` exempt, `components/ui` NOT exempt).
- Immutability: never weaken signed-consultation guards. The sign flush must run BEFORE the sign PATCH and abort the sign on any flush failure.
- Follow existing test harnesses in each `__tests__/` dir (vitest + testing-library on web, jest-style specs on api).

## Verified root causes (do not re-investigate; build on these)

- **F7 save bug:** click→`saveVersion` wiring is correct and covered by a passing test (`apps/web/src/pages/ProtocolEditor/__tests__/index.test.tsx`). Live repro on a fresh session saves fine (201). The only code-consistent mechanism for the observed "all save controls dead, zero requests, zero toasts": a save whose promise never settles — `apps/web/src/lib/api-client.ts:31` `await authClient.getToken()` (Firebase `user.getIdToken()` refresh can hang) and `:39` `fetch(...)` have **no timeout**, so `useSaveVersion().isPending` latches true and `disabled={isSaving}` kills all 5 save controls (`EditorHeader.tsx:96,100`, `SaveModal.tsx:60,70`, `PublishModal.tsx:59`) with no feedback. Additionally the save buttons show no pending indicator, and a successful save clears `clearLocalDraft(id)` but never `setDraftBanner(null)` (`ProtocolEditor/index.tsx:199-242` vs `:62,91`), so the "Se recuperó un borrador no guardado" banner survives a successful save and "Usar borrador" would restore stale blocks.
- **F11 prescriptions:** "+ Añadir a receta" (`BlockRendererRunMode.tsx:401`) only writes to the Zustand store `useOrderQueueStore` (`apps/web/src/store/order-queue.store.ts:135`). Only the manual "Generar receta" button (`OrderQueuePanel.tsx:558-576`) POSTs `/v1/consultations/:id/prescriptions` (creates row with `status:'queued'`, `orders.repository.ts:259-267`). The API sign transaction (`consultations.repository.ts:394-439`) correctly flips *persisted* `queued` rows to `signed` but knows nothing about the client store → un-generated queue silently vanishes. Counter mismatch: `totalMeds = medications.length + savedRxCount` (`OrderQueuePanel.tsx:1130`) counts the client queue post-sign while the signed list reads server data only (`:1207-1211`); `useOrderQueueSession` removes localStorage on sign (`use-order-queue-session.ts:66-68`) but never resets the in-memory store. Historia `plan_tratamiento` is built from persisted order rows (`generate-record-sections.ts:251-269`); `repo.sign` runs before `recordsSvc.ensureDraft` (`consultations.service.ts:299` → `:326`), so flushing before sign automatically populates it.
- **F6:** `EDITABLE_BLOCK_TYPES` set (`apps/web/src/components/protocols/EditorBlockRenderer.tsx:37-46`) omits `vitals` and `clinical_notes`; the Editar menu item and the inline `EditForm` swap (`:274-298,405-440`) are gated on it. `DosageTableEditor` (`apps/web/src/components/protocols/DosageTableEditor.tsx`) is the pattern: local draft state, commit via `useEditorStore().updateBlock(id, …)` + `selectBlock(null)`. Historia routing keys off `block.label` (`generate-record-sections.ts:162`), so an editable label is what unblocks note→section mapping.
- **F2:** template editor is a parallel implementation (`apps/web/src/components/template/TemplateEditor.tsx`): `BlockType` union (`:52-59`), add-block palette (`:975-984`), and `TYPE_LABELS` (`:350-358`) all lack `vitals`, `clinical_notes`, `imaging_order`, `lab_order`; its detail panel (`:619-643`) is generic title+placeholder only. The shared `TemplateBlockSchema` (`packages/shared/src/schemas/protocol.ts:187-246`) already supports all types — UI-only gap.
- **Chrome:** protocol editor leaf cards render TWO stacked headers: the outer one uses local `blockTypeLabel`/`blockDisplayTitle` maps missing vitals/clinical_notes (`EditorBlockRenderer.tsx:759-805` → "BLOQUE"/"Bloque"), and the unselected body renders `<BlockRenderer>` (`:299`) which wraps content in `ProtocolBlock` chrome with its own complete `BLOCK_TYPE_LABELS` (`BlockRenderer.tsx:106-118`) → duplicated "DOSIFICACIÓN/Antihipertensivos". Read-only view also duplicates the clinical_notes label (chrome title `b.label` + `ClinicalNotesBlock` body label span, `blocks/ClinicalNotesBlock.tsx:21`) and vitals ("SIGNOS VITALES" + fallback title "Signos vitales").
- **F8 DOB:** `apps/web/src/pages/Patients/helpers.ts:9-16` `formatDate` does `new Date('1972-03-15')` (UTC midnight) + `toLocaleDateString('es-DO')` (UTC-4) → previous day. Call sites: `PatientDetail/DemographicsBlock.tsx:16-17`, `Patients/PatientModal.tsx:152-153`. Central util `apps/web/src/lib/format/dates.ts` formats Date objects with local getters but has no date-only-string parser.
- **Minors:** "Onboardin" = naive singularizer `slice(1, -1)` in `apps/api/src/common/interceptors/audit-log.interceptor.ts:52-56` drops the last char of non-plural segments; web fallback `un registro (${t})` in `apps/web/src/pages/Dashboard/helpers.ts:83-97`. "…o desde cero" at `apps/web/src/pages/Protocols/strings.ts:5`. Patient field labeled with modal title `s.title` at `apps/web/src/components/consultations/NewConsultationDialog.tsx:80`. Duplicate create affordances: `createPatientAction:'Crear paciente'` button (`NewConsultationDialog.tsx:86-92`) vs combobox last option `'Nuevo paciente'` (`Schedule/PatientCombobox.tsx:93-104`). Raw source tag rendered verbatim at `OrderQueuePanel.tsx:642-651`. Historia sign toast ignores `err.error.details.missing` (`apps/web/src/hooks/consultations/use-consultation-record.ts:88-94`; API sends `details:{missing}` from `consultation-records.service.ts:146-155`). Patient page header has only "Editar" (`PatientDetail/PageHeader.tsx:28-31`, hardcoded strings). Topbar location dropdown renders nothing when `locations.length === 0` (`components/layout/Topbar.tsx:80`). Doc-type selects omit `rnc` (`PatientModal.tsx:252-257`, `EditModal.tsx:130-135`) though `DocumentTypeSchema` and `Patients/helpers.ts` `DOC_LABELS` already support it. Vitals float artifact: `VitalsBlock.tsx:32-39` renders stored value verbatim; `withDerivedBMI` (`BlockRendererRunMode.tsx:450-466`) rounds only `bmi`.

---

### Task 1: Transport hardening — every request settles (F7, part 1)

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/toasts.ts` (timeout message string)
- Test: `apps/web/src/lib/__tests__/api-client.test.ts` (extend)

**Interfaces:**
- Produces: `request()`/`downloadBlob()` internally use `withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T>` (module-private) and pass `signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)` to `fetch`. Constants: `TOKEN_TIMEOUT_MS = 15_000`, `REQUEST_TIMEOUT_MS = 30_000`. No public API change — `apiClient.get/post/patch/delete/download` signatures unchanged.

- [ ] **Step 1: Failing tests.** In `api-client.test.ts` add: (a) `getToken` that never resolves → `apiClient.get('/v1/x')` rejects within fake-timer advance of 15s with an `Error` whose message is `toastStrings.errorRequestTimeout`; (b) `fetch` receives an `AbortSignal` (assert `expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)`); (c) loading store `requestFinished` still fires on timeout (finally path). Use `vi.useFakeTimers()` and mock `authClient`.
- [ ] **Step 2: Run tests, confirm failures.** `pnpm --filter @rezeta/web test -- api-client`
- [ ] **Step 3: Implement.** In `api-client.ts`:

```ts
const TOKEN_TIMEOUT_MS = 15_000
const REQUEST_TIMEOUT_MS = 30_000

async function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    clearTimeout(timer!)
  }
}
```

In `request()` and `downloadBlob()`: `const token = await withTimeout(authClient.getToken(), TOKEN_TIMEOUT_MS, toastStrings.errorRequestTimeout)` and `fetch(url, { ...init, headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })`. Add to `toasts.ts`: `errorRequestTimeout: 'La solicitud tardó demasiado. Revisa tu conexión e inténtalo de nuevo.'`. Every mutation's existing `onError` toast now fires on hang, and `isPending` always clears.
- [ ] **Step 4: Tests pass.** `pnpm --filter @rezeta/web test -- api-client`
- [ ] **Step 5: Gates + commit.** `pnpm lint && pnpm -r typecheck`. Commit: `fix(web): timeouts on auth token and fetch so requests always settle`

---

### Task 2: Protocol editor save UX — visible pending, banner cleared (F7, part 2)

**Files:**
- Modify: `apps/web/src/pages/ProtocolEditor/index.tsx` (clear banner on save success)
- Modify: `apps/web/src/pages/ProtocolEditor/EditorHeader.tsx` (pending labels on Guardar/Publicar)
- Modify: `apps/web/src/pages/ProtocolEditor/SaveModal.tsx`, `PublishModal.tsx` (pending labels on confirm buttons)
- Modify: `apps/web/src/pages/ProtocolEditor/strings.ts` (`saving: 'Guardando…'`, `publishing: 'Publicando…'`)
- Test: `apps/web/src/pages/ProtocolEditor/__tests__/index.test.tsx` (extend)

**Interfaces:**
- Consumes: `isSaving` already threaded to all three components; `handleSaveDraft`/`handleSaveModalPublish`/`handlePublishConfirm` onSuccess callbacks at `index.tsx:199-242`.
- Produces: no new exports. Behavior: while `isSaving`, Guardar shows `strings.saving`, Publicar/`Guardar y publicar` show `strings.publishing` alongside `disabled` + a `<Spinner size="sm" />` (existing ui component); on save success `setDraftBanner(null)` runs in all three onSuccess handlers next to `clearLocalDraft(id)`.

- [ ] **Step 1: Failing tests.** In `index.test.tsx` (existing harness mocks `useProtocols`): (a) render with the mocked `useSaveVersion` returning `isPending: true` → header buttons disabled AND show "Guardando…"/"Publicando…"; (b) simulate a recovered draft (mock `loadLocalDraft` to return a draft), trigger a successful save (mocked `saveVersion` calls its `onSuccess`), assert the banner text "Se recuperó un borrador no guardado." is removed from the DOM.
- [ ] **Step 2: Confirm failures.** `pnpm --filter @rezeta/web test -- ProtocolEditor`
- [ ] **Step 3: Implement.** Add `setDraftBanner(null)` inside the three `onSuccess` callbacks. In `EditorHeader.tsx` swap static labels for `isSaving ? strings.saving : strings.save` (resp. publish) and prepend `<Spinner size="sm" />` when pending; same on the SaveModal/PublishModal confirm buttons.
- [ ] **Step 4: Tests pass.** Full editor suite: `pnpm --filter @rezeta/web test -- ProtocolEditor`
- [ ] **Step 5: Gates + commit.** Commit: `fix(web): visible saving state in protocol editor and clear recovered-draft banner on save`

---

### Task 3: Flush order queue at sign (F11 — critical)

**Files:**
- Create: `apps/web/src/hooks/consultations/use-flush-order-queue.ts`
- Modify: `apps/web/src/pages/Consultation/ConsultationModals.tsx` (or wherever `onBeforeSign` is composed for `SignModal` — read it first; compose flush AFTER the existing pending-modifications persist)
- Modify: `apps/web/src/pages/Consultation/index.tsx` (clear queue store on signed)
- Modify: `apps/web/src/lib/toasts.ts` or `components/consultations/strings.ts` (flush-failure toast: `errorFlushOrders: 'No se pudieron guardar las órdenes pendientes. No se firmó la consulta.'`)
- Test: create `apps/web/src/hooks/consultations/__tests__/use-flush-order-queue.test.ts`; extend `apps/web/src/components/consultations/__tests__/` SignModal/OrderQueuePanel tests

**Interfaces:**
- Consumes: `useOrderQueueStore` state (`medications`, `medicationGroups`, `imagingOrders`, `labOrders` + group removal actions — read `order-queue.store.ts` for exact names), `useCreatePrescription` (`use-consultations.ts:314-329`) and the analogous imaging/lab create hooks, `SignModalProps.onBeforeSign?: () => Promise<boolean>` (`SignModal.tsx:20`).
- Produces:

```ts
export function useFlushOrderQueue(consultationId: string): {
  /** Persists every queued medication group, lab and imaging order via the
   * existing create endpoints, removing each group from the store as it
   * succeeds (same behavior as manual "Generar receta"). Returns true when
   * the queue is fully persisted; false (after toasting errorFlushOrders)
   * if any create fails — remaining queue stays intact for retry. */
  flush: () => Promise<boolean>
}
```

- [ ] **Step 1: Failing hook tests.** Cases: (a) queue with 1 medication group + 1 lab order → `flush()` awaits both create mutations (assert `mutateAsync` payloads match the manual-generate payload shape incl. `groupTitle`, `items[].source`) and returns true, store emptied; (b) empty queue → resolves true, zero requests; (c) prescription create rejects → returns false, toast fired, lab group NOT removed (retry-safe), no throw.
- [ ] **Step 2: Confirm failures.**
- [ ] **Step 3: Implement the hook** using `mutateAsync` sequentially per group (meds first, then labs, then imaging), removing each group from the store on its individual success, `try/catch` → toast + `return false`.
- [ ] **Step 4: Wire into sign.** Where `onBeforeSign` is passed to `SignModal`, compose: existing pending-modifications persist runs first; if it returns true, `return flush()`. On sign success (`onSigned` path in `Consultation/index.tsx`), call the store's reset/clear action so the in-memory queue can't produce the "Recetas 1 / Sin recetas" mismatch.
- [ ] **Step 5: Extend integration test.** SignModal test: queued-but-not-generated medication → confirm sign → assert POST prescriptions fired BEFORE the sign PATCH and the sign proceeds; failure case aborts sign (no PATCH).
- [ ] **Step 6: Gates + commit.** `pnpm --filter @rezeta/web test && pnpm lint && pnpm -r typecheck`. Commit: `fix(web): flush queued orders to server before signing consultation`

Note: this also fixes the empty patient-Recetas tab and the empty historia `plan_tratamiento` (rows now exist when `ensureDraft` builds the plan) with zero API changes.

---

### Task 4: Editar for Nota clínica and Signos vitales blocks (F6)

**Files:**
- Modify: `apps/web/src/components/protocols/EditorBlockRenderer.tsx` (`EDITABLE_BLOCK_TYPES` + `EditForm` cases)
- Create: `apps/web/src/components/protocols/ClinicalNotesBlockEditor.tsx`, `apps/web/src/components/protocols/VitalsBlockEditor.tsx`
- Modify: `apps/web/src/components/protocols/strings.ts` (editor labels: `notesLabelField: 'Etiqueta'`, `notesRequiredField: 'Obligatorio'`, `vitalsTitleField: 'Título'`, `vitalsFieldLabel: 'Campo'`, `vitalsFieldUnit: 'Unidad'`, `vitalsFieldType: 'Tipo'`, `vitalsAddField: 'Añadir campo'`, `vitalsRemoveField: (label: string) => \`Quitar ${label}\``)
- Test: create `apps/web/src/components/protocols/__tests__/ClinicalNotesBlockEditor.test.tsx`, `__tests__/VitalsBlockEditor.test.tsx`

**Interfaces:**
- Consumes: `useEditorStore().updateBlock(id, patch)` + `selectBlock(null)` — mirror `DosageTableEditor.tsx` commit/cancel shape exactly. Schemas: clinical_notes `{label: string, required?: boolean, content: string}`; vitals `{fields: VitalsFieldSchema[]}` with field `{id, label, unit?, input_type: 'text'|'number'|'computed', formula?}` (`packages/shared/src/schemas/protocol.ts:103-176`).
- Produces:

```tsx
export function ClinicalNotesBlockEditor(props: { id: string; label: string; required?: boolean }): JSX.Element
// Draft state for label (Field + Input) and required (Checkbox); Guardar commits
// via updateBlock(id, { label, required }), Cancelar discards; both selectBlock(null).
export function VitalsBlockEditor(props: { id: string; title?: string; fields: VitalsField[] }): JSX.Element
// Title Field + editable rows (label, unit, input_type select) with add/remove;
// computed fields (input_type==='computed') render locked (no remove, label/unit
// editable only) to protect formula fields like BMI. Commit via updateBlock.
```

- [ ] **Step 1: Failing tests.** ClinicalNotesBlockEditor: renders current label; editing + Guardar calls `updateBlock` with `{label: 'Motivo de consulta', required: true}`; Cancelar calls only `selectBlock(null)`. VitalsBlockEditor: renders one row per field; add-field appends a `{input_type:'number'}` row with generated id; remove hidden on computed fields; commit payload shape.
- [ ] **Step 2: Confirm failures.**
- [ ] **Step 3: Implement editors** following `DosageTableEditor.tsx` structure and styling (token classes, `Field`, `Input`, `Select` from `components/ui`).
- [ ] **Step 4: Wire the gate.** Add `'vitals'`, `'clinical_notes'` to `EDITABLE_BLOCK_TYPES`; add `EditForm` cases returning the two editors. Extend `__tests__/EditorBlockRenderer.delete-focus.test.tsx` (or the existing context-menu test) asserting the Editar item now appears for a clinical_notes block.
- [ ] **Step 5: Gates + commit.** Commit: `feat(web): edit label and fields of nota clinica and vitals blocks in protocol editor`

---

### Task 5: Editor chrome consistency — single typed header, no duplicated titles

**Files:**
- Modify: `apps/web/src/components/protocols/EditorBlockRenderer.tsx` (`blockTypeLabel`, `blockDisplayTitle`, chromeless body)
- Modify: `apps/web/src/components/protocols/BlockRenderer.tsx` (optional `chromeless` prop; drop redundant titles)
- Modify: `apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx` (no change to label span — it becomes the single label once chrome title is dropped; verify)
- Test: extend `apps/web/src/components/protocols/__tests__/` (new `EditorBlockRenderer.chrome.test.tsx`)

**Interfaces:**
- Produces: `BlockRenderer` gains `chromeless?: boolean` — when true, leaf blocks render their inner content WITHOUT the `ProtocolBlock` wrapper (sections/nesting unaffected; run mode untouched). `EditorBlockRenderer` passes `chromeless` for the unselected leaf body so each editor card has exactly ONE header (the outer one).

- [ ] **Step 1: Failing tests.** (a) editor card for a `vitals` block shows header chip "SIGNOS VITALES" (not "BLOQUE") and a `clinical_notes` block shows "NOTA CLÍNICA" with title = its label; (b) editor card for a dosage block renders the string "Antihipertensivos" exactly once and "DOSIFICACIÓN" exactly once (`getAllByText(...)).toHaveLength(1)`); (c) `BlockRenderer` with `chromeless` renders dosage rows without the `ProtocolBlock` header.
- [ ] **Step 2: Confirm failures.**
- [ ] **Step 3: Implement.** Complete the two local maps in `EditorBlockRenderer.tsx` (add `vitals: blockTypeStrings.vitals`, `clinical_notes: blockTypeStrings.clinicalNotes`; `blockDisplayTitle` cases: vitals → `b.title ?? blockTypeStrings.vitals`, clinical_notes → `b.label`). Add `chromeless` to `BlockRenderer` (thread through the leaf switch; each case returns its inner content directly when set). Read-only duplication: in `BlockRenderer`'s non-chromeless clinical_notes case pass `title={undefined}` (body span keeps label + required asterisk); vitals case pass `title={b.title}` only when set (drop the fallback that duplicates the type name).
- [ ] **Step 4: Tests pass; eyeball Storybook** (`pnpm storybook`) only if stories exist for these components — do not add new stories in this task.
- [ ] **Step 5: Gates + commit.** Commit: `fix(web): single typed header per editor block, no duplicated titles`

---

### Task 6: Template editor parity — missing block types + per-type detail (F2)

**Files:**
- Modify: `apps/web/src/components/template/TemplateEditor.tsx` (BlockType union `:52-59`, palette `:975-984`, `TYPE_LABELS` `:350-358`, add-block factory, detail panel `:619-643`)
- Modify: the template editor's strings source (labels are currently hardcoded — add new ones alongside; do not refactor existing ones)
- Test: extend `apps/web/src/pages/settings/__tests__/TemplateEditor.test.tsx`

**Interfaces:**
- Consumes: `TemplateBlockSchema` (`protocol.ts:187-246`) — all four types already valid; vitals default fields: copy the 5-field default from `apps/web/src/pages/ProtocolEditor/block-factory.ts:98-110` (bp/hr/weight/height/bmi incl. computed BMI).
- Produces: template palette gains `vitals` ("SIGNOS VITALES"), `clinical_notes` ("NOTA CLÍNICA"), `imaging_order` ("ORDEN IMAGEN"), `lab_order` ("ORDEN LAB") with factories producing schema-valid defaults (`clinical_notes`: `{label: 'Nota clínica'}`; orders: empty study/test lists matching the protocol factory defaults). Detail panel becomes type-aware: for `clinical_notes` the title Field edits `label` (+ an "Obligatorio" checkbox); for `dosage_table` a rows editor (drug/dose/route/frequency/notes columns, add/remove row) replaces the placeholder textarea; other types keep the generic panel.

- [ ] **Step 1: Failing tests.** (a) palette renders all 11 add buttons; (b) adding a vitals block produces a block whose `fields` parse against `TemplateBlockSchema`; (c) clinical_notes detail panel edits `label` and it round-trips into reducer state; (d) dosage detail panel adds a row `{drug:'Enalapril', dose:'10 mg', route:'VO', frequency:'cada 12 h'}` and it appears in state.
- [ ] **Step 2: Confirm failures.**
- [ ] **Step 3: Implement** union + palette + labels + factories + detail-panel branches. Keep the template editor self-contained (house pattern) — do NOT import protocol-editor components.
- [ ] **Step 4: Tests pass.**
- [ ] **Step 5: Gates + commit.** Commit: `feat(web): vitals, nota clinica and order blocks in template editor with typed detail panels`

---

### Task 7: DOB timezone fix (F8)

**Files:**
- Modify: `apps/web/src/lib/format/dates.ts` (add `parseDateOnly`)
- Modify: `apps/web/src/pages/Patients/helpers.ts` (`formatDate`, `formatAge`)
- Test: extend `apps/web/src/lib/format/__tests__/dates.test.ts` (or create following harness) + `apps/web/src/pages/Patients/__tests__/helpers.test.ts`

**Interfaces:**
- Produces:

```ts
/** Parses 'YYYY-MM-DD' (optionally with a time suffix, which is ignored)
 * as LOCAL midnight, avoiding the UTC-midnight off-by-one. */
export function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}
```

- [ ] **Step 1: Failing tests.** `parseDateOnly('1972-03-15')` → `getDate()===15 && getMonth()===2 && getFullYear()===1972`; `formatDate('1972-03-15')` renders "15 de marzo de 1972"; `formatAge` unchanged behavior for a known DOB. Also handles `'1972-03-15T00:00:00.000Z'` input (slices date part).
- [ ] **Step 2: Confirm failures.**
- [ ] **Step 3: Implement** and swap `new Date(iso)` → `parseDateOnly(iso)` in `Patients/helpers.ts` `formatDate`/`formatAge`. Then audit the sibling `formatDate` copies (`Schedule/helpers.ts:5`, `Consultation/helpers.ts:1`, `Billing/helpers.ts:9`, `PatientDetail/PrescriptionsTab.tsx:7`, `PatientDetail/AppointmentsTab.tsx:9`, `Dashboard/helpers.ts`): only convert the ones fed date-ONLY strings (check each call site); full ISO datetimes are safe — leave them.
- [ ] **Step 4: Tests pass. Step 5: Gates + commit.** Commit: `fix(web): parse date-only strings as local time so birth dates display correctly`

---

### Task 8: Audit entity name + historia missing-sections toast

**Files:**
- Modify: `apps/api/src/common/interceptors/audit-log.interceptor.ts:52-56`
- Modify: `apps/web/src/pages/Dashboard/helpers.ts:83-97`
- Modify: `apps/web/src/hooks/consultations/use-consultation-record.ts:88-94` + `apps/web/src/lib/toasts.ts:36`
- Modify (only if not exported): `packages/shared/src/record/generate-record-sections.ts` — export the section-key→title map used to build sections (check its current name; export as `RECORD_SECTION_TITLES` if unexported)
- Test: extend `apps/api/src/common/interceptors/__tests__/` audit interceptor spec; extend `apps/web/src/hooks/consultations/__tests__/use-consultation-record.test.ts` (or harness equivalent); shared export test if added

**Interfaces:**
- Produces: interceptor singularizer becomes suffix-aware: `const singular = seg.endsWith('s') ? seg.slice(0, -1) : seg; entityType = singular.charAt(0).toUpperCase() + singular.slice(1)` → `onboarding` → `Onboarding`. Web `friendlyEntity` map gains `Onboarding: 'la configuración inicial'`. Historia sign `onError` builds: `` `Completa las secciones requeridas: ${names.join(', ')}` `` from `err.error.details?.['missing']` mapped through `RECORD_SECTION_TITLES`, falling back to the existing generic string when details are absent.

- [ ] **Step 1: Failing tests.** Interceptor: path `/v1/onboarding` → entityType `Onboarding`; path `/v1/patients/:id` still → `Patient`. Web: sign error with `details.missing=['motivo_consulta','plan_tratamiento']` toasts a message containing both Spanish section titles; error without details keeps the generic message.
- [ ] **Step 2–4: Red → implement → green.** Note the pre-commit slicing memory: if the shared export is added, ship shared change + its web consumer in the SAME commit.
- [ ] **Step 5: Gates + commit.** `pnpm --filter @rezeta/api test && pnpm --filter @rezeta/web test && pnpm --filter @rezeta/shared test`. Commit: `fix: correct audit entity singularization and name missing historia sections in sign error`

---

### Task 9: Copy and small UI fixes batch

**Files:**
- Modify: `apps/web/src/pages/Protocols/strings.ts:5` — `emptyDescription: 'Crea tu primer protocolo a partir de una plantilla.'`
- Modify: `apps/web/src/components/consultations/NewConsultationDialog.tsx` + its strings — new key `patientLabel: 'Paciente'` used as the Field label (`:80`); REMOVE the redundant "Crear paciente" button + its inline `create-patient` mode (`:86-92` and the mode branch) — the combobox's "Nuevo paciente" last option (which opens the full `PatientModal` with antecedentes fields) is the single creation path. Delete the now-dead `createPatientAction` string and any dead mode code/tests.
- Modify: `apps/web/src/components/consultations/OrderQueuePanel.tsx:642-651` — replace the raw `{med.source}` mono caption: when `med.source?.startsWith('protocol:')` render the strings key `sourceFromProtocol: 'Desde protocolo'`; otherwise render nothing (do not show raw ids). Apply the same at the two other source renderings (`:704`, `:834`).
- Modify: `apps/web/src/pages/Patients/PatientModal.tsx:252-257` and `apps/web/src/pages/PatientDetail/EditModal.tsx:130-135` — add `<SelectItem value="rnc">` with new strings keys (`docTypeRnc: 'RNC'` / `documentTypeRnc: 'RNC'`).
- Modify: `apps/web/src/components/protocols/BlockRendererRunMode.tsx:450-466` — in the vitals commit path, normalize numeric values: any parseable-as-number value is stored as `String(Math.round(parseFloat(v) * 100) / 100)` (2-decimal cap kills float artifacts without touching in-progress typing — apply at commit/merge time only, not on each keystroke).
- Test: extend the colocated tests for each touched component (NewConsultationDialog, OrderQueuePanel source rendering, both patient modals' doc-type options, BlockRendererRunMode vitals normalization).

- [ ] **Step 1: Failing tests.** (a) NewConsultationDialog labels the picker "Paciente" and renders exactly ONE create-patient affordance; (b) OrderQueuePanel med row with `source:'protocol:row_1'` shows "Desde protocolo" and never the raw string; (c) both doc-type selects offer Cédula/Pasaporte/RNC and submitting `rnc` reaches the payload; (d) vitals blur with weight `81.4000015258789` persists `81.4`.
- [ ] **Step 2–4: Red → implement → green.**
- [ ] **Step 5: Gates + commit.** Commit: `fix(web): consultation dialog labels, single create-patient path, friendly order source, rnc option, vitals rounding`

---

### Task 10: Patient page "Nueva consulta" + location selector empty state

**Files:**
- Modify: `apps/web/src/pages/PatientDetail/PageHeader.tsx` + `apps/web/src/pages/PatientDetail/index.tsx` + `PatientDetail/strings.ts` (also move the hardcoded "Editar"/"Pacientes"/"Sin documento" into strings while touching the file)
- Modify: `apps/web/src/components/consultations/NewConsultationDialog.tsx` (accept preselected patient)
- Modify: `apps/web/src/components/layout/Topbar.tsx:80` + `components/layout/strings.ts`
- Test: extend PatientDetail page tests + Topbar tests

**Interfaces:**
- Produces: `NewConsultationDialogProps` gains `initialPatient?: { id: string; fullName: string }` — when set, the combobox starts with that patient selected (thread through existing combobox `value`/`onChange` state). PatientDetail header renders a primary "Nueva consulta" button (`ph-plus` icon, strings key `newConsultation: 'Nueva consulta'`) that opens `NewConsultationDialog` with `initialPatient` = current patient. Topbar with zero locations renders the dropdown panel with an empty state: strings `noLocations: 'Sin ubicaciones configuradas'` + a link "Añadir ubicación" to the locations settings route (find the exact route in `App.tsx` — the Ajustes locations page).

- [ ] **Step 1: Failing tests.** (a) PatientDetail shows "Nueva consulta"; clicking opens the dialog with the patient's name already selected in the combobox; (b) Topbar with `locations: []` open → shows "Sin ubicaciones configuradas" and the settings link.
- [ ] **Step 2–4: Red → implement → green.**
- [ ] **Step 5: Gates + commit.** Commit: `feat(web): start consultation from patient page and location selector empty state`

---

### Task 11: Changelog, TODO cleanup, full gates

- [ ] Prepend `CHANGELOG.md` entry `## [2026-07-07] Correcciones del flujo de consulta (hallazgos E2E)` with `### Fixed` bullets naming: transport timeouts, protocol-editor saving state + draft banner, order-queue flush at sign (recetas del paciente + plan de tratamiento de la historia), Editar for nota clínica/signos vitales, editor chrome, template palette parity, DOB timezone, audit entity name, historia sign toast, copy fixes, RNC, vitals rounding; `### Added` bullets: Nueva consulta desde paciente, location empty state, template per-type panels.
- [ ] Update `docs/TODO.md`: mark the items this plan resolves as done/remove; add a follow-up line: "F7 root cause was a non-settling request (no timeout); if a dead-save recurs after this fix, capture HAR + console before reload."
- [ ] Full gates: `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage` (95% per-file; re-run flaky web timeout tests in isolation once before diagnosing).
- [ ] Commit: `docs: changelog for e2e findings fixes`
