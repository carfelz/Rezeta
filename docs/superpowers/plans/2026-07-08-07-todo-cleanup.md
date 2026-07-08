# TODO Backlog Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear every actionable item in `docs/TODO.md` (items 1–6, 9–15): historia version history, P2002 retry, mapping-aware crash drafts, optimistic-concurrency guard, flush toast storm + idempotent order creation, queue-session race hardening, Obligatorio dedup, AuditLog labels, two regression tests, seeded-template historia enrichment, and the CIE/ICD decision doc.

**Architecture:** One branch `chore/todo-cleanup` off fresh main. API-first tasks (P2002, version history), then the shared+api+web vertical slices (concurrency guard; idempotency key with a small Prisma migration), then web-only hardening/polish, then the fixtures/content task and the decision doc. Every shared-package change ships with all its consumers in the same commit (pre-commit typechecks the whole workspace).

**Tech Stack:** NestJS + Prisma, React 18 + TanStack Query + Zustand, Zod in `@rezeta/shared`, vitest.

## Global Constraints

- Token Tailwind classes only; Spanish user-facing strings colocated in `strings.ts`/`toasts.ts`; 2-space indent; no TODO/FIXME comments; lower-case commit subjects; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (blank line before trailer).
- Error codes are a closed enum in `packages/shared/src/errors.ts` (SCREAMING_SNAKE keys = values, `as const`). New codes: `PROTOCOL_USAGE_STALE` (place in the Consultation block, lines 32-41 area).
- Immutable clinical records: never weaken signed guards; the concurrency guard must not affect modification-only (append-merge) PATCHes.
- Gates per task: `pnpm --filter <touched pkgs> test`, `pnpm lint`, `pnpm -r typecheck`. Final task: `pnpm test` + `pnpm test:coverage` (95% per-file; `src/pages/**`, `src/components/protocols/**`, `src/components/consultations/**`, `src/components/template/**`, `src/components/layout/**` are web coverage-exempt; `lib/**` and `hooks/**` are NOT).
- Each task ends with a CHANGELOG.md entry under a `## [2026-07-08]` heading for that task (house convention: multiple same-day H2 sections with distinct titles is fine; never duplicate an existing section title).
- Node: run dev/test under Node ≥20 (`.nvmrc` pins v24.18.0; `nvm use` if the API dies with `crypto is not defined`).

## Verified facts (from investigation — build on these, do not re-derive)

- **ConsultationRecord**: `@@unique([consultationId, versionNumber])`; repo (`apps/api/src/modules/consultation-records/consultation-records.repository.ts`) has `findLatest` (:46-52), `create` (:54-76, caller-supplied versionNumber), `replaceSections`, `sign`, `toDto` (:25-40); NO list method. Service (`consultation-records.service.ts`): `ensureDraft` hardcodes `versionNumber: 1` (:52); `regenerate` uses `latest.versionNumber + 1` (:93); both read `findLatest` then create optimistically — no P2002 handling. The global filter (`apps/api/src/common/filters/http-exception.filter.ts:36-47`) already maps P2002 → 409 `RESOURCE_CONFLICT`, so the race today surfaces as a misleading generic 409, not a 500. House P2002 catch-and-refetch pattern: `apps/api/src/modules/users/users.repository.ts:110-129` (+ its spec :185-205).
- **Record routes** (`consultation-records.controller.ts`, base `v1/consultations/:consultationId/record`): GET latest (:39), POST ensureDraft (:51), PATCH sections (:64), POST regenerate (:78), POST sign (:91), GET pdf (:106-125, no version param). Spec promise (`docs/superpowers/specs/2026-07-06-historia-medica-design.md:165`): "GET …/record — latest version (draft or signed) + version list".
- **Web record UI**: `use-consultation-record.ts` (QK `'consultation-record'`, key `[QK, consultationId]`; `downloadRecordPdf` at :109). `RecordDocument.tsx` fetches latest only; header renders `· v{record.versionNumber}` at :155-158 — the natural mount point for a version selector; signed-bar PDF button :141-147. `HistoriaTab.tsx` selects consultations, not versions.
- **ProtocolUsage**: model has `updatedAt @updatedAt` (schema.prisma:546), NO revision column. Serializer `toProtocolUsage` (`consultations.repository.ts:99-128`) does NOT emit `updatedAt`; shared `ConsultationProtocolUsage` (packages/shared/src/types/consultation.ts:43-69) lacks it. Repo `updateProtocolUsage` (:529-571): `content` = wholesale replace; `modifications` = append-merge (inherently safe). Service guard pattern: `ConflictException({ code: ErrorCode.CONSULTATION_ALREADY_SIGNED, … })` (`consultations.service.ts:442-463`). Web content-writer: `use-pending-modifications.ts` flush (:160-259) builds `content` from the react-query cache usage (:167, :182-188), PATCHes via `Promise.allSettled` (:204-211), and on ANY rejection re-buffers delta+content and toasts generic `errorProtocolUsage` — it never reads `err.error.code` (`ApiRequestError.error.code` is the discriminator; there is no HTTP status on it). Modification-only callers (useSkipStep :260-283, useAddOffProtocolNote :289-312, useUpdateCheckedState :189-217) send no content.
- **Flush/toasts**: `use-flush-order-queue.ts` builds its OWN hook instances (:26-28) and calls `mutateAsync` per group sequentially, removing each group on success (:60, :79, :98); single catch → `errorFlushOrders`. The three create hooks (`use-consultations.ts` — useCreatePrescription :314-329, useCreateImagingOrder :342-357, useCreateLabOrder :370-385) toast success AND error inside the hook, take `(consultationId)` only — no options; per-call `mutateAsync` options CANNOT suppress hook-level toasts (both run). Manual "Generar" paths in `OrderQueuePanel.tsx` use separate instances (:556/:560, :689/:693, :819/:823) and must keep their toasts.
- **Order store/groups**: `useOrderQueueStore` default medication group is the CONSTANT id `'default-rx'` (title 'Receta', order 1) — group ids are not unique per creation, so a group id alone is NOT a safe idempotency key. Queued item `source` round-trips to persisted `*ItemRow.source` (per item, not per group). GET hooks exist: useListPrescriptions :331-340, useListImagingOrders :359-368, useListLabOrders :387-393.
- **Queue session race**: `use-order-queue-session.ts` restore effect (:42-61, deps `[consultationId]`) then mirror effect (:64-97, deps incl. queue arrays). On first commit the mirror runs with PRE-restore (empty) selector values → hits the empty branch (:70-72) → `removeItem` can wipe the snapshot before restored values propagate; same transient on consultationId change (`reset()`). Fix = hydration `useRef(false)` gate: set false at top of restore effect, true at its end; mirror early-returns while false. Test file: `__tests__/use-order-queue-session.test.ts` (9 cases; none covers the ordering race).
- **Editor drafts**: `editor.store.ts` — `AUTOSAVE_PREFIX = 'protocol-draft-'` (:234); `saveLocalDraft(protocolId, blocks)` stores `{blocks, savedAt}` (:236-245); `loadLocalDraft` raw-parses (:247-257); `clearLocalDraft` (:259-261). Page (`ProtocolEditor/index.tsx`): mapping state `historiaMapping`/`savedHistoriaMapping` useStates (:67-68); autosave interval saves `blocksRef.current` only (:104-115); `applyDraft` re-inits blocks only (:248-253); draft cleared in the three save onSuccess handlers. Store draft tests: `store/__tests__/editor.store.test.ts:347-382`.
- **TemplateEditor Obligatorio**: canonical header toggle for every non-locked block at `TemplateEditor.tsx:665-693`; the clinical_notes detail panel duplicates it at :797-810 (same `onUpdate(block.id, { required })`); no other per-type panel duplicates the header control. Neither checkbox has test coverage.
- **AuditLog labels**: map at `apps/web/src/pages/settings/AuditLog.tsx:71-82`, fallback `?? item.entityType` at :533. Interceptor `toEntityType` (`audit-log.interceptor.ts:22-25`) strips a trailing 's' + capitalizes first char — no kebab→Pascal, no -ies handling. Complete set of values the API produces TODAY: `Patient, Consultation, Invoice, Appointment, Protocol, Location, User, Schedule, Onboarding, Log, ConsultationRecord, Protocol-template, Protocol-categorie` (last two are the ugly kebab leftovers). Dead map keys: ProtocolVersion, ProtocolTemplate, ProtocolType, Prescription.
- **Read-only BlockRenderer**: vitals case :291-302 (title only when `b.title`), clinical_notes case :305-320 (no chrome title; body label span). NO test file imports the read-only BlockRenderer today; harness home = new sibling in `components/protocols/__tests__/` (plain RTL render, no providers).
- **Imaging flush test**: harness at `hooks/consultations/__tests__/use-flush-order-queue.test.ts` (mocks `../use-consultations` mutateAsync spies; `mutateImg` exists at :7/:12/:31, only asserted negatively). Imaging payload keys are camelCase: `studyType, indication, urgency, contrast, fastingRequired, specialInstructions?, source?` (hook :88-96).
- **Seeded templates**: `apps/api/src/lib/starter-fixtures/index.ts` (2 fixtures × es/en: "emergency", "diagnostic") and a NEAR-DUPLICATE copy in `packages/db/src/seed.ts` (`STARTER_TEMPLATES`, :12-183 — cannot import from apps/api; keep both in sync manually). NO seeded block is `clinical_notes` or `vitals`; children are text/alert/checklist/dosage_table/steps/decision, and text/alert/dosage are IGNORED by `walkBlocks` — so out-of-the-box protocols route nothing to motivo/diagnósticos/examen_fisico. Router keywords (`matchNotesSection`, generate-record-sections.ts:93-103): motivo, antecedente, examen/fisic/exploracion, diagnostic, plan/tratamiento, evolucion, resultado/estudio. Fixtures applied by `tenant-seeding.service.ts` `seedDefault` (:39-105); fixture tests (`starter-fixtures/__tests__/index.test.ts`) assert only count/category/name — block additions won't break them; `template-to-content.test.ts:13-21` schema-validates every fixture (must stay green).

---

### Task 1: P2002 retry in consultation-records service (TODO item 2)

**Files:**
- Modify: `apps/api/src/modules/consultation-records/consultation-records.service.ts` (ensureDraft, regenerate)
- Test: extend `apps/api/src/modules/consultation-records/__tests__/consultation-records.service.spec.ts`

**Interfaces:**
- Consumes: `repo.create` throws Prisma P2002 on `@@unique([consultationId, versionNumber])` collision; house detection pattern from `users.repository.ts:110-129` (`err.code === 'P2002'` structural check).
- Produces: no signature changes. Behavior: `ensureDraft` — on P2002, the racing winner already created v1; re-read `findLatest` and return it (do NOT create again). `regenerate` (signed+amended path) — on P2002, re-read `findLatest`, recompute `latest.versionNumber + 1`, retry the create ONCE; a second P2002 rethrows (filter turns it into the existing 409).

- [ ] **Step 1: Failing tests.** (a) ensureDraft: `repo.create` rejects with `{code:'P2002'}` → `findLatest` re-read (second call) returns a record → ensureDraft resolves with it, `create` called exactly once; (b) regenerate: first `create` rejects P2002 → second `create` called with `versionNumber` = re-read latest + 1 → resolves; (c) regenerate: both creates reject P2002 → rejects with the original error; (d) non-P2002 error rethrows immediately without re-read. Mirror the structural-error fixtures from `users.repository.spec.ts:185-205`.
- [ ] **Step 2: Confirm red.** `pnpm --filter @rezeta/api test -- consultation-records.service`
- [ ] **Step 3: Implement** a private `isUniqueViolation(err)` helper (copy the structural check) + the two catch paths.
- [ ] **Step 4: Green + gates.** Full `pnpm --filter @rezeta/api test`, `pnpm lint`, `pnpm -r typecheck`.
- [ ] **Step 5: CHANGELOG + commit** `fix(api): retry consultation record creation on version race`

---

### Task 2: Historia version history — API (TODO item 1, server half)

**Files:**
- Modify: `packages/shared/src/types/consultation-record.ts` (add `RecordVersionSummary`)
- Modify: `apps/api/src/modules/consultation-records/consultation-records.repository.ts` (add `listVersions`, `findByVersion`)
- Modify: `apps/api/src/modules/consultation-records/consultation-records.service.ts` (add `listVersions`, `getVersion`; extend `getPdfData(consultationId, tenantId, versionNumber?)`)
- Modify: `apps/api/src/modules/consultation-records/consultation-records.controller.ts` (routes + optional pdf query param)
- Test: extend the three api spec files

**Interfaces:**
- Produces (shared — ship with consumers in the SAME commit):

```ts
export interface RecordVersionSummary {
  id: string
  versionNumber: number
  kind: ConsultationRecordKind
  status: ConsultationRecordStatus
  generatedAt: string
  signedAt: string | null
}
```

- Produces (API):
  - `GET /v1/consultations/:consultationId/record/versions` → `RecordVersionSummary[]` ordered `versionNumber desc` (repo `findMany` where consultationId+tenantId, `deletedAt: null`). Empty array when no record exists (no 404 — the UI gates on it).
  - `GET /v1/consultations/:consultationId/record/versions/:versionNumber` → full `ConsultationRecordDto` for that version (404 `RECORD_NOT_FOUND` if absent). Route MUST be declared so it does not shadow/get shadowed by existing routes (Nest matches in declaration order; `versions` is a literal segment so it cannot collide with the base GET).
  - `GET …/record/pdf?version=N` — optional `version` query (validated int ≥1 via pipe); `getPdfData` loads that version instead of latest; filename becomes `historia-${consultationId}-v${N}.pdf` when the param is present. PDF download keeps the existing audit call (category `communication`, action `pdf_generated`) unchanged.
- Consumes: `toDto` for the full record; a new private `toSummary(row)` picking the summary fields.

- [ ] **Step 1: Failing tests.** Repo: `listVersions` returns all non-deleted versions desc + tenant-filtered; `findByVersion` exact match/null. Service: `listVersions` maps to summaries; `getVersion` throws `RECORD_NOT_FOUND` when null; `getPdfData` with version loads that version. Controller: the two new GETs wired; pdf passes the query param through.
- [ ] **Step 2: Red. Step 3: Implement. Step 4: Green + gates.**
- [ ] **Step 5: CHANGELOG + commit** `feat(api): list and fetch historia medica record versions` (shared type + api consumers in ONE commit per the slicing rule).

---

### Task 3: Historia version history — web UI (TODO item 1, client half)

**Files:**
- Modify: `apps/web/src/hooks/consultations/use-consultation-record.ts` (add `useRecordVersions(consultationId)` → GET `/record/versions`, key `[QK, consultationId, 'versions']`; add `useRecordVersion(consultationId, versionNumber | null)` enabled only when a non-latest version is selected; extend `downloadRecordPdf(consultationId, versionNumber?)` → appends `?version=N`, filename `historia-${consultationId}-v${N}.pdf`)
- Modify: `apps/web/src/pages/PatientDetail/RecordDocument.tsx` (version selector in the header block at :152-159; render selected older version read-only)
- Modify: `apps/web/src/pages/PatientDetail/strings.ts` (e.g. `versionLabel: (n: number) => \`V${n}\``, `versionSelectorAria: 'Seleccionar versión de la historia'`, `olderVersionNotice: 'Versión anterior — solo lectura'`)
- Test: extend `use-consultation-record.test.tsx` + `RecordDocument.test.tsx`

**Interfaces:**
- Behavior contract: when `useRecordVersions` returns >1 version, the header shows a version selector (existing `Select` ui component, current version preselected). Choosing an older version renders THAT version's sections strictly read-only (no Editar/Firmar/Regenerar actions — only its PDF download via `downloadRecordPdf(consultationId, n)`) plus the `olderVersionNotice` caption. Choosing the latest restores today's behavior exactly (draft actions when draft, signed bar when signed). With 0–1 versions, NO selector renders (pixel-identical to today). Mutations keep writing through the existing `[QK, consultationId]` key; invalidate `[QK, consultationId, 'versions']` after regenerate/sign so the list stays fresh.

- [ ] **Step 1: Failing tests.** Hook: versions GET + query key; pdf URL with and without version. Component: selector hidden at 1 version; visible at 2; selecting v1 renders v1 sections, hides Editar/Firmar/Regenerar, shows notice + PDF button; switching back to v2 restores action bars.
- [ ] **Step 2: Red. Step 3: Implement. Step 4: Green + gates** (`pnpm --filter @rezeta/web test`, lint, typecheck).
- [ ] **Step 5: CHANGELOG + commit** `feat(web): version history selector in historia medica document`

---

### Task 4: Optimistic-concurrency guard on usage content (TODO item 5) — shared+api+web slice

**Files:**
- Modify: `packages/shared/src/errors.ts` (add `PROTOCOL_USAGE_STALE` in the Consultation block)
- Modify: `packages/shared/src/schemas/consultation.ts` (`UpdateProtocolUsageSchema` + `expectedUpdatedAt: z.string().datetime().optional()`)
- Modify: `packages/shared/src/types/consultation.ts` (`ConsultationProtocolUsage` + `updatedAt: string`)
- Modify: `apps/api/src/modules/consultations/consultations.repository.ts` (`toProtocolUsage` emits `updatedAt: row.updatedAt.toISOString()`)
- Modify: `apps/api/src/modules/consultations/consultations.service.ts` (`updateProtocolUsage` stale check)
- Modify: `apps/web/src/hooks/consultations/use-pending-modifications.ts` (send precondition; handle 409)
- Modify: `apps/web/src/lib/toasts.ts` (`errorProtocolUsageStale: 'Este protocolo fue actualizado en otra pestaña o dispositivo. Recarga la consulta para continuar.'`)
- Test: extend api service + repository specs, web `use-pending-modifications.test.tsx`

**Interfaces:**
- API behavior: in `updateProtocolUsage`, AFTER the existing signed/not-found guards — if `dto.content !== undefined && dto.expectedUpdatedAt !== undefined` and `usage.updatedAt.toISOString() !== dto.expectedUpdatedAt` → `throw new ConflictException({ code: ErrorCode.PROTOCOL_USAGE_STALE, message: 'Protocol usage was modified by another session', details: { currentUpdatedAt: usage.updatedAt.toISOString() } })`. Strip `expectedUpdatedAt` from the dto before passing to the repo. PATCHes without `content` or without `expectedUpdatedAt` behave exactly as today (backward compatible; modification-only callers untouched).
- Web behavior: the flush includes `expectedUpdatedAt: usage.updatedAt` whenever it sends `content` (the usage comes from the react-query cache at :167). On a rejected PATCH, inspect `result.reason`: if `reason instanceof ApiRequestError && reason.error.code === ErrorCode.PROTOCOL_USAGE_STALE` → do NOT re-buffer that usage's `contentEdits` (they are stale; re-sending loops 409 forever), DO re-buffer its modifications delta (append-safe), toast `errorProtocolUsageStale` once, and `void qc.invalidateQueries({ queryKey: [QK, consultationId] })` so the fresh content loads. All other rejections keep today's re-buffer + generic toast.

- [ ] **Step 1: Failing tests.** API service: content+stale precondition → ConflictException with code + details; content+matching precondition → repo called WITHOUT `expectedUpdatedAt` key; modifications-only with stale-looking timestamp field absent → passes through. Repo: `toProtocolUsage` emits `updatedAt` ISO string. Web: flush sends `expectedUpdatedAt` alongside content; 409 PROTOCOL_USAGE_STALE → stale toast, content NOT re-buffered (second flush does not re-send it), modifications delta re-buffered, consultation query invalidated; a plain network error keeps existing behavior (existing test still green).
- [ ] **Step 2: Red. Step 3: Implement. Step 4: Green + gates** (`pnpm --filter @rezeta/shared test && pnpm --filter @rezeta/api test && pnpm --filter @rezeta/web test`).
- [ ] **Step 5: CHANGELOG + commit** — ONE commit for the whole slice: `feat: stale-write guard on protocol usage content updates`

---

### Task 5: Silence per-group toasts during flush + imaging flush test (TODO items 11, 12)

**Files:**
- Modify: `apps/web/src/hooks/consultations/use-consultations.ts` (the three create hooks gain an options param)
- Modify: `apps/web/src/hooks/consultations/use-flush-order-queue.ts` (pass `{ silent: true }`)
- Test: extend `use-flush-order-queue.test.ts` (+ the hooks' own tests if any assert toasts)

**Interfaces:**
- Produces: `useCreatePrescription(consultationId: string, opts?: { silent?: boolean })` (same for imaging/lab). Inside `onSuccess`/`onError`: `if (!opts?.silent) toast.…(…)`. Query invalidation stays UNCONDITIONAL (silent affects toasts only). All existing callers (OrderQueuePanel manual paths at :556, :689, :819) pass no opts → behavior unchanged.
- Flush behavior after change: N-group flush produces ZERO per-group toasts; failure produces exactly ONE `errorFlushOrders`; success produces none from the flush itself (the sign flow's own feedback covers it).

- [ ] **Step 1: Failing tests.** (a) flush of 2 groups → `toast.success` never called, `toast.error` never called on success; (b) flush failure → `toast.error` called exactly once with `errorFlushOrders`; (c) NEW imaging case (TODO 12): queue an imaging order → flush → `mutateImg` called once with `expect.objectContaining({ items: [expect.objectContaining({ studyType, indication, urgency, contrast, fastingRequired, source })] })`, store imagingOrders emptied. NOTE: the flush test file mocks `../use-consultations`, so the toast-suppression tests must instead live where the real hooks run — add a small `use-consultations.create-toasts.test.tsx` (mock apiClient + sonner, renderHook with QueryClientProvider — copy the harness from `use-protocols.save-toast.test.tsx`) asserting: default → toasts fire; `{silent:true}` → they don't.
- [ ] **Step 2: Red. Step 3: Implement. Step 4: Green + gates.**
- [ ] **Step 5: CHANGELOG + commit** `fix(web): suppress per-group toasts during order flush and cover imaging path`

---

### Task 6: Idempotent order creation on flush retry (TODO item 14) — db+shared+api+web slice

**Files:**
- Modify: `packages/db/prisma/schema.prisma` — add `clientRequestId String? @map("client_request_id") @db.VarChar(64)` + `@@unique([consultationId, clientRequestId])` to `Prescription`, `ImagingOrder`, `LabOrder`; create migration `pnpm --filter @rezeta/db prisma migrate dev --name order_client_request_id` (PG allows multiple NULLs in a unique index — existing rows unaffected)
- Modify: `packages/shared/src/schemas/consultation.ts` (`CreatePrescriptionGroupSchema`/imaging/lab gain `clientRequestId: z.string().min(8).max(64).optional()`)
- Modify: `apps/api/src/modules/orders/` service+repository: pass `clientRequestId` through to create; catch P2002 on that unique → re-fetch the existing row by `(consultationId, clientRequestId)` and return it (house pattern `users.repository.ts:110-129`)
- Modify: `apps/web/src/store/order-queue.store.ts` — every `OrderGroup` gets `requestId: string` generated at group creation (`crypto.randomUUID()`); the default `'default-rx'` DISPLAY id stays (check any hardcoded references first — the id is used for grouping only), but `requestId` is fresh per group instance, including when the default group is re-created after removal
- Modify: `apps/web/src/hooks/consultations/use-flush-order-queue.ts` (send `clientRequestId: group.requestId` per group POST)
- Test: extend orders api specs (P2002 → returns existing, non-P2002 rethrows), order-queue.store test (fresh requestId per group re-creation), flush hook test (payload carries clientRequestId; two flushes of the SAME still-queued group send the same id)

**Interfaces:**
- Failure scenario being closed: a create that times out client-side (30s AbortSignal) after succeeding server-side leaves the group queued; retry re-POSTs → today a duplicate signed prescription. With the key: the retry POST hits the unique, the API returns the EXISTING row (200-equivalent semantics — return the row from the create path so the client cannot tell the difference), the flush removes the group, no duplicate.
- localStorage back-compat: old queue snapshots lack `requestId` — `restoreSnapshot` backfills a fresh `crypto.randomUUID()` for any group missing it.

- [ ] **Step 1: Failing tests** (schema/API first, then store/hook). **Step 2: Red. Step 3: Implement + migration. Step 4: Green + gates** (`pnpm --filter @rezeta/db test && pnpm --filter @rezeta/shared test && pnpm --filter @rezeta/api test && pnpm --filter @rezeta/web test`).
- [ ] **Step 5: CHANGELOG + commit** — ONE commit for the slice: `feat: idempotent order creation via client request id`

---

### Task 7: Queue-session hydration gate (TODO item 15)

**Files:**
- Modify: `apps/web/src/hooks/consultations/use-order-queue-session.ts`
- Test: extend `__tests__/use-order-queue-session.test.ts`

**Interfaces:**
- `const hydrated = useRef(false)`. Restore effect: FIRST statement `hydrated.current = false`; after `reset()` + optional `restoreSnapshot()`, LAST statement `hydrated.current = true` (also on the early-return paths — signed, no snapshot, corrupted — the hook is "hydrated" once the restore pass completed, whatever it found). Mirror effect: `if (!hydrated.current) return` before any read/removeItem. No dep changes.

- [ ] **Step 1: Failing tests.** (a) THE RACE: pre-seed localStorage with a snapshot; render the hook; assert the key STILL EXISTS in localStorage after the first commit AND the store contains the restored meds (this fails today only if the effect interleaving manifests in the test env — if it passes vacuously, assert the mechanism instead: spy `localStorage.removeItem` and assert it is NOT called during the initial mount when a non-empty snapshot exists); (b) consultationId switch: with id A hydrated and queue non-empty, rerender with id B whose storage has a snapshot → A's transient reset must NOT remove B's (or A's) keys before B's restore completes; (c) all 9 existing cases stay green.
- [ ] **Step 2: Red (or documented-vacuous with mechanism assertion). Step 3: Implement. Step 4: Green + gates.**
- [ ] **Step 5: CHANGELOG + commit** `fix(web): hydration gate prevents order queue snapshot loss on mount races`

---

### Task 8: Mapping-aware crash drafts (TODO item 3)

**Files:**
- Modify: `apps/web/src/store/editor.store.ts` (draft helpers)
- Modify: `apps/web/src/pages/ProtocolEditor/index.tsx` (autosave + applyDraft)
- Test: extend `store/__tests__/editor.store.test.ts`; add a page-level draft test to `pages/ProtocolEditor/__tests__/index.test.tsx`

**Interfaces:**
- Produces:

```ts
export function saveLocalDraft(
  protocolId: string,
  blocks: ProtocolBlock[],
  historiaMapping?: HistoriaMapping,
): void
// payload: { blocks, historia_mapping?, savedAt } — historia_mapping key present only when non-empty
export function loadLocalDraft(protocolId: string): {
  blocks: ProtocolBlock[]
  historiaMapping?: HistoriaMapping
  savedAt: number
} | null
// Backward compat: old {blocks, savedAt} payloads load fine with historiaMapping undefined.
```

- Page wiring: add `const mappingRef = useRef(historiaMapping); mappingRef.current = historiaMapping` next to `blocksRef` (:104-105); autosave calls `saveLocalDraft(id, blocksRef.current, mappingRef.current)`. `applyDraft`: after `initEditor(...)`, `if (draftBanner.historiaMapping) setHistoriaMapping(draftBanner.historiaMapping)` (do NOT touch `savedHistoriaMapping` — the restored mapping must read as dirty so Guardar persists it). `draftBanner` state type gains the optional field.

- [ ] **Step 1: Failing tests.** Store: round-trip with mapping; round-trip without mapping (key absent); legacy payload loads with undefined mapping. Page: autosave tick (fake timers, 30s) with a mapping-only edit persists a draft containing `historia_mapping`; applying a draft with mapping sets the mapping state (assert via the Historia tab reflecting the override, or expose via the existing test harness patterns in `index.test.tsx`).
- [ ] **Step 2: Red. Step 3: Implement. Step 4: Green + gates.**
- [ ] **Step 5: CHANGELOG + commit** `fix(web): crash-recovery drafts include historia mapping`

---

### Task 9: Obligatorio dedup + AuditLog labels + read-only label test (TODO items 9, 10, 13)

**Files:**
- Modify: `apps/web/src/components/template/TemplateEditor.tsx` — DELETE the clinical_notes detail-panel Obligatorio checkbox (:797-810); the header toggle (:665-693) is the single control. Remove the now-dead `obligatorio` string if unused elsewhere.
- Modify: `apps/api/src/common/interceptors/audit-log.interceptor.ts` — `toEntityType` handles kebab-case and -ies: split on `-`, singularize the LAST word (`ies`→`y`, else strip trailing `s`), PascalCase-join: `protocol-templates`→`ProtocolTemplate`, `protocol-categories`→`ProtocolCategory`, `patients`→`Patient`, `onboarding`→`Onboarding`.
- Modify: `apps/web/src/pages/settings/AuditLog.tsx` — `ENTITY_TYPE_LABELS` covers every produced value, old and new: keep existing keys (historical rows), add `ProtocolCategory: 'Categoría de protocolo'`, `'Protocol-template': 'Plantilla'`, `'Protocol-categorie': 'Categoría de protocolo'`, `Schedule: 'Horario'`, `User: 'Usuario'`, `Onboarding: 'Configuración inicial'`, `Log: 'Registro técnico'`, `ConsultationRecord: 'Historia médica'`, `'Onboardin': 'Configuración inicial'` (pre-fix historical rows). Also add the same set to `Dashboard/helpers.ts` `friendlyEntity` where sensible (at minimum ConsultationRecord → 'una historia médica').
- Create: `apps/web/src/components/protocols/__tests__/BlockRenderer.vitals-notes.test.tsx` (TODO 13) — plain RTL render harness (copy the note at the top of the run-mode test): (a) non-chromeless clinical_notes renders its label EXACTLY once (`getAllByText('Motivo de consulta')).toHaveLength(1)`); (b) non-chromeless vitals with NO title renders the type name exactly once (the chrome chip) and no duplicate title; (c) vitals WITH `title: 'Signos basales'` renders that title once.
- Test: extend interceptor spec (`protocol-templates`→`ProtocolTemplate`, `protocol-categories`→`ProtocolCategory`, `onboarding`→`Onboarding` regression) + TemplateEditor test (header toggle round-trips `required`; detail panel no longer contains an Obligatorio checkbox) + an AuditLog labels test if the page has a test harness (check; if `src/pages/**` has no harness, the map is a constant — cover via the interceptor + skip page test, noting pages are coverage-exempt).

- [ ] **Step 1: Failing tests** for each of the three pieces. **Step 2: Red. Step 3: Implement. Step 4: Green + gates** (`pnpm --filter @rezeta/api test && pnpm --filter @rezeta/web test`).
- [ ] **Step 5: CHANGELOG + commit** `fix: single obligatorio toggle, exhaustive audit entity labels, read-only label regression test`

---

### Task 10: Seeded-template historia enrichment (TODO item 6)

**Files:**
- Modify: `apps/api/src/lib/starter-fixtures/index.ts` (both fixtures × both locales)
- Modify: `packages/db/src/seed.ts` (`STARTER_TEMPLATES` — keep the two copies content-identical; they cannot share code across packages)
- Test: extend `apps/api/src/lib/starter-fixtures/__tests__/index.test.ts`; `template-to-content.test.ts` must stay green (it schema-validates every fixture)

**Interfaces:**
- Add to the DIAGNOSTIC fixture (es; en mirrors with English labels — labels still route because mapping is done per-locale template the doctor uses; use the es keywords for es, and for en KEEP SPANISH ROUTER-MATCHING LABELS? No — the router normalizes and matches Spanish keywords only, and the product's UI language is Spanish; for the `en` fixture use labels that still contain a router keyword, e.g. "Motivo de consulta / Chief complaint" is over-engineering — decision: en fixture uses the same Spanish section labels as es for the clinical_notes blocks, since historia routing is keyword-Spanish; note this in a code comment):
  - `clinical_notes` label `'Motivo de consulta'`, required — placed as the FIRST block (before the existing sections)
  - `vitals` block with the standard 5-field default (copy from `apps/web/src/pages/ProtocolEditor/block-factory.ts:98-110`: bp/hr/temperature/weight/height — same ids/labels/units/input_types)
  - `clinical_notes` label `'Diagnóstico'` — after the "Diagnóstico Diferencial" section
  - `clinical_notes` label `'Plan de tratamiento'` — last block
- Add to the EMERGENCY fixture: `vitals` (same 5 fields) as the first block inside/before "Evaluación inicial"; `clinical_notes` label `'Evolución'` after "Monitoreo post-intervención"; `clinical_notes` label `'Diagnóstico'` before it.
- All new blocks are TEMPLATE blocks (validate against `TemplateBlockSchema` — clinical_notes label/required, vitals fields; ids like `blk_dx_notes` following the fixtures' existing id style). Apply the IDENTICAL additions to the `seed.ts` copies (matching each template's structure there).
- Predicted historia effect (assert in test via `matchNotesSection`): motivo→motivo_consulta, diagnóstico→diagnosticos, plan→plan_tratamiento, evolución→evolucion, vitals→examen_fisico.

- [ ] **Step 1: Failing tests.** Extend the fixtures spec: every fixture (both locales) contains ≥1 `clinical_notes` block whose label routes via `matchNotesSection` to a non-narrative section, and ≥1 `vitals` block with ≥4 fields; the diagnostic fixture specifically routes labels to motivo_consulta/diagnosticos/plan_tratamiento. (Import `matchNotesSection` if exported; if not, assert on the literal labels.)
- [ ] **Step 2: Red. Step 3: Implement both copies. Step 4: Green + gates** (`pnpm --filter @rezeta/api test && pnpm --filter @rezeta/db test` — seed.ts has no content test today; run `pnpm --filter @rezeta/db typecheck` and, if a local dev DB is available, a smoke `prisma db seed` is optional, not a gate).
- [ ] **Step 5: CHANGELOG + commit** `feat(api): starter templates carry historia-mapped note and vitals blocks`

---

### Task 11: CIE/ICD coding decision doc (TODO item 4 — research, no code)

**Files:**
- Create: `docs/superpowers/specs/2026-07-08-cie-coding-decision.md`

**Content contract:** STATUS banner `DRAFT — pending Carlos's decision`. Sections: (1) the conflict — DR Reglamento §6.12.4 formally requires CIE coding of definitive diagnoses vs. CLAUDE.md's "no ICD-10, free-text diagnoses" convention; (2) three options with pros/cons sized for a solo-specialist product: A) optional CIE-10 typeahead alongside free text (free text primary, code stored when picked), B) free-text only + document the compliance risk, C) mandatory coding; (3) considerations: ARS/SISALRIL audit expectations, CIE-10-ES licensing/data source options (public WHO core vs. licensed es-ES extensions), where a code would live in the model (a `code` field on the diagnosis entries inside `ProtocolUsage` content and a `codes` rendering in the `diagnosticos` record section — no schema commitment yet); (4) RECOMMENDATION: option A, phased — schema-tolerant now (free text remains valid), typeahead in v1.5; (5) explicit "Decision: ______" line for Carlos to fill. Cite the Reglamento section and keep it under ~120 lines.

- [ ] **Step 1: Write the doc.** No tests. `pnpm lint` (markdown is not linted, but run the gate anyway for the branch state).
- [ ] **Step 2: Commit** `docs: cie coding decision draft for definitive diagnoses`

---

### Task 12: TODO.md cleanup + changelog + full gates

- [ ] Update `docs/TODO.md`: mark items 1–6, 9–15 done (strikethrough with date + PR pointer, matching item 7's done style); keep item 8 (F7 recurrence watch) and the deferred INDOTEL section; note item 7's residual (historia PDF click-through) as covered by the 2026-07-08 live E2E if Task 3's PDF work re-verified it, else leave open.
- [ ] Verify CHANGELOG has one entry per task (Tasks 1–11), all under properly-titled `## [2026-07-08]` headings.
- [ ] Full gates: `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage` (95% per-file; re-run flaky web timeout tests in isolation once before diagnosing).
- [ ] Commit `docs: todo cleanup and changelog for backlog fixes`
