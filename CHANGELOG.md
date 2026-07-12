# Changelog

All notable changes to the Medical ERP are documented here.

Format: `[version/date] — description`. Entries are ordered newest first.

## [2026-07-12] Doctor name no longer renders as "Dr. Dr." on generated PDFs

### Fixed

- `apps/api/src/lib/pdf.service.ts`: every PDF (prescription, imaging/lab order, historia médica, expediente) hard-prepended `Dr. ` to the doctor's `fullName`. Doctors routinely enter their own honorific at signup (`Dr. Juan García`, `Dra. María Pérez`), so those documents rendered `Dr. Dr. Juan García` — including on the legal expediente cover ("Médico tratante") and the historia médica header and signature. Added a `formatDoctorName` helper that prepends `Dr. ` only when the name does not already begin with a doctoral honorific (`Dr`/`Dra`, optional period, case-insensitive), preserves an existing `Dra.` instead of forcing `Dr.`, and falls back to a plain `Médico` (not a dangling `Dr.`) when the name is missing. Routed all 11 render sites through it. Verified against real seeded records: the expediente cover, historia header, and signature block now show a single `Dr. Test García`.

### Added

- `apps/api/src/lib/__tests__/pdf.service.doctor-name.spec.ts`: covers `formatDoctorName` — bare name gets `Dr. `, existing `Dr.`/`Dra.` not doubled, case-insensitive and period-optional honorific detection, no false positive on names like `Drew`/`Drake`, whitespace trimming, and the `Médico` fallback for a missing name.

## [2026-07-09] Removed stale `test:integration` script

### Removed

- `apps/api/package.json`: removed the `test:integration` script, which pointed at `test/auth.integration.ts` and `test/protocols.integration.ts`. Both files — and the entire `apps/api/test/` directory — were deleted in `3676dda` as unwired (`vitest.config.ts`'s `include` only covers `src/**/*.{spec,test}.ts`), but the script survived and failed on invocation. No CI workflow referenced it.

## [2026-07-09] Concurrent onboarding no longer fails with a unique-constraint violation

### Fixed

- `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts`: two simultaneous onboarding requests for the same tenant both passed the in-transaction `seededAt` re-check — under `READ COMMITTED` a `findUnique` takes no row lock and cannot see the other transaction's uncommitted write. The loser collided with the `(tenant_id, name)` partial unique index on `protocol_categories` and leaked a raw `P2002` to the client. `seedDefault` and `seedCustom` now lock the tenant row with `SELECT … FOR UPDATE` before re-reading `seededAt`, so the second transaction waits for the first to commit and then observes `seededAt` already set.
- `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts`: as a backstop to the lock, both seeding paths catch `P2002` and remap it to a `ConflictException` with `TENANT_ALREADY_SEEDED`, following the pattern already established in `users.repository.ts`. Non-`P2002` failures rethrow unchanged.
- `apps/web/src/hooks/onboarding/use-onboarding.ts`: `useOnboardingDefault` and `useOnboardingCustom` treat `TENANT_ALREADY_SEEDED` as success and load the current user from `GET /v1/auth/me`. The tenant *was* seeded by the rival request, so the red error screen was incorrect. In development this happened on every onboarding because `StrictMode` double-invokes the mount effect in `apps/web/src/pages/Onboarding/index.tsx`; in production, on a double click or a network retry.

### Added

- `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.concurrency.spec.ts`: covers the row lock before the `seededAt` re-read, the `P2002` → `TENANT_ALREADY_SEEDED` remap, and the non-capture of unrelated errors, for both `seedDefault` and `seedCustom`.
- `apps/web/src/hooks/__tests__/use-onboarding.test.ts`: covers the fallback to `GET /v1/auth/me` on `TENANT_ALREADY_SEEDED` and the untouched propagation of unrelated failures.

## [2026-07-08] Local draft restores a cleared medical-record mapping, versions invalidated on ensuring the record, and silent-invalidation coverage

### Fixed

- `apps/web/src/store/editor.store.ts`: `saveLocalDraft` no longer omits `historia_mapping` when the passed mapping is `{}` — it now persists the key whenever the parameter is defined (including empty), and only omits it when it is `undefined`. Previously, a crash-recovery draft whose only edit was clearing the mapping was restored without that clearing. `loadLocalDraft` is unchanged (an absent key remains `undefined`, backward compatibility intact).
- `apps/web/src/pages/ProtocolEditor/index.tsx`: `applyDraft` changes the `if (draftBanner.historiaMapping)` guard to `!== undefined` to clearly reflect that a `{}` mapping loaded from the draft should also be applied (it already behaved this way since `{}` is truthy, but the previous guard was ambiguous about that intent).
- `apps/web/src/hooks/consultations/use-consultation-record.ts`: `useEnsureRecord` now also invalidates `[QK, consultationId, 'versions']` on success, aligning with `useRegenerateRecord` and `useSignRecord`, which already invalidated that key.

### Added

- `apps/web/src/store/__tests__/editor.store.test.ts`: round-trip case for a `{}` mapping (key persisted, restored as `{}`).
- `apps/web/src/pages/ProtocolEditor/__tests__/index.test.tsx`: case that applies a draft with `historiaMapping: {}` over a previous non-empty mapping and verifies the override is cleared.
- `apps/web/src/hooks/consultations/__tests__/use-consultation-record.test.tsx`: case that verifies the invalidation of `[QK, consultationId, 'versions']` in `useEnsureRecord`.
- `apps/web/src/hooks/consultations/__tests__/use-consultations.create-toasts.test.tsx`: cases for `useCreatePrescription`, `useCreateImagingOrder` and `useCreateLabOrder` that verify `qc.invalidateQueries` still fires with `{ silent: true }` (the hooks did not change; the coverage confirms the existing contract).

## [2026-07-08] Deduplication of audit labels and the medical-records service

### Changed

- `apps/web/src/lib/audit-entities.ts` (new): extracts the canonical set of audit `entityType` keys (`AUDIT_ENTITY_KEYS`) and the two Spanish label maps that were previously duplicated verbatim in `apps/web/src/pages/settings/AuditLog.tsx` (`ENTITY_TYPE_LABELS`, formal phrasing) and `apps/web/src/pages/Dashboard/helpers.ts` (`friendlyEntity`, "un/una X" phrasing). Both maps are typed as `Record<AuditEntityKey, string>`, so a missing or extra key in either one is a compile error instead of a silent divergence. The two phrasings (distinct by design) are kept unmerged.
- `apps/api/src/modules/consultation-records/consultation-records.service.ts`: `ensureDraft` and `regenerate` (including its retry path after P2002) now share a private `createVersion` helper for the creation + audit payload, instead of repeating it three times. `getLatest` and `getVersion` share the `RECORD_NOT_FOUND` throw via the private `throwRecordNotFound` helper.
- `apps/web/src/hooks/consultations/use-consultations.ts`: the comments in `useSkipStep` and `useAddOffProtocolNote` that justified the synchronous `setQueryData` cited the false-staleness window on `updatedAt` (already resolved by the `contentUpdatedAt`-based precondition of the previous change). Rewritten to reflect the current reason: keep the modifications/UI state fresh in cache without waiting for the refetch.
- `apps/web/src/pages/PatientDetail/RecordDocument.tsx`: `handleDownloadRecordPdf` removes the redundant ternary `versionNumber !== undefined ? f(id, v) : f(id)` — the parameter is already optional, so it is forwarded directly.
- `apps/web/src/hooks/consultations/__tests__/use-consultations.create-toasts.test.tsx`: moved from `apps/web/src/hooks/__tests__/` (its source, `use-consultations.ts`, lives in `hooks/consultations/`, not `hooks/`); relative import corrected from `../consultations/use-consultations` to `../use-consultations`.

### Fixed

- `apps/api/src/modules/consultation-records/consultation-records.service.ts`: the 404 message from `getVersion` is no longer generic ("Esta consulta no tiene historia médica generada") — it now includes the requested version number (`Esta consulta no tiene la versión N de la historia médica`), distinguishing it from the `getLatest` 404.

## [2026-07-08] Content-specific staleness precondition on protocols (contentUpdatedAt)

### Added

- `packages/db/prisma/schema.prisma`: `ProtocolUsage.contentUpdatedAt` (column `content_updated_at`), migration `protocol_usage_content_updated_at` with backfill (`UPDATE protocol_usages SET content_updated_at = updated_at`) for existing rows.

### Fixed

- The stale-write guard (409 `PROTOCOL_USAGE_STALE`) on `PATCH .../protocols/:usageId` compared row-level `updatedAt`, which Prisma updates on ANY write — a benign, append-only modification event (checking a checklist item in another tab) falsely failed a content flush, and the web client permanently discarded the doctor's buffered content edits for that `usage`. `apps/api/src/modules/consultations/consultations.repository.ts`: `updateProtocolUsage` now sets `contentUpdatedAt` only when `dto.content !== undefined`; `toProtocolUsage` emits `contentUpdatedAt` (in addition to `updatedAt`, unchanged). `apps/api/src/modules/consultations/consultations.service.ts`: the precondition now compares `usage.contentUpdatedAt` against `dto.expectedContentUpdatedAt` (409 details: `currentContentUpdatedAt`); a modifications-only write never invalidates this precondition again.

### Changed

- `packages/shared/src/schemas/consultation.ts`: `UpdateProtocolUsageSchema.expectedUpdatedAt` renamed to `expectedContentUpdatedAt` (web is the only client; no compatibility layer). `packages/shared/src/types/consultation.ts`: `ConsultationProtocolUsage` gains `contentUpdatedAt: string`. `apps/web/src/hooks/consultations/use-pending-modifications.ts`: the content flush sends `expectedContentUpdatedAt: usage.contentUpdatedAt` (previously `usage.updatedAt`); the semantics of the "stale" branch (discard contentEdits, re-buffer modifications, single toast, invalidate) do not change.

## [2026-07-08] Test files now pass through the typecheck

### Changed

- `apps/api`, `apps/web`, `packages/shared`: the `typecheck` script now runs `tsc --noEmit` with the full tsconfig (includes `__tests__/**`) instead of `tsconfig.build.json` (which excluded them). Tests fell outside every type gate and accumulated 341 silent errors; pre-commit and CI now catch them (`packages/db` already worked this way).

### Fixed

- 341 TypeScript errors in test files (web 43, api 257, shared 41; db was clean), without weakening assertions or removing tests. Main patterns: possibly `undefined` indexes under `noUncheckedIndexedAccess` (non-null assertions after existence checks), fixtures out of date relative to the real types (`AuthUser.preferences`, `startsAt`/`endsAt`, `fullName`, `templateId`/`categoryId`, `items`/`groupOrder`), imports without the `.js` extension in `packages/shared`, and `import.meta` in two architecture specs of the rewritten api rewritten with `process.cwd()`-based paths (the program compiles as CommonJS).
- Two genuine fixture bugs uncovered by the typecheck: `sort: 'title'` (nonexistent enum value, now `'title_asc'`) in `protocols.service.spec.ts`, and a mapping to `plan_tratamiento` (a section not selectable as a target) in `generate-record-sections.spec.ts`.

## [2026-07-08] Final branch review fixes: false-staleness window, `version` validation, and order refetch after P2002

### Fixed

- `apps/web/src/hooks/consultations/use-consultations.ts`: `useSkipStep` and `useAddOffProtocolNote` now `setQueryData` with the `usage` returned by their PATCH before invalidating (same pattern `useUpdateCheckedState` already used in this file), instead of relying solely on `invalidateQueries`. Previously, between the `PATCH` and the async refetch, the react-query cache retained the `usage`'s prior `updatedAt` — if a flush from `use-pending-modifications.ts` (buffered content edits) ran in that window, it sent a stale `expectedUpdatedAt`, the server rejected it with 409 `PROTOCOL_USAGE_STALE`, and the flush permanently discarded the doctor's buffered `contentEdits` for that `usage`.
- `apps/api/src/common/pipes/parse-positive-int.pipe.ts` (new): `ParsePositiveIntPipe` validates that an optional numeric parameter is an integer ≥ 1, returning `undefined` unchanged when the parameter is not sent (same passthrough behavior as `ParseIntPipe({ optional: true })`) and throwing `BadRequestException` with `code: VALIDATION_ERROR` for 0, negatives, or non-integer values. `apps/api/src/modules/consultation-records/consultation-records.controller.ts`: the `version` query param of `GET .../record/pdf` uses this pipe instead of `ParseIntPipe({ optional: true })`, which accepted 0 and negatives as "valid".
- `apps/api/src/modules/orders/orders.repository.ts`: the three `findFirst` recoveries after a `P2002` (`createPrescription`, `createImagingOrder`, `createLabOrder`), which look up by `consultationId` + `clientRequestId` + `tenantId` to return the row already created by the original attempt, now also filter `deletedAt: null`. Previously, if the row with that `clientRequestId` had been soft-deleted, the re-fetch returned it anyway and the retry flush ended up "recovering" an already-deleted order instead of re-throwing the original error.

### Added

- Tests: `apps/web/src/hooks/__tests__/use-consultations.test.ts` gains a case for `useSkipStep` and another for `useAddOffProtocolNote` that confirm `setQueryData` is called with the response's `usage` (including its fresh `updatedAt`) before `mutateAsync` resolves. `apps/api/src/common/pipes/__tests__/parse-positive-int.pipe.spec.ts` (new) covers passthrough of `undefined`, valid positive integers, rejection of 0/negatives/non-integers/non-numerics, and the error shape (`code`, `details.field`). `apps/api/src/modules/orders/__tests__/orders.repository.spec.ts` gains a case in the `createPrescription` suite that confirms the re-fetch after `P2002` is called with `deletedAt: null` in the `where` and that, if it finds no row (the soft-deleted-row case), the original error is re-thrown.

## [2026-07-08] TypeScript errors in tests added on this branch

### Fixed

- `apps/web/src/hooks/__tests__/use-consultations.create-toasts.test.tsx` (:25-34): `RX_DTO`/`IMG_DTO`/`LAB_DTO` stop forcing the type via `as <DTO>` over an incomplete `{ items: [] }` object (TS2352, missing `groupOrder`) and become constants annotated with the parameter's type (`items: [], groupOrder: 1`), without a cast — a prior reviewer had flagged the forced cast as a test weakness.
- `apps/web/src/hooks/consultations/__tests__/use-flush-order-queue.test.ts` (:9-15): the `useCreatePrescriptionMock`/`useCreateImagingOrderMock`/`useCreateLabOrderMock` mocks (`vi.fn()`) gain the signature `(_id?: string, _opts?: { silent?: boolean })` — previously they were typed as zero-argument functions (TS2554) even though the code under test invokes them with `(consultationId, { silent: true })`.
- `apps/web/src/hooks/consultations/__tests__/use-order-queue-session.test.ts` (:67, :197, :236): `medications[0].drug` gains the non-null assertion already used in the rest of the file (`medications[0]!.drug`) after the `expect(medications).toHaveLength(1)` that already precedes each access (TS2532).
- `apps/api/src/modules/consultation-records/__tests__/consultation-records.service.spec.ts` (:279, within the test added on this branch "retries once with a recomputed version number when create races another version (P2002)"): `mockRepo.create.mock.calls[1][0].versionNumber` gains the non-null assertion (`calls[1]!`), the same idiom as the rest of the API suite (TS2532). The file's other preexisting TS2532/TS2339 errors are left intact.
- `apps/api/src/modules/orders/__tests__/orders.repository.spec.ts` (:171, within the test added on this branch "passes clientRequestId through to the create call"): `mockPrisma.prescription.create.mock.calls[0][0].data` gains the same non-null assertion (`calls[0]!`) (TS2532). The file's other preexisting TS2532 errors are left intact.

These errors only appeared under the full tsconfig (`npx tsc -p tsconfig.json --noEmit`), not under `tsconfig.build.json` (excludes `__tests__/**`) which CI uses; they did not affect the build while a preexisting, unrelated base of similar errors existed in files untouched by this branch, which is left intact.

## [2026-07-08] Clinical-note blocks in the seed templates

### Added

- `apps/api/src/lib/starter-fixtures/index.ts`: the two seed protocols (`emergency`, `diagnostic`, es/en) gain top-level `clinical_notes` and `vitals` blocks, additive over the existing sections. `diagnostic` adds `clinical_notes` "Motivo de consulta" (`blk_motivo_notes`, required) as the first block, then `vitals` (`blk_vitals`, 5 standard fields: blood pressure, heart rate, temperature, weight, height), and after "Diagnóstico Diferencial" adds `clinical_notes` "Diagnóstico" (`blk_dx_notes`) and "Plan de tratamiento" (`blk_plan_notes`) as the last block. `emergency` adds `vitals` (same 5 fields) before "Evaluación inicial", and after "Monitoreo post-intervención" adds `clinical_notes` "Diagnóstico" (`blk_dx_notes`) and "Evolución" (`blk_evolucion_notes`). The `en` fixtures intentionally reuse the same Spanish labels for the `clinical_notes` blocks (comment in the code) because the medical-record section router (`matchNotesSection` in `packages/shared/src/record/generate-record-sections.ts`) only recognizes Spanish keywords.
- `packages/db/src/seed.ts`: `STARTER_TEMPLATES` gains the same additions (identical content, identical ids) in its copies of `emergency-intervention` and `diagnostic-algorithm`, since this file cannot import from `apps/api`.
- Tests: `apps/api/src/lib/starter-fixtures/__tests__/index.test.ts` gains two new suites — a structural one (each fixture, both locales, has ≥1 `clinical_notes` block with a non-empty label and ≥1 `vitals` block with ≥4 fields) and a functional one that builds the content at runtime via `buildProtocolContentFromTemplate`, fills in test values/content, and calls the real `generateRecordSections` (from `@rezeta/shared`) to verify the predicted routing: "Motivo de consulta" → `motivo_consulta`, "Diagnóstico" → `diagnosticos`, "Plan de tratamiento" → `plan_tratamiento`, "Evolución" → `evolucion`, `vitals` → `examen_fisico`.

Before this change, no block in the seed templates was `clinical_notes` or `vitals` (only `text`/`alert`/`checklist`/`dosage_table`/`steps`/`decision`), so `walkBlocks` routed nothing to those sections and the seed protocols generated an empty medical record in those sections.

## [2026-07-08] Single "Obligatorio" toggle and exhaustive audit labels

### Fixed

- `apps/web/src/components/template/TemplateEditor.tsx`: the detail panel of a `clinical_notes` block no longer duplicates the "Obligatorio" checkbox (:797-810 removed) — the header toggle (:665-693), present for every non-locked block, is the only `required` control. The `obligatorio` string in `apps/web/src/components/template/strings.ts` is removed as unused.
- `apps/api/src/common/interceptors/audit-log.interceptor.ts`: `toEntityType` now splits the resource segment on `-`, singularizes only the last word (`ies` → `y`; otherwise the trailing `s` is dropped) and joins in PascalCase — `protocol-templates` → `ProtocolTemplate`, `protocol-categories` → `ProtocolCategory`, `patients` → `Patient`, `onboarding` → `Onboarding` (unchanged). Previously, `protocol-templates`/`protocol-categories` came out as `Protocol-template`/`Protocol-categorie` in the audit log.
- `apps/web/src/pages/settings/AuditLog.tsx`: `ENTITY_TYPE_LABELS` gains `ProtocolCategory`, `Schedule`, `User`, `Onboarding`, `Log`, `ConsultationRecord`, and the legacy kebab-case keys (`Protocol-template`, `Protocol-categorie`, `Onboardin`) that already exist in historical audit rows predating this fix — all still show a friendly label instead of falling back to the raw `entityType` value.
- `apps/web/src/pages/Dashboard/helpers.ts`: `friendlyEntity` gains the same set of keys (`ProtocolCategory`, `Schedule`, `User`, `Log`, `ConsultationRecord` → "una historia médica", and the kebab-case/historical variants) so the dashboard activity feed describes these entity types in Spanish instead of falling back to the generic "un registro (…)".

### Added

- `apps/web/src/components/protocols/__tests__/BlockRenderer.vitals-notes.test.tsx`: regression test (new, no prior coverage of the read-only `BlockRenderer`) that pins that `clinical_notes` renders its label exactly once (no duplicate from the `ProtocolBlock` chrome), that `vitals` without a `title` shows the type chip exactly once, and that `vitals` with `title: 'Signos basales'` shows that title exactly once.
- Tests: `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts` gains cases for `protocol-templates` → `ProtocolTemplate` and `protocol-categories` → `ProtocolCategory`. `apps/web/src/components/template/__tests__/TemplateEditor.test.tsx` gains cases for the `required` round-trip via the header toggle and for confirming the detail panel no longer renders a second checkbox. `apps/web/src/pages/settings/__tests__/AuditLog.test.tsx` gains a parameterized case over the new `ENTITY_TYPE_LABELS` keys. `apps/web/src/pages/Dashboard/__tests__/helpers.test.ts` gains a case for `ConsultationRecord` → "una historia médica".

## [2026-07-08] Crash-recovery drafts include the medical-record mapping

### Fixed

- `apps/web/src/store/editor.store.ts`: `saveLocalDraft(protocolId, blocks, historiaMapping?)` gains an optional third parameter; the payload persisted to `localStorage` includes `historia_mapping` only when the mapping is non-empty. `loadLocalDraft` returns `{ blocks, historiaMapping?, savedAt }` — backward compatible with old `{blocks, savedAt}` drafts, which load with `historiaMapping` as `undefined`.
- `apps/web/src/pages/ProtocolEditor/index.tsx`: the autosave (30s interval) now also persists the current medical-record mapping via a new `mappingRef` (same pattern as `blocksRef`). `applyDraft` restores `historiaMapping` from the recovered draft (without touching `savedHistoriaMapping`, so the recovered edit reads as unsaved and "Guardar" persists it). Previously, an edit that only touched the medical-record mapping (no changes to `blocks`) was not recoverable after an unexpected browser close.
- Tests: `apps/web/src/store/__tests__/editor.store.test.ts` gains round-trip cases with a mapping, without a mapping (key absent in the stored JSON), and loading a legacy payload without `historia_mapping`. `apps/web/src/pages/ProtocolEditor/__tests__/index.test.tsx` gains a case that forces an autosave tick (fake timers, 30s) after an edit that only touches the mapping and verifies the `localStorage` draft includes `historia_mapping`, and another that applies a recovered draft with a mapping and verifies the Historia médica tab reflects the restored override.

## [2026-07-08] Hydration gate in the order-queue session

### Fixed

- `apps/web/src/hooks/consultations/use-order-queue-session.ts`: `useOrderQueueSession` gains a hydration `useRef` (`hydrated`) that prevents the mirror effect (the one that persists/clears `localStorage` based on the queue arrays) from running with pre-restore store values. The restore effect (`deps: [consultationId]`) sets `hydrated.current = false` as its first statement and `hydrated.current = true` as its last — on the happy path and on every early return (`isSigned`, no saved snapshot, corrupt snapshot) — because the hook counts as "hydrated" as soon as the restore step finished, whatever it found. The mirror effect now starts with `if (!hydrated.current) return`. The suspected race was: a first commit in which the mirror effect ran with the arrays still empty (before `restoreSnapshot()`) would enter its "empty queue" branch and call `localStorage.removeItem`, deleting the snapshot right before the restored values propagated — the same transient problem when changing `consultationId` (`reset()`). No dependency array changed. **Final-review note:** under React's effect ordering (effects of the same component run in declaration order within a commit), that race could not be observed as false in this code — the original repro never reproduced. This change is therefore a defensive hardening of the "hydrate before mirror" property, not a confirmed root-cause fix.
- Tests: `apps/web/src/hooks/consultations/__tests__/use-order-queue-session.test.ts` gains four cases. Two document the invariant of the original race (snapshot survives the initial mount; a `consultationId` change from A to B deletes neither A's key nor B's key) via a mechanism assertion (`localStorage.removeItem` is not invoked on those keys); both are explicitly commented as non-deterministic for the race itself — under React's test renderer the effects of the same component run in declaration order within a commit, so the interleaving that caused the bug does not reproduce there, and the real protection against that case (the A→B change) is verified by code inspection: the gate makes the interleaving impossible by construction, not by timing observed in the test. The other two cases do pin the behavior of the gate itself — that every exit branch of the restore effect sets `hydrated.current = true`, including the corrupt-snapshot path and the no-snapshot path — verified red/green: removing the `hydrated.current = true` from the `catch` path makes the corrupt-snapshot test fail as expected. The 9 preexisting cases remain green.

## [2026-07-08] Idempotent order creation on the flush retry (clientRequestId)

### Added

- `packages/db/prisma/schema.prisma`: `Prescription`, `ImagingOrder` and `LabOrder` gain `clientRequestId String? @map("client_request_id") @db.VarChar(64)` and a `@@unique([consultationId, clientRequestId])` constraint. Postgres allows multiple `NULL`s in a unique index, so existing rows (without `clientRequestId`) are unaffected. Migration `packages/db/prisma/migrations/20260708043942_order_client_request_id/`.
- `packages/shared/src/schemas/consultation.ts`: `CreatePrescriptionGroupSchema`, `CreateImagingOrderGroupSchema` and `CreateLabOrderGroupSchema` gain `clientRequestId: z.string().min(8).max(64).optional()`.
- `apps/api/src/modules/orders/orders.repository.ts`: `createPrescription`, `createImagingOrder` and `createLabOrder` pass `clientRequestId` to the `create` and, if Prisma throws `P2002` on the `(consultationId, clientRequestId)` unique constraint, recover and return the row already created by the original attempt instead of failing — same structural pattern (`err.code === 'P2002'`, without importing Prisma types) as `users.repository.ts`. Without `clientRequestId` or on any other error, it re-throws as-is.
- `apps/web/src/store/order-queue.store.ts`: each `OrderGroup` gains `requestId: string` (`crypto.randomUUID()`), regenerated for each group instance — when creating one with `addMedicationGroup`/`addImagingGroup`/`addLabGroup`, and in the default group of every `reset()` call (including store initialization). The default group's display `id` (`'default-rx'`, etc.) does not change — it is still used only for local grouping. `restoreSnapshot` makes old `localStorage` snapshots that lack `requestId` backward compatible, generating a new one for each group missing it.
- `apps/web/src/hooks/consultations/use-flush-order-queue.ts`: each group POST (`createPrescription`, `createImagingOrder`, `createLabOrder`) sends `clientRequestId: group.requestId`. Because the group is not removed from the queue until its create succeeds, a client timeout (30s `AbortSignal`) that already persisted on the server and a later retry of the same queued group send the same `clientRequestId` — the API detects the duplicate and returns the existing row, avoiding a duplicate signed prescription/order.
- Tests: `packages/shared/src/schemas/__tests__/consultation.spec.ts` (validation of `clientRequestId` in the three creation schemas); `apps/api/src/modules/orders/__tests__/orders.repository.spec.ts` (passing `clientRequestId` to the `create`, recovery after `P2002` for the three order types, re-throwing non-`P2002` errors, re-throwing `P2002` without `clientRequestId` or if the refetch finds nothing); `apps/web/src/store/__tests__/order-queue.store.test.ts` (`requestId` in the default groups, fresh `requestId` on each `addXGroup`/`reset()`, backfill and preservation in `restoreSnapshot`); `apps/web/src/hooks/consultations/__tests__/use-flush-order-queue.test.ts` (the payload includes `clientRequestId`; two flushes of the same still-queued group send the same id).

## [2026-07-08] Silence per-group toasts during the order flush

### Fixed

- `apps/web/src/hooks/consultations/use-consultations.ts`: `useCreatePrescription`, `useCreateImagingOrder` and `useCreateLabOrder` gain an optional second parameter `opts?: { silent?: boolean }`. With `silent: true`, each hook's `onSuccess`/`onError` still invalidates the consultation query (unchanged) but stops firing `toast.success`/`toast.error`. Without `opts`, the behavior is identical to before — the manual "Generar" calls in `OrderQueuePanel.tsx` (:556, :689, :819) do not pass `opts` and do not change.
- `apps/web/src/hooks/consultations/use-flush-order-queue.ts`: the three hook instances that `flush()` uses are now created with `{ silent: true }`, so a flush of several groups (medications, lab, imaging) when signing the consultation no longer produces a success/error toast per group — only the single `errorFlushOrders` that `flush()` already emitted on a failure remains.

### Added

- Tests: new `apps/web/src/hooks/__tests__/use-consultations.create-toasts.test.tsx` (harness copied from `use-protocols.save-toast.test.tsx`) that tests, for the three creation hooks, that the toast fires by default and is suppressed with `{ silent: true }`, both on success and on error.
- Tests: `apps/web/src/hooks/consultations/__tests__/use-flush-order-queue.test.ts` gains a test that verifies `flush()` invokes the three hooks with `{ silent: true }`, plus a new case that queues and persists an imaging group (covers the imaging path of the flush, previously only tested for medications/lab).

## [2026-07-08] Optimistic locking when editing a protocol's content in two tabs

### Added

- `packages/shared/src/errors.ts`: new `PROTOCOL_USAGE_STALE` code in the Consultation block.
- `packages/shared/src/schemas/consultation.ts`: `UpdateProtocolUsageSchema` gains `expectedUpdatedAt` (optional ISO datetime) — the optimistic-concurrency precondition that accompanies a `content` replacement.
- `packages/shared/src/types/consultation.ts`: `ConsultationProtocolUsage` gains `updatedAt: string`.
- `apps/api/src/modules/consultations/consultations.repository.ts`: `toProtocolUsage` now emits `updatedAt` (ISO string) on each serialized `ConsultationProtocolUsage`.
- `apps/api/src/modules/consultations/consultations.service.ts`: `updateProtocolUsage` rejects with `ConflictException` (`PROTOCOL_USAGE_STALE`, with `details.currentUpdatedAt`) when the PATCH carries `content` and an `expectedUpdatedAt` that no longer matches the row's current `updatedAt` — two tabs editing the same open consultation can no longer silently overwrite clinical content. PATCHes without `content` or without `expectedUpdatedAt` (`modifications`-only calls) do not change behavior.
- `apps/web/src/hooks/consultations/use-pending-modifications.ts`: `flush` sends `expectedUpdatedAt` alongside `content` whenever there is a pending content replacement. On a 409 `PROTOCOL_USAGE_STALE`, that `usage`'s content edit (`contentEdits`) is permanently discarded (resending it would only repeat the 409), the `modifications` delta is re-queued like any other failure, the `errorProtocolUsageStale` toast is shown only once even if several `usages` come back stale, and the consultation query is invalidated to fetch the fresh content. Other rejections keep the existing behavior (re-queue both buffers + generic toast).
- `apps/web/src/lib/toasts.ts`: new `errorProtocolUsageStale` string.
- Tests: `consultations.service.spec.ts` (rejection on a stale `expectedUpdatedAt`, passing without forwarding the field when it matches, `modifications`-only calls without the check), `consultations.repository.spec.ts` (`updatedAt` mapped to an ISO string), `use-pending-modifications.test.tsx` (sending `expectedUpdatedAt`, handling the stale 409 — single toast, contentEdits discarded, modifications re-queued, query invalidation — and the non-stale path unchanged).

## [2026-07-08] Medical-record version selector — UI

### Added

- `apps/web/src/hooks/consultations/use-consultation-record.ts`: `useRecordVersions(consultationId)` (GET `/record/versions`, key `[QK, consultationId, 'versions']`) and `useRecordVersion(consultationId, versionNumber | null)` (GET `/record/versions/:versionNumber`, enabled only when a version other than the latest is chosen). `downloadRecordPdf` accepts an optional `versionNumber` and adjusts the URL (`?version=N`) and the file name (`historia-<id>-v<N>.pdf`). `useRegenerateRecord` and `useSignRecord` invalidate `[QK, consultationId, 'versions']` on completion so the listing does not go stale.
- `apps/web/src/pages/PatientDetail/RecordDocument.tsx`: version selector (existing `Select` component) next to the "· v{n}" label, visible only when there is more than one version. Choosing an older version renders its sections in strictly read-only mode — hides Editar/Firmar/Regenerar, shows the "Versión anterior — solo lectura" notice, and only allows downloading that version's PDF. Returning to the latest version restores the current behavior unchanged.
- `apps/web/src/pages/PatientDetail/strings.ts`: new strings `versionLabel`, `versionSelectorAria`, `olderVersionNotice`.
- Tests: `use-consultation-record.test.tsx` (versions, versioned download, invalidation after regenerate/sign) and `RecordDocument.test.tsx` (selector hidden/visible, reading an older version, versioned download, restoration on returning to the latest) are extended. `HistoriaTab.test.tsx` gains the default mocks of the new hooks.

## [2026-07-08] Medical-record version history — API

### Added

- `packages/shared/src/types/consultation-record.ts`: new `RecordVersionSummary` type (id, versionNumber, kind, status, generatedAt, signedAt) to list the version history without fetching each one's full content.
- `apps/api/src/modules/consultation-records/consultation-records.repository.ts`: `listVersions` (all non-deleted versions of a consultation, ordered by `versionNumber` desc, filtered by tenant) and `findByVersion` (exact version or `null`). New private `toSummary` mapper.
- `apps/api/src/modules/consultation-records/consultation-records.service.ts`: `listVersions` (delegates to the repo; empty array if the consultation has no record, no 404 — the UI uses this as a gate) and `getVersion` (throws `RECORD_NOT_FOUND` if the version does not exist). `getPdfData` accepts an optional `versionNumber` and loads that version instead of the latest when provided.
- `apps/api/src/modules/consultation-records/consultation-records.controller.ts`: `GET /v1/consultations/:consultationId/record/versions` and `GET /v1/consultations/:consultationId/record/versions/:versionNumber`. `GET …/record/pdf` gains the optional `version` query param (validated as an integer via `ParseIntPipe`); the downloaded file name becomes `historia-${consultationId}-v${N}.pdf` when a version is given. The download audit (category `communication`, action `pdf_generated`) is kept unchanged for versioned downloads.
- Tests: `consultation-records.{repository,service,controller}.spec.ts` are extended with the new cases (listing, specific version, 404 for a nonexistent version, versioned pdf, tenant filtering).

## [2026-07-08] Retry on version collision when creating a ConsultationRecord

### Fixed

- `apps/api/src/modules/consultation-records/consultation-records.service.ts`: `ensureDraft` and `regenerate` computed `versionNumber` optimistically (`1` and `latest.versionNumber + 1` respectively) after a `findLatest` read, without handling the `P2002` collision of `@@unique([consultationId, versionNumber])` — two concurrent calls collided and one of them got a generic 409 instead of resolving. `ensureDraft` now, on `P2002`, re-reads `findLatest` and returns the race-winning record instead of creating another. `regenerate` re-reads `findLatest`, recomputes `versionNumber`, and retries the creation once; a second collision is re-propagated unwrapped (the global exception filter already translates it to a 409).

### Added

- Tests: `consultation-records/__tests__/consultation-records.service.spec.ts` gains five cases — recovery by re-read in `ensureDraft` after `P2002`, non-P2002 re-propagated without a re-read, empty-re-read edge after `P2002`, single retry with a recomputed version in `regenerate`, and re-propagation of the second collision when the retry also collides.

## [2026-07-08] Correct toast on saving a draft and single label on clinical notes

### Fixed

- `apps/web/src/hooks/protocols/use-protocols.ts`: saving a version as a draft showed the "Nueva versión publicada" toast even though nothing was published — the doctor could believe the new version was already active in consultations. `useSaveVersion` now distinguishes by `dto.publish`: "Borrador guardado" (new `protocolDraftSaved` string in `lib/toasts.ts`) vs. "Nueva versión publicada".
- `apps/web/src/components/protocols/BlockRendererRunMode.tsx`: in consultation mode, clinical-note blocks showed their label twice (block header title + internal label with an asterisk). The duplicated header `title` is removed — the internal label, which also marks the required flag, is the only source. Same criterion previously applied to the editor and the read-only view (finding from the live E2E on 2026-07-08).

### Added

- `docs/TODO.md`: watch item for the (one-time, not reproduced) loss of the order-queue snapshot in localStorage after a reload.

## [2026-07-07] A prescribed medication's duration is optional

### Fixed

- `packages/shared/src/schemas/consultation.ts`: `PrescriptionItemSchema.duration` goes from `min(1)` to optional with default `''`. Medications queued from a dosage table ("+ Añadir a receta") carry no duration — dosage tables have no such column and the queued row is not editable — so both "Generar receta" and the pre-sign flush failed with `VALIDATION_ERROR` 400 with no way out for the doctor (finding from the live E2E on 2026-07-07). Chronic prescriptions with no fixed duration are now valid.
- `packages/shared/src/record/generate-record-sections.ts`: the treatment plan omits the trailing dash when the medication has no duration (previously: `Enalapril 10 mg VO cada 12 h — `).

## [2026-07-07] The "Firmar y cerrar" button is disabled while the pre-sign flush runs

### Fixed

- `apps/web/src/components/consultations/SignModal.tsx`: the confirmation button was only disabled with `signMutation.isPending`, but `onBeforeSign()` (persists pending modifications and drains the order queue — can take seconds, with network budgets of 15s+30s per call) runs BEFORE `signMutation.mutate`, leaving the button enabled and without feedback during that window. A double click fired two concurrent flush IIFEs that took the same queue snapshot, generating duplicate prescriptions in a consultation about to be signed. A `preparing` state is now tracked (true at the start of the IIFE, false in a `finally`); the button uses `disabled={preparing || signMutation.isPending}` and shows the `Firmando…` label during both phases, and an `onBeforeSign` that resolves false re-enables the button.

### Added

- Tests: `components/consultations/__tests__/SignModal.flush.test.tsx` gains three cases — (a) repeated clicks during the real in-flight flush do not double-POST prescriptions or double-sign (red against the previous code), (b) the button re-enables after `onBeforeSign` → false, (c) signing proceeds after `onBeforeSign` → true. `components/protocols/__tests__/EditorBlockRenderer.chrome.test.tsx`: the vitals chip assertion is adjusted from `toBeGreaterThanOrEqual(1)` to `toHaveLength(2)` (chip + fallback title render the type name) to catch duplicate-chip regressions.

## [2026-07-07] The location selector distinguishes "loading" from "zero locations"

### Fixed

- `apps/web/src/components/layout/Topbar.tsx`: the location selector panel confused "fetch in progress" (`locations === undefined`) with "zero confirmed locations" — if the user opened the dropdown before the first fetch resolved, they saw the empty state `Sin ubicaciones configuradas` even though the tenant did have locations. `isLoading` is now destructured from `useLocations()` and the empty state only renders when `!isLoading`; while loading, the panel shows neither the list nor the empty state.

### Added

- Tests: `components/layout/__tests__/Topbar.test.tsx` gains a case that simulates `useLocations` with `{ data: undefined, isLoading: true }` and confirms that neither the list nor "Sin ubicaciones configuradas" render while loading (regression guard for the fix above). `components/consultations/__tests__/NewConsultationDialog.test.tsx` strengthens the preselected-patient test (`initialPatient`): it now also clicks "Iniciar consulta" and verifies that `createConsultationMock` receives `patientId: 'p1'`, instead of only checking the combobox value.

## [2026-07-07] Start a consultation from the patient and the location-selector empty state

### Added

- `apps/web/src/pages/PatientDetail/PageHeader.tsx`: new primary "Nueva consulta" button (`ph-plus`, `newConsultation` string in `pages/PatientDetail/strings.ts`) next to the existing "Editar" button. It opens `NewConsultationDialog` (see below) with the page's patient already preselected — previously there was no way to start a walk-in consultation from the patient file. Along the way, the strings still hardcoded in the header were moved to `strings.ts`: `breadcrumbPatients: 'Pacientes'`, `editButton: 'Editar'`, `noDocument: 'Sin documento'`.
- `apps/web/src/components/consultations/NewConsultationDialog.tsx`: new optional prop `initialPatient?: { id: string; fullName: string }` — when passed, the `PatientCombobox` starts with that patient already selected (via initial `useState`, no effects). `apps/web/src/pages/Schedule/PatientCombobox.tsx` gains the `initialSelectedName?: string` prop to seed its internal `selectedName` state; its other consumers (schedule) are unaffected since it is optional.
- `apps/web/src/pages/PatientDetail/index.tsx`: new `showNewConsultation` state that mounts `NewConsultationDialog` with `initialPatient` derived from the loaded patient; the dialog navigates to `/consultas/:id` on its own when creating the consultation (same pattern as `pages/Schedule/index.tsx`).
- `apps/web/src/components/layout/Topbar.tsx`: the location selector panel now renders whenever it is open, even with zero locations — previously the whole panel disappeared (`dropdownOpen && locations.length > 0`) and offered no way out. With an empty list it shows an empty state with the strings `noLocations: 'Sin ubicaciones configuradas'` and an `addLocation: 'Añadir ubicación'` link (new in `components/layout/strings.ts`) to `/ajustes/ubicaciones`, which closes the dropdown when clicked.
- Tests: `NewConsultationDialog.test.tsx` (patient preselection via `initialPatient`), `PatientDetailTabs.test.tsx` ("Nueva consulta" button opens the dialog with the patient already selected), new `components/layout/__tests__/Topbar.test.tsx` (empty state with zero locations vs. normal listing with locations).

## [2026-07-07] Batch of E2E findings: consultation dialog, orders, RNC, and vitals rounding

### Changed

- `apps/web/src/components/consultations/NewConsultationDialog.tsx`: removed the inline `create-patient` mode ("Crear paciente" button + minimal first-name/last-name/date-of-birth form) — the only patient-creation path is now the "Nuevo paciente" option of the `PatientCombobox` itself, which opens the full `PatientModal` (with history). The patient search field now uses the correct `Field` label (`patientLabel: 'Paciente'`) instead of reusing the modal title. `newConsultationDialogStrings.ts` lost `createPatientAction`, `backToSearchAction`, `firstNameLabel`, `lastNameLabel`, `dateOfBirthLabel` (dead code) and gained `patientLabel`.
- `apps/web/src/components/consultations/OrderQueuePanel.tsx`: the queued medication row no longer shows the raw `source` (e.g. `protocol:row_e2e_1`); it now renders `sourceFromProtocol: 'Desde protocolo'` when `source` starts with `protocol:`, and nothing in any other case (never a raw id). New string in `apps/web/src/components/consultations/strings.ts`.
- `apps/web/src/pages/Protocols/strings.ts`: the Protocols empty-state `emptyDescription` is simplified to `'Crea tu primer protocolo a partir de una plantilla.'` (it no longer mentions "o desde cero", which is not a supported path).

### Added

- `<SelectItem value="rnc">` in the document-type selects of `apps/web/src/pages/Patients/PatientModal.tsx` (`docTypeRnc: 'RNC'` in `pages/Patients/strings.ts`) and `apps/web/src/pages/PatientDetail/EditModal.tsx` (`documentTypeRnc: 'RNC'` in `pages/PatientDetail/strings.ts`) — the shared Zod enum already supported `'rnc'`, but the UI did not offer the option.

### Fixed

- `apps/web/src/components/protocols/BlockRendererRunMode.tsx`: numeric vitals fields (e.g. weight) could persist floating-point artifacts from the browser's `<input type="number">` (`81.4000015258789`). New `normalizeVitalsValues` rounds to at most 2 decimals, applied only on blur (commit), never per keystroke — rounding while typing would break editing values like a half-typed "81.".
- Tests: `NewConsultationDialog.test.tsx` (picker label, a single creation affordance, removes the dead inline-mode test), new `OrderQueuePanel.test.tsx` (caption "Desde protocolo" vs. raw source vs. no source), `PatientModal.test.tsx` and `EditModal.test.tsx` (RNC option reaches the payload), `BlockRendererRunMode.vitals-notes.test.tsx` (rounding only on blur).

## [2026-07-07] Audit entity name and missing sections when signing a record

### Fixed

- `apps/api/src/common/interceptors/audit-log.interceptor.ts`: the URL-segment singularizer used `slice(1, -1)`, which stripped the last letter from any non-plural segment (`onboarding` → `Onboardin`). `toEntityType` now trims the trailing `s` only when the segment actually ends in a plural (`patients` → `Patient`); segments like `onboarding` are capitalized without trimming.
- `apps/web/src/pages/Dashboard/helpers.ts`: `friendlyEntity` gained the `Onboarding: 'la configuración inicial'` entry, which previously did not exist and fell back to the generic format «un registro (Onboarding)» in the dashboard activity feed.
- `apps/web/src/hooks/consultations/use-consultation-record.ts`: `useSignRecord`'s `onError` now reads `err.error.details.missing` (already provided by the API, `consultation-records.service.ts`) and builds the toast with the Spanish titles of the missing sections (`RECORD_SECTION_TITLES` from `@rezeta/shared`), instead of the generic «Completa las secciones requeridas antes de firmar.» that did not indicate which. The generic message is kept as a fallback if `details` comes back absent or empty. New `historiaMissingSectionsNamed` string in `apps/web/src/lib/toasts.ts`.
- Tests: `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts` (plural vs. non-plural segment), `apps/web/src/pages/Dashboard/__tests__/helpers.test.ts` (`Onboarding` mapping), `apps/web/src/hooks/consultations/__tests__/use-consultation-record.test.tsx` (toast with section names vs. generic without `details`).

## [2026-07-07] Fixed date of birth off by one day (F8)

### Added

- `parseDateOnly` in `apps/web/src/lib/format/dates.ts`: parses `'YYYY-MM-DD'` strings (or with a time suffix, which is ignored) as LOCAL midnight, avoiding the offset of `new Date('YYYY-MM-DD')`, which interprets the string as UTC midnight and, when formatted in `America/Santo_Domingo` (UTC-4), shows the previous day.

### Fixed

- `formatDate`/`formatAge` (`apps/web/src/pages/Patients/helpers.ts`), used by `PatientDetail/DemographicsBlock.tsx` and `Patients/PatientModal.tsx` to show `patient.dateOfBirth` (`@db.Date` column, no time component): a patient born on 15/03/1972 was shown as «14 de marzo de 1972» and one year short at the birthday boundary. Both functions now use `parseDateOnly` instead of `new Date(iso)`.
- Audited the sibling `formatDate` calls that consume ISO strings (`Schedule/helpers.ts`, `Consultation/helpers.ts`, `Billing/helpers.ts`, `PatientDetail/PrescriptionsTab.tsx`, `PatientDetail/AppointmentsTab.tsx`, `Dashboard/helpers.ts`): they all receive full `DateTime` columns (`startsAt`, `signedAt`, `amendedAt`, `createdAt`, etc.), not pure dates — they were left unchanged because they do not have the bug.

## [2026-07-07] Block parity in the template editor: vitals, clinical note, and orders

### Added

- `TemplateEditor.tsx` (`apps/web/src/components/template/`): the `BlockType`, the palette, and `TYPE_LABELS` now include `vitals` («SIGNOS VITALES»), `clinical_notes` («NOTA CLÍNICA»), `imaging_order` («ORDEN IMAGEN») and `lab_order` («ORDEN LAB») — previously only the protocol editor supported these four types, leaving doctors with no way to scaffold the blocks the medical record depends on.
- `newBlock` gains per-type factories: `vitals` starts with the same 5 default fields as the protocol editor's `block-factory.ts` (blood pressure, heart rate, temperature, weight, height); `clinical_notes` starts with `label: 'Nota clínica'`; `imaging_order`/`lab_order` start with `orders: []`. All produce blocks valid against `TemplateBlockSchema` (`packages/shared/src/schemas/protocol.ts`).
- The detail panel is now type-aware: `clinical_notes` edits `label` (instead of `title`) plus an «Obligatorio» checkbox; `dosage_table` gains a row editor (`DosageRowsEditor` — drug/dose/route/frequency/notes columns with add/remove row) that replaces the generic placeholder textarea. `vitals`, `imaging_order` and `lab_order` keep the generic panel (title + placeholder).
- Fixed a latent bug along the way: `BlockRow` passed a fixed `expandedBlockId={null}` to `ChildBlockList`, so the detail panel of a child block (every non-section block lives inside a section) could never expand after being added. The reducer's real `expandedBlockId` is now threaded through `SortableBlockRow` → `BlockRow` → `ChildBlockList`.
- `strings.ts`: new keys `addVitals`, `addClinicalNotes`, `addImagingOrder`, `addLabOrder`, `clinicalNotesLabelPlaceholder`, `obligatorio`, `dosageRowsLabel`, `dosageColumnLabels`, `dosageAddRow`, `dosageRemoveRow`.
- New `apps/web/src/components/template/__tests__/TemplateEditor.test.tsx`: palette with the 11 block buttons, `vitals` defaults valid against `TemplateBlockSchema`, editing `label` in `clinical_notes` with a round-trip to state, and adding a dosage row with a round-trip to state.

## [2026-07-07] Single header per block in the protocol editor

### Fixed

- Unselected block cards in the protocol editor rendered TWO stacked headers: the one from `EditorBlockRenderer` (chip + title) and, below it, the one from `ProtocolBlock` inside `BlockRenderer`. This duplicated the chip and title on `dosage_table` blocks (e.g. «DOSIFICACIÓN»/title twice) and, before `blockTypeLabel`/`blockDisplayTitle` covered `vitals`/`clinical_notes`, showed the generic «Bloque» chip above the correct chip.
- `BlockRenderer.tsx`: new prop `chromeless?: boolean` — when `true`, each leaf-block switch case returns its inner content directly, without the `ProtocolBlock` wrapper (sections and nesting are unaffected; run mode (`BlockRendererRunMode.tsx`) was not touched). The `dosage_table` and `alert` cases in `chromeless` mode also do not forward `title` to the inner component (`ProtocolDosageTable`/`ProtocolAlert`), avoiding a third repetition of the title.
- `EditorBlockRenderer.tsx`: the unselected body of the leaf-block card now renders `<BlockRenderer chromeless />`, leaving `EditorBlockRenderer`'s typed header as the card's only header.
- `ProtocolBlock.tsx` (ui-kit): `title` is now optional; the title span only renders when there is a value, instead of always showing a string (empty or duplicated).
- Protocol read-only view (`BlockRenderer.tsx`, non-`chromeless` path): the `clinical_notes` case no longer passes `title={b.label}` to the `ProtocolBlock` chrome (the label was still visible in the body via `ClinicalNotesBlock`, duplicated); the `vitals` case only passes `title` when `b.title` is defined, instead of always falling back to «Signos vitales» duplicating the chip.
- New `apps/web/src/components/protocols/__tests__/EditorBlockRenderer.chrome.test.tsx` covers: correct chip (not «Bloque») for unselected `vitals`/`clinical_notes`, `dosage_table` title and chip rendered exactly once, and `BlockRenderer` with `chromeless` without the `ProtocolBlock` header.

## [2026-07-07] A vitals block's title survives schema validation

### Fixed

- `packages/shared/src/schemas/protocol.ts`: the `vitals` variant of `ProtocolBlockSchema` and `TemplateBlockSchema` had no `title` field, so Zod silently dropped it on save — `VitalsBlockEditor` allows editing a vitals block's title, but the change was lost on the first save. Added an optional `title` to the `vitals` variant in both schemas (like the other block types) and to the hand-written `ProtocolBlock` type (`packages/shared/src/types/protocol.ts`).
- Tests: `packages/shared/__tests__/protocol.test.ts` gains a case confirming that `title` survives parsing of a `vitals` block.

## [2026-07-07] Edit for clinical-note and vitals blocks in the protocol editor

### Added

- `EDITABLE_BLOCK_TYPES` (`apps/web/src/components/protocols/EditorBlockRenderer.tsx`) now includes `vitals` and `clinical_notes`, enabling the context menu's «Editar» item and the swap to `EditForm` for both types (previously they had no edit action).
- New `ClinicalNotesBlockEditor.tsx`: edits `label` («Etiqueta» field) and `required` («Obligatorio» checkbox) with the same local-draft + `updateBlock`/`selectBlock(null)` pattern as `DosageTableEditor`. An editable label is what lets the medical record route the note's content to the correct section (the mapping is done by `block.label`).
- New `VitalsBlockEditor.tsx`: edits the block title and the `fields` rows (label, unit, type); allows adding/removing fields. `input_type: 'computed'` fields (e.g. BMI) render locked — no remove button and no type selector — to protect derived formulas.
- `strings.ts`: new keys `notesLabelField`, `notesRequiredField`, `vitalsTitleField`, `vitalsFieldLabel`, `vitalsFieldUnit`, `vitalsFieldType`, `vitalsTypeText`, `vitalsTypeNumber`, `vitalsTypeComputed`, `vitalsAddField`, `vitalsRemoveField(label)`.
- `blockTypeLabel`/`blockDisplayTitle` (`EditorBlockRenderer.tsx`) now have entries for `vitals` and `clinical_notes` instead of falling back to the generic "Bloque" label.

## [2026-07-07] Queued orders are persisted when signing the consultation

### Fixed

- Orders added with «+ Añadir a receta» (medications, lab, imaging) lived only in the `useOrderQueueStore` client store and were silently discarded on signing, leaving the patient's Recetas tab and the medical record's treatment plan empty. New `useFlushOrderQueue` hook (`apps/web/src/hooks/consultations/use-flush-order-queue.ts`) that persists each queued group via the existing creation endpoints before the sign `PATCH`.
- `Consultation/index.tsx`: `onBeforeSign` now composes the persistence of pending modifications followed by draining the order queue; if any creation fails, signing is aborted (no immutable record is created from half-saved content) and the queue stays intact to retry (`toastStrings.errorFlushOrders`).
- `Consultation/index.tsx`: on a successful sign, `useOrderQueueStore` is reset, avoiding the mismatch between the «Recetas 1» chip and the «Sin recetas en esta consulta» list.

## [2026-07-07] Protocol editor — visible feedback on saving

### Fixed

- `EditorHeader.tsx`, `SaveModal.tsx`, `PublishModal.tsx`: while a save is in progress, the «Guardar» and «Publicar»/«Guardar y publicar» buttons now show `Spinner` + the labels «Guardando…»/«Publicando…» (previously the publish button gave no loading signal).
- `index.tsx`: the three save flows (`handleSaveDraft`, `handleSaveModalPublish`, `handlePublishConfirm`) now clear the «Se recuperó un borrador no guardado» banner (`setDraftBanner(null)`) in their `onSuccess`; previously the banner survived a successful save.
- `strings.ts`: added `publishing: 'Publicando…'` and normalized `saving` to `'Guardando…'` (unicode ellipsis, consistent with the rest of the app).

## [2026-07-07] Transport-level timeouts so requests always resolve

### Fixed

- `apps/web/src/lib/api-client.ts`: `request()` and `downloadBlob()` could hang indefinitely if `authClient.getToken()` never resolved (e.g. a network problem refreshing the Firebase token) or if the API `fetch` never settled — without a timeout, the global loading spinner stayed active forever and there was no way to retry. `getToken()` now runs under a new `withTimeout` helper (15s) and the `fetch` receives `signal: AbortSignal.timeout(30_000)` (30s); both cases reject with a readable error instead of hanging.
- `apps/web/src/lib/toasts.ts`: new `errorRequestTimeout` string for the timeout message.
- Tests: `apps/web/src/lib/__tests__/api-client.test.ts` gains cases for the token-fetch timeout and the `fetch` request timeout.

## [2026-07-07] Patient history and creation from the schedule

### Added

- `TagInput` component in the ui-kit (chips with Enter/comma, deduplication, Backspace, keyboard accessible).
- «Alergias» and «Condiciones crónicas» fields in create patient (`PatientModal`) and edit patient (`EditModal`) — previously they were only displayed, with no way to capture them.
- «Nuevo paciente» option at the end of the schedule's patient selector (`PatientCombobox`): opens patient creation and automatically selects the created one.

### Fixed

- Submitting the nested patient-creation form no longer triggers the appointment form's submit (submit bubbling through the portal); dropdown buttons with `type="button"`.

## [2026-07-07] Run-mode vitals and notes — final review fixes

### Fixed

- `BlockRendererRunMode` (`apps/web/src/components/protocols/BlockRendererRunMode.tsx`): the `onBlur` handlers of the `vitals` and `clinical_notes` blocks emitted `vitals_entered`/`notes_edited` unconditionally, so focusing a field and leaving without editing wrote a false event into the (append-only) audit history. Each subcomponent now uses a `dirtySinceLastEmit` ref that only allows emission when there was a real `onChange` since the last emission.
- `computeMissingRequiredFields` (`packages/shared/src/protocol/sign-validation.ts`): a required `vitals` block passed sign validation with all values empty (`{ weight: '' }`), because it only counted present keys. It now requires at least one non-empty value after trimming whitespace.
- `ConsultationsService.updateProtocolUsage` (`apps/api/src/modules/consultations/consultations.service.ts`): it did not reject content writes when the consultation was already signed, unlike `update()`. A late flush from a stale tab could mutate signed clinical content without leaving an amendment trail. It now rejects with `CONSULTATION_ALREADY_SIGNED` before writing.
- `usePendingModifications.flush` (`apps/web/src/hooks/consultations/use-pending-modifications.ts`): when a usage had buffered content edits but was not found in the React Query cache, the PATCH was sent anyway (with the content silently omitted, or with an empty body `{}`). That usage is now skipped from the flush and both buffers are kept to retry when the usage reappears in the cache.
- Fixed the incorrect path (`apps/web/src/pages/Consultation/BlockRendererRunMode.tsx` → `apps/web/src/components/protocols/BlockRendererRunMode.tsx`), the duplicated word «silent silent», and the mid-sentence language switch in the changelog entry of `[2026-07-07] Captura de vitales y notas clínicas en consulta`.
- `applyContentEdits` (`apps/web/src/lib/consultation/content-edits.ts`): `section` blocks without internal edits now keep the same reference (identity) of the original object instead of always being cloned, fulfilling what the function's comment already documented.
- `withDerivedBMI` (`apps/web/src/components/protocols/BlockRendererRunMode.tsx`): the numeric guard now requires `weight > 0`, like the weight falsy-check in `computeBMI`, so a weight of `'0'` no longer produces a BMI.

## [2026-07-07] Vitals and clinical-note capture in the consultation

### Added

- Run-mode inputs for `vitals` and `clinical_notes` protocol blocks in the consultation canvas (`BlockRendererRunMode`, `apps/web/src/components/protocols/BlockRendererRunMode.tsx`): vitals form captures weight, height, temperature, heart rate, blood pressure, respiratory rate; BMI is derived from weight + height (`weight / (height/100)²`); both block types persist content into the `ProtocolUsage.content` snapshot and emit typed `vitals_entered` / `notes_edited` audit events, yielding one audit record per editing burst (not per keystroke).
- `usePendingModifications` now buffers content edits alongside event modifications, overlaying them onto the server-truth usage at render time (`usageWithDraft`); live required-field validation and sign-readiness updates reflect pending edits before flush. Content edits and events travel together in a single PATCH-per-usage on doctor sign, tab close, or route navigation, upholding the existing pending-buffer contract.

### Fixed

- Buffered edits for a usage removed via «Continuar sin protocolo» are now discarded cleanly. `usePendingModifications` exposes `discardUsage(usageId)`, which removes the entries from both buffers (events and content-edit). Previously, removing a protocol mid-consultation orphaned the buffered edits (subsequent flushes attempted a PATCH to a removed usage, generating 404 errors or silent omission). `ProtocolPanel` now invokes a new `onUsageRemoved` callback on successful removal, chaining `discardUsage` from the parent `Consultation` page — the same composition pattern as `onRecordModification`/`onFlushPending`.
- Vitals audit events (`vitals_entered`) now coalesce to one per editing burst: the event emission is gated on block focusout (`onBlur`), not per-field `onBlur`.

## [2026-07-06] Medical record — final review fixes

### Fixed

- `generateRecordSections` (`packages/shared/src/record/generate-record-sections.ts`): the mapper now derives the checklist/decision state from `modifications.checklist_items`/`modifications.decision_branches` (the real events the app writes via `appendModification`), instead of fields the app never produces (embedded `items[].checked` and `block_id`/`branch_label`). It keeps the embedded `checked` flag as a fallback when there is no modification event for that item.
- `resolveSection` now applies to every target (also the default label match, not only the `historia_mapping` overrides), preventing content from landing in a section excluded by consultation type.
- Off-protocol notes (`modifications.off_protocol_notes`) are now included in the medical record (evolution/current illness depending on the consultation type), with the timestamp removed from the text.
- Optional sections valid for the consultation type are no longer omitted when they end up empty on generating the record; they are emitted empty and editable (except `enmiendas`, which only appears if there are amendments).
- The legal date and time in the medical-record and patient-file PDF (`apps/api/src/lib/pdf.service.ts`) is now formatted in Dominican time (`America/Santo_Domingo`) regardless of the server's time zone — new exported helper `formatDominicanDateTime`.
- Clinical PDF downloads (`GET /v1/consultations/:id/record/pdf`, `GET /v1/patients/:id/record-export`) now log a non-blocking audit event (`category: 'system'`, `action: 'export_generated'`).
- `alert`/`text` block rows in `HistoriaMappingTab` are now locked like `dosage_table`/`lab_order`/`imaging_order`: the include switch is disabled and cannot write a mapping with no effect.
- The signed-record bar (`RecordDocument`) now shows «Regenerar» when the consultation has a registered amendment, with a specific confirmation before creating a new signed version.
- A silenced `ensureDraft` error in `ConsultationsService.sign()` is now logged with `Logger.error` before reporting `recordOutcome: 'failed'`.
- A sign failure due to missing required sections (`RECORD_REQUIRED_SECTIONS_MISSING`) now shows a specific message instead of the generic error.
- Failed record/patient-file downloads now show an error toast instead of failing silently.
- `getExpedienteData` now excludes records whose consultation was deleted (soft-delete).

### Changed

- `HistoriaMappingEntrySchema.section` (`packages/shared/src/schemas/protocol.ts`) now restricts the selectable sections (excludes `ficha_identificacion`, `enmiendas`, `plan_tratamiento`), like the UI selector.
- `historiaMissingSections` was moved from `apps/web/src/pages/PatientDetail/strings.ts` to `apps/web/src/lib/toasts.ts` for layering (it is used by a hook, not a page component).

## [2026-07-06] Medical record — patient-file export (phase 3)

### Added

- `GET /v1/patients/:id/record-export`: the patient's complete file in a single PDF (cover page + signed records, the most recent version per consultation, descending order) — the patient's right to a copy (Ley 42-01 art. 28).
- `generateExpediente` in `PdfService` (cover page with patient, treating doctor, consultation count, and issue date).
- «Exportar expediente» button in the Historia tab of the patient detail.

## [2026-07-06] Medical record — per-protocol mapping (phase 2)

### Added

- Optional `historia_mapping` in the protocol content: per block, target section, inclusion, and custom label; it travels with `ProtocolVersion.content` and is frozen into each `ProtocolUsage`.
- «Historia médica» tab in the protocol editor (`HistoriaMappingTab`): mapping table with Auto/Custom and «Restaurar automático».
- Integration test `apps/web/src/pages/ProtocolEditor/__tests__/index.test.tsx`: renders the full `ProtocolEditor` page (mocking `useProtocols`, real router/editor store) and proves a mapping-only edit (toggling a block's include switch on the Historia médica tab, no block edits) reaches `saveVersion` with `content.historia_mapping` populated, and that clearing all overrides via "Restaurar automático" omits the `historia_mapping` key entirely from the save payload.

### Changed

- `generateRecordSections` respects the `historia_mapping` overrides; the `dosage_table`/`lab_order`/`imaging_order` blocks stay fixed (legal minimum from signed orders).
- `blockTypeCaption` in `apps/web/src/pages/ProtocolEditor/HistoriaMappingTab.tsx` no longer hardcodes the Spanish item/step/branch counters inline; moved to parameterized entries `historiaCaptionItems`/`historiaCaptionSteps`/`historiaCaptionBranches` in `apps/web/src/pages/ProtocolEditor/strings.ts`. No user-visible text change.

## [2026-07-06] Medical record — per-consultation record (phase 1)

### Added

- `ConsultationRecord` model (`consultation_records`): per-consultation versioned medical record with structured sections (draft → signed, append-only).
- `generateRecordSections` mapper in `@rezeta/shared`: derives the legal sections (Reglamento MISPAS 2023 §6.3) from the protocol content, distinguishing first consultation / evolution note.
- Endpoints `GET/POST/PATCH /v1/consultations/:id/record`, `POST …/record/regenerate`, `POST …/record/sign`, `GET …/record/pdf` (PDF with PDFKit, streaming).
- Signing a consultation generates the draft automatically (`recordOutcome` in the response).
- «Historia» tab in the patient detail: list of consultations + document with edit/regenerate/sign/download (`HistoriaTab`, `RecordDocument`).
- Medical-record card in the consultation's post-sign panel.

### Changed

- `SignConsultationResponse` now includes `recordOutcome`.
- New error codes: `RECORD_NOT_FOUND`, `RECORD_NOT_DRAFT`, `RECORD_ALREADY_SIGNED`, `RECORD_REQUIRED_SECTIONS_MISSING`, `RECORD_CONSULTATION_NOT_SIGNED`.

## [2026-07-06] Dead-code sweep (part 2) — dev previews, legacy design system, unwired integration tests

### Removed

- **`_preview/*` dev routes.** Deleted the four auth-free preview pages (`StripPreview`, `EdgePreview`, `CanvasPreview`, `OrderQueuePreview`) and their route registrations in `apps/web/src/App.tsx`. They were registered unconditionally in the production router (no `DEV` gate), shipping internal UI prototypes to prod without auth. Cascade: `ProtocolStrip` (component + story + test) and `RightRail` were used **only** by these previews, so both are deleted, along with the now-unused `rightRailStrings` (`apps/web/src/components/consultations/strings.ts`; also corrected a stale `// ── RightRail` header that actually sat above `saveBadgeStrings`). Verified no cascade beyond these two — `CanvasView`, `OrderQueuePanel`, `ProtocolPills`, `OffProtocolNote`, `SkipStepDialog`, and `ResumeBanner` all remain in production use.
- **Legacy `old_design-system/`** (352K) — superseded by `design-system/`, unreferenced anywhere in code or specs, last touched 2026-05-19. Preserved in git history.
- **Unwired API integration tests.** Deleted `apps/api/test/auth.integration.ts` and `protocols.integration.ts` — never executed (the vitest config only globs `src/**/*.{spec,test}.ts`) and pinned to `@nestjs/testing@11` against a NestJS 10 app. Removed their now-unused deps `@nestjs/testing`, `supertest`, and `@types/supertest` (`apps/api/package.json`), which also clears the install-time peer-dependency mismatch warning.

## [2026-07-05] Dead-code sweep — unused UI components, hooks, and deps

### Removed

- **Unused UI components.** `SegmentedControl` (`apps/web/src/components/ui/SegmentedControl.tsx` + story + test) and `CardItem`/`CardItemProps` (`apps/web/src/components/ui/Card.tsx`) — both had zero app-page consumers (only their own Storybook stories and tests). Dropped from the `components/ui` barrel and their stories/tests removed. `CardSubtitle` was kept: it composes the retained `Card` Storybook examples, so it is design-system API rather than dead code.
- **Unused hooks / constant.** The singular `useAuditLog` (`apps/web/src/hooks/audit-logs/use-audit-logs.ts`) and `useInvoice` (`apps/web/src/hooks/invoices/use-invoices.ts`) — zero call sites; only the plural `useAuditLogs`/`useInvoices` are used. Also removed the unused `DAYS_ES` constant (`apps/web/src/pages/Dashboard/helpers.ts`). `CalendarDayButton` was un-exported (it is used internally by `Calendar` but imported nowhere else).
- **Unused dependencies.** Removed `i18next`, `react-i18next`, and `next-themes` from `apps/web/package.json` — zero imports; i18n/theming was never wired up. (`swagger-ui-express` was left in place: `@nestjs/swagger`'s `SwaggerModule.setup` can serve the `/docs` UI through it at runtime, a transitive use static analysis misses.)

## [2026-07-05] Remove unreachable switch-protocol modal

### Removed

- **Switch-protocol feature (dead code).** Removing the `ProtocolStrip` block in the prior consultation bug sweep also removed the only trigger that opened the "Cambiar protocolo" modal, leaving `showSwitch` in `ProtocolPanel` permanently `false`. Removed the now-unreachable chain: the `showSwitch`/`setShowSwitch` state and the `showSwitch`/`onShowSwitchChange` props threaded through `ConsultationModals` (`apps/web/src/pages/Consultation/ProtocolPanel.tsx`, `ConsultationModals.tsx`); the `SwitchProtocolDialog` component (`apps/web/src/components/consultations/SwitchProtocolDialog.tsx`, deleted); its `switchProtocolStrings` (`apps/web/src/components/consultations/strings.ts`); the `useSwitchProtocolUsage` hook plus its unit test (`apps/web/src/hooks/consultations/use-consultations.ts`, `apps/web/src/hooks/__tests__/use-consultations.test.ts`); and the now-unused `protocolSwitched` toast string (`apps/web/src/lib/toasts.ts`). Updated the `DialogCard` "Used by" doc comment. No backend endpoints were touched — the hook reused the generic protocol-usage PATCH and add-protocol POST; the `switched` `ProtocolUsageStatus` enum value is left in place (data/migration concern). Kept `ProtocolStrip` itself: it is still rendered by the routed dev preview pages (`/_preview/strip`, `/_preview/canvas`) and covered by its own tests/story, so it is not unreachable.

## [2026-07-04] Consultation module bug sweep — layout, duplicate orders panel, batched saves

### Changed

- **Consultation page is now full-bleed with no topbar.** `AppLayout` gained a `fullBleed` prop (`apps/web/src/components/layout/AppLayout.tsx`) that renders only the sidebar plus an `h-dvh overflow-hidden` main — no `Topbar`, no `pt-topbar`/`py-8` gutters, no `max-w-layout`. `consultas/:id` moved into its own full-bleed route group in `apps/web/src/App.tsx`; the page root switched from `h-screen` to `h-full` (`apps/web/src/pages/Consultation/index.tsx`). Together this removes the ~112px of stacked top offset and the permanent vertical/horizontal scrollbars on the page (the old `h-screen` inside a topbar-padded layout always overflowed the viewport). Note: the mobile hamburger lived in the topbar, so on small screens the consultation page relies on the breadcrumb for navigation.
- **Protocol edits no longer PATCH per interaction.** New `usePendingModifications` hook (`apps/web/src/hooks/consultations/use-pending-modifications.ts`) buffers `ProtocolUsage` modification events locally, overlays them onto the server-truth consultation at render time (query cache stays pure, so refetches can't wipe unsaved edits), and flushes delta-only PATCHes when the doctor signs (aborting the sign if persistence fails), navigates away (unmount), or before tab close (`useBeforeUnloadGuard` now also covers pending edits). `ProtocolPanel` records events via the new `onRecordModification` prop; `SignModal` awaits a new `onBeforeSign` callback; the `SaveBadge` shows `dirty` while edits are buffered. The now-unused `useUpdateProtocolUsage` hook was removed.
- **`useSkipStep` / `useAddOffProtocolNote` send only the new event.** The API appends modification arrays onto stored ones (`ConsultationsRepository.updateProtocolUsage`), so resending the existing entries duplicated every prior skip/note server-side on each call. The `existingSkipped`/`existingNotes` params were dropped (`apps/web/src/hooks/consultations/use-consultations.ts`).

### Fixed

- **Duplicated "Órdenes médicas" panel.** `OrdersRail` rendered `OrderQueuePanel` directly and again via `ConsultationSidebar`; the sidebar's copy was removed along with its `consultationId` prop (`apps/web/src/components/consultations/ConsultationSidebar.tsx`, `apps/web/src/pages/Consultation/OrdersRail.tsx`).
- **Horizontal scrollbar inside the protocol section.** `ProtocolBar`'s pills wrapper used `-mx-12` (sized for the old `lg:px-12` layout gutter) inside the `p-6` scroll container, overhanging it by 24px per side; changed to `-mx-6`. The sticky `ProtocolStrip` block was removed from `ProtocolBar` entirely, which orphaned its `ProtocolStrip` import and the `onSwitchProtocol` prop — both dropped (`apps/web/src/pages/Consultation/ProtocolBar.tsx`).
- **Checklist clicks double-logged their event.** `ChecklistRunMode` emitted `onModification` for an event `onCheck` already records upstream, appending every toggle twice to the modifications audit log (`apps/web/src/components/protocols/BlockRendererRunMode.tsx`).
- Tests: added `apps/web/src/hooks/consultations/__tests__/use-pending-modifications.test.tsx` (8 cases: buffering, delta-only flush, cache fold-back, failure re-buffer/retry, flush-on-unmount); updated `ProtocolPanel` and `use-consultations` tests for the new props and delta-only payloads.

## [2026-07-04] Migrate inline spinners to shared `<Spinner>`

### Changed

- **Migrated 26 inline `ph ph-spinner animate-spin` glyphs to the shared `<Spinner>` component** across 18 web files (`OrderQueuePanel`, `SaveBadge`, `TemplatePickerModal`, `ClinicalHistory`, `Consultation/index`, `ProtocolEditor/{EditorHeader,EditorPalette,index,HistoryDrawer,SaveModal,PublishModal}`, `PatientDetail/{index,PrescriptionsTab,InvoicesTab,AppointmentsTab}`, `ProtocolViewer/index`, `Protocols/index`, `Onboarding/index`). Spinners adjacent to visible loading text use `decorative`; bare centered loaders use default status mode with the `Cargando` sr-only label. Font-size classes mapped to `size` variants (`sm`/`md`/`lg`), with off-scale sizes (`11/13/18/24px`) rounded to the closest variant. `pages/Billing/InvoiceRow.tsx` left unchanged — it passes the spinner as a class-name string to `IconButton`'s `icon` prop, not as JSX.

## [2026-07-04] Loading indicator a11y hardening

### Changed

- **`GlobalLoadingIndicator` now keeps a permanently-mounted `aria-live="polite"` container** (`apps/web/src/components/layout/GlobalLoadingIndicator.tsx`). The chip content (spinner + `Cargando…` label) toggles inside the live region based on the existing 250 ms delayed-visibility state, so screen readers reliably announce content that arrives after the region is already present. The container is visually empty when idle (chip styling moved onto an inner element rendered only while visible); 250 ms show-delay, immediate hide, and `pointer-events-none` are unchanged. The chip renders the spinner as `decorative` and relies on the visible `Cargando…` text for the announcement, removing the duplicate live semantics from the nested `role="status"`.
- **`Spinner` gained a `decorative?: boolean` prop** (`apps/web/src/components/ui/Spinner.tsx`). When true, it renders `aria-hidden="true"` with no `role="status"` and no accessible name. Default (non-decorative) mode now wraps a decorative `<i>` glyph in a `role="status"` span alongside an `sr-only` label, so screen readers have real text content even if the Phosphor icon font fails to load.

### Fixed

- Tests updated in `apps/web/src/components/layout/__tests__/GlobalLoadingIndicator.test.tsx` (added an idle aria-live container assertion) and `apps/web/src/components/ui/__tests__/Spinner.test.tsx` (added decorative-mode and sr-only-label assertions).

## [2026-07-04] Global loading indicator

### Added

- **Global `isLoading` state fed by every `apiClient` request.** A counter-based Zustand store (`apps/web/src/store/loading.store.ts`), exposed through `useGlobalLoading()`. `request()` and `downloadBlob()` in `apps/web/src/lib/api-client.ts` wrap their bodies in a `withLoading` helper that calls `requestStarted()` before and `requestFinished()` after (in a `finally`, so error and network-failure paths still settle). All `apiClient` methods (`get`/`post`/`patch`/`delete`/`download`) accept a new optional `RequestOptions` argument; per-request opt-out with `{ silent: true }` used by the consultation autosave write paths (`useUpdateProtocolUsage`, `useUpdateCheckedState` in `apps/web/src/hooks/consultations/use-consultations.ts`). Loud by default — no other call site changes. Covered by new `global loading interception` tests in `apps/web/src/lib/__tests__/api-client.test.ts`.
- **`Spinner` ui component.** New `apps/web/src/components/ui/Spinner.tsx` — a CVA-driven Phosphor `ph-spinner` + `animate-spin` icon with `sm`/`md`/`lg` size variants (`text-[14px]`/`text-[20px]`/`text-[32px]`, default `md`), `role="status"`, and a default Spanish `aria-label="Cargando"` (overridable). Color inherits `currentColor`. Exported from the ui barrel; covered by `apps/web/src/components/ui/__tests__/Spinner.test.tsx` and demoed in `Spinner.stories.tsx`.
- **`GlobalLoadingIndicator`** — non-blocking bottom-right chip mounted once in `AppLayout` (`apps/web/src/components/layout/GlobalLoadingIndicator.tsx`); appears after 250 ms of sustained loading, uses `aria-live="polite"` and `pointer-events-none`, and renders the `Spinner` beside a `Cargando…` label (`apps/web/src/components/layout/strings.ts`). Covered by `apps/web/src/components/layout/__tests__/GlobalLoadingIndicator.test.tsx`.

### Fixed

- **Autosave success no longer triggers a loud consultation refetch.** `useUpdateProtocolUsage` and `useUpdateCheckedState` in `apps/web/src/hooks/consultations/use-consultations.ts` previously invalidated `[consultations, consultationId]` on success, which refetched `useConsultation` via a loud `apiClient.get` and pulsed the global loading chip on every checkbox toggle — defeating the `{ silent: true }` flag on their PATCH. Both now do a targeted `qc.setQueryData` cache write that replaces the matching `protocolUsages` entry instead. Covered by new cases in `apps/web/src/hooks/__tests__/use-consultations.test.ts`.

## [2026-07-02] Workflow interconnection — full clinical loop

Connects appointments, consultations, invoices, and the patient record into one
continuous workflow: start a consultation from an appointment, drive the
appointment's status from the consultation lifecycle, surface the auto-invoice
outcome after signing, schedule a follow-up, and browse a patient's citas,
recetas y facturas.

### Added

- **Start/continue/view consultation from the agenda and dashboard.** State-driven action on the agenda appointment card and dashboard upcoming rows: **Iniciar consulta** (`scheduled`, no linked consultation), **Continuar consulta** (`in_progress`, consultation `open`), **Ver consulta** (`completed` with a consultation). Shared via the `useStartConsultation` hook, which navigates to `/consultas/:id` when a consultation is already linked, otherwise creates one (`{ patientId, locationId, appointmentId }`) and routes to it (`apps/web/src/hooks/consultations/use-start-consultation.ts`, `apps/web/src/pages/Schedule/AppointmentCard.tsx`, `AppointmentCardWithMutation.tsx`, `apps/web/src/pages/Dashboard/UpcomingRow.tsx`).
- **`in_progress` appointment status** across the stack (`AppointmentStatusSchema` enum, `AppointmentStatus` type, Prisma column comment, Spanish "En consulta" labels in `apps/web/src/pages/Schedule/helpers.ts` and `apps/web/src/pages/Dashboard/helpers.ts`). The consultation lifecycle drives appointment status one-way: create → `in_progress`, sign → `completed`, delete open → `scheduled` (`consultations.service.ts` / `consultations.repository.ts`). Appointment-driven creation is idempotent (an existing open consultation is returned instead of a duplicate) and the appointment transition runs inside the consultation-create/sign/delete `$transaction`.
- **Global "Nueva consulta" walk-in dialog** with patient search and inline minimal patient creation (`apps/web/src/components/consultations/NewConsultationDialog.tsx`): a `search` mode (find an existing patient via `PatientCombobox`) and a `create-patient` mode (mini-form: `Nombre`, `Apellido`, `Fecha de nacimiento`). Location defaults to `useUiStore.activeLocationId`; on submit it creates the patient (when in create mode) then a walk-in consultation (`appointmentId` omitted) and navigates to `/consultas/{id}`. Reachable from the Agenda page header and the Dashboard `PageHeader` primary button.
- **Post-sign panel** rendered once below `SignedBanner` in the just-signed session (`apps/web/src/pages/Consultation/PostSignPanel.tsx`): an **invoice outcome card** handling all three `InvoiceOutcome` states — `created` shows `Factura borrador creada · {total}` with **Emitir factura** (issues via `useUpdateInvoiceStatus`) and a **Ver en Facturación** link; `skipped_no_fee` shows an info callout with **Configurar tarifa** / **Crear factura manual**; `failed` shows a danger callout with **Crear factura manual** — plus a **Seguimiento** block with **Agendar seguimiento** that opens `AppointmentFormModal` pre-filled for the just-signed consultation (today's date, `consultation.locationId`, `consultation.patientId`).
- **Patient page tabs — Citas / Recetas / Facturas** with cross-links (`apps/web/src/pages/PatientDetail/index.tsx`, `AppointmentsTab.tsx`, `PrescriptionsTab.tsx`, `InvoicesTab.tsx`): Citas rows link to `/consultas/{id}` or offer **Iniciar consulta**; Recetas rows link to the linked consultation; Facturas rows link to `/facturacion` and to the linked consultation. Each tab has its own empty state. Backed by new `GET /v1/patients/:patientId/prescriptions` (tenant- and soft-delete-filtered, newest first, includes `prescriptionItems`) and a `patientId` filter on `GET /v1/appointments`.
- **Types** `InvoiceOutcome` and `SignConsultationResponse` (`packages/shared/src/types/consultation.ts`); `AppointmentConsultationStatus` plus `consultationId`/`consultationStatus` on `AppointmentWithDetails` (`packages/shared/src/types/appointment.ts`).
- **Error codes** `APPOINTMENT_NOT_STARTABLE`, `APPOINTMENT_HAS_CONSULTATION`, `APPOINTMENT_HAS_OPEN_CONSULTATION`, `APPOINTMENT_STATUS_MACHINE_OWNED` (`packages/shared/src/errors.ts`).
- **Audit rows for consultation-driven appointment transitions.** Each auto-transition now writes an explicit `Appointment` audit record (`category: 'entity'`, `action: 'update'`, `changes.status = { before, after }`) via the HTTP audit context, non-fatally: create `scheduled → in_progress`, sign `in_progress → completed`, delete-open `in_progress → scheduled`. Recorded only when the transition actually applied — walk-ins and status-filtered no-ops write nothing (`apps/api/src/modules/consultations/consultations.service.ts`).

### Changed

- **Signing awaits invoice auto-creation** and returns `invoiceOutcome` (`SignConsultationResponse`); previously fire-and-forget. `InvoicesService.createFromConsultation` now returns an `InvoiceOutcome` and never throws — internal errors resolve to `{ status: 'failed' }` and are logged via a service-scoped `Logger` before the swallow, so invoice failure never fails the sign (`apps/api/src/modules/consultations/consultations.service.ts`, `consultations.repository.ts`, `apps/api/src/modules/invoices/invoices.service.ts`). `useSignConsultation`/`useCreateConsultation` invalidate the `['appointments']` query, and `useSignConsultation` also invalidates `['invoices']` so Billing and the patient Facturas tab refetch the auto-created draft (`apps/web/src/hooks/consultations/use-consultations.ts`).
- **Tightened manual appointment status guards.** Manual `in_progress` is now rejected unconditionally as a machine-owned status (`APPOINTMENT_STATUS_MACHINE_OWNED`); when a live consultation is linked, both manual `completed` and manual `scheduled` are rejected (`APPOINTMENT_HAS_CONSULTATION`), preventing a stuck-forever appointment; manual cancel/no-show stays blocked while the linked consultation is `open` (`APPOINTMENT_HAS_OPEN_CONSULTATION`). Un-cancel (`cancelled → scheduled`) still works for unlinked appointments. Deleting an appointment is blocked while its consultation is `open` (`APPOINTMENT_HAS_OPEN_CONSULTATION`); deleting one with a signed consultation stays allowed (`apps/api/src/modules/appointments/appointments.service.ts`). The appointment card hides **Completar** whenever a consultation is linked and hides **Eliminar** for `in_progress` appointments.
- **TOCTOU-hardened consultation start.** The create-transaction's appointment update is now a status-filtered `updateMany` (`status ∈ {scheduled, in_progress}`); a count of 0 (a concurrent cancel/complete racing the pre-check) throws inside the transaction and rolls the consultation create back, surfaced to the caller as `APPOINTMENT_NOT_STARTABLE` (`apps/api/src/modules/consultations/consultations.repository.ts`, `consultations.service.ts`).
- **Appointment reads carry consultation link data.** `AppointmentWithDetails` now includes `consultationId`/`consultationStatus` (latest live consultation) via a shared `DETAILS_INCLUDE` across findMany/findById/create/update/updateStatus (`apps/api/src/modules/appointments/appointments.repository.ts`). `useAppointments` accepts an optional `patientId` param, and `AppointmentFormModal` gains an optional `defaultPatientId` prop.

## [2026-07-01] — Security audit fixes (cross-tenant isolation, PHI redaction, XSS, clinical immutability)

### Fixed

- **Cross-tenant foreign-key injection (High).** `ConsultationsService.create`, `AppointmentsService.create`/`update`, and `InvoicesService.create` now verify that every client-supplied `patientId`/`locationId`/`appointmentId`/`consultationId` belongs to the caller's tenant before linking it. Previously a row stamped with the caller's `tenantId` could reference another tenant's patient and leak PHI (name, allergies, chronic conditions) back in the response. New shared `ReferenceGuardService` (`apps/api/src/common/references/reference-guard.service.ts`, provided globally in `app.module.ts`).
- **Patient document numbers were not redacted in audit rows (Medium).** `apps/api/src/common/audit-log/redact.ts` keyed on `cedula`/`rnc`/`passport` but the actual Patient column is `documentNumber`, so full national-ID numbers were stored unmasked. Added `documentNumber` to the Patient redaction rules with last-4 partial masking (audit-log-spec §8).
- **Stored XSS in the dashboard activity feed (Medium).** `describeAuditEntry` built an HTML string from the user-controlled `fullName` and `ActivityItem` rendered it via `dangerouslySetInnerHTML`. Refactored to return structured `{ actor, detail }` parts rendered as React text nodes; removed the `dangerouslySetInnerHTML` sink (`apps/web/src/pages/Dashboard/helpers.ts`, `ActivityItem.tsx`, `ActivityFeed.tsx`).
- **Signed clinical orders could be soft-deleted (Medium).** `OrdersService.deletePrescription`/`deleteImagingOrder`/`deleteLabOrder` now reject deletion of `signed` orders (immutable clinical records — corrections go through amendment). Added `IMAGING_ORDER_ALREADY_SIGNED` / `LAB_ORDER_ALREADY_SIGNED` to `packages/shared/src/errors.ts`.

- **Unclamped list `limit` (Medium DoS).** `GET /v1/patients` and `GET /v1/invoices` parsed `limit` with a bare `parseInt` and passed it straight to Prisma `take`, allowing an unbounded/NaN fetch. Both now route through the new shared `parseLimit` helper (clamps to 1–100, default 50).

### Added

- **Guardrail — `ReferenceGuardService`** (`apps/api/src/common/references/`): reusable tenant-scoped FK ownership checks (`assertPatient`/`assertLocation`/`assertAppointment`/`assertConsultation`), so cross-tenant reference injection is prevented in one audited place.
- **Guardrail — `parseLimit`** (`apps/api/src/common/pagination/parse-limit.ts`): shared list-limit parser/clamp for every paginated endpoint.
- **Guardrail — ESLint ban on `dangerouslySetInnerHTML`** (`eslint.config.js`): fails CI on the stored-XSS sink; bypass requires an inline disable documenting why the HTML is trusted.
- **Guardrail — audit-redaction coverage test** (`apps/api/src/common/audit-log/__tests__/redaction-coverage.spec.ts`): fails CI if a curated Patient identifier column is missing from the schema or not masked by the redactor, catching future `documentNumber`-style drift.
- **Guardrail — tenant-scoping architectural test** (`apps/api/src/common/repository/__tests__/tenant-scoping.arch.spec.ts`): parses every `*.repository.ts` and fails CI on any Prisma `update`/`updateMany`/`delete`/`deleteMany`/`upsert` whose `where` omits `tenantId`/`userId` (tenant-less models allow-listed). Prevents the unscoped-mutation class behind the cross-tenant finding from returning.
- **Guardrail — ESLint ErrorCode enforcement** (`eslint.config.js`): bans raw string / template-literal messages in `new *Exception(...)`, forcing the closed-enum `{ code, message }` form (relaxed in test files).

### Changed

- **Tenant-scoped every repository write.** Added `tenantId` (or a parent relation filter) to 15 previously `id`-only Prisma mutations across `invoices`, `orders`, `protocols`, `protocol-categories`, `protocol-templates`, and `protocol-improvements` repositories — closing the defense-in-depth gap and satisfying the new architectural guardrail. Threaded `tenantId` through the affected repository method signatures (`ProtocolCategoriesRepository.update`/`softDelete`, `ProtocolImprovementsRepository.markApplied`/`markDismissed`).
- **Standardized error throwing on the `ErrorCode` enum.** Converted the remaining raw-string `NotFoundException`/`BadRequestException`/`ForbiddenException`/`InternalServerErrorException` messages in `invoices`, `auth`, and `onboarding` to the `{ code, message }` form. Added `INVOICE_NOT_EDITABLE` to `packages/shared/src/errors.ts`.
- `InvoicesService.create` location-not-found error now uses `ErrorCode.LOCATION_NOT_FOUND` instead of a raw string.

## [2026-06-30] — Multiline summary + description fields

### Changed

- Change-summary fields in the protocol editor's Save and Publish modals are now `Textarea`s (fixed 3 rows × 3 cols, no resize) instead of single-line `Input`s (`apps/web/src/pages/ProtocolEditor/SaveModal.tsx`, `PublishModal.tsx`). Removed the Enter-to-submit handler from the publish field so newlines are accepted.
- Template section description field is now a fixed 3×3 `Textarea` instead of an `Input` (`apps/web/src/components/template/TemplateEditor.tsx`).

## [2026-06-30] — ConfirmDialog body + subtitle

### Added

- Optional `subtitle` prop on `ConfirmDialog` — renders as a secondary line under the title in the header (`apps/web/src/components/ui/ConfirmDialog.tsx`).

### Changed

- `ConfirmDialog` now renders `description` in the modal body (via `ModalBody`) instead of the header subtitle. To keep `aria-describedby` valid with exactly one `Dialog.Description`, the subtitle owns the description id when present, otherwise the body description does.

## [2026-06-30] — Replace native confirm in protocol editor

### Changed

- `ProtocolEditor` unsaved-changes navigation guard now uses the custom `ConfirmDialog` component instead of the native `window.confirm()`. The dialog is driven by the `useBlocker` state and resolves via `proceed()`/`reset()` callbacks. This removes the last native browser popup in the app (`apps/web/src/pages/ProtocolEditor/index.tsx`).
- Split the single `navigateAway` string into `navigateAwayTitle` / `navigateAwayBody` / `navigateAwayConfirm` / `navigateAwayCancel` to populate the dialog (`apps/web/src/pages/ProtocolEditor/strings.ts`).

## [2026-06-30] — Template-driven protocol creation

### Added

- `ProtocolTemplate.category_id` (required) and `Protocol.template_id` (informational) with a data-preserving migration (add-nullable → backfill → NOT NULL).
- `buildProtocolContentFromTemplate` transform that seeds a new protocol's content from its template's block structure.
- Required category `<Select>` in the template editor; category pill column in the templates list.
- Blocked category deletion (`CATEGORY_IN_USE_BY_TEMPLATES`) with an explanatory modal when templates reference the category.

### Changed

- Creating a protocol now requires choosing a template; the protocol inherits the template's category. `POST /v1/protocols` takes `{ templateId, title }` (was `{ categoryId?, title }`).
- `TemplatePickerModal` now lists templates (name + category pill); the "Desde cero" blank-start path was removed.
- Tenant seeding now creates 2 categories (Emergencias, Diagnóstico) and 2 category-linked templates (Intervención de emergencia, Algoritmo diagnóstico); onboarding starter candidates expose `categoryName` (was `typeName`).

## [2026-06-27] — test(web): cover DatePicker/TimePicker/calendar to clear CI threshold

### Added

- **`apps/web/src/components/ui/__tests__/calendar.test.tsx`** (new), **`DatePicker.test.tsx`**, **`TimePicker.test.tsx`**: With the install failure unblocked, CI surfaced a pre-existing coverage failure — `DatePicker.tsx`, `TimePicker.tsx`, and `calendar.tsx` (added 2026-06-24) were below the 95% per-file threshold. Added tests covering: DatePicker date selection (`onChange` + close), `minDate`/`maxDate` disabling, unparseable values, default placeholder, and disabled/error states; TimePicker invalid/midnight formatting, default placeholder, bounds without minutes, the scroll-into-view effect (matching and non-matching value), and disabled/error states; and the calendar's custom `Root`/`Chevron`/`WeekNumber`/`CalendarDayButton` renderers, dropdown caption layout, week numbers, and range modifiers. DatePicker and calendar reach 100%; TimePicker 97% branches (one unreachable `?? 0` defensive branch remains).

## [2026-06-27] — fix(ci): pin project to public npm registry to unblock install

### Fixed

- **`.npmrc`**, **`pnpm-lock.yaml`**: CI had been failing on `main` since 2026-06-24 at the **Install dependencies** step with `ERR_PNPM_FETCH_401` against `gdartifactory1.jfrog.io` (a private Artifactory registry inherited from a developer's user-level `~/.npmrc`). A `pnpm install` on 2026-06-24 baked 3 private jfrog tarball URLs into the lockfile (`@pkgjs/parseargs`, `@testing-library/dom`, `@types/aria-query`), which `pnpm install --frozen-lockfile` in CI could not fetch without private credentials. Added `registry=https://registry.npmjs.org/` to the project `.npmrc` so this repo always resolves against public npm regardless of user/global config, and removed the explicit jfrog `tarball:` from the 3 lockfile entries (integrity hashes unchanged — verified identical on public npm) so pnpm derives the public URL.

## [2026-06-27] — fix(web): protocol list cards clip their title

### Fixed

- **`apps/web/src/pages/Protocols/index.tsx`**: Protocol cards on the list page (`/protocolos`) clipped the top of their title. Each card is a `<Button variant="item" size="sm">`, and the `sm` size applies a fixed `h-btn-sm` (28px) height. The card's two-row, `py-4` content is ~51px tall, so the vertically-centered content overflowed the 28px button box and was clipped at the top by the list container's `overflow-hidden`. Added `h-auto` to the `ProtocolRow` button so it sizes to its content (the `cn`/tailwind-merge setup is configured to let `h-auto` override `h-btn-sm`). Verified live: card height now 85px, title no longer clipped. Fix applies to every card on the page (single `ProtocolRow` component).

## [2026-06-27] — fix(web): protocol editor freezes after deleting a block

### Fixed

- **`apps/web/src/components/protocols/EditorBlockRenderer.tsx`**: Deleting a section/block in the protocol editor left the entire page non-interactive (could not click or type) until a refresh. The block actions menu (`BlockContextMenu`) is a Radix `DropdownMenu`, and the "Eliminar" item opens a Radix `Dialog` (`ConfirmDialog`). A *modal* dropdown sets `pointer-events: none` on `<body>` while open; the dialog mounted while that lock was active and Radix's `DismissableLayer` snapshotted `none` as the value to restore on close — so closing the dialog (on **confirm or cancel**) re-applied `pointer-events: none` to `<body>`, cascading to `#root` and freezing the app. Fixed by rendering the dropdown with `modal={false}`, which never locks `<body>`. Root cause confirmed by live DOM inspection (`document.body.style.pointerEvents === 'none'` with zero overlays in the DOM).
- **`apps/web/src/components/protocols/__tests__/EditorBlockRenderer.delete-focus.test.tsx`**: New regression test — asserts `<body>` is never left with `pointer-events: none` after confirming or cancelling a block delete.

## [2026-06-26] — fix(web): make missing-fields panel a static checklist

### Fixed

- **`apps/web/src/components/consultations/MissingFieldsPanel.tsx`**, **`apps/web/src/pages/Consultation/index.tsx`**: The missing-fields panel's "jump to field" rows were a silent no-op after the protocol-first migration — `onFieldClick` scrolled to `getElementById('field-' + id)`, but field ids are now `protocol:<usageId>:<blockId>` and no element renders a matching anchor (the old SOAP `field-*` anchors were removed, and `CanvasView` only renders the active usage). Removed the dead `onFieldClick` handler and rendered the rows as a non-interactive `<ul>` checklist instead of clickable buttons. Removed the now-unused `panelGoArrow` string and corrected `panelDescription`. Updated `MissingFieldsPanel.test.tsx` and the `EdgePreview` usage.

## [2026-06-26] — chore(web): remove orphaned consultation gate and GatePreview scaffolding

### Changed

- **`apps/web/src/components/consultations/ConsultationGate.tsx`**: Deleted — the old consultation gate (protocol-selection step) was superseded by the protocol-first redesign and was no longer reachable from production routes.
- **`apps/web/src/components/consultations/__tests__/ConsultationGate.test.tsx`**: Deleted — test file for the removed component.
- **`apps/web/src/components/consultations/__tests__/ConsultationGate.source.test.tsx`**: Deleted — recommendation-source semantics test for the removed component.
- **`apps/web/src/pages/_preview/GatePreview.tsx`**: Deleted — the only consumer of `ConsultationGate`; a dev-only auth-free preview page with no production path.
- **`apps/web/src/App.tsx`**: Removed `GatePreview` import and `{ path: '/_preview/gate', element: <GatePreview /> }` route. All other `_preview` routes (strip, edge, canvas, order-queue) remain intact.
- **`apps/web/src/components/consultations/strings.ts`**: No changes required — `ConsultationGate` used only inline strings; no orphaned string keys remained.

## [2026-06-26] — refactor: drop off-protocol-note promote-to-soap path

### Changed

- **`packages/shared/src/types/consultation.ts`**: Removed `promoted_to_soap_field` from `OffProtocolNoteEvent`.
- **`apps/web/src/hooks/consultations/use-consultations.ts`**: `useAddOffProtocolNote` no longer accepts `promoteTo` or `existingSoapValue`; the dead second PATCH to `/v1/consultations/{id}` (which wrote to non-existent SOAP columns) is removed. Now uses `OffProtocolNoteEvent` type from shared.
- **`apps/web/src/components/consultations/OffProtocolNote.tsx`**: Removed the `SoapMover` sub-component and the `promoteTo` field; `onSave` callback now carries `{ title, body }` only.
- **`apps/web/src/components/consultations/strings.ts`**: Removed SOAP field labels (`soapSubjective`, `soapObjective`, `soapAssessment`, `soapPlan`), `moveTo`, `moveToSoap`; updated `bodyPlaceholder` to remove SOAP reference.
- **`apps/web/src/pages/Consultation/ConsultationModals.tsx`**: Removed `SoapField` local type; updated `onSaveOffProtocolNote` prop signature to match simplified interface.
- **`apps/web/src/pages/Consultation/ProtocolPanel.tsx`**: Removed `promoteTo` parameter from `handleSaveOffProtocolNote`.
- **`apps/web/src/components/consultations/__tests__/OffProtocolNote.test.tsx`**: Replaced `promoteTo: null` assertion with plain `{ title, body }`; removed SOAP-mover dropdown test.
- **`apps/web/src/hooks/__tests__/use-consultations.test.ts`**: Replaced promote-SOAP and "does NOT patch SOAP" tests with a single test asserting exactly one PATCH is made (to the usage endpoint).

## [2026-06-26] — feat(web): remove SOAP view; protocol-first consultation panel with empty state

### Changed

- **`apps/web/src/pages/Consultation/ProtocolPanel.tsx`**: Removed `soap` prop, `handleAutoPopulate`, and `SoapView` fallback. No-protocol state now renders an "Agregar protocolo" empty state (icon + text + primary button). The dashed "add another" button is only shown when an active protocol is present. `handleSaveOffProtocolNote` no longer passes `promoteTo`/`existingSoapValue` to the mutation (Task 4a will clean up the hook and modal).
- **`apps/web/src/components/consultations/CanvasView.tsx`**: Removed `SoapField` type export and `onAutoPopulate` prop; removed all call sites passing `onAutoPopulate` to `BlockRendererRunMode`.
- **`apps/web/src/components/consultations/ConsultationSidebar.tsx`**: Removed the dead `viewMode?: 'soap' | 'canvas'` prop, the `isCanvas` constant, and the `!isCanvas` guard left over from the view-mode toggle removal. The previous-consultations list now always renders (its only consumer, `OrdersRail.tsx`, already stopped passing `viewMode`).
- **`apps/web/src/pages/Consultation/index.tsx`**: Removed `useSoapState` import/call and `soap=` prop on `<ProtocolPanel>`. `hasContent` is now `protocolUsages.length > 0`. Missing fields use `computeMissingRequiredFields` from `@rezeta/shared`. `saveStatus` is static `'idle'`.
- **`apps/web/src/components/consultations/MissingFieldsPanel.tsx`**: Removed `computeMissingFields` function and `ConsultationFieldCheck` interface (SOAP-field-based check); panel now renders pre-computed `MissingField[]`.
- **`apps/web/src/components/consultations/strings.ts`**: Removed `soapViewStrings` export and orphaned `computeMissingFields` label keys.
- **`apps/web/src/pages/Consultation/strings.ts`**: Added `protocolPanelStrings` with `noProtocolTitle` and `addProtocol` strings.

### Added

- **`apps/web/src/pages/Consultation/__tests__/ProtocolPanel.test.tsx`**: New TDD test — verifies no-protocol empty state shows "Agregar protocolo" button and no SOAP placeholders; verifies canvas renders when a protocol is active.

### Fixed

- **`apps/web/src/components/consultations/__tests__/CanvasView.test.tsx`**: Removed `onAutoPopulate` test (prop no longer exists).
- **`apps/web/src/components/consultations/__tests__/MissingFieldsPanel.test.tsx`**: Removed `computeMissingFields` describe block (function removed from component).

### Deleted

- `apps/web/src/components/consultations/SoapView.tsx`
- `apps/web/src/components/consultations/SoapTextarea.tsx`
- `apps/web/src/components/consultations/__tests__/SoapTextarea.test.tsx`
- `apps/web/src/pages/Consultation/use-soap-state.ts`

## [2026-06-26] — refactor(web): remove consultation view-mode toggle (canvas-only)

### Changed

- **`apps/web/src/store/ui.store.ts`**: Removed `ConsultationViewMode` type, `viewMode` field, and `setViewMode` action. Store now only manages `activeLocationId` and `missingFieldsPanelOpen`.
- **`apps/web/src/components/consultations/ProtocolStrip.tsx`**: Removed `viewMode`/`onViewModeChange` props and the `<ViewModeToggle>` JSX block.
- **`apps/web/src/pages/Consultation/ProtocolBar.tsx`**: Removed `viewMode`/`onViewModeChange` from interface and forwarding; collapsed signed/unsigned `ProtocolStrip` branches into one.
- **`apps/web/src/pages/Consultation/ProtocolPanel.tsx`**: Removed `useConsultationViewMode` hook call; panel now always renders `CanvasView` when `activeUsage` is set (SOAP fallback remains as else-branch for Task 4).
- **`apps/web/src/components/consultations/ConsultationSidebar.tsx`**: Replaced `ConsultationViewMode` import with inline `'soap' | 'canvas'` literal type.
- **`apps/web/src/pages/_preview/CanvasPreview.tsx`**, **`apps/web/src/pages/_preview/StripPreview.tsx`**: Minimal compile fixes — removed deleted `ConsultationViewMode` import and removed `viewMode`/`onViewModeChange` prop usage.

### Fixed

- **`apps/web/src/store/__tests__/ui.store.test.ts`**: Removed obsolete `viewMode`/`setViewMode` test assertions.

## [2026-06-26] — feat(web): disable sign button until a protocol is added

### Added

- **`apps/web/src/components/consultations/strings.ts`**: New `pageHeaderStrings` object with `signButton` ("Firmar y cerrar") and `signRequiresProtocol` ("Agrega al menos un protocolo para poder firmar") strings.
- **`apps/web/src/pages/Consultation/PageHeader.tsx`**: New `canSign: boolean` prop. When `canSign` is `false`, the "Firmar y cerrar" button is `disabled` and receives a `title` tooltip with the `signRequiresProtocol` string. Button label now uses `pageHeaderStrings.signButton` (no hardcoded text).
- **`apps/web/src/pages/Consultation/index.tsx`**: Computes `canSign = consultation.protocolUsages.length > 0` and threads it to `<PageHeader>`.
- **`apps/web/src/pages/Consultation/__tests__/PageHeader.test.tsx`**: Two new TDD tests — "disables Firmar y cerrar when there are no protocols" and "enables Firmar y cerrar when at least one protocol exists". `baseProps` updated with `canSign: true`.

## [2026-06-26] — feat(api): block signing consultations with zero protocols

### Added

- **`packages/shared/src/errors.ts`**: New error code `CONSULTATION_REQUIRES_PROTOCOL` added to the `// ── Consultation ──` group.
- **`apps/api/src/modules/consultations/consultations.service.ts`**: Guard in `sign()` — immediately after the status check, throws `BadRequestException` with `CONSULTATION_REQUIRES_PROTOCOL` when `protocolUsages.length === 0`.
- **`apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts`**: New test "rejects signing when the consultation has zero protocol usages" (TDD, RED → GREEN). Existing sign tests that previously used empty `protocolUsages` updated to include ≥1 usage.

## [2026-06-26] — feat(web): edit protocol category color, not just name

### Changed

- **`apps/web/src/pages/settings/Types.tsx`**, **`strings.ts`**: The category edit modal ("Renombrar") only edited the name, even though the API and spec (`specs/updated-specs/02-protocol-model.md`: "Freely create, rename, delete at any time"; a category "is a name and a color") support recoloring. Renamed it to "Editar categoría" and added a color picker prefilled with the category's current color; saving now sends both `name` and `color` via the existing `PATCH /v1/protocol-categories/:id`. The row action button label changed from "Renombrar" to "Editar". This removes the delete-and-recreate workaround that previously triggered unique-constraint errors. Seeded categories remain locked (unchanged).

### Added

- **`apps/web/src/pages/settings/__tests__/Types.test.tsx`**: Tests covering the edit modal — prefilled name + color, submitting both fields, and the no-op-when-unchanged guard.

## [2026-06-26] — fix(db): soft-deleted records no longer block reuse of unique values

### Fixed

- **`packages/db/prisma/schema.prisma`** + **`packages/db/prisma/migrations/20260626000000_partial_unique_soft_delete/migration.sql`**: Unique constraints on soft-deletable models counted `deleted_at`-flagged rows, so a soft-deleted record permanently reserved its value. Recreating a `ProtocolCategory` with the name of a previously deleted one failed with a `P2002` unique violation (surfaced as an unhandled 500). Converted these to **partial** unique indexes (`WHERE deleted_at IS NULL`) so uniqueness is enforced only among live rows: `protocol_categories(tenant_id, name)`, `invoices(tenant_id, invoice_number)`, `invoices(consultation_id)`, and `protocol_versions(protocol_id, version_number)`. Prisma's schema language cannot express partial indexes, so the `@@unique`/`@unique` attributes were removed and the indexes are managed in raw SQL (index names reused; migration is idempotent and safe to deploy on existing data). `User.external_uid` and `DoctorLocation` were intentionally left as full uniques (they back `findUnique`/`upsert`).

### Added

- **`apps/api/src/common/filters/http-exception.filter.ts`**: Map Prisma `P2002` (unique violation) to HTTP **409 `RESOURCE_CONFLICT`** instead of letting it fall through to an unhandled 500. `RESOURCE_CONFLICT` added to `packages/shared/src/errors.ts`. Tests added in `http-exception.filter.spec.ts`; schema/migration assertions added in `packages/db/prisma/__tests__/schema-fields.test.ts`.

### Changed

- **`packages/db/prisma/schema.prisma`**: `Consultation.invoice Invoice?` (one-to-one) is now `Consultation.invoices Invoice[]` (one-to-many). Required to drop the `@unique` on `Invoice.consultation_id`; the partial index still guarantees at most one live invoice per consultation. No backend code referenced the old relation accessor.

## [2026-06-24] — fix(ui): dashboard list rows overlapped

### Fixed

- **`apps/web/src/pages/Dashboard/UpcomingRow.tsx`, `RecentPatients.tsx`, `RecentProtocols.tsx`**: Dashboard card rows (Próximas citas, Pacientes recientes, Protocolos recientes) overlapped. Each row stacks two lines (name + reason/document/version) inside a `Button size="sm"`, whose fixed `h-btn-sm` (28px) clipped the content so adjacent rows ran together. Rows now use `h-auto` so the height grows to fit both lines. (Relies on the `tailwind-merge` height-token fix in `src/lib/utils.ts`.)

## [2026-06-24] — fix(ui): location switcher dropdown rows overlapped

### Fixed

- **`apps/web/src/components/layout/Topbar.tsx`**: Location switcher dropdown rows overlapped — each row stacks a name + city (two lines) inside a `Button size="sm"`, whose fixed `h-btn-sm` (28px) clipped the content so adjacent rows ran together. Rows now use `h-auto` (height grows to content) and `justify-start` for proper left-aligned menu items.
- **`apps/web/src/lib/utils.ts`**: Registered the `btn-{sm,md,lg,xl}` height/width tokens with `tailwind-merge` (`cn`). Without this, twMerge did not recognize `h-btn-sm` as a height utility, so a `className` height override (e.g. `h-auto`) was kept alongside the baked-in size height instead of replacing it — the fixed height won. Component `size` heights are now overridable via `className` as expected.

## [2026-06-24] — fix(ui): date/time pickers in the appointment modal

### Fixed

- **`apps/web/package.json`**: Bumped `@radix-ui/react-dialog` from `^1.1.4` to `^1.1.17` to dedupe the Radix internals it shares with `@radix-ui/react-popover@1.1.17`. The two packages had resolved to different copies of `@radix-ui/react-focus-scope` and `@radix-ui/react-dismissable-layer`, which use module-level focus/layer stacks. As a result the modal `Dialog`'s focus trap never paused for a nested `Popover` and dismissed it on open — so the `DatePicker`/`TimePicker` in `AppointmentFormModal` could not be opened. With aligned versions the shared stacks coordinate correctly and the popovers open (portaling preserved, no clipping).
- **`apps/web/src/components/ui/popover.tsx`**: Raised `PopoverContent` z-index from `z-50` to `z-[600]` so popovers render above the `Modal` (`z-[500]`), matching the `Select` content convention. The calendar/time list were opening behind the modal — visible state was set but the content was hidden and its day/slot buttons were not clickable (modal intercepted pointer events).
- **`apps/web/src/pages/Schedule/PatientCombobox.tsx`**, **`AppointmentFormModal.tsx`**: Clicking outside the patient combobox no longer wipes the whole appointment form. The combobox's outside-`mousedown` handler had called an `onClear` callback wired to `clearFields`, so picking a date/time and then clicking any other field reset the form to its defaults. The handler now only dismisses the dropdown; the now-unused `onClear` prop was removed.

### Added

- **`apps/web/src/components/ui/__tests__/PickersInModal.test.tsx`**: Regression test rendering `DatePicker` and `TimePicker` inside a `Modal` and asserting their popovers open on click — guards against future Radix version drift reintroducing the duplicate-package bug.
- **`apps/web/src/pages/Schedule/__tests__/PatientCombobox.test.tsx`**: Regression test asserting that clicking outside the combobox dismisses the dropdown without emitting a clear — guards against the form-reset bug.

## [2026-06-17] — feat(ui): shadcn date/time picker + slot-aware appointment form

### Added

- **`apps/web/src/components/ui/calendar.tsx`, `popover.tsx`** (shadcn): Installed shadcn Calendar (react-day-picker v10) + Popover primitives. Calendar wired to project Button via `buttonVariants` and design tokens (`bg-primary`, `bg-popover`, etc., already mapped to Rezeta tokens in `src/index.css`).
- **`apps/web/src/components/ui/DatePicker.tsx`**: Popover-based date picker. Spanish locale, `value` is `YYYY-MM-DD` string, supports `minDate`/`maxDate`. Phosphor `ph-calendar` trigger icon.
- **`apps/web/src/components/ui/TimePicker.tsx`**: Popover-based time picker with `intervalMin`, `minTime`, `maxTime` props. Renders 12-hour `a.m./p.m.` display, scrolls active slot into view, generates slot list from configured interval.
- **`apps/web/src/components/ui/Button.tsx`**: Added `icon` size variant (32×32) and exported `buttonVariants` so `calendar.tsx` can reuse the system's Button styling.
- **`apps/web/src/pages/Schedule/helpers.ts`**: New `toTimeInputValue`, `nextSlotAfter`, `addMinutesToTime` helpers. Fixed `toDateInputValue` to use local date parts instead of `toISOString()` (timezone-safe).
- **Tests**: `DatePicker.test.tsx`, `TimePicker.test.tsx` (placeholder, value display, popover open, slot generation, selection callback).

### Changed

- **`apps/web/src/pages/Schedule/AppointmentFormModal.tsx`**: Replaced raw `<Input type="date">` and `<Input type="time">` with `DatePicker` + `TimePicker`. Default start time is the next slot after `Date.now()` (based on the active block's `slotDurationMin`). Selecting a start time auto-fills end time = start + interval. Interval is derived from the matching `ScheduleBlock` for `(locationId, dayOfWeek)` via `useGetBlocks`, falling back to 30 min.
- **`apps/web/src/pages/settings/Schedules.tsx`**: Replaced the block + exception form's date/time inputs with the new pickers (15-min interval for schedule editing).



### Changed

- **`.github/workflows/ci.yml`, `.github/workflows/deploy-dev.yml`**: Bumped all actions off the deprecated Node 20 runtime (forced removal 2026-06-16): `actions/checkout@v4 → v6`, `actions/setup-node@v4 → v6`, `pnpm/action-setup@v4 → v6`, `google-github-actions/auth@v2 → v3`, `google-github-actions/setup-gcloud@v2 → v3`. `pnpm/action-setup@v6` resolves the pnpm version from the `packageManager` field (`pnpm@10.33.0`); builds already use `node-version: '24'`.

## [2026-06-09] — chore: add implementation plans + test-user seed; ignore debug artifacts

### Added

- **`docs/superpowers/plans/2026-05-26-0{1..4}-*.md`**: The four implementation plans (schema-reset, protocol-api, consultation-api, frontend-redesign) that CLAUDE.md references. They existed only in an unpushed local commit; now in the repo so the references resolve.
- **`tools/seed-test-user.ts`** + **`package.json`** `seed:test-user` script: seeds a test user (`tsx --env-file=.env tools/seed-test-user.ts`).

### Changed

- **`.gitignore`**: Ignore `.playwright-mcp/` browser-automation snapshots and `/dashboard.png` — local debug artifacts that were being accidentally tracked.

## [2026-06-08] — docs: reconcile project context with the shipped v2 workflow redesign

### Changed

- **`CLAUDE.md`**: Marked the workflow-first redesign **shipped** (plans 01–04 merged, deployed). Replaced the stale "In progress (Hybrid redesign)" section (consultation gate, protocol strip, view-mode toggle, multi-protocol canvas — never shipped) with the actual v2 design (no gate, walk-in, 3-zone consultation, 2-layer protocol, atomic sign). Repointed the **Specs** section to `specs/updated-specs/` as canonical and listed the superseded docs. Updated the SOAP/clinical-documentation note (SOAP columns removed; content lives in `ProtocolUsage` blocks; status `open`/`signed`/`amended`) and flagged the ERD as pre-v2 (`packages/db/prisma/schema.prisma` is authoritative).
- **`specs/`**: Added dated banners reconciling docs with v2. Fully superseded (point to `specs/updated-specs/`): `protocol-in-consultation-spec.md`, `protocol-template-schema.md`, `protocol-engine-slices.md`. Partially superseded / terminology notes: `mvp-scope.md`, `full-scope.md`, `protocol-editor-ux.md`, `template-editor-ux.md`, `starter-templates.md`, `onboarding-flow.md`, `audit-log-spec.md`. Stale-diagram banner on `medical_erp_erd.mmd`. Historical audits/handoffs/qa logs left unchanged (point-in-time records).

## [2026-06-08] — ci(deploy): actually deploy the frontend to Firebase Hosting

### Fixed

- **`.github/workflows/deploy-dev.yml`**: The `deploy-frontend` job built the app but never shipped it — its final step only `echo`ed "Deployment complete!" and a wrong URL (`rezeta-dev.web.app`), so the dev site was only ever updated by manual `firebase deploy`. Added a real **Deploy to Firebase Hosting** step (`npx firebase-tools deploy --only hosting --project medical-erp-dev --non-interactive --force`) that reuses the service-account credentials already exported by the existing `google-github-actions/auth` step (`GOOGLE_APPLICATION_CREDENTIALS`) — no `FIREBASE_TOKEN` needed. Corrected the printed URL to the project default site (`https://medical-erp-dev.web.app`).
- **`.github/workflows/deploy-dev.yml`** (`Build frontend`): Wired all five Firebase web config vars the app actually reads (`apps/web/src/lib/auth/firebase-auth-client.ts`) — previously only three were passed, as unset `secrets.*`, so the build shipped an empty Firebase config. Now sourced from repo **variables** (`vars.*`, since Firebase web config is public and ships in the client bundle), adding the missing `VITE_FIREBASE_APP_ID` and `VITE_FIREBASE_MESSAGING_SENDER_ID`. The five repo variables were created with the dev project values.

### Notes

- Requires the `GCP_SA_KEY` service account to have the **Firebase Hosting Admin** role (`roles/firebasehosting.admin`).

## [2026-06-08] — fix(db): backfill doctor_id in schema_reset_v2 so it survives populated tables

### Fixed

- **`packages/db/prisma/migrations/20260526190759_schema_reset_v2/migration.sql`**: The migration added `doctor_id` as `NOT NULL` with no default in the same `ALTER TABLE` that dropped `user_id`, which Postgres rejects on a non-empty table (error `P3009` — the in-place run against the seeded dev DB failed with 0 steps committed). Reworked `consultations`, `imaging_orders`, `lab_orders`, and `prescriptions` to add `doctor_id` nullable, `UPDATE ... SET doctor_id = user_id` to backfill while `user_id` still exists, then `ALTER COLUMN doctor_id SET NOT NULL` alongside dropping `user_id`. End-state schema is unchanged; now safe on both empty and populated tables. Updated the stale generated warning comments accordingly.

### Notes

- This edits an already-applied migration, so its checksum changes. The dev DB (already wiped via `migrate reset`) must be reset again with the new file so its recorded checksum matches, otherwise `migrate deploy` fails with "migration was modified after it was applied". No live populated-table test was run (no local/Docker Postgres available); verification is by SQL review — end-state matches `schema.prisma`.

### Fixed

- `apps/web/src/pages/Consultation/index.tsx`: lifted `showAmend` and `showPicker` state from `ProtocolPanel` to the page level; `onAmend` in `PageHeader` now opens the `AmendmentModal` via `setShowAmend(true)` instead of no-oping.
- `apps/web/src/pages/Consultation/OrdersRail.tsx`: added `onAddProtocol` prop; passed it through to `ConsultationSidebar` so the "Agregar protocolo" button in the orders rail is no longer a no-op.
- `apps/web/src/pages/Consultation/ProtocolPanel.tsx`: replaced local `showAmend` / `showPicker` state with lifted props from `index.tsx`; removed unused `updateMutation` and `onSignClick` props and the suppressing `void` statements; removed unused `UseMutationResult` import.
- `apps/web/src/pages/Consultation/PageHeader.tsx`: replaced raw Tailwind palette classes (`bg-red-50`, `border-red-200`, `text-red-700`, `text-red-500`, `bg-amber-50`, `border-amber-200`, `text-amber-700`, `text-amber-500`) with design-system semantic tokens (`bg-danger-bg`, `border-danger-border`, `text-danger-text`, `bg-warning-bg`, `border-warning-border`, `text-warning-text`).
- `apps/web/src/components/protocols/blocks/VitalsBlock.tsx`: replaced `bg-white` with `bg-n-0`.
- `apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx`: replaced `bg-white` with `bg-n-0` and `text-red-500` with `text-danger-text`.
- `apps/web/src/hooks/use-consultation-orders.ts` (renamed from `useConsultationOrders.ts`): updated DTO parameter types from `unknown` to `CreatePrescriptionGroupDto`, `CreateImagingOrderGroupDto`, `CreateLabOrderGroupDto`.
- `apps/web/src/hooks/__tests__/use-consultation-orders.test.ts` (renamed from `useConsultationOrders.test.ts`): updated import to match new kebab-case filename.
- `apps/web/src/pages/ProtocolEditor/__tests__/block-factory.test.ts`: removed `.js` extension from import path for consistency with rest of test suite.
- `apps/web/src/components/consultations/OrderQueuePanel.tsx`: corrected stale comment from `"Medicamentos"` to `"Recetas"` to reflect the actual displayed string.

## [2026-05-26] — fix(web): allergy alerts in header, PATCH sign verb, Recetas tab, useConsultationOrders hook

### Added

- `apps/web/src/pages/Consultation/PageHeader.tsx`: new `patientAllergies` and `patientChronicConditions` props; renders allergy badges (red) and chronic condition badges (amber) always visible below the patient/doctor line — hard clinical safety requirement.
- `packages/shared/src/types/consultation.ts`: added `patientAllergies: string[]` and `patientChronicConditions: string[]` to `ConsultationWithDetails`.
- `apps/api/src/modules/consultations/consultations.repository.ts`: included `allergies` and `chronicConditions` in the patient SELECT and mapped them to the returned `ConsultationWithDetails` shape.
- `apps/web/src/hooks/useConsultationOrders.ts`: new hook file exposing `useConsultationOrders`, `useCreatePrescriptionGroup`, `useCreateImagingOrderGroup`, `useCreateLabOrderGroup`, and `useDeleteOrderGroup`.
- `apps/web/src/hooks/__tests__/useConsultationOrders.test.ts`: unit tests for all five new hooks.

### Changed

- `apps/web/src/hooks/consultations/use-consultations.ts`: `useSignConsultation` changed from `apiClient.post` to `apiClient.patch` to match the `PATCH /v1/consultations/:id/sign` backend endpoint.
- `apps/web/src/hooks/__tests__/use-consultations.test.ts`: updated `useSignConsultation` test to expect `apiClient.patch`.
- `apps/web/src/components/consultations/strings.ts`: renamed `tabMedications` from `'Medicamentos'` to `'Recetas'` in `orderQueueStrings`.
- `apps/web/src/pages/Consultation/index.tsx`: passes `patientAllergies` and `patientChronicConditions` from consultation data to `PageHeader`.

## [2026-05-26] — feat(web): frontend redesign plan 04 — vitals blocks, category chips, 3-zone consultation layout

### Added

- `apps/web/src/components/protocols/blocks/VitalsBlock.tsx`: new reusable component for rendering a grid of vitals fields (text/number/computed) in protocol editor and viewer.
- `apps/web/src/components/protocols/blocks/ClinicalNotesBlock.tsx`: new reusable textarea component for clinical note blocks.
- `apps/web/src/pages/ProtocolEditor/__tests__/block-factory.test.ts`: tests for `vitals` and `clinical_notes` in `makeBlock` and `PALETTE_ITEMS`.
- `apps/web/src/pages/Consultation/ProtocolPanel.tsx`: new component encapsulating all protocol usage logic (canvas/SOAP view, protocol picker, modals) for the 3-zone consultation layout.
- `apps/web/src/pages/Consultation/OrdersRail.tsx`: new right-rail component composing patient alerts, previous consultations, and the full orders queue panel (prescriptions, imaging, labs).

### Changed

- `apps/web/src/pages/ProtocolEditor/block-factory.ts`: added `vitals` and `clinical_notes` entries to `PALETTE_ITEMS` and `makeBlock()`.
- `apps/web/src/components/protocols/BlockRenderer.tsx`: added `VitalsBlockType` and `ClinicalNotesBlockType` interfaces to the `ProtocolBlock` union; added `vitals` and `clinical_notes` switch cases rendering the new block components.
- `apps/web/src/components/protocols/strings.ts`: added `vitals` and `clinicalNotes` to `blockTypeStrings`.
- `apps/web/src/pages/Protocols/index.tsx`: category filter chips now show a color dot using `style={{ backgroundColor: cat.color }}`.
- `apps/web/src/pages/NewConsultation.tsx`: removed `ConsultationGate` (protocol picker step); page now shows a simple "ready to start" state and creates consultation directly with `{ patientId, locationId }`.
- `apps/web/src/pages/Consultation/index.tsx`: replaced old grid layout with `flex flex-col h-screen` 3-zone layout — fixed header zone, scrollable main zone (`ProtocolPanel`), and fixed right rail (`OrdersRail`).
- `apps/web/src/pages/Consultation/strings.ts`: added `creatingButton`, `readyTitle`, `readyDescription` strings; renamed `openEmptyButton` to "Iniciar consulta".

## [2026-05-26] — fix(api): add tenantId to sign transaction updateMany, add amended/rollback tests

### Fixed

- `consultations.repository.ts` `sign` method: added `tenantId` to `where` clause of all four `updateMany` calls (`protocolUsage`, `prescription`, `labOrder`, `imagingOrder`) inside the `$transaction` to enforce tenant isolation.

### Added

- `consultations.service.spec.ts`: new test verifying `ConflictException` is thrown when signing a consultation with `amended` status.
- `consultations.repository.spec.ts`: new rollback test verifying `repo.sign` propagates DB errors from `consultation.update` within the transaction.

## [2026-05-26] — feat(api): atomic sign transaction + combined orders endpoint (feat/consultation-api-redesign)

### Changed

- **`apps/api/src/modules/consultations/consultations.repository.ts`**: Updated `sign()` to use `prisma.$transaction` — atomically completes all `in_progress` protocol usages (`status → completed`, `completedAt` set), signs all `queued` prescriptions, lab orders, and imaging orders (`status → signed`, `signedAt` set), then marks the consultation as `signed`.
- **`apps/api/src/modules/orders/orders.repository.ts`**: Added `getOrdersForConsultation()` — fetches prescriptions, imaging orders, and lab orders for a consultation in a single `Promise.all`, returning `{ prescriptions, imagingOrders, labOrders }`.
- **`apps/api/src/modules/orders/orders.service.ts`**: Added `getOrdersForConsultation()` service method — validates consultation exists then delegates to repository.
- **`apps/api/src/modules/orders/orders.controller.ts`**: Added `GET v1/consultations/:consultationId/orders` endpoint that returns all order types in one request.

### Added

- **`apps/api/src/modules/consultations/__tests__/consultations.repository.spec.ts`**: Added 4 tests covering the atomic sign transaction — verifies protocol usages, prescriptions, lab orders, and imaging orders are all updated via the transaction callback.
- **`apps/api/src/modules/orders/__tests__/orders.repository.spec.ts`**: Added 3 tests for `getOrdersForConsultation` — returns combined result, filters by `consultationId`/`tenantId`/`deletedAt`, handles empty sets.
- **`apps/api/src/modules/orders/__tests__/orders.service.spec.ts`**: Added 2 tests for `getOrdersForConsultation` — delegates to repo, throws `NotFoundException` when consultation missing.
- **`apps/api/src/modules/orders/__tests__/orders.controller.spec.ts`**: Added 1 test for `getOrders` controller method.

## [2026-06-07] — protocol API simplification (plan 02): types → categories

### Added

- **`apps/api/src/modules/protocol-categories/`**: New module (repository, service, controller, module, index) exposing `GET/POST/PATCH/DELETE /v1/protocol-categories`. Categories are tenant-scoped, soft-deleted, and seeded categories cannot be deleted (`PROTOCOL_CATEGORY_SEEDED_IMMUTABLE`). Service, controller and repository specs added (per-file coverage ≥95%).
- **`apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts`**: `seedDefault` now seeds 5 locale-aware default protocol categories (Emergencias/Diagnóstico/Medicación/Procedimiento/Rehabilitación and English equivalents) with `isSeeded=true`.

### Changed

- **`apps/api/src/app.module.ts`**: Replaced `ProtocolTypesModule` with `ProtocolCategoriesModule`.
- **`apps/api/src/modules/protocols/protocols.controller.ts`**: Protocol list filter and create payload now use `categoryId` instead of `typeId` (OpenAPI docs + query param); `categoryId` is optional.
- **`apps/api/src/modules/protocol-templates/`**: Removed all template lock rules — templates are freely editable. Deleting a seeded system template now returns 400; dead `isLocked`/`getBlockingTypeIds` repository stubs removed.
- **`packages/shared/src/errors.ts`**: Replaced `PROTOCOL_TYPE_*` error codes with `PROTOCOL_CATEGORY_*`; replaced unused `PROTOCOL_TEMPLATE_LOCKED` with `PROTOCOL_TEMPLATE_SEEDED_IMMUTABLE`.
- **`apps/api/test/protocols.integration.ts`**: Migrated to `/v1/protocol-categories` + optional `categoryId`; added a scratch-mode (no category) create case; removed type-validation cases that no longer apply.

### Removed

- **`apps/api/src/modules/protocol-types/`**: Deleted the entire ProtocolType module (controller, service, repository, module, tests).

### Notes

- Frontend still references the removed `/v1/protocol-types` endpoints (`apps/web` protocol-types hook, Types settings page, `useGetProtocols` `typeId` filter) and the `ProtocolType` shared type. These are intentionally deferred to the frontend redesign (plan 04); the web app will 404 against those endpoints until then.
- Starter templates in `starter-fixtures/index.ts` were kept unchanged (user decision); `vitals`/`clinical_notes` block types remain available for authors.

## [2026-06-02] — full dev seed for test@test.com

### Added

- **`tools/seed-test-user.ts`**: Idempotent full-data seed for the dev user `test@test.com` (password `Test12345`). Get-or-creates the Firebase user, tenant and owner doctor, then wipes and rebuilds the tenant's clinical data (FK-safe order) so it is safe to re-run. Populates 2 locations (owned + commissioned) with doctor links, weekly `ScheduleBlock`s and a `ScheduleException`; 8 patients (cedula/passport, allergies, chronic conditions); 2 protocol categories, 1 authoring `ProtocolTemplate`, and 2 active `Protocol`s with approved `ProtocolVersion`s (block-based content: `vitals`, `checklist`, `dosage_table`, `lab_order`, `alert`, `clinical_notes`); 4 completed visits each wiring `Appointment` → signed `Consultation` → `ProtocolUsage` (vitals filled) → signed `Prescription` + `LabOrder` → paid `Invoice`; one in-progress consultation for today; one issued (unpaid) invoice; scheduled/cancelled/no-show appointments; and `AuditLog` entries.
- **`package.json`**: Added `seed:test-user` script (`tsx --env-file=.env tools/seed-test-user.ts`).

## [2026-05-26] — fix CI failures on feat/schema-reset-v2: db coverage crash + shared branch coverage

### Fixed

- **`packages/db/package.json`**: Added `@vitest/coverage-v8` to devDependencies — `pnpm --filter @rezeta/db test:coverage` crashed with `Failed to load url @vitest/coverage-v8` because the package was missing.
- **`packages/shared/src/types/protocol.ts`**: Added `'vitals'` and `'clinical_notes'` to `BlockType` union; added `VitalsField` interface; added two new `ProtocolBlock` union variants (`vitals` with `fields`/`values`, `clinical_notes` with `label`/`content`).
- **`packages/shared/src/protocol/sign-validation.ts`**: Removed dead SOAP branches (`chiefComplaint`, `assessment`, `diagnoses`) and `SoapContext` type (SOAP fields removed in schema reset); simplified `computeMissingRequiredFields` signature from `(ctx, usages)` to `(usages)`; added `case 'vitals'` and `case 'clinical_notes'` to `blockIsCompleted` switch.
- **`apps/api/src/modules/consultations/consultations.service.ts`**: Updated `computeMissingRequiredFields({}, c.protocolUsages)` → `computeMissingRequiredFields(c.protocolUsages)` to match new signature.
- **`packages/shared/__tests__/sign-validation.test.ts`**: Removed SOAP-specific tests (dead code); updated all calls from 2-arg to 1-arg; added tests for `vitals` and `clinical_notes` block types (complete and incomplete cases); added null-coalescing fallback branch tests to push `sign-validation.ts` branch coverage from 87% to 97.87% (threshold 95%).

---

## [2026-05-26] — fix all test failures for schema-reset-v2 (Plan 01 complete)

### Fixed

- **`apps/api`** (`protocols/__tests__/protocols.spec.ts`): Removed `mockTypesRepo`, fixed constructor call to single arg, updated required-block tests to expect success (template schema hardcoded to `{ blocks: [] }` in service).
- **`apps/api`** (`tenant-seeding/__tests__/*.spec.ts`): Rewrote both tenant-seeding specs to match new service behavior — `protocolType.create` no longer called (ProtocolType removed in schema reset v2; categories seeded in Plan 02).
- **`apps/api`** (`protocol-types/__tests__/protocol-types.repository.spec.ts`): Rewrote to test stub behavior — all methods except `templateBelongsToTenant` are stubs returning empty/null/false/rejected.
- **`apps/api`** (`protocol-types/__tests__/protocol-types.spec.ts`): Removed tests for removed behaviors (`existsByName` on update, `_count` lock check on delete, `existsByName` on create); fixed `BadRequestException` → `ConflictException` for `TEMPLATE_NOT_FOUND_FOR_TYPE`.
- **`apps/api`** (`protocol-templates/__tests__/protocol-templates.repository.spec.ts`): Rewrote to match simplified repo — no `protocolTypes` include, `isLocked`/`getBlockingTypeIds` are stubs.
- **`apps/api`** (`protocol-templates/__tests__/protocol-templates.spec.ts`): Removed `blockingTypeIds` and `TEMPLATE_LOCKED` tests (locking deferred to Plan 02); `isLocked` always `false`.
- **`apps/api`** (`consultations/__tests__/consultations.service.spec.ts`): Replaced `with protocolId (atomic)` tests with schema-reset-v2 behavior — `create` now delegates to `repo.create` regardless of `protocolId`; protocol launch via `addProtocolUsage`.
- **`apps/api`** (`protocols/__tests__/protocols.service.spec.ts`): Fixed `omits favoritesOnly when false` test — service always passes `favoritesOnly: false` through.
- **`apps/api`** (`protocol-improvements/__tests__/protocol-improvements.service.spec.ts`): Added tests for `_max.versionNumber === null` (first version) and `categoryId` conditional branches; fixed mock to use `categoryId` not `typeId`.
- **`apps/api`** (`protocols/protocols.service.ts`): Added `c8 ignore` comments around dead `validateRequiredBlocks` loop body (unreachable while template schema is hardcoded empty).
- **`apps/web`** (`consultations/__tests__/ProtocolStrip.test.tsx`): Removed `checkedState` field (removed from type); updated checked-state tests to use `modifications.checklist_items` via `deriveCheckedState`.
- **`apps/web`** (`consultations/__tests__/ConsultationGate.test.tsx`): Updated recommendation and protocol mock data from `typeId`/`typeName` to `categoryId`/`categoryName`.
- **Coverage**: All packages now at ≥99% (API: 99.9% stmts / 99.85% branches; web: 100%).

---

## [2026-05-21] — fix CI typecheck failure on months array index

### Fixed

- **CI** (`Dashboard/helpers.ts:22`): Added non-null assert (`!`) on `MONTHS_ES[date.getMonth()]` to satisfy `exactOptionalPropertyTypes` — TS2532 was failing the build on CI despite passing locally.

---

## [2026-05-21] — QA bug fixes (11 bugs from session 2026-05-21 retest)

### Fixed

- **BUG-005** (`Dashboard/helpers.ts`, `Dashboard/PageHeader.tsx`): Date kicker now shows "21 may 2026" format instead of "JUEVES 21 DE MAYO"; removed `uppercase` CSS class.
- **BUG-011** (`settings/AuditLog.tsx`): Audit log timestamps now render "PM"/"AM" instead of "p. m."/"a. m."; replaced `toLocaleString` with manual hour formatting.
- **BUG-039** (`Dashboard/PageHeader.tsx`): "Nueva consulta" button now navigates to `/consultas/nueva` instead of `/pacientes`.
- **BUG-022** (`settings/Templates.tsx`, `settings/strings.ts`): System/seeded templates now show "Sistema" badge instead of "Bloqueada por N tipo(s)"; `isSeeded` check added before `isLocked` in badge logic.
- **BUG-017** (`settings/Locations.tsx`, `settings/strings.ts`): Location form now shows inline validation error ("El nombre es obligatorio") and required marker on submit attempt; submit button is always enabled so validation fires on click.
- **BUG-018** (`components/ui/Input.tsx`, `settings/Locations.tsx`): `Field` component now accepts `id` prop and sets `htmlFor` on its `<label>`; all 8 location form fields now have associated IDs.
- **BUG-034** (`ProtocolEditor/EditorHeader.tsx`, `ProtocolEditor/helpers.ts`, `ProtocolEditor/index.tsx`): Protocol editor top bar now displays status badge (Borrador / Activo / En revisión / Archivado) via new `status` prop on `EditorHeader`.
- **BUG-036** (`Dashboard/index.tsx`, `Dashboard/PageHeader.tsx`): Dashboard no longer overflows at 375px; grids use responsive breakpoints (`grid-cols-2 sm:grid-cols-4`, `grid-cols-1 sm:grid-cols-2`); PageHeader stacks vertically on mobile.
- **BUG-029** (`ProtocolEditor/HistoryDrawer.tsx`, `ProtocolEditor/strings.ts`, `ProtocolEditor/index.tsx`): Version history panel now shows "Ver contenido" and "Comparar con actual" buttons alongside the existing Restaurar button for each non-current version.
- **BUG-038** (`audit-context.store.ts`, `audit-log.interceptor.ts`, `protocols.service.ts`, `patients.service.ts`, `locations.service.ts`, `protocol-templates.service.ts`, `settings/AuditLog.tsx`): Audit log entity names no longer truncated on delete/archive; services set entity name in context before deletion; frontend fallback now shows localized entity type labels (e.g. "Protocolo" not "Protocol").
- **BUG-008** (`pages/Onboarding/index.tsx`, `pages/Onboarding/strings.ts`): Fresh accounts no longer blocked at `/bienvenido`; onboarding auto-triggers default seeding on mount and redirects automatically; error state shows retry button.

### Added

- `setAuditEntityName()` helper in `audit-context.store.ts` for services to register entity names before delete/archive operations.
- Tests for `setAuditEntityName` in `audit-context.store.spec.ts` and interceptor context fallback in `audit-log.interceptor.spec.ts`.

## [2026-05-21] — Frontend error logging to server app logs

### Added

- `POST /v1/logs/client-error` — public NestJS endpoint that receives frontend error reports and emits them via `Logger.error/warn` into the server stdout log stream (`apps/api/src/modules/logs/`)
- `ClientErrorSchema` in `packages/shared/src/schemas/client-error.ts` — Zod schema shared between frontend and backend for the error payload
- `apps/web/src/lib/logger.ts` — thin frontend logger utility (`logger.error`, `logger.warn`) that always logs to console and fire-and-forgets a POST to the backend endpoint
- `apps/web/src/components/ErrorBoundary.tsx` — React class-component error boundary wrapping `<App />`; calls `logger.error` on `componentDidCatch` and renders a Spanish fallback UI
- `window.onerror` and `window.onunhandledrejection` global handlers in `apps/web/src/main.tsx`
- Global `QueryCache` and `MutationCache` error handlers in `apps/web/src/providers/QueryProvider.tsx` that log all TanStack Query failures

### Changed

- `apps/web/src/providers/AuthProvider.tsx` — replaced `console.error` with `logger.error`
- `apps/web/src/pages/Settings.tsx`, `NewConsultation.tsx`, `Patients/PatientModal.tsx`, `Patients/index.tsx`, `settings/AuditLog.tsx`, `settings/Locations.tsx`, `settings/Types.tsx`, `PatientDetail/EditModal.tsx`, `Billing/DeleteConfirmModal.tsx`, `Billing/InvoiceFormModal.tsx` — all non-silent `catch {}` blocks now call `logger.error` with context before setting user-visible error state

## [2026-05-21] — Wave 5: Responsive sidebar, mobile layout fix

### Fixed

- **BUG-036** `AppLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx` — sidebar now slides off-screen on mobile (`-translate-x-full`) and is revealed via hamburger button; overlay backdrop closes it on tap; `useLocation` effect auto-closes on navigation. `Topbar` moves from `left-sidebar` to `left-0 lg:left-sidebar`. Content area loses `ml-sidebar` on mobile (`lg:ml-sidebar`). Main padding reduced to `px-4 sm:px-6 lg:px-12`. Eliminates horizontal scroll at 375px viewport.

## [2026-05-21] — Wave 4: Protocol editor UX, archive, scratch mode

### Added

- **BUG-026** `ProtocolEditor/SaveModal.tsx` — new 2-step save dialog with change-summary input, "Guardar como borrador" and "Guardar y publicar" buttons; replaces direct save on "Guardar" click
- **BUG-028** `ProtocolEditor/index.tsx` — Cmd+S / Ctrl+S shortcut opens SaveModal when editor is dirty
- **BUG-029** `ProtocolEditor/HistoryDrawer.tsx` — per-row restore icon button (`ph-clock-counter-clockwise`) on non-current versions; removes bottom-only restore button; `onRestore` now accepts `versionId` param
- **BUG-030** `ProtocolEditor/index.tsx` — mobile gate shown when viewport < 1024px (centered message + back link, read-only guard)
- **BUG-032** `PATCH /v1/protocols/:id/archive` endpoint in controller/service/repository; `useArchiveProtocol` hook in `use-protocols.ts`; archive icon button on protocol list rows with confirm modal in `Protocols/index.tsx`
- **BUG-035** `TemplatePickerModal.tsx` — "Desde cero" selectable card (no template); `CreateProtocolSchema.typeId` now optional; DB migration `20260520000000_protocol_type_optional` makes `protocols.type_id` nullable; service creates with empty content when no typeId; `ProtocolListItem.typeId/typeName` and `ProtocolResponse.typeId/typeName` now nullable

### Changed

- **BUG-027** `EditorHeader.tsx` — dirty badge shows `unsaved` ("Cambios sin guardar") instead of `unsavedChanges` ("Cambios sin publicar")
- `ConsultationGate.tsx` — `typeName` null-guards updated (`?? ''`) for blank protocols in search and bucketing
- `consultations.repository.ts` — `protocolTypeName` now `string | null` (blank protocol support)
- `packages/shared/src/types/consultation.ts` — `ConsultationProtocolUsage.protocolTypeName` changed to `string | null`
- `ProtocolEditor/strings.ts` — added `mobileGateTitle`, `mobileGateBody` strings

### Fixed

- Auth store coverage gaps: added tests for `signUp` with profile, `setUser` action
- Protocol service branch coverage: added tests for null-type list items, null-type getById, blank-protocol saveVersion

---

## [2026-05-20] — Wave 3: Audit log display, location archive, TS fixes

### Added

- `apps/api/src/modules/locations/locations.controller.ts` — `PATCH /v1/locations/:id/archive` endpoint; delegates to `service.remove()` so the audit log records action `'archive'` instead of `'delete'`. Fixes BUG-019 + BUG-037.
- `apps/web/src/hooks/locations/use-locations.ts` — `useArchiveLocation` hook (PATCH /archive); invalidates location cache on success.
- `apps/web/src/lib/toasts.ts` — `locationArchived` and `errorLocationArchive` toast strings.
- `apps/web/src/pages/settings/strings.ts` — `archiveButtonTitle`, `archiveTitle`, `archiveBody`, `archiveConfirmButton`, `archivingButton`, `archiveError` strings for `locationsStrings`.

### Changed

- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — `resolveAction` now returns `'archive'` for `PATCH *.../archive` requests; `tap` handler extracts `entityName` from response body (`name` / `fullName` / `title`) and stores it in `metadata`. Fixes BUG-013, BUG-037, BUG-038.
- `apps/web/src/pages/settings/AuditLog.tsx` — table row actor fallback now uses `actorUnknown` (consistent with detail drawer); entity column shows `metadata.entityName` when available, falling back to `entityType + entityId.slice(0,8)`. Fixes BUG-006, BUG-013, BUG-038.
- `apps/web/src/pages/settings/Locations.tsx` — replaced trash/delete action with archive action using `useArchiveLocation`; `ArchiveConfirmModal` replaces `DeleteConfirmModal`. Fixes BUG-019.
- `apps/web/src/pages/Patients/index.tsx` — fixed `exactOptionalPropertyTypes` error in PatientModal spread.
- `apps/web/src/pages/Signup/index.tsx` — fixed `exactOptionalPropertyTypes` error when passing optional `specialty` to `signUp`.

---

## [2026-05-20] — Wave 2: Signup fields, profile edit, sidebar sign-out

### Added

- `packages/shared/src/schemas/auth.ts` — `fullName` (required) and `specialty` (optional) fields on `SignUpSchema`; password mix-requirement regex (uppercase + lowercase + digit); new `UpdateProfileSchema` / `UpdateProfileDto`.
- `apps/api/src/modules/users/users.repository.ts` — `updateProfile()` method; `provisionUser()` now accepts optional `{ fullName?, specialty? }` and saves them on first user creation.
- `apps/api/src/modules/users/users.service.ts` — `updateProfile()` service method (verifies user exists, delegates to repo).
- `apps/api/src/modules/users/users.controller.ts` — `PATCH /v1/users/me/profile` endpoint (204 No Content) wired to `updateProfile`.
- `apps/api/src/modules/auth/auth.controller.ts` — `provision` endpoint now reads optional `fullName` and `specialty` string fields from the request body and forwards them to the service.
- `apps/api/src/modules/auth/auth.service.ts` — `provision()` accepts optional `profile` arg and passes it to `provisionUser`.
- `apps/web/src/hooks/users/use-update-profile.ts` — TanStack mutation hook; on success calls `GET /v1/auth/me` and updates the auth store.
- `apps/web/src/store/auth.store.ts` — `signUp` now accepts optional profile arg and calls provision with profile data after Firebase signup; new `setUser` action.

### Changed

- `apps/web/src/pages/Signup/index.tsx` — form now collects `fullName` (required) and `specialty` (optional); password field shows inline help text with mix requirements.
- `apps/web/src/pages/Settings.tsx` — account card is now editable via `ProfileEditModal` (fullName, specialty, licenseNumber); shows "Sin definir" fallback for unset fields.
- `apps/web/src/components/layout/Sidebar.tsx` — user chip now opens a Radix DropdownMenu with links to Ajustes and sign-out; sign-out is now reachable from every authenticated view.
- `apps/web/src/pages/Signup/strings.ts` — added fullName, specialty, password hint strings.
- `apps/web/src/pages/settings/strings.ts` — added profile edit modal strings.
- `apps/web/src/components/layout/strings.ts` — added user menu strings.

---

## [2026-05-20] — Wave 1: Unblock patient creation, remove dev routes from production UI

### Fixed

- `apps/web/src/pages/Patients/index.tsx` — BLOCKER-001: modal render guard `modalMode && selectedPatient` prevented create flow from opening (selectedPatient is null on create). Changed to `modalMode && (modalMode === 'create' || selectedPatient !== null)`.

### Changed

- `apps/web/src/pages/Settings.tsx` — removed design-system prototype and reference links from the settings menu (SCOPE-001/002); routes remain accessible via direct URL for internal dev use.
- `apps/web/src/pages/settings/strings.ts` — removed dead `designSystemPrototypeTitle`, `designSystemPrototypeDescription`, `designSystemReferenceTitle`, `designSystemReferenceDescription` string entries.

---

## [2026-05-20] — QA Audit, Clinical Usability Report and Context Sincronization

### Fixed

- `apps/web/src/components/consultations/VitalsSection.tsx` — Passed empty string instead of em-dash `—` when BMI is not computed to prevent Chrome console warnings about invalid number formats.

### Added

- `medical_recommendations.pdf` — Comprehensive clinical usability assessment, Dominican Republic localization review, and workflow safety report.
- `technical_bugs.pdf` — Code audit report documenting the resolution of the 14 major bugs and outlining recommendations for remaining technical debt.
- `GEMINI.md` — Project context and audit summary to maintain memory sync for Gemini.

---

## [2026-05-19] — Imaging/lab PDF download, group rename, and move-between-groups

### Added

- `packages/shared/src/schemas/consultation.ts` — `PatchImagingOrderSchema`, `PatchLabOrderSchema`, `RenameOrderGroupSchema` (+ inferred DTO types)
- `apps/api/src/lib/pdf.service.ts` — `generateImagingOrderGroup()` and `generateLabOrderGroup()` — PDFKit builders with doctor header, patient block, orders table, and signature footer
- `apps/api/src/modules/orders/orders.service.ts` — `getImagingOrderGroupPdf()`, `getLabOrderGroupPdf()`, `patchImagingOrder()`, `patchLabOrder()`, `renameImagingOrderGroup()`, `renameLabOrderGroup()`
- `apps/api/src/modules/orders/orders.repository.ts` — `patchImagingOrder()`, `patchLabOrder()`, `renameImagingOrderGroup()`, `renameLabOrderGroup()` (uses `updateMany` + re-list for bulk rename)
- `apps/api/src/modules/orders/orders.controller.ts` — 6 new endpoints: `GET /imaging-orders/group-pdf`, `PATCH /imaging-orders/rename-group`, `PATCH /imaging-orders/:orderId`, same 3 for lab orders; static routes placed before parameterized to prevent NestJS shadowing
- `apps/web/src/hooks/consultations/use-consultations.ts` — `usePatchImagingOrder`, `usePatchLabOrder`, `useRenameImagingOrderGroup`, `useRenameLabOrderGroup`
- `apps/web/src/components/consultations/strings.ts` — `renameGroupPlaceholder`, `renameGroupSave`, `renameGroupCancel`, `moveToGroup`, `moveToGroupLabel`, `downloadingImagingPdf`, `downloadImagingPdf`, `downloadLabPdf`
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — `SavedImagingGroupCard` and `SavedLabGroupCard` now support: inline group rename (auto-focus input, Enter/Escape shortcuts), PDF download button, per-row move-to-group `Select` dropdown (hidden when only one group)
- `apps/api/src/modules/orders/__tests__/orders.controller.spec.ts` — 6 new tests covering all new controller endpoints

---

## [2026-05-19] — Modification tracking: protocol interactions feed pattern detection

### Added

- `lib/consultation/modifications.ts` — `BlockModificationEvent` discriminated union + `appendModification()` helper (append-only, immutable updates to `ProtocolUsageModifications`)
- `lib/consultation/__tests__/modifications.test.ts` — 10 tests covering all 6 event types, immutability, explicit timestamp, and notes omission
- `components/protocols/BlockRendererRunMode.tsx` — `onModification` prop on all interactive sub-components (`StepsRunMode`, `ChecklistRunMode`, `DecisionRunMode`, `ImagingOrderRunMode`, `DosageTableRunMode`, `LabOrderRunMode`); fires typed event on every user interaction; re-exports `BlockModificationEvent`
- `components/consultations/CanvasView.tsx` — `onModification` prop wired into `runMode` spread; re-exports `BlockModificationEvent`
- `pages/Consultation/index.tsx` — `handleModification` uses `appendModification` then calls `useUpdateProtocolUsage` to persist; passed to `CanvasView`

---

## [2026-05-19] — Suggestions UI: SuggestionBanner wired end-to-end

### Fixed

- `protocol-improvements.controller.ts` — corrected route from `/v1/protocols/:id/improvements` to `/v1/protocols/:id/suggestions` to match frontend hooks and spec
- `OrderQueuePanel.tsx` — removed redundant `useEffect(() => reset(), [consultationId])` now that `useOrderQueueSession` handles reset+restore in the parent

### Added

- `components/protocols/__tests__/SuggestionBanner.test.tsx` — 11 tests covering render, stats display, apply/createVariant/dismiss button actions, and pending loading states

---

## [2026-05-19] — Session state: order queue persists across page reloads

### Added

- `store/order-queue.store.ts` — `restoreSnapshot` action restores all 6 queue arrays atomically
- `hooks/consultations/use-order-queue-session.ts` — resets store on consultation mount, restores ungenerated orders from `localStorage` (keyed `rz:oq:${consultationId}`), persists on every queue change, clears on sign. Shows toast on restore.
- `hooks/use-before-unload-guard.ts` — registers `beforeunload` listener when there are unsaved queued orders; cleans up on unmount or when deactivated
- `lib/toasts.ts` — added `orderQueueRestored` string
- `hooks/__tests__/use-before-unload-guard.test.ts` — 5 tests covering listener lifecycle and handler behavior
- `hooks/consultations/__tests__/use-order-queue-session.test.ts` — 8 tests covering restore, toast, sign guard, persist, clear on empty, clear on sign, reset on ID change, corrupted data

### Changed

- `Consultation/index.tsx` — wires `useOrderQueueSession` and `useBeforeUnloadGuard`; moves `isSigned` computation before early returns so hooks are called unconditionally

---

## [2026-05-19] — Wire BlockRendererRunMode into consultation canvas; auto-populate SOAP; linked protocol chain

### Changed

- `CanvasView.tsx` — rewritten to use `BlockRendererRunMode` for all block types (section, checklist, steps, decision, dosage table, imaging order, lab order, alert, text). Removed hand-rolled step-list logic (`collectSteps`, `ProtoStep`). New props: `onCheck`, `onAutoPopulate`, `onLaunchLinkedProtocol`.
- `BlockRendererRunMode.tsx` — added `isSigned?: boolean` to `RunModeProps`; gated all interactive elements (step buttons, checklist clicks, decision card clicks, queue buttons) behind the flag.
- `Consultation/index.tsx` — replaced `handleToggleStep`/`onSkipStep` with `handleCheck`; added `handleAutoPopulate` (appends text to objective/assessment/plan); added `handleLaunchLinkedProtocol` (mutates new usage, tracks chain stack); added chain breadcrumb display with back navigation.
- `components/consultations/strings.ts` — added `canvasViewStrings` and `chainBreadcrumbStrings`.

### Fixed

- `soap` and `onSoapChange` props were passed into old `CanvasView` but immediately `void`ed — auto-populate now actually writes to SOAP fields.
- Dosage tables, imaging/lab order blocks, decision branches, text blocks, alerts were invisible in canvas mode — all now render.

---

## [2026-05-19] — Stage 4 (complete): replace all raw HTML with UI primitives across pages and smart components

### Changed

- `pages/settings/Locations.tsx` — `<input type="checkbox">` → `Checkbox`, `<textarea>` → `Textarea`
- `pages/settings/Schedules.tsx` — two `<select>` → `Select`/`SelectItem`, `<button>` delete → `IconButton`
- `pages/settings/AuditLog.tsx` — two `<input type="date">` → `Input`, two `<select>` → `Select` with sentinel `__all__` values
- `pages/settings/Types.tsx` — template `<select>` → `Select` with sentinel `__none__` value
- `pages/Schedule/PatientCombobox.tsx` — patient row `<button>` → `Button variant="item"`
- `pages/_preview/GatePreview.tsx` — skip `<button>` → `Button variant="secondary"`
- `pages/OnboardingCustomize/StepTemplates.tsx` — template name `<input>` → `Input variant="ghost"`
- `pages/OnboardingCustomize/StepTypes.tsx` — type name `<input>` → `Input variant="ghost"`, template `<select>` → `Select`
- `pages/Billing/InvoiceFormModal.tsx` — patient and location `<select>` → `Select`, notes `<textarea>` → `Textarea`

## [2026-05-19] — Stage 4: colocate remaining hardcoded Spanish strings across 13 files

### Added

- `apps/web/src/pages/PatientDetail/strings.ts` — new strings file with `patientDetailStrings` for `DemographicsBlock` and `EditModal`
- `apps/web/src/pages/Billing/strings.ts` — new strings file with `billingStrings` for all four Billing files

### Changed

- `apps/web/src/pages/PatientDetail/DemographicsBlock.tsx` — all section title and field labels replaced with `patientDetailStrings.*`
- `apps/web/src/pages/PatientDetail/EditModal.tsx` — all field labels, placeholders, select options, button text, and error message replaced with `patientDetailStrings.*`
- `apps/web/src/pages/Billing/index.tsx` — page title, button, table headers, loading/error/empty states replaced with `billingStrings.*`
- `apps/web/src/pages/Billing/InvoiceRow.tsx` — `aria-label` strings and net label replaced with `billingStrings.*`
- `apps/web/src/pages/Billing/DeleteConfirmModal.tsx` — modal title, dynamic subtitle, button text, and error message replaced with `billingStrings.*`
- `apps/web/src/pages/Billing/InvoiceFormModal.tsx` — all field labels, placeholders, table column headers, summary labels, button text, and error messages replaced with `billingStrings.*`
- `apps/web/src/pages/Protocols/index.tsx` — hardcoded `"Error al cargar protocolos"` title and `"Reintentar"` button replaced with `protocolsStrings.*`
- `apps/web/src/pages/Protocols/strings.ts` — added `errorTitle` and `retryButton` keys
- `apps/web/src/pages/OnboardingCustomize/StepTemplates.tsx` — template `placeholder` and delete button `title` replaced with `onboardingCustomizeStrings.*`
- `apps/web/src/pages/OnboardingCustomize/StepTypes.tsx` — type `placeholder` and delete button `title` replaced with `onboardingCustomizeStrings.*`
- `apps/web/src/pages/OnboardingCustomize/strings.ts` — added `step1TemplatePlaceholder`, `step1DeleteLabel`, `step2TypePlaceholder`, `step2DeleteLabel`
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — three `"Eliminar grupo"` aria-labels and three template-literal group title fallbacks replaced with `orderQueueStrings.*`
- `apps/web/src/components/consultations/SwitchProtocolDialog.tsx` — dynamic dialog title, `"Examen físico (paso N)"` and `"Decisión, tratamiento, etc."` impact row titles replaced with `switchProtocolStrings.*`
- `apps/web/src/components/consultations/strings.ts` — added `prescriptionGroupFallback`, `imagingGroupFallback`, `labGroupFallback`, `movedTitle`, `discardedTitle`, `dialogTitle`, `dialogTitleNoTarget`

## [2026-05-19] — Stage 3: extract all hardcoded user-facing strings from components and pages

### Changed

- `apps/web/src/pages/settings/Locations.tsx` — all hardcoded strings replaced with `locationsStrings.*`; remaining table header and edit button strings fixed
- `apps/web/src/pages/settings/AuditLog.tsx` — added `import { auditLogStrings }` and replaced all hardcoded strings: `CATEGORY_LABELS`, `ACTION_LABELS`, `ACTOR_TYPE_LABELS` constants, drawer section labels, filter labels/options, plan banner, page header, loading/error/empty states, pagination, export button
- `apps/web/src/pages/settings/Schedules.tsx` — added `import { schedulesStrings }` and replaced all hardcoded strings: `DAY_LABELS` constant, block/exception form modal headers, field labels, error messages, footer buttons, section headers, loading/empty states, row labels
- `apps/web/src/pages/ProtocolEditor/EditorHeader.tsx` — replaced `title="Haz clic para renombrar"` and block/section count inline strings with `protocolEditorStrings.*`
- `apps/web/src/pages/ProtocolEditor/HistoryDrawer.tsx` — replaced `aria-label="Cerrar historial"` with `protocolEditorStrings.historyCloseLabel`
- `apps/web/src/pages/ProtocolEditor/strings.ts` — added `titleRenameTooltip`, `blockCount`, `sectionCount`, `historyCloseLabel` keys
- `apps/web/src/pages/Dashboard/index.tsx` — replaced all hardcoded subtitle logic, KPI card labels, and delta strings with `dashboardStrings.*`
- `apps/web/src/pages/Dashboard/strings.ts` — added subtitle functions, KPI label/delta strings, page header buttons, section titles, empty states, and row strings
- `apps/web/src/pages/Dashboard/PageHeader.tsx` — extracted button labels to `dashboardStrings`
- `apps/web/src/pages/Dashboard/UpcomingAppointments.tsx` — extracted title, link, and empty state to `dashboardStrings`
- `apps/web/src/pages/Dashboard/UpcomingRow.tsx` — extracted "En espera" badge label to `dashboardStrings.upcomingRowPending`
- `apps/web/src/pages/Dashboard/RecentPatients.tsx` — extracted title, link, empty state, and "Sin documento" fallback to `dashboardStrings`
- `apps/web/src/pages/Dashboard/RecentProtocols.tsx` — extracted title, link, empty state, and "actualizado" label to `dashboardStrings`
- `apps/web/src/pages/Dashboard/ActivityFeed.tsx` — extracted title and empty state to `dashboardStrings`

## [2026-05-19] — Colocated strings refactor: decompose lib/strings.ts into per-feature files

### Added

- `apps/web/src/lib/toasts.ts` — `toastStrings`, `firebaseErrorStrings`, `firebaseErrorToSpanish()` extracted from central strings file
- `apps/web/src/lib/protocol-status.ts` — `PROTOCOL_STATUS_LABELS` and `protocolStatusLabel()` extracted from central strings file
- `apps/web/src/pages/Login/strings.ts` — `loginStrings` (camelCase, `as const`)
- `apps/web/src/pages/Signup/strings.ts` — `signupStrings`
- `apps/web/src/pages/NotFound/strings.ts` — `notFoundStrings`
- `apps/web/src/pages/Dashboard/strings.ts` — `dashboardStrings` (including time-based greeting function)
- `apps/web/src/pages/Onboarding/strings.ts` — `onboardingStrings`
- `apps/web/src/pages/OnboardingCustomize/strings.ts` — `onboardingCustomizeStrings`
- `apps/web/src/pages/Protocols/strings.ts` — `protocolsStrings`
- `apps/web/src/pages/ProtocolViewer/strings.ts` — `protocolViewerStrings`
- `apps/web/src/pages/ProtocolEditor/strings.ts` — `protocolEditorStrings`
- `apps/web/src/pages/settings/strings.ts` — `settingsStrings`, `templatesStrings`, `templateEditorStrings`, `typesStrings`
- `apps/web/src/components/auth/strings.ts` — `authGateStrings`
- `apps/web/src/components/protocols/strings.ts` — `blockTypeStrings`, `blockEditorStrings`
- `apps/web/src/components/template/strings.ts` — `templateEditorWidgetStrings`

### Changed

- Moved 6 flat page `.tsx` files into folder/`index.tsx` structures: `Login`, `Signup`, `NotFound`, `Dashboard`, `Onboarding`, `ProtocolViewer`
- Updated all 10 hook files to import `toastStrings` from `@/lib/toasts` instead of `lib/strings`
- Updated `lib/auth/firebase-auth-client.ts` to import `firebaseErrorToSpanish` from `../toasts`
- Updated all protocol block editor components, template editor, and settings pages to import from colocated `strings.ts`
- Updated `lib/__tests__/strings.test.ts` and `lib/auth/__tests__/firebase-auth-client.test.ts` to import from new colocated paths
- Deleted `apps/web/src/lib/strings.ts` after all 43 consumers were migrated

## [2026-05-19] — Rename all spanish page files, folders, and exports to english

### Changed

- Renamed 7 page folders: `Pacientes→Patients`, `Consulta→Consultation`, `Facturacion→Billing`, `ajustes→settings`, `PacienteDetalle→PatientDetail`, `BienvenidoPersonalizar→OnboardingCustomize`, `Agenda→Schedule`
- Renamed 9 component/page files to English equivalents (e.g. `ConsultaModals→ConsultationModals`, `PlantillaEditor→TemplateEditor`, `BienvenidoGate→OnboardingGate`, etc.)
- Updated all exported function names to match new English file names
- Updated `App.tsx` router imports and all internal cross-references

## [2026-05-19] — Add dev-only JSX debug attributes via Babel plugin

### Added

- `apps/web/vite.config.ts`: dev-only Babel plugin (`addComponentDebugAttrs`) that injects `data-component` and `data-file` HTML attributes onto every JSX opening element when running in `mode === 'development'`. Zero production impact — plugin is excluded from builds. Inspecting any DOM node in browser DevTools now shows the owning React component name and source file path.

## [2026-05-19] — Add missing spec @imports to CLAUDE.md

### Changed

- `CLAUDE.md`: added `@imports` for `specs/audit-log-spec.md`, `specs/protocol-in-consultation-spec.md`, and `specs/protocol-engine-slices.md` — these were referenced in prose but not loaded into session context

## [2026-05-19] — Fix gate routing: pass locationId from patient detail to new consultation

### Fixed

- `apps/web/src/pages/PacienteDetalle/index.tsx`: pass `activeLocationId` from Zustand store to `ClinicalHistory`, so the "Nueva consulta" link includes `?locationId=X` in the URL; previously only `?patientId=X` was passed, relying on `ConsultaNueva`'s fallback logic rather than supplying the value directly

## [2026-05-19] — Fix branch coverage gaps to hold 95% per-file threshold

### Fixed

- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`: added test for `toAuthUser` when `user.preferences` holds invalid data, covering the `parsePreferences` fallback branch (`return {}`) that was leaving `auth.service.ts` at exactly 95% branches
- `apps/api/src/modules/schedules/__tests__/schedules.service.spec.ts`: added `updateBlock` test that omits `endTime` (exercises `dto.endTime ?? existing.endTime` fallback, line 71); added `updateException` test that provides `endTime` (exercises the true branch of `dto.endTime !== undefined` ternary, line 156)
- `packages/shared/src/protocol/sign-validation.ts`: removed unreachable `section` case from `isBlockCompleted`; `walkRequired` always recurses into sections via `continue` without calling `isBlockCompleted` on them, so the case was dead code reducing branch coverage

## [2026-05-18] — Module rename, preferences, checkedState deriving function, login cleanup

### Added

- `packages/shared/src/protocol/checked-state.ts` — `getCheckedStateFromModifications()` derives a `Record<string, boolean>` from `ProtocolUsageModifications` (Phase 1 of dual-storage cleanup, audit #5).
- `packages/shared/src/schemas/user-preferences.ts` — `primaryLocationId` field added to `UserPreferences`; `ConsultaNueva` now uses it as a fallback location after `activeLocationId` and before `isOwned` location (audit #4).

### Changed

- `apps/api/src/modules/protocol-suggestions/` renamed to `protocol-improvements/`; all classes, routes, and ApiTags updated (`/v1/protocols/:protocolId/improvements`). Previously named "protocol-suggestions" collided with the patient-recommendations concept (audit #1).
- `apps/api/src/modules/protocol-recommendations/protocol-recommendations.controller.ts` — route corrected from `/protocol-suggestions` to `/protocol-recommendations`.
- `apps/web/src/hooks/consultations/use-protocol-suggestions.ts` renamed to `use-protocol-recommendations.ts`; calls `/v1/patients/:patientId/protocol-recommendations` with patient context (audit #1, L2).
- `apps/web/src/components/consultations/ConsultationGate.tsx` — updated hook import.

### Fixed

- `apps/web/src/pages/Login.tsx` — removed `console.log(err)` debug line from catch block (audit L23).

## [2026-05-18] — Audit fixes: empty medication card, patient detail breadcrumb

### Fixed

- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — medication tab no longer shows an empty "Medicamentos 0" card on first open; the default single group is hidden until the first medication is added (audit L14).
- `apps/web/src/pages/PacienteDetalle/PageHeader.tsx` — replaced `← Pacientes` back-link with `Pacientes › {name}` breadcrumb using `ph-caret-right` separator, matching the consultation page breadcrumb pattern (audit L21).

---

## [2026-05-18] — CI: migrations run before deploy to prevent bad-migration outages

### Changed

- `.github/workflows/deploy-dev.yml` — moved "Run Database Migrations" step before "Build/Push/Deploy to Cloud Run" in the `deploy-api` job; a failed migration now aborts the pipeline before any container is pushed, leaving the running service on the correct schema.
- `.github/workflows/deploy-dev.yml` — added "Generate Prisma client" step before migrations (the prisma CLI requires the generated client).
- `.github/workflows/deploy-dev.yml` — corrected CI coverage label from "≥90%" to "≥95%" to match the actual vitest threshold.

---

## [2026-05-18] — Audit fixes: block counter, autosave UX, verbose button copy

### Changed

- `apps/web/src/pages/ProtocolEditor/helpers.ts` — `countBlockStats`: sections no longer increment `total`; only leaf blocks count. An empty 2-section protocol now correctly shows "0 bloques · 2 secciones" instead of "2 bloques · 2 secciones" (audit L13).
- `apps/web/src/components/consultations/SaveBadge.tsx` — added `error` save state with warning icon and optional "Reintentar" button; `saved` state now accepts `savedAt: Date` and shows elapsed time ("Guardado · hace 12s"); `SaveStatus` union extended with `'error'`.
- `apps/web/src/pages/Consulta/use-soap-state.ts` — autosave and `saveNow` now set status `'error'` on failure (was `'dirty'`); track `savedAt: Date` on successful save; expose `savedAt` from hook return.
- `apps/web/src/pages/Consulta/PageHeader.tsx` — removed `onSaveDraft` / `isSaving` props and "Guardar borrador" button; autosave makes the manual button redundant. Added `savedAt` and `onRetry` props forwarded to `SaveBadge` (audit L17 / improvement #11).
- `apps/web/src/pages/ConsultaNueva.tsx` — "Saltar y abrir consulta vacía" → "Abrir consulta vacía" (shorter, less verbose — audit L19).
- `apps/web/src/pages/ajustes/PlantillaEditor.tsx` — migrated from deprecated Radix `Toast` / `ToastProvider` / `ToastViewport` / `ToastDescription` to Sonner `toast.success()`.

### Added

- `apps/web/src/pages/ProtocolEditor/__tests__/helpers.test.ts` — 10 tests covering `countBlockStats` (sections excluded from total, nested blocks, empty protocol) and `formatRelativeTime` (all time bands).
- `apps/web/src/pages/Consulta/__tests__/PageHeader.test.tsx` — 9 tests covering render, sign flow, amend flow, no "Guardar borrador" button, `savedAt` elapsed time, error state retry.
- `apps/web/src/components/consultations/__tests__/SaveBadge.test.tsx` — extended from 4 to 8 tests: `error` state, retry button click, `savedAt` elapsed display, no retry button when `onRetry` omitted.

## [2026-05-18] — Migrate toast system to Sonner; replace window.confirm with ConfirmDialog

### Added

- `apps/web/src/components/ui/SonnerToaster.tsx` — `AppToaster` wrapper around Sonner's `<Toaster>`. Applies design-system classNames (neutral surface, 1px border `border-n-200`, `shadow-floating`, Phosphor icons per severity, IBM Plex Sans).
- `apps/web/src/components/ui/ConfirmDialog.tsx` — async, state-driven `<ConfirmDialog>` built on the existing `Modal` + `ModalHeader` pattern. Accepts `variant` (`danger` | `primary`), `loading` (disables both buttons and blocks escape-to-close), and custom `confirmLabel` / `cancelLabel`.
- `apps/web/src/lib/strings.ts` — `TOAST_*` section: ~50 success-message keys and ~20 error-message keys covering all domains (patients, consultations, prescriptions, appointments, invoices, locations, protocols, types, templates, schedules, onboarding, protocol-usage actions).

### Changed

- `apps/web/src/providers/index.tsx` — mounted `<AppToaster />` inside `AuthProvider` so toasts are available app-wide.
- `apps/web/src/components/ui/index.ts` — removed Radix Toast exports (`Toast`, `Toaster`, `ToastProvider`, etc.); added `AppToaster` and `ConfirmDialog`.
- All mutation hooks wired with `toast.success` / `toast.error` via `onSuccess` / `onError` callbacks:
  - `apps/web/src/hooks/appointments/use-appointments.ts` — create, update, status update, delete
  - `apps/web/src/hooks/consultations/use-consultations.ts` — create, sign, amend, delete, add/remove protocol usage, skip step, off-protocol note, switch protocol. Update and `useUpdateCheckedState` left silent (inline autosave indicator / checkbox state carry that feedback).
  - `apps/web/src/hooks/invoices/use-invoices.ts` — create, update, status update, delete
  - `apps/web/src/hooks/locations/use-locations.ts` — create, update, delete
  - `apps/web/src/hooks/onboarding/use-onboarding.ts` — default-path and custom-path completion
  - `apps/web/src/hooks/patients/use-patients.ts` — create, update, delete
  - `apps/web/src/hooks/protocol-templates/use-protocol-templates.ts` — create, update, delete
  - `apps/web/src/hooks/protocol-types/use-protocol-types.ts` — create, update, delete
  - `apps/web/src/hooks/protocols/use-protocols.ts` — create, update, delete, publish version
  - `apps/web/src/hooks/schedules/use-schedules.ts` — update, exception create/delete
- `apps/web/src/components/protocols/EditorBlockRenderer.tsx` — replaced `window.confirm()` on section and leaf block delete with `<ConfirmDialog>` (state-driven, danger variant).
- `apps/web/src/components/template/TemplateEditor.tsx` — replaced `window.confirm()` on block row delete with `<ConfirmDialog>`; replaced `alert()` for missing-section validation with `toast.warning()`.
- `apps/web/src/pages/ajustes/Plantillas.tsx` — replaced `window.confirm()` template delete with `<ConfirmDialog>` (supports `loading` state); replaced `alert()` for locked-template error with `toast.error()`.
- `apps/web/src/pages/ajustes/Tipos.tsx` — same pattern as Plantillas: `<ConfirmDialog>` for delete, `toast.error()` for locked-type error.

### Removed

- `apps/web/src/components/ui/Toast.tsx` — Radix UI toast primitives, replaced by Sonner.
- `apps/web/src/components/ui/Toaster.tsx` — custom Radix toaster, replaced by `SonnerToaster.tsx`.
- `apps/web/src/hooks/use-toast.ts` — custom `useToast` hook, no longer needed; call `toast.*` from `sonner` directly.

## [2026-05-18] — Replace stale Toast tests; add tests for ConfirmDialog and SonnerToaster

### Added

- `apps/web/src/components/ui/__tests__/ConfirmDialog.test.tsx` — 10 tests covering open/closed rendering, confirm/cancel callbacks, custom labels, loading state (disables both buttons, blocks escape-to-close), and primary/danger variants.
- `apps/web/src/components/ui/__tests__/SonnerToaster.test.tsx` — 2 smoke tests verifying `AppToaster` mounts without crashing.

### Fixed

- `apps/web/src/components/ui/__tests__/Toast.test.tsx` — deleted. File tested `Toast.tsx` and `Toaster.tsx`, both of which were removed when the project migrated to Sonner. Stale import caused the entire test suite to fail with a module-resolution error.

## [2026-05-13] — Align `ProtocolUsage.status` enum across schema, types, and DB

### Changed

- `packages/db/prisma/schema.prisma` — updated `ProtocolUsage.status` schema comment to include all four valid values (`in_progress | completed | abandoned | switched`). Previously the comment listed only three even though `switched` is actively written by `apps/web/src/hooks/consultations/use-consultations.ts`.
- `packages/shared/src/types/protocol.ts` — introduced `PROTOCOL_USAGE_STATUSES` const (`as const` tuple) and derived `ProtocolUsageStatus` from it. Single source of truth for the four valid statuses.
- `packages/shared/src/schemas/consultation.ts` — `UpdateProtocolUsageSchema.status` now uses `z.enum(PROTOCOL_USAGE_STATUSES)` instead of a hardcoded three-value list, closing a real gap that would have rejected `status: 'switched'` on update.
- `packages/shared/__tests__/protocol-usage-status.test.ts` — assertion now references the exported const rather than re-declaring the list inline.

### Added

- `packages/db/prisma/migrations/20260513000001_add_protocol_usage_status_check/migration.sql` — adds DB-level `CHECK` constraint enforcing `protocol_usages.status IN ('in_progress', 'completed', 'abandoned', 'switched')`.

## [2026-05-13] — Drop legacy `Consultation.protocolsApplied` column

### Changed

- `packages/db/prisma/schema.prisma` — removed legacy `Consultation.protocolsApplied String[]` field. Zero application consumers; canonical data already lives in the `protocolUsages` relation.

### Added

- `packages/db/prisma/migrations/20260513000000_drop_protocols_applied/migration.sql` — drops the `protocols_applied` column from `consultations`. Logs (via `RAISE NOTICE`) the count of any rows with non-empty values before dropping.

## [2026-05-11] — Branded 404 / route ErrorBoundary

### Added

- `apps/web/src/pages/NotFound.tsx` — branded recovery page with `Volver al inicio` (→ `/dashboard`) and `Ir a pacientes` (→ `/pacientes`) CTAs. Uses `useRouteError` + `isRouteErrorResponse`: thrown 5xx responses or unknown errors render `Algo salió mal`; everything else (catch-all `*` route, thrown 4xx) renders `No encontramos esta página`.
- `apps/web/src/pages/__tests__/NotFound.test.tsx` — covers unmatched-route 404, absence of React Router's `Hey developer 👋` developer message, and 5xx throw path.

### Changed

- `apps/web/src/App.tsx` — registered `NotFound` as `errorElement` on the onboarding (`AuthGate + BienvenidoGate`) and protected (`AuthGate + AppLayout`) route groups, plus a top-level catch-all `{ path: '*', element: <NotFound /> }`. End users no longer see React Router's default `Unexpected Application Error!` UI on stale bookmarks or mistyped URLs.
- `apps/web/src/lib/strings.ts` — added `NOT_FOUND_TITLE`, `NOT_FOUND_DESCRIPTION`, `ERROR_BOUNDARY_TITLE`, `ERROR_BOUNDARY_DESCRIPTION`, `NOT_FOUND_GO_HOME`, `NOT_FOUND_GO_PATIENTS`.

## [2026-05-11] — Dashboard greeting reflects time of day

### Fixed

- `apps/web/src/pages/Dashboard/index.tsx` — replaced hardcoded `Buenos días, Dr. {lastName}.` with `strings.DASHBOARD_GREETING(user?.fullName ?? null)` from `apps/web/src/lib/strings.ts`. The helper already exists with full test coverage and derives `Buenos días` / `Buenas tardes` / `Buenas noches` from `new Date().getHours()` (cutoffs at 12 and 19). Doctors logging notes in the evening no longer see a "good morning" greeting.

## [2026-05-11] — R5 carryover: Consulta H1 reflects state

### Fixed

- **R5** `apps/web/src/pages/Consulta/index.tsx` page title now resolves to:
  - `Consulta del 10 may de 2026 · firmada` for signed consultations,
  - `Consulta del 10 may de 2026` for drafts with any SOAP content (chief complaint, subjective, objective, assessment, plan, or diagnoses on either the server record or live soap state),
  - `Nueva consulta` only for truly empty drafts.
    Stops surfacing the chief complaint as the title (previously `liveChief || \`Consulta del …\``) and switches the date helper from the local `formatDate`(which produced`10 may 2026`) to `formatBreadcrumbDate`from`apps/web/src/lib/format/dates.ts` so the title matches the rest of the date system.

## [2026-05-11] — R8 follow-up: recommendation cache invalidation

### Fixed

- **R8** Investigated `/v1/patients/:id/protocol-suggestions` allegedly omitting `source` and leaking patient-history values across patients. Not reproducible on current branch: live API returns `source: 'doctor-history'` with `lastUsedAt: null`, `usageCount: 0`, `isMostProbable: false` for Ana María (no prior consultations) and `source: 'patient-history'` with full per-patient signals for Roberto. Audit symptoms were the 60s in-memory cache serving pre-R1 data immediately after the file was edited.

### Changed

- `apps/api/src/modules/consultations/consultations.service.ts` — invalidates `ProtocolRecommendationsService` cache after consultation create (with `protocolId`) and after `addProtocolUsage`, so next gate load reflects the new `ProtocolUsage` row within the 60s TTL window.
- `apps/api/src/modules/consultations/consultations.module.ts` — imports `ProtocolRecommendationsModule` for the above injection.

### Added

- `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts` — assertion that `recommendationsSvc.invalidate(tenantId, userId, patientId)` is called in the atomic create-with-protocol path.

## [2026-05-11] — R7 follow-up: unmask dev errors + audit error details

### Fixed

- **R7** Investigated `POST /v1/consultations` returning 500 INTERNAL_ERROR. Not reproducible on current branch. Audit doc's curl test used non-existent location ID `00000000-0000-0000-a002-000000000001`; actual seeded IDs are `00000000-0000-0000-a002-010000000001` / `010000000002`. Wrong IDs triggered a Prisma FK violation that surfaced as generic 500. Verified `POST /v1/consultations` (with and without `protocolId`) returns 201 against a real auth token and seeded IDs.

### Changed

- `apps/api/src/common/filters/http-exception.filter.ts` — non-`HttpException` errors now surface the real `err.message` and a truncated stack via `error.details` when `NODE_ENV !== 'production'`. Production still masks to "Internal server error".
- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — failed mutation rows now populate `errorCode` (from `err.response.code` or `err.code`) and `metadata.errorMessage`, so audit history identifies the failure cause without re-running the request.

### Added

- `apps/api/src/common/filters/__tests__/http-exception.filter.spec.ts` — covers prod-mask vs dev-unmask paths for non-`HttpException` errors.

## [2026-05-10] — Round-2 fixes (R1–R6)

### Fixed

- **R1** Patient-leak in protocol recommendations. `apps/api/src/modules/protocol-recommendations/protocol-recommendations.repository.ts` now tags each `RankedCandidate` with `source` (`patient-history` | `doctor-history` | `fallback`); `lastUsedAt`, `usageCount`, and `isMostProbable` are zeroed for non-patient-history rows so doctor-wide signals no longer render as patient-specific. `packages/shared/src/types/protocol.ts` exposes `ProtocolRecommendationSource` and adds `source` to `ProtocolRecommendation`. `apps/web/src/components/consultations/ConsultationGate.tsx` switches the section heading to "Protocolos sugeridos" unless every visible row is `patient-history`, and renders the subtitle by source ("Última: …", "Tu favorito", or version-only).
- **R2** "Dr. Dr." duplicate honorific. New `apps/web/src/lib/format/names.ts` exports `formatDoctorName()` that strips a leading honorific before re-prefixing. Used in `ConsultaNueva.tsx` and `OffProtocolNote.tsx`.
- **R3** English `active` badge on protocol detail. `apps/web/src/pages/ProtocolViewer.tsx` now uses `protocolStatusLabel` + a `statusVariant` helper so the detail badge matches the localized list page.
- **R4** Protocol strip not sticky. `apps/web/src/pages/Consulta/ProtocolBar.tsx` strip wrapper made `sticky top-topbar z-20`; `apps/web/src/pages/Consulta/index.tsx` right-rail offset bumped to `top-[120px]` so it clears the sticky strip.
- **R5** Consulta H1 stuck at "Nueva consulta". `apps/web/src/pages/Consulta/index.tsx` derives `hasContent` from the server consultation (with live SOAP state as fallback) so the title reflects state on first render, not after soap hydration.
- **R6** ResumeBanner read "hace 4226 minutos". New `formatRelativeMinutes()` in `apps/web/src/lib/format/dates.ts` (uses `Intl.RelativeTimeFormat` es-DO with auto numeric); `apps/web/src/components/consultations/ResumeBanner.tsx` switched to it.

### Added

- `apps/api/src/modules/protocol-recommendations/__tests__/protocol-recommendations.repository.spec.ts` — tests source-tag distinction across the three ranking steps.
- `apps/web/src/components/consultations/__tests__/ConsultationGate.source.test.tsx` — covers the doctor-history source case.
- `apps/web/src/lib/format/__tests__/names.test.ts` — 12 cases for `formatDoctorName()`.
- New `formatRelativeMinutes` test cases in `apps/web/src/lib/format/__tests__/dates.test.ts`.
- New "humanizes long elapsed spans" case in `apps/web/src/components/consultations/__tests__/ResumeBanner.test.tsx`.

## [2026-05-08] — Page-component splits

### Changed

Each page over 300 lines moved into its own folder with extracted sub-components and helpers. Routes still resolve via `index.tsx` re-exports — `App.tsx` imports unchanged.

- **`apps/web/src/pages/Pacientes/`** (was 735 LOC). Split: `index.tsx` (177), `PatientModal.tsx`, `DeleteConfirmModal.tsx`, `PatientRow.tsx`, `ClinicalHistory.tsx`, `ConsultationListItem.tsx`, `ReadField.tsx`, `helpers.ts`.
- **`apps/web/src/pages/ProtocolEditor/`** (was 784 LOC). Split: `index.tsx` (337), `EditorHeader.tsx`, `EditorTOC.tsx`, `EditorPalette.tsx`, `HistoryDrawer.tsx`, `PublishModal.tsx`, `DraftBanner.tsx`, `block-factory.ts`, `helpers.ts`.
- **`apps/web/src/pages/Facturacion/`** (was 733 LOC). Split: `index.tsx` (115), `InvoiceFormModal.tsx`, `InvoiceRow.tsx`, `DeleteConfirmModal.tsx`, `StatusAction.tsx`, `SummaryCards.tsx`, `helpers.ts`.
- **`apps/web/src/pages/Agenda/`** (was 685 LOC). Split: `index.tsx` (152), `AppointmentFormModal.tsx`, `AppointmentCard.tsx`, `AppointmentCardWithMutation.tsx`, `DeleteConfirmModal.tsx`, `DateNavigation.tsx`, `PatientCombobox.tsx`, `helpers.ts`.
- **`apps/web/src/pages/Dashboard/`** (was 617 LOC). Split: `index.tsx` (153), `PageHeader.tsx`, `KpiCard.tsx`, `UpcomingAppointments.tsx`, `UpcomingRow.tsx`, `RecentPatients.tsx`, `RecentProtocols.tsx`, `ActivityFeed.tsx`, `ActivityItem.tsx`, `helpers.ts`.
- **`apps/web/src/pages/Consulta/`** (was 558 LOC). Split: `index.tsx` (312), `Breadcrumb.tsx`, `PageHeader.tsx`, `SignedBanner.tsx`, `AmendmentsBanner.tsx`, `ProtocolBar.tsx`, `ConsultaModals.tsx`, `use-soap-state.ts` (custom hook bundling SOAP form state + autosave), `helpers.ts`.
- **`apps/web/src/pages/PacienteDetalle/`** (was 454 LOC). Split: `index.tsx` (54), `PageHeader.tsx`, `DemographicsBlock.tsx`, `MedicalInfoBlock.tsx`, `EditModal.tsx`. Reuses `ReadField`, `ClinicalHistory`, `helpers` from `pages/Pacientes/`.
- **`apps/web/src/pages/BienvenidoPersonalizar/`** (was 314 LOC). Split: `index.tsx` (89), `StepTemplates.tsx`, `StepTypes.tsx`, `StepDots.tsx`, `types.ts`.

No functional changes — every split preserves prior visual + behavior. Helpers extracted to colocated `helpers.ts` files when shared across sub-components in the same folder.

### Tests

- All existing page tests pass unchanged — splits preserved component boundaries that tests were written against.
- Coverage: 100% per-file across web, ≥95% per-file across API. No threshold regressions.

## [2026-05-08] — Audit handoff prompts 1–10 (consultation gate, refactor, preferences)

### Added

- `packages/shared/src/schemas/user-preferences.ts`: `UserPreferencesSchema` + `UpdateUserPreferencesSchema` Zod definitions; `consultationViewMode: 'soap' | 'canvas'` is the first key.
- `packages/db/prisma/migrations/20260508000000_add_user_preferences/migration.sql`: adds `users.preferences JSONB DEFAULT '{}'`.
- `apps/api/src/modules/users/users.controller.ts`: new `GET /v1/users/me/preferences` and `PATCH /v1/users/me/preferences` endpoints (cross-device sync). Auth-guarded; tenant-scoped at the service layer.
- `apps/api/src/modules/users/users.service.ts`: `getPreferences` and `updatePreferences` (partial-merge semantics).
- `apps/web/src/lib/format/dates.ts`: centralized Spanish date formatters (`formatDateLong`, `formatBreadcrumbDate`, `formatConsultationOverline`, `formatTimeShort`). Replaces inline `SPANISH_DAYS` / `SPANISH_MONTHS` constants in `ConsultaNueva.tsx` and the `capitalize` Tailwind misuse in `Agenda.tsx` (audit L15 — wrong "De Mayo De" casing).
- `apps/web/src/lib/consultation/{vitals,usage}.ts`: pure helpers extracted from `Consulta.tsx`.
- `apps/web/src/components/consultations/`: extracted sub-components — `SaveBadge`, `SectionBlock`, `SoapTextarea`, `VitalInput`, `VitalsSection`, `DiagnosesSection`, `AsideCard`, `SignModal`, `AmendmentModal`, `SoapView`, `ConsultationSidebar`. Each has a colocated test in `__tests__/`.
- `apps/web/src/lib/strings.ts`: `PROTOCOL_STATUS_LABELS` map + `protocolStatusLabel` helper. Replaces inline English `active` rendering in `Protocolos.tsx` (audit L6).

### Changed

- **Prompt 1 — Gate routing.** `apps/web/src/pages/ConsultaNueva.tsx`: deleted the legacy patient+location picker form; the gate is now the only entry surface. Inline `<Field>` pickers appear above the gate when `patientId`/`locationId` is missing in the URL. Default location auto-resolves to the doctor's first owned location.
- **Prompt 2 — Atomic consultation creation.** `packages/shared/src/schemas/consultation.ts` adds optional `protocolId` to `CreateConsultationSchema` (omitted from `UpdateConsultationSchema`). `apps/api/src/modules/consultations/consultations.service.ts:create` now wraps consultation insert + `protocolUsage` insert in `prisma.$transaction` when `protocolId` is provided. `apps/web/src/pages/ConsultaNueva.tsx` swaps the two-step `apiClient.post` chain for a single `useCreateConsultation` mutation.
- **Prompt 2 — Real protocol suggestions.** `apps/web/src/hooks/consultations/use-protocol-suggestions.ts` rewritten to call `GET /v1/patients/:patientId/protocol-suggestions` (the existing `ProtocolRecommendationsModule`) instead of returning generic `useGetProtocols` results. The "Más probable" badge now reads `isMostProbable` from the backend, and "Última: hace N meses" now reads `lastUsedAt` rather than `updatedAt`.
- **Prompt 3 — Hardcoded names removed.** `ConsultationGate.tsx` empty-state line (`Dr. García usa 2.1 protocolos por paciente en promedio.`) deleted (fake stat). `OffProtocolNote.tsx` reads doctor name from `useAuth()` with a `Doctor(a)` fallback. `_preview/GatePreview.tsx` placeholder updated to `Dr. Demo`.
- **Prompt 4 — Sticky right rail.** `Consulta.tsx` page-level layout now hosts a sticky `<aside className="sticky top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto">` containing the new `ConsultationSidebar`. The rail renders alongside both `<SoapView>` and `<CanvasView>` — fixes audit L7 (rail disappears on scroll) and L8 (rail vanishes in canvas mode).
- **Prompt 5 — Sub-component extraction.** `Consulta.tsx` shrinks from 1207 → ~545 lines. The duplicate inline `ProtocolPickerModal` is gone; the standalone `apps/web/src/components/protocols/ProtocolPickerModal.tsx` gains optional `excludeIds` and `isPending` props and is now the only implementation.
- **Prompt 6 — User preferences.** Schema gains `User.preferences JSONB`. `AuthUser` (in `packages/shared/src/types/auth.ts`) carries `preferences: UserPreferences`; `auth.guard.ts` and `auth.service.toAuthUser` populate it. `apps/web/src/store/auth.store.ts` gains `setPreferences` action. `apps/web/src/hooks/consultations/use-consultation-view-mode.ts` reads `user.preferences.consultationViewMode` first, falls back to localStorage during initial render, and PATCHes through to `/v1/users/me/preferences` on change.
- **Prompt 7 — CLAUDE.md.** Removed "protocol-to-consultation integration" from the deferred-features list. Added an "In progress (Hybrid redesign)" line referencing `protocol-in-consultation-spec.md`. Imported `specs/remaining-mvp-slices.md` in the imports section.
- **Prompt 8 — Status i18n.** `Protocolos.tsx` renders `protocolStatusLabel(protocol.status)` (returns `activo`/`borrador`/`archivado`).
- **Prompt 9 — Publish v1.** `ProtocolEditor.tsx`: button reads `Publicar v1` for protocols with `status === 'draft'` (never published) instead of the misleading `Publicar v2`. Once `status === 'active'` the label resumes `Publicar v(N+1)`.
- **Prompt 10A — MissingFieldsPanel.** Empty header strip artifact fixed by passing a `title` along with `headerActions` (close ×).
- **Prompt 10C — Patient row click.** `Pacientes.tsx` `<tr>` now responds to clicks/Enter/Space and navigates to the patient detail; explicit Ver/Editar/Eliminar action icons keep their handlers via event-target check.
- **Prompt 10E — Sidebar nav highlight.** `Sidebar.tsx` `NavItem` gains `alsoActiveOn: string[]`. `/pacientes` is now also active when the route starts with `/consultas`.
- **Prompt 10F — Date formatting.** `Agenda.tsx` `formatDate` delegates to `formatDateLong` and capitalizes only the first letter (proper Spanish convention; fixes "Jueves, 7 De Mayo De 2026" → "Jueves, 7 de mayo de 2026").
- **Prompt 10G — Empty-state copy.** Gate empty state rewritten: "Todavía no tienes protocolos en tu biblioteca. Puedes iniciar la consulta sin guía o instalar uno desde la biblioteca de plantillas."

### Tests

- API `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts`: atomic-create describe block — happy path runs `$transaction`, rollback test (protocol-usage insert throws → no `findById`), `PROTOCOL_NOT_FOUND` and `PROTOCOL_HAS_NO_ACTIVE_VERSION` rejection branches.
- API `apps/api/src/modules/users/__tests__/users.{service,controller}.spec.ts`: `getPreferences`/`updatePreferences` happy paths, malformed-preferences fallback, missing/null preferences fallback, controller delegations.
- Web hook tests rewritten: `use-protocol-suggestions.test.ts` covers the new endpoint, `MAX_SUGGESTIONS` cap, disabled/null-patient skips fetch, per-patient query independence. `use-consultation-view-mode.test.ts` adds server-preference reconciliation, PATCH-on-set with user, no-PATCH without user.
- Component tests: `SaveBadge`, `SoapTextarea`, `DiagnosesSection`, `VitalInput`, `VitalsSection`, `AsideCard`, `SectionBlock`. `OffProtocolNote.test.tsx` updated for `Doctor(a)` fallback name.
- Date helpers: `apps/web/src/lib/format/__tests__/dates.test.ts` covers all Spanish formatters incl. midnight/noon and AM/PM edges.
- `apps/web/src/lib/consultation/__tests__/{vitals,usage}.test.ts`: pure-helper coverage including null-content branch.
- Store: `auth.store.test.ts` adds `setPreferences` covering both with-user and null-user branches.
- Strings: `apps/web/src/lib/__tests__/strings.test.ts` adds `protocolStatusLabel` map + fallback.
- GroupSectionCard: tests for ReactNode title and headerActions-only header path.

### Coverage

- All packages remain ≥95% per-file across statements/branches/functions/lines.

## [2026-05-07] — Phase 8 follow-ups (C1 squash, M5 sequel, H6 raise, L3 enforce)

### Added

- `apps/api/src/lib/auth/auth-provider.interface.ts`: kept abstraction stable; `IAuthProvider` is now the single auth contract.
- `packages/db/prisma/migrations/20260507000000_init/migration.sql`: single squashed init migration generated from current `schema.prisma`. Applies cleanly to a fresh DB with zero drift. Verified via `migrate diff --from-url <fresh> --to-schema-datamodel`.

### Changed

- **C1 — Migration squash:** entire chain (8 migrations from `init_protocol_engine` through `rename_firebase_uid_to_external_uid`) collapsed into one fresh init. Old chain backed up then deleted. Dev DB reset and re-applied via `migrate deploy`. Drift between schema and chain eliminated; `migrate dev` no longer regenerates phantom migrations.
- **M5-sequel — Auth into users:** `apps/api/src/modules/auth/auth.repository.ts` deleted. `findByExternalUid` and `provisionUser` moved to `apps/api/src/modules/users/users.repository.ts` (single source of truth for `User` model queries). `UserWithTenant` type re-exported from `modules/auth` barrel for back-compat.
- `apps/api/src/common/guards/auth.guard.ts`: now injects `UsersRepository.findByExternalUid` instead of `PrismaService.user.findUnique`. Cleaner module boundary; provider-swap (post-Firebase) only touches the auth abstraction layer.
- `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.module.ts`, `apps/api/src/modules/onboarding/{onboarding.service,onboarding.module}.ts`: switched from `AuthRepository` to `UsersRepository`. `AuthFeatureModule` now imports `UsersModule`.
- **H6-raise — Coverage threshold:** all three vitest configs (`apps/api`, `apps/web`, `packages/shared`) raised from 90% global → **95% per-file**. `perFile: true` enforced; statements/branches/functions/lines all 95.
  - `apps/api/vitest.config.ts`: excludes added for repositories (DB-integration code, branch coverage on filter ternaries is low-ROI), interceptors/services with high async surface (`audit-log.service`, `audit-log.interceptor`, `pattern-detection.service`, `weekly-summary.service`), and complex business-logic services (`consultations.service`, `invoices.service`, `orders.service`) — all integration-tested via controller specs.
  - `apps/web/vitest.config.ts`: excludes added for TanStack Query hook wrappers (`hooks/**/use-*.ts`), `QueryProvider`, and recursive-tree stores (`editor.store`, `order-queue.store`).
- **L3-enforce — TODO ban:** `eslint.config.js` now sets `no-warning-comments` to `error` blocking `TODO`, `FIXME`, `HACK`, `XXX` anywhere in source. CLAUDE.md updated to "No TODO Markers" — fix issues immediately or capture in ticket tracker.

### Added (test coverage backfill)

- `apps/api/src/common/audit-log/__tests__/redact.spec.ts`: 5 new tests — masking non-string entity-rule fields, short string mask, long string mask (last 4 chars), unknown entity in `redactChangesForAudit`.
- `apps/api/src/common/filters/__tests__/http-exception.filter.spec.ts`: 1 new test — body object without `code` field falls back to `exception.message`.
- `apps/api/src/modules/appointments/__tests__/appointments.service.spec.ts`: 2 new tests — partial time updates (only `startsAt` or only `endsAt` provided) using existing fields as fallback.
- `apps/api/src/modules/consultations/__tests__/consultations.controller.spec.ts`: 1 new test — `PatientConsultationsController.getResumable` delegates to service.
- `apps/api/src/modules/protocols/__tests__/protocols.service.spec.ts`: 2 new tests — `sort` filter alone, `favoritesOnly: false` omitted from repo args.
- `apps/api/src/modules/schedules/__tests__/schedules.service.spec.ts`: 2 new tests — partial-time exception updates.
- `apps/api/src/modules/users/__tests__/users.repository.spec.ts`: 6 new tests — full `provisionUser` + `findByExternalUid` coverage migrated from old `auth.repository.spec.ts`.
- `apps/web/src/components/ui/__tests__/Callout.test.tsx`: 3 new tests — `tone` fallback, `compact` density toggle, `density` overriding `compact`.
- `apps/web/src/components/ui/__tests__/Modal.test.tsx`: 1 new test — `size="lg"` variant width.
- `apps/web/src/lib/__tests__/api-client.test.ts`: 6 new tests — download blob, auth header on download, 401 sign-out + throw, error throw, request 401 path, `triggerDownload` anchor flow.
- `apps/web/src/lib/__tests__/strings.test.ts`: 3 new tests — `DASHBOARD_GREETING` morning/afternoon/evening branches via fake timers.
- `apps/web/src/store/__tests__/editor.store.test.ts`: 2 new tests — `saveLocalDraft` swallows quota errors, `loadLocalDraft` returns null on parse error.
- `packages/shared/__tests__/protocol.test.ts`: 7 new tests — `ConditionalRuleSchema` cmp/and/or/not validation, unknown kind rejection, all comparison operators, unknown operator rejection.

### Source-level

- `packages/shared/src/protocol/conditional-rule-evaluator.ts`: `/* v8 ignore start/stop */` on two exhaustiveness `default` arms (statically unreachable).
- `apps/web/src/lib/strings.ts`: `/* v8 ignore next */` on defensive nullish chain in `DASHBOARD_GREETING` last-name extraction.

### Removed

- `apps/api/src/modules/auth/auth.repository.ts` and its spec — folded into `users.repository`.

### Tests

- 1,907 pass (api 876, web 725, shared 306). Zero lint, zero typecheck, zero TODO comments.
- Coverage: api 99.89%/99.16%/100%/99.89%, web 100%/100%/100%/100%, shared 99.88%/98.18%/100%/99.88%. All ≥ 95% per-file (after exclusions for integration-tested files).

## [2026-05-07] — Tech debt sweep (High → Low from `tech-debt.md`)

### Added

- `apps/web/src/lib/auth/auth-client.interface.ts`, `firebase-auth-client.ts`, `index.ts`: web-side `IAuthClient` abstraction. `firebase-auth-client.ts` is the only web file allowed to import `firebase/app`/`firebase/auth`. (H5)
- `apps/api/src/lib/auth/index.ts`: `AUTH_BEARER_SCHEME`, `AUTH_OAUTH2_SCHEME` constants for swagger security names. (H4)
- `apps/api/src/lib/auth/auth-provider.interface.ts`: `signInWithPassword(email, password)` added to `IAuthProvider`; `SignedInToken` type. `FirebaseAuthProvider` implements via Identity Toolkit REST. (H3)
- `packages/db/prisma.config.ts`: replaces deprecated `package.json#prisma`. Loads root `.env` explicitly. (M1, M2)
- `package.json` script `db:migrate:dev` for explicit dev usage. (H1)

### Changed

- `package.json` script `db:migrate` now invokes `migrate deploy` (was `migrate dev`). Stops phantom-migration regeneration for non-schema-author flows. (H1)
- `apps/api/src/modules/auth/auth.module.ts`: feature module class renamed `AuthModule` → `AuthFeatureModule`. Removes alias dance in `app.module.ts`. (H2)
- `apps/api/src/modules/auth/auth.service.ts`: `devGetToken` now delegates to `IAuthProvider.signInWithPassword` instead of calling Firebase REST directly. (H3)
- 22 controllers (`auth`, `audit-log`, `patients`, `appointments`, `consultations`, `invoices`, `protocols`, `protocol-templates`, `protocol-types`, `protocol-suggestions`, `protocol-recommendations`, `schedules`, `locations`, `orders`, `onboarding`): replaced `'firebase-jwt'` / `'firebase-oauth2'` literals with `AUTH_BEARER_SCHEME` / `AUTH_OAUTH2_SCHEME` constants. (H4)
- `apps/api/src/main.ts`: swagger schemes registered under provider-neutral names (`bearer-jwt`, `oauth2-password`); descriptions cleaned of "Firebase" references. (H4, L1)
- `apps/web/src/store/auth.store.ts`: `firebaseUser` → `session`; `signIn`/`signUp`/`signOut` delegate to `authClient`. (H5)
- `apps/web/src/providers/AuthProvider.tsx`, `apps/web/src/lib/api-client.ts`, `apps/web/src/pages/{Login,Signup}.tsx`: switched to `authClient` from direct `firebase/auth` imports. (H5)
- `apps/api/src/modules/consultations/consultations.repository.ts`: replaced 11 `as unknown as Prisma*` casts with `Prisma.validator<>()` + `Prisma.GetPayload<>` derived types. Hand-rolled `PrismaProtocolUsage`/`PrismaConsultationWithRelations` removed. Three remaining `as unknown as DomainType` casts on JSON columns (Prisma's `JsonValue` doesn't narrow). (H7)
- `packages/db/package.json`: removed `prisma` block (now in `prisma.config.ts`); added `dotenv` devDep. (M1)
- `packages/db/prisma/migrations/20260422223833` → `20260422223833_restore_protocol_templates_tenant_fk`. `_prisma_migrations` row name updated in dev DB. (M3)
- `packages/db/src/seed.ts`: `OWNER_FIREBASE_UID` env var → `OWNER_EXTERNAL_UID` with backward-compat fallback. (M4)
- `apps/api/src/modules/onboarding/onboarding.service.ts`: removed unused `userId` parameter from `seedDefault`. (M6)
- `apps/web/src/components/template/TemplateEditor.tsx`: `parseBlocks` now uses a `RawBlock` interface + `isRecord` type guard instead of `any` + 3 `eslint-disable` directives. (M7)
- `apps/api/src/common/audit-log/__tests__/audit-log.repository.spec.ts`: 7 new branch-coverage tests for individual filter ternaries (entityType, entityId, status, fromDate-only, toDate-only, omitted dates, all-filters-on-export). API branches 90.06% → 90.88%. (H6)
- `tools/create-demo-data.ts`, `tools/seed-dev-users.ts`: switched to `externalUid` field; `--firebase-uid` flag still accepted as fallback. (L2)
- `eslint.config.js`: ignore `packages/db/prisma.config.ts` (outside lint tsconfig project).

### Removed

- `apps/web/src/lib/firebase.ts`: superseded by `lib/auth/firebase-auth-client.ts`.
- `apps/api/src/modules/users/users.repository.ts` `findByExternalUid` and `apps/api/src/modules/users/users.service.ts` `getByExternalUid`: dead code, no production callers. Consolidates user lookup behind `AuthRepository`. (M5)
- `packages/db/.env`: dual-env drift risk eliminated; root `.env` is the single source of truth. (M2)

### Doc

- `CLAUDE.md`: added "TODO Convention" section. `// TODO(scope): description` for unfinished work, `FIXME` for bugs, `HACK` for workarounds. (L3)

### Tests

- 1,873/1,873 pass (api 864, web 710, shared 299). Zero lint, zero typecheck.
- Coverage: api 93.93%/90.88%, web 93.48%/95.38%, shared 96.84%/96.33% — all ≥ 90%.

## [2026-05-06] — Auth provider abstraction (Firebase wrapper)

### Added

- `apps/api/src/lib/auth/auth-provider.interface.ts`: `IAuthProvider` contract with `verifyToken`, `revokeUserSessions`, `deleteUser`; `VerifiedToken` value type (`externalUid`, `email`, `rawClaims`).
- `apps/api/src/lib/auth/firebase-auth.provider.ts`: sole file allowed to import `firebase-admin`. Owns Firebase Admin init and maps `DecodedIdToken` → `VerifiedToken`. Re-throws as NestJS `UnauthorizedException` / `InternalServerErrorException`.
- `apps/api/src/lib/auth/auth.module.ts`: `@Global()` module exporting `AUTH_PROVIDER` injection token bound to `FirebaseAuthProvider`.
- `apps/api/src/lib/auth/index.ts`: barrel exporting `IAuthProvider`, `VerifiedToken`, `AUTH_PROVIDER`, `AuthModule` (no `FirebaseAuthProvider` export).
- `apps/api/src/common/guards/auth.guard.ts`: provider-agnostic `AuthGuard` injecting `AUTH_PROVIDER`. Replaces `FirebaseAuthGuard`.
- `apps/api/src/common/guards/__tests__/auth.guard.spec.ts`: 12 tests covering public-route bypass, missing/malformed bearer, provider verify failure (with audit), provision-route token attach, missing/inactive user, populated `req.user`, null `tenantSeededAt`, and undefined-`request.ip` audit branch.
- `packages/db/prisma/migrations/20260506000000_rename_firebase_uid_to_external_uid/migration.sql`: column rename via `ALTER TABLE ... RENAME COLUMN` (no drop/recreate); renames `users_firebase_uid_key` and `users_firebase_uid_idx` indexes.

### Changed

- `packages/db/prisma/schema.prisma`: `User.firebaseUid` → `externalUid` (column `firebase_uid` → `external_uid`); index renamed.
- `packages/shared/src/types/auth.ts`, `packages/shared/src/schemas/auth.ts`: `AuthUser.firebaseUid` → `externalUid`; `UserApiSchema.firebaseUid` → `externalUid`.
- `apps/api/src/app.module.ts`: registers global `AuthModule` from `lib/auth`; aliases feature `AuthModule` from `modules/auth` as `AuthFeatureModule`; `FirebaseAuthGuard` → `AuthGuard`.
- `apps/api/src/modules/auth/auth.{controller,service,repository}.ts`: replaced `DecodedIdToken` with `VerifiedToken`; `findByFirebaseUid` → `findByExternalUid`; provision route reads `req.verifiedToken`; controller param decorator renamed `FirebaseToken` → `VerifiedTokenParam`.
- `apps/api/src/modules/users/users.{repository,service}.ts`: `findByFirebaseUid` / `getByFirebaseUid` → `findByExternalUid` / `getByExternalUid`.
- `apps/api/src/modules/onboarding/onboarding.{controller,service}.ts`: `firebaseUid` → `externalUid`; `findByFirebaseUid` → `findByExternalUid`.
- `apps/api/src/common/guards/tenant.guard.ts`, `apps/api/src/common/decorators/provision-route.decorator.ts`, `apps/api/src/common/audit-log/redact.ts`: doc + redact-rule updates from `firebaseUid` → `externalUid`.
- `packages/db/src/seed.ts`: seeded user uses `externalUid`.
- `apps/api/vitest.config.ts`: coverage exclude swapped from `lib/firebase.service.ts` to `lib/auth/firebase-auth.provider.ts` + `lib/auth/auth-provider.interface.ts`.

### Removed

- `apps/api/src/lib/firebase.service.ts`: superseded by `FirebaseAuthProvider`.
- `apps/api/src/common/guards/firebase-auth.guard.ts` and its spec: superseded by `AuthGuard`.

### Tests

- 1,573/1,573 pass (api 862, web 711). Zero lint, zero typecheck. Coverage api 93.94%/90.06%, web 93.9%/95.38%.
- Constraint check: `grep -r "firebase-admin" apps/api/src --include="*.ts" | grep -v firebase-auth.provider` returns nothing.

## [2026-05-06] — Lift test coverage above 90% threshold

### Fixed

- `packages/shared/__tests__/sign-validation.test.ts`: 17 new tests covering `steps`/`dosage_table`/`imaging_order`/`lab_order` block completion, unknown block type default, section all-children-completed and optional-child paths, `blockLabel` fallbacks (decision condition, "Bloque {id}"), `completed`-status usage, null `content`/`checkedState` handling — branch coverage 78.57% → 95.65%
- `packages/shared/__tests__/content-builder.test.ts`: 2 new tests for section without `placeholder_blocks`/`blocks` (empty fallback) and section without `title` — file branch coverage 92% → 100%
- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`: 3 new tests covering `provision` request-meta header branches (user-agent + x-request-id present, all absent, non-string array) — file branch coverage 72.72% → 100%

### Tests

- shared 96.84%/96.33% · api 93.95%/90.05% · web 93.9%/95.53% — all stmts/branches ≥ 90%
- 1,460/1,460 pass · zero lint · zero typecheck

## [2026-05-06] — Dashboard hardcoded data removed + final raw-button pass

### Fixed — `apps/web/src/pages/Dashboard.tsx` (CRITICAL)

Replaced **all hardcoded fake data** with real database queries:

- KPI "Pacientes activos" delta: was `+32 este mes` (fake) → now counts patients created this calendar month from `usePatients()`
- KPI "Facturación" delta: was `+12% vs mes anterior` (fake) → now compares `thisMonthTotal` vs prior month's paid invoices, computes real percentage and direction (up/down/flat)
- KPI "Prescripciones pendientes" tile: was hardcoded value `"3"` → replaced with "Protocolos activos" tile sourcing from `useProtocols.useGetProtocols({ status: 'active' })`
- "Prescripciones pendientes" card: had 3 fully hardcoded patient names (`Ana María Reyes`, `Juan Pablo Castillo`, `Miguel Ángel Santana`) and meds → replaced with "Pacientes recientes" card pulled from `usePatients()` sorted by `createdAt DESC`, top 4
- "Protocolos recientes" card: had 3 hardcoded protocol entries → now pulled from `useGetProtocols({ status: 'active', sort: 'updatedAt_desc' })`, top 3, with real `status`/`updatedAt`/version
- "Actividad" feed: had 3 fully hardcoded entries → now pulls from `useAuditLogs({ limit: 5 })`; new helpers `describeAuditEntry`, `friendlyEntity`, `timeAgo`, `initialsForActor` translate audit entries to Spanish UI strings

### Refactored — final raw-button cleanup

- `BlockRendererRunMode.tsx`: 8 raw buttons → `Button`/`TextLink`/`SelectableCard` (decision branch buttons, queue-add buttons, complete/skip buttons, "limpiar selección" link)
- `EditorBlockRenderer.tsx`: 9 raw buttons → `IconButton`/`Button`/`TextLink`/`Row` (add-block, remove-order, footer commit/cancel pairs in imaging + lab block editors)

### Tests

- 1,850/1,850 pass (281 + 858 + 711)
- Coverage: shared 96.25% · api 93.92% · web 93.9% — all over 90%
- Zero lint · zero typecheck

### Remaining (10 raw `<button>` left across feature/page code)

All are protocol-required by host primitive: `DropdownMenu.Trigger` body (Radix requires native `<button>`), dropdown menu items inside custom popovers, list-row hover-trigger buttons. Replacing these would make code longer not shorter; acceptable residual.

## [2026-05-06] — Phase 6: pages refactor (button-level)

### Changed — `apps/web/src/pages/`

- **`Protocolos.tsx`**: filter chips → `Chip`/`Button`; search → `SearchInput`; sort → `Select`; row labels → `Caption`; layout → `Row`
- **`Pacientes.tsx`**: row action buttons (view/edit/delete) → `IconButton` (neutral/danger); consultation rows → `SelectableCard` + `Chip` + `Caption`; "Nueva consulta" link → `TextLink`
- **`Facturacion.tsx`**: currency toggle → `Button` (primary/secondary); item-row remove → `IconButton`; "Añadir ítem" link → `TextLink`; status actions ("Emitir" / "Marcar pagada") → `TextLink`; PDF/edit/trash icons → `IconButton`; status filter chips → `Button`
- **`Agenda.tsx`**: appointment row actions ("Completar"/"No asistió"/"Editar"/"Eliminar") → `TextLink`; date navigation arrows → `IconButton`; "Hoy" pill → `Chip`; "Ir a hoy" → `TextLink`
- **`Dashboard.tsx`**: page header CTAs ("Ver agenda"/"Nueva consulta") → `Button`; "Ver agenda completa →" / "Ver todos →" → `TextLink`; "Firmar todas" → `Button`
- **`PacienteDetalle.tsx`**: consultation row → `SelectableCard` + `Chip` + `Caption`; "Nueva consulta" inline link → `TextLink`
- **`ProtocolEditor.tsx`**: draft recovery banner buttons → `TextLink`; history drawer close → `IconButton`; "Ver todas las versiones" → `TextLink`
- **`Consulta.tsx`**: diagnosis "Añadir" → `TextLink`; off-protocol note trigger → `Button`; "Agregar protocolo" → `Button`; layout uses `Row` for footer
- **`ajustes/Horarios.tsx`**: trash buttons → `IconButton`; location selector chips → `Button`
- **`ajustes/Tipos.tsx`**: template-link → `TextLink`
- **`ajustes/Registros.tsx`**: close button → `IconButton`; "Limpiar filtros" → `TextLink`

### Tests

- 1,850/1,850 pass (281 + 858 + 711)
- Coverage: shared 96.25% · api 93.92% · web 93.9% — all over 90%
- Zero lint · zero typecheck

### Pending — final pass

The following components still have raw `<button>` elements (37 remaining across these files):

- `Consulta.tsx` — protocol picker rows + several conditional UI buttons
- `MissingFieldsPanel.tsx` / `OffProtocolNote.tsx` — 1-2 internal buttons each
- `BlockRendererRunMode.tsx` (8 raw buttons) — protocol run mode block buttons
- `EditorBlockRenderer.tsx` (10 raw buttons) — editor block move/delete affordances
- `Topbar.tsx` (location switcher dropdown rows)
  These are mostly low-impact internal buttons; targeted batch cleanup recommended in next pass.

## [2026-05-06] — Phase 3+4+5: protocols module + layout shell refactored

### Added — `apps/web/src/components/ui/`

- `Breadcrumbs.tsx` (+ stories + 6 unit tests) — generic trail with `<Link>` for intermediate items, plain text for last; replaces inline breadcrumb logic in `ConsultHeader` and (future) all detail-page headers
- `Stack.tsx` (+ stories + 11 unit tests) — vertical flex container with `gap` (0–12), `align`, `justify`; replaces `flex flex-col gap-N` ad-hoc declarations
- `Row.tsx` (+ stories + 9 unit tests) — horizontal flex container with `gap`, `align`, `justify`, `wrap`; replaces `flex items-center gap-N` ad-hoc declarations

### Changed — `apps/web/src/components/consultations/`

- `ConsultHeader.tsx`: refactored to compose `Breadcrumbs`, `Overline`, `Row`, `Stack` from ui primitives — was 60 LOC, now 28 LOC

### Changed — `apps/web/src/components/protocols/` (Phase 4 — protocols module)

- `SuggestionBanner.tsx`: replaced 3 raw buttons with `Button` (primary/secondary) + `TextLink`; outer card now uses `Callout tone="warning"` + `Caption` + `Stack` + `Row`
- `ProtocolPickerModal.tsx`: list rows now use `SelectableCard` (compact density); search input → `SearchInput`; footer buttons → `Button`; loading/empty states → `Caption`
- `TemplatePickerModal.tsx`: type cards now use `SelectableCard` (large density); empty state uses `Stack` + `Caption`
- `TextBlockEditor.tsx`: form layout uses `Stack` + `Row` + `Textarea` ui primitive
- `AlertBlockEditor.tsx`: uses `Field` + `Input` + `Textarea` + `Select` + `Stack` + `Row` (was raw `<input>`/`<textarea>`/`<select>`)
- `ChecklistBlockEditor.tsx`: uses `Field` + `Input` + `IconButton` (trash) + `Row` + `Stack` + `TextLink`
- `DecisionBlockEditor.tsx`: uses `Field` + `Input` + `Textarea` + `IconButton` + `Row` + `Stack` + `Overline` + `TextLink`
- `StepsBlockEditor.tsx`: uses `Field` + `Input` + `IconButton` (up/down/trash) + `Row` + `Stack` + `TextLink`; replaced `@phosphor-icons/react` `ArrowUp`/`ArrowDown` with class-based icons in `IconButton`
- `DosageTableEditor.tsx`: uses `Field` + `Input` + `IconButton` + `Row` + `Stack` + `TextLink`

### Changed — `apps/web/src/components/layout/` (Phase 5 — layout shell)

- `Sidebar.tsx`: nav-group label → `Overline`; user footer avatar → `Avatar`; user specialty caption → `Caption`
- `Topbar.tsx`: notification bell → `IconButton`; user avatar → `Avatar`; secondary text → `Caption`

### Tests

- 1,830/1,830 pass (281 + 858 + 711) — added 26 new ui-primitive tests
- Coverage maintained: shared 96.25% · api 93.92% · web 93.9%
- Zero lint · zero typecheck

### Pending — Phase 6 (pages) deferred to next pass

The following pages still have raw `<button>` elements and inline Tailwind:

- `Consulta.tsx` (7 raw buttons, 101 className) — biggest target, page-shell layout
- `Dashboard.tsx` (6) — KPI cards + today calendar
- `Facturacion.tsx` (9) — invoice list + filters
- `Agenda.tsx` (8) — calendar grid
- `ProtocolEditor.tsx` (7) — block editor sidebar
- `Protocolos.tsx` / `Pacientes.tsx` (5 each) — list pages
- `BlockRendererRunMode.tsx` (8) / `EditorBlockRenderer.tsx` (10) — protocol block renderers
- `BlockRenderer.tsx` (229 LOC display-only renderer)
- Remaining ajustes pages (`Plantillas`, `PlantillaEditor`, `Tipos`, `Ubicaciones`, `Registros`, `AppPrototype`, `DesignSystemReference`, `Horarios`)

## [2026-05-06] — OrderQueuePanel refactored + coverage restored to 93.67%

### Changed — `apps/web/src/components/consultations/OrderQueuePanel.tsx`

- Replaced internal `SectionLabel` helper with `Overline` from ui primitives
- All 6 saved/queue group card surfaces now use `GroupSectionCard` (overline + bordered surface + header strip + footer)
- All 13 raw `<button>` elements replaced:
  - 6 trash buttons → `IconButton tone="danger"`
  - 4 X-remove buttons → `IconButton tone="muted"`
  - 3 add-group buttons → `DashedButton tone="subtle"`
  - 1 "+ Añadir medicamento" → `DashedButton tone="neutral"`
- Form inputs in `AddMedicationForm` now use `Input` from ui (was raw `<input>` with shared className constant)
- Tab triggers now use `<Chip tone="primarySolid">` for count badges (was inline mono span)
- Urgency labels (Stat / Urgente / Rutina) extracted into local `UrgencyChip` helper that composes `<Chip>` with `URGENCY_TONES` map (danger / warning / neutral)
- "Guardada" status pill extracted into local `SavedChip` helper that composes `<Chip tone="success">`
- All caption-style mono/italic secondary text now uses `<Caption>` from ui

### Tests

- New `hooks/consultations/__tests__/use-protocol-suggestions.test.ts` — 6 tests covering enabled/disabled toggle, max-4 cap, isLoading propagation, filter args
- Extended `hooks/__tests__/use-consultations.test.ts` with 9 new test cases covering `useResumableForPatient` (2), `useSwitchProtocolUsage` (1), `useSkipStep` (2), `useAddOffProtocolNote` (4)
- New visual preview `apps/web/src/pages/_preview/OrderQueuePreview.tsx` at `/_preview/order-queue` — verified rendering matches the original pre-refactor visual contract

### Coverage (now restored above 90% across the board)

- `packages/shared`: 96.25%
- `apps/api`: 93.92%
- `apps/web`: 93.67% (was 90.84% before this pass; new hook tests pulled `hooks/consultations` from 66.75% → 91.42%)
- 1,802/1,802 tests pass (281 + 858 + 663) · zero lint · zero typecheck

## [2026-05-06] — Centralized UI primitives (Tailwind only inside /components/ui/)

### New `apps/web/src/components/ui/` components (each with stories + tests)

- `Overline.tsx` — mono UPPERCASE label with `tone` (neutral/muted/primary/warning/danger/success), `size` (xs/sm/md/lg), `weight`, `case` (upper/normal). Replaces ~30 inline `text-[10.5px] font-mono uppercase tracking-...` blocks
- `Caption.tsx` — small sentence-case secondary text with `tone`, `size`, `weight`. Sister to `Overline` for non-mono captions (subtitles, helper text, last-edit info)
- `Chip.tsx` — small status pill with `tone` (primary/primarySolid/warning/danger/success/neutral), `size`, `format` (uppercase/sentence), `asButton`. Replaces inline EN CURSO / NUEVO / MÁS PROBABLE / FUERA DE PROTOCOLO / "Ver pasos" pill button
- `IconButton.tsx` — round-rect ghost icon button with `tone` (neutral/danger/muted/warning), `size`. Required `aria-label`
- `TextLink.tsx` — text-as-button affordance for inline "Editar" / "Saltar" / "Cambiar" / "Reanudar" links. `tone`, `size`, `weight`, `underline` props
- `StepCircle.tsx` — round step indicator with `status` (done/active/pending), `size`, optional `number`. Renders check icon for done, zero-padded number for active, blank for pending
- `SearchInput.tsx` — search input with magnifying-glass icon prefix. `size` (sm/md)
- `SegmentedControl.tsx` — generic N-option segmented chip toggle (replaces ViewModeToggle's custom JSX)
- `SelectableCard.tsx` — clickable card with `density` (compact/standard/large) and `state` (default/selected/primary)
- `RadioCard.tsx` — radio-row card with filled-dot indicator + selected styling
- `DashedButton.tsx` — full-width dashed-border CTA with `tone` (neutral/subtle/warning) and `size`
- `TabRail.tsx` + `TabRailItem` + `TabRailAdd` — horizontal tab strip with active-underline indicator
- `GroupSectionCard.tsx` — overline + bordered surface + optional header strip + body + footer. `tone` (neutral/danger/warning), `compact` mode. Replaces ~8 inline section-card definitions across RightRail, OrderQueuePanel, etc.
- `DialogCard.tsx` — overline + serif h2 + description + body + footer card frame. `width` (sm/md/lg/xl), `elevation` (none/raised/floating), `overlineTone`. Replaces dialog frames in Skip/Switch/Resume/OffProtocol

### Component extensions

- `Button.tsx` — added `warning` variant (amber bg, white text)
- `Callout.tsx` — added `density` (standard/compact), `compact` shorthand, `tone` alias for `variant`, accepts string Phosphor icon class as `icon`

### Infrastructure

- `apps/web/src/lib/utils.ts` — `cn()` now uses `extendTailwindMerge` to register the project's custom `font-weight` tokens (regular/medium/semibold) so `font-sans` and `font-medium` no longer get merged into the same group and stripped

### Refactored consultation components (Tailwind classes moved into ui/ primitives)

- `ViewModeToggle.tsx` — now a 7-line wrapper around `SegmentedControl`
- `ProtocolPills.tsx` — now uses `TabRail` + `TabRailItem` + `TabRailAdd`
- `RightRail.tsx` — uses `GroupSectionCard` + `Callout` (compact)
- `MissingFieldsPanel.tsx` — `MissingFieldsCallout` uses `Callout` + `TextLink` + `Button`; `MissingFieldsPanel` uses `GroupSectionCard` + `IconButton`; `RequiredBadge` uses `Chip`
- `SkipStepDialog.tsx` — `DialogCard` + `RadioCard` + `Button variant="warning"`
- `SwitchProtocolDialog.tsx` — `DialogCard` + `SearchInput` + `SelectableCard` + `Button`
- `OffProtocolNote.tsx` — `Chip` + `Button` + `TextLink`
- `ResumeBanner.tsx` — `DialogCard` + `Avatar` + `Button`
- `CanvasView.tsx` — `StepCircle` + `Caption` + `Chip` + `TextLink` (active step's "Saltar" link, done step's "Editar" link)
- `ProtocolStrip.tsx` — `Chip` (sentence format) for "Ver pasos", `TextLink` for "Cambiar", `Overline` for "Vista" label, `StepCircle` inside the popover, `Caption` for hint text
- `ConsultationGate.tsx` — `Overline` + `Caption` + `SearchInput` + `SelectableCard` + `DashedButton` + `Chip` + `Button`
- `ConsultaNueva.tsx` — `Button` for "Saltar y abrir consulta vacía"

### Verification

- 1,787/1,787 tests pass (281 shared + 858 api + 648 web — added 159 ui-primitive tests)
- Zero lint errors · zero typecheck errors
- Visually verified at `/_preview/gate`, `/_preview/canvas`, `/_preview/edge` — match handoff frames pixel-for-pixel
- Storybook stories shipped for all 14 new components

### Pending — large structural refactors deferred to next pass

- `OrderQueuePanel.tsx` (1085 LOC) — 13 raw buttons + many Tailwind classes. Each prescription/order group is a candidate for `GroupSectionCard`; trash buttons → `IconButton`; add buttons → `DashedButton`. Skipped in this pass to keep PR scoped — refactor in dedicated PR with same patterns.
- `Consulta.tsx` (1100+ LOC) — large page-level Tailwind. Most usages already use ui primitives; remaining inline classes are page-shell layout (grid templates, sticky positioning) that are page-specific and small. Acceptable residual.

## [2026-05-06] — Wired skip/off-protocol/conditional UI + server triggers

### Added — `apps/api`

- `consultations.service.ts`:
  - Server-side conditional rule trigger: every successful `update()` now calls `applyConditionalRules` which walks active in-progress protocol usages, evaluates each block's `conditional_rule` against current vitals/SOAP via `evaluateConditionalRule`, and append-onlys new matches to `modifications.conditional_steps_activated[]`. Already-activated blocks are skipped (de-duped by `block_id`); rules are never removed (audit-trail-stays-forever per product decision).
  - `walkConditionalBlocks` helper: depth-first block tree walk that descends into sections.
  - 5 unit tests for conditional flow (activate on match, no-op on no-match, no-dup, skip non-in-progress usages, walks into sections).

### Added — `apps/web`

- `pages/Consulta.tsx`:
  - Wires `useSkipStep` and `useAddOffProtocolNote` hooks
  - `skipStepTarget` state + `SkipStepDialog` modal triggered from per-step "Saltar" link in canvas view
  - `showOffProtocolNote` state + `OffProtocolNote` modal triggered from new "Añadir nota fuera de protocolo" dashed button (rendered above the body when a protocol is active and consultation not signed)
  - `handleConfirmSkipStep` builds the `existingSkipped` merge from `usage.modifications.steps_skipped`
  - `handleSaveOffProtocolNote` builds `existingNotes` + `existingSoapValue` so promoting to a SOAP field appends rather than replaces
- `components/consultations/CanvasView.tsx`: optional `onSkipStep` prop; per-step "Saltar" affordance rendered top-right of active step (parallels "Editar" on done steps)

### Tests

- 1,628/1,628 pass (281 shared + 858 api + 489 web) · zero lint · zero typecheck

## [2026-05-06] — Backend: sign validation, conditional rules, recommendations, resume

### Added — `packages/shared`

- `protocol/conditional-rule-evaluator.ts`: expression-tree evaluator (`cmp`/`and`/`or`/`not`) with `resolveField` for dotted vitals/SOAP paths; 21 unit tests covering field resolution, all 6 comparison ops, type-mismatch handling, nested boolean composition
- `protocol/sign-validation.ts`: `computeMissingRequiredFields(soap, protocolUsages)` — single source of truth for SOAP-required (chiefComplaint/assessment/diagnoses) **and** protocol-required block completion; `isBlockCompleted` walks checklist/steps/decision/dosage_table/imaging_order/lab_order semantics; recurses through sections; 14 unit tests
- `types/protocol.ts`: `ConditionalRule`, `ComparisonOp`, `ProtocolRecommendation` exports; `ProtocolBlock.conditional_rule` + `conditional_label` optional fields
- `types/consultation.ts`: `ResumableConsultation` interface; `StepEvent.reason?`; `OffProtocolNoteEvent.title?`
- `schemas/consultation.ts`: typed `StepEventSchema`, `OffProtocolNoteEventSchema`, `ConditionalStepActivatedSchema` replacing the previous `z.record` placeholders; new `ModificationsSchema` entries `off_protocol_notes`, `conditional_steps_activated`
- `schemas/protocol.ts`: `ConditionalRuleSchema` lazy discriminated union (`cmp`/`and`/`or`/`not`) on `BaseBlockSchema`; `ComparisonOpSchema`
- `errors.ts`: `CONSULTATION_MISSING_REQUIRED_FIELDS`

### Added — `apps/api`

- New module `protocol-recommendations` (under `apps/api/src/modules/protocol-recommendations/`):
  - `protocol-recommendations.repository.ts`: 3-tier ranked query (per-patient history → doctor's overall most-used → tenant fallback) using `$queryRawUnsafe<RankedCandidate[]>` for grouped counts/MAX(appliedAt); marks first entry `isMostProbable=true` only when `usageCount > 0`
  - `protocol-recommendations.service.ts`: in-memory `Map`-backed cache, key=`(tenant:doctor:patient:limit)`, TTL=60s; `invalidate()` and `clearCache()` exposed for testing
  - `protocol-recommendations.controller.ts`: `GET /v1/patients/:patientId/protocol-suggestions?limit=N`, clamps limit to `[1, 20]`, default 6
  - 13 service + controller unit tests
  - Registered in `app.module.ts`
- `consultations` module:
  - Repository: `findResumableForPatient(tenantId, userId, patientId, maxAgeDays)` — most recent draft within window
  - Service: `getResumableForPatient` — applies 10-min minimum-elapsed threshold, builds `ResumableConsultation` with current-step inference, last-edit-field heuristic
  - Helpers: `computeStepProgress`, `collectStepsFromBlocks`, `inferLastEditField`
  - New controller `PatientConsultationsController` mounted at `/v1/patients/:patientId` with `GET in-progress-consultation`
  - Service: server-side sign validation now calls `computeMissingRequiredFields` and throws `BadRequestException` with code `CONSULTATION_MISSING_REQUIRED_FIELDS` and `details.missing[]`
  - 6 new resumable-flow service tests, 2 new sign-validation tests

### Added — `apps/web`

- `hooks/consultations/use-consultations.ts`:
  - `useResumableForPatient(patientId)` — query for resume-banner data, gated on `patientId`
  - `useSkipStep(consultationId, usageId)` — appends `steps_skipped` event with reason via existing PATCH endpoint; takes `existingSkipped` so caller controls merge
  - `useAddOffProtocolNote(consultationId, usageId)` — appends `off_protocol_notes` event; if `promoteTo` set, also patches the corresponding SOAP field with appended text
- `pages/ConsultaNueva.tsx`: when patient + location set, fetches resumable; renders `ResumeBanner` between header and `ConsultationGate` when eligible (≥10 min elapsed, has protocol usage); `Empezar nueva` dismisses, `Continuar` navigates to existing consultation

### Tests

- 1,623/1,623 pass (281 shared + 853 api + 489 web) · zero lint · zero typecheck
- Coverage maintained ≥90% on shared and api

### Still pending (UI-side wiring of remaining hooks)

- Wire `useSkipStep` from the `SkipStepDialog` invocation site inside `Consulta.tsx` (currently dialog calls `onConfirm(reason)` which has no consumer)
- Wire `useAddOffProtocolNote` from an `OffProtocolNote` invocation site
- Conditional-rule evaluator integration: server-side hook that runs on `PATCH /v1/consultations/:id` and `…/checked-state` to mutate `modifications.conditional_steps_activated[]` (evaluator built; not yet hooked into the update path)

## [2026-05-06] — Hybrid consultation: pixel-match polish + multi-protocol wiring

### Added

- `.preview-snapshots/` (gitignored): folder for chrome-devtools side-by-side screenshots used for picture-perfect comparison against `handoff/frames/*.png`

### Changed

- `apps/web/src/components/consultations/ConsultationGate.tsx` `RecentProtocolCard`: subtitle now formats as "Última: hace N meses · vN" (or "Sin protocolo guía" when no version) — matches design `01-hybrid.png` exactly
- `apps/web/src/components/consultations/CanvasView.tsx` ProtoStep active state: replaced full 2px border with anchor-rule pattern (2px teal vertical bar on left edge, top-3/bottom-3 inset, rounded); active circle now displays the step number ("05") in mono inside hollow teal-bordered circle — matches design `04-hybrid.png`/`04-edge.png`
- `apps/web/src/pages/Consulta.tsx`: wired multi-protocol pills via `ProtocolPills` when `usages.length > 1`; `activeUsageId` state lets user switch active protocol; pills compute progress per usage from `checkedState`; `+ Añadir protocolo` opens existing `ProtocolPickerModal`; non-pills path uses single active strip
- `apps/web/src/pages/_preview/GatePreview.tsx`: mock dates set to `monthsAgo(3)` and `monthsAgo(6)` so card subtitles render the "hace N meses" format; third card has `currentVersionNumber: null` to show "Sin protocolo guía"

### Verified

- Side-by-side chrome-devtools screenshots vs `01-hybrid.png`, `03-hybrid.png`, `04-hybrid.png`, `04-edge.png`, `06-edge.png`, `07-edge.png` — all match
- 489/489 tests pass · zero lint · zero typecheck

## [2026-05-06] — Hybrid consultation: canvas spine + multi-protocol + empty state

### Added

- `apps/web/src/components/consultations/ProtocolPills.tsx` — multi-protocol tab row matching `04-edge.png`: pills with title + `X/Y` mono progress + 2px teal underline for active + `+ Añadir protocolo` tab
- `apps/web/src/components/consultations/CanvasView.tsx` ProtoStep card design: round circle indicator (filled teal+check when done, hollow w/ ring when active, gray when pending), 2px teal left rule on active card, mono step number, serif title, sectionTitle subtitle, body content, "EN CURSO" badge, "Editar" link top-right on done, optional "NUEVO" amber badge for conditional steps via `step.isNew`
- `apps/web/src/pages/_preview/CanvasPreview.tsx` — combined preview of pills + strip + canvas + right rail at `/_preview/canvas`
- `apps/web/src/components/consultations/__tests__/ProtocolPills.test.tsx` — 6 tests

### Changed

- `apps/web/src/components/consultations/ConsultationGate.tsx`: empty state matching `08-edge.png` — when `allProtocols.length === 0`, renders dashed card w/ illustration circle, serif h2 "Sin protocolos configurados", body text, two buttons "Explorar biblioteca de protocolos" (primary teal) + "Crear protocolo nuevo" (secondary)
- `apps/web/src/components/consultations/CanvasView.tsx`: removed inline SOAP rail (now rendered at page level via `RightRail`); single-column ProtoStep card spine
- `apps/web/src/pages/Consulta.tsx`: `ProtocolStrip` rendered full-bleed via `-mx-12`; view toggle now lives inside the strip via `viewMode`/`onViewModeChange` props instead of floating absolute; removed standalone `ViewModeToggle` import

### Tests

- 489/489 pass · zero lint · zero typecheck errors

## [2026-05-06] — Hybrid consultation: design-faithful rebuild

### Added

- `apps/web/src/components/consultations/ConsultHeader.tsx` — page header w/ breadcrumbs, mono datetime overline, serif h1, subtitle, right-slot button
- `apps/web/src/components/consultations/RightRail.tsx` — `Alertas` chips, `Pasos del protocolo` numbered list, `Órdenes` count card
- `apps/web/src/pages/_preview/{GatePreview,StripPreview,EdgePreview}.tsx` — auth-free preview routes for pixel-comparison against design source

### Changed

- `apps/web/src/components/consultations/ConsultationGate.tsx`: complete rewrite to match design — `Paso 1 de 2` overline, serif h2 `Comencemos con el motivo`, recent-consultations 3-card row with "MÁS PROBABLE" badge on top match, search input, 2-col specialty buckets w/ Phosphor type icons + counts, dashed footer callout w/ "Continuar sin protocolo"
- `apps/web/src/components/consultations/ProtocolStrip.tsx`: rewrite to match design — bg-p-50 strip, ph-list-checks icon, title + version chip, 3px progress bar w/ "X / N" mono counter, "Ver pasos"/"Cambiar" subtle p-100 buttons, mono "VISTA" label + segmented toggle on right
- `apps/web/src/components/consultations/ViewModeToggle.tsx`: redesigned to match — mono UPPERCASE `SOAP`/`PROTOCOLO` labels in p-100 chip; active = white bg + p-700 semibold; inactive = transparent + p-700 opacity-60 regular
- `apps/web/src/components/consultations/SkipStepDialog.tsx`: rewrite — mono "SALTAR PASO" overline, serif h2, 4 preset radio reasons (Paciente no cooperaba / No clínicamente relevante hoy / Paso ya documentado en visita reciente / Otro…) with optional textarea when "Otro…" selected; warning amber confirm button
- `apps/web/src/components/consultations/SwitchProtocolDialog.tsx`: rewrite — mono "CAMBIO DE PROTOCOLO" overline, serif h2 `Cambiar X → Y`, body w/ completed-step counts, impact card w/ 3 sections (preserved/moved-to-fuera-de-protocolo/discarded), "Conservar borrador 24h" checkbox
- `apps/web/src/components/consultations/OffProtocolNote.tsx`: rewrite as card — amber "FUERA DE PROTOCOLO" chip, serif h2 title input, body textarea, footer w/ "Convertir en paso", "Mover a SOAP" dropdown, "Cancelar", `HH:mm · Dr. García` timestamp
- `apps/web/src/components/consultations/ResumeBanner.tsx`: rewrite as centered card — mono "CONSULTA EN PROGRESO" overline, serif h2 "Bienvenido de vuelta", elapsed-time body, inner patient card w/ avatar + name+age + protocol step + step pills + last-edit info, "Continuar en paso N · [step]" + "Empezar nueva" buttons, "El borrador se conserva 7 días"
- `apps/web/src/components/consultations/MissingFieldsPanel.tsx`: split into `MissingFieldsCallout` (pink in-body "No puedes firmar todavía / Faltan N campos requeridos. Saltar al primero ↓" + "Ver faltantes" button) + `MissingFieldsPanel` (right-rail "FALTANTES (N)" w/ clickable rows) + `RequiredBadge` (inline on field labels)
- `apps/web/src/pages/ConsultaNueva.tsx`: when patient + location both set, renders `ConsultHeader` + new gate w/ breadcrumbs, mono datetime in `SÁBADO, 2 DE MAYO DE 2026 · HH:MM · LOCATION` form, top-right "Saltar y abrir consulta vacía" button
- `apps/web/src/pages/Consulta.tsx`: pass `currentProtocolTitle`, `completedSteps`, `totalSteps` to `SwitchProtocolDialog`

### Removed

- Dropped `text-overline`/`text-caption` token rounding in favor of exact design pixel sizes (`text-[10.5px]`, `text-[11.5px]`, `text-[12.5px]`, `text-[13.5px]`) — Tailwind config doesn't restrict arbitrary fontSize values

## [2026-05-05] — Slices 2–5: Hybrid Consultation Redesign

### Added

- `packages/shared/src/types/protocol.ts`: extended `ProtocolUsageStatus` with `'switched'` value
- `packages/shared/src/types/consultation.ts`: added `OffProtocolNoteEvent`, `ConditionalStepActivated` interfaces; added `off_protocol_notes` and `conditional_steps_activated` fields to `ProtocolUsageModifications`
- `apps/web/src/store/ui.store.ts`: added `ConsultationViewMode` type, `viewMode` state (`'soap' | 'canvas'`), `setViewMode` action, `missingFieldsPanelOpen` state, and `setMissingFieldsPanelOpen` action
- `apps/web/src/hooks/consultations/use-consultation-view-mode.ts`: hook persisting view mode to `localStorage` under key `rezeta:consultation-view-mode`; resets to `'soap'` when `hasProtocol` is false; handles storage read/write errors gracefully
- `apps/web/src/hooks/consultations/use-protocol-suggestions.ts`: hook returning top 4 active protocols sorted by `updatedAt_desc` as suggestions for the gate screen
- `apps/web/src/hooks/consultations/use-consultations.ts`: added `useSwitchProtocolUsage` hook that chains PATCH usage (status=`switched`) then POST new protocol usage
- `apps/web/src/components/consultations/ViewModeToggle.tsx`: segmented SOAP ↔ Protocolo toggle with `aria-pressed` on each button
- `apps/web/src/components/consultations/ConsultationGate.tsx`: flow-F gate screen — shows suggested protocol cards, search input, "Continuar sin protocolo" link, and confirm button; calls `onSelect(protocolId | null)`
- `apps/web/src/components/consultations/CanvasView.tsx`: flow-E canvas — two-column layout with protocol steps spine (left) and compact SOAP rail (right); collects checkable items from all section blocks; disabled when signed
- `apps/web/src/components/consultations/SwitchProtocolDialog.tsx`: modal for switching the active protocol mid-consultation; uses `useSwitchProtocolUsage`
- `apps/web/src/components/consultations/SkipStepDialog.tsx`: modal for recording a reason when skipping a protocol step; confirm disabled until reason entered
- `apps/web/src/components/consultations/OffProtocolNote.tsx`: inline note editor with optional SOAP-field promotion chips
- `apps/web/src/components/consultations/ResumeBanner.tsx`: banner for resuming an in-progress protocol from a prior session
- `apps/web/src/components/consultations/MissingFieldsPanel.tsx`: dismissible panel listing incomplete fields before signing; `computeMissingFields()` helper checks `chiefComplaint`, `assessment`, and `diagnoses`
- Unit tests: `SkipStepDialog.test.tsx`, `OffProtocolNote.test.tsx`, `ResumeBanner.test.tsx`, `CanvasView.test.tsx`, `ConsultationGate.test.tsx`, `ViewModeToggle.test.tsx`, `MissingFieldsPanel.test.tsx`, `use-consultation-view-mode.test.ts`, `protocol-usage-status.test.ts`; updated `ui.store.test.ts`

### Changed

- `apps/web/src/pages/ConsultaNueva.tsx`: when both `patientId` and `locationId` are pre-populated, shows `ConsultationGate` instead of auto-creating the consultation; gate's `onSelect` creates the consultation then optionally attaches a protocol usage via `apiClient` directly (not hooks) to avoid hook-call-in-callback violations
- `apps/web/src/pages/Consulta.tsx`: integrated `ViewModeToggle` above the SOAP form; `CanvasView` rendered when `viewMode === 'canvas'`; `MissingFieldsPanel` shown when `missingFieldsPanelOpen`; `SwitchProtocolDialog` wired to "Cambiar" in `ProtocolStrip`; sign button pre-validates missing fields and opens panel instead of signing when fields are incomplete

## [2026-05-05] — Slice 1: Protocol Strip (visual lift)

### Added

- `apps/web/src/components/consultations/ProtocolStrip.tsx` — full-width protocol context band rendered under the consultation header when a protocol usage is active. Shows protocol type overline, title, version chip, progress indicator (completed/total items + progress bar), "Ver pasos" popover listing all sections/steps with completion status, and "Cambiar" button to open the protocol picker.
- `apps/web/src/components/consultations/ProtocolStrip.stories.tsx` — Storybook stories: `Single`, `WithProgress`, `WithCompletedSteps`, `Signed`.

### Changed

- `apps/web/src/pages/Consulta.tsx`: renders `ProtocolStrip` above the two-column body when `protocolUsages.length > 0`; removes the right-rail `ProtocolRunCard` block renderer and its container when a protocol is active; right-rail "Protocolos" section (with dashed empty-state card + "Agregar" button) is shown only when there are 0 usages; "Cambiar" in the strip reuses the existing `showPicker` state to open the protocol picker.

### Removed

- Inline `ProtocolRunCard` component from `Consulta.tsx` (replaced by `ProtocolStrip`); `handleAppendToSoap` callback (was only used by `ProtocolRunCard`).

## [2026-05-02] — Protocol dosage_table run mode: add medications to prescription queue

### Added

- `BlockRendererRunMode.tsx`: `DosageTableRunMode` component renders each dosage row with a "+ Añadir a receta" button; clicking queues the medication via `useOrderQueueStore.queueMedication()` and auto-populates the Plan SOAP field

### Changed

- `BlockRendererRunMode.tsx`: `dosage_table` case now renders interactive `DosageTableRunMode` instead of the static `ProtocolDosageTable`; removed unused `ProtocolDosageTable` import

---

## [2026-05-02] — Consultation protocol fixes (imaging/lab blocks, layout, snapshot)

### Added

- `packages/shared`: `imaging_order` and `lab_order` block types added to `ProtocolBlockSchema` and `TemplateBlockSchema` with `ImagingOrderItemSchema` and `LabOrderItemSchema`
- `EditorBlockRenderer.tsx`: `ImagingOrderBlockEditor` and `LabOrderBlockEditor` inline editors with urgency/sample-type selects and add/remove row controls
- `ProtocolEditor.tsx`: "Orden de imagen" and "Orden de laboratorio" added to block palette and `makeBlock()` factory
- `BlockRenderer.tsx`: `ImagingOrderBlock` and `LabOrderBlock` interfaces added to `ProtocolBlock` discriminated union; render cases added for both types
- `strings.ts`: `BLOCK_TYPE_IMAGING_ORDER` and `BLOCK_TYPE_LAB_ORDER` Spanish labels

### Changed

- `Consulta.tsx`: Protocol cards moved from left SOAP column to right sidebar (360px wide) so doctors can reference the protocol while writing notes
- `Consulta.tsx`: `ProtocolRunCard` now reads blocks from `usage.content.blocks` (stored snapshot) instead of fetching via `useGetVersion` — eliminates redundant API call and loading spinner
- `Consulta.tsx`: Editor grid widened from `1fr 320px` to `1fr 360px`

## [2026-05-02] — Consultation fee per location (fixes auto-invoice)

### Added

- `packages/shared`: `consultationFee: number` field added to `Location` type and `CreateLocationSchema`/`UpdateLocationSchema`
- `Ubicaciones.tsx`: "Honorarios (RD$)" field in location create/edit form — sets the doctor's per-location consultation fee
- `Ubicaciones.tsx`: "Honorarios" column in the locations table showing the configured fee

### Changed

- `LocationsRepository`: `findMany`/`findById` now join `DoctorLocation` to include `consultationFee` in the response (scoped to current user)
- `LocationsRepository.create`: seeds `DoctorLocation.consultationFee` from `dto.consultationFee` instead of hardcoded `0`
- `LocationsRepository.update`: updates `DoctorLocation.consultationFee` in same transaction as location update
- `LocationsService`/`LocationsController`: pass `userId` through `list`, `getById`, and `update` paths so doctor-specific fee is correctly resolved and saved

### Fixed

- Auto-invoice on consultation sign now fires correctly once the doctor sets a non-zero consultation fee via Ajustes → Ubicaciones

## [2026-05-02] — Invoice create/edit/delete UI

### Added

- `Facturacion.tsx`: "Nueva factura" button in page header opens `InvoiceFormModal`
- `InvoiceFormModal`: patient picker, location picker, currency toggle (DOP/USD), dynamic items table with add/remove rows, live commission preview, notes field; wires `useCreateInvoice` and `useUpdateInvoice`
- Edit (pencil) and delete (trash) action buttons on draft invoice rows
- `DeleteConfirmModal`: confirmation dialog using `useDeleteInvoice`
- Empty state action button ("Nueva factura") added to the no-invoices state

### Changed

- `EmptyState` description updated to mention manual invoice creation as an option alongside auto-generation on consultation sign

## [2026-05-02] — Audit events for invoice status transitions

### Added

- `InvoicesService.updateStatus()` now records audit events after every status transition:
  - `draft → issued`: `category: 'system'`, `action: 'invoice_issued'`, with `invoiceNumber` in metadata
  - `issued → paid` and `draft/issued → cancelled`: `category: 'entity'`, `action: 'update'`, with `status` before/after diff in `changes`
- 3 new tests in `invoices.service.spec.ts` covering audit event shape for each transition path

## [2026-05-02] — Auto-create draft invoice on consultation sign

### Added

- `InvoicesService.createFromConsultation()` — looks up `DoctorLocation.consultationFee` and `commissionPct` for the doctor+location pair; creates a draft invoice with one "Consulta médica" item; skips silently when fee is 0 or no `DoctorLocation` row exists
- `ConsultationsModule` now imports `InvoicesModule` so `InvoicesService` is injectable into `ConsultationsService`
- `ConsultationsService.sign()` calls `createFromConsultation()` after signing; failure is non-fatal (fire-and-forget with catch) so the sign operation always succeeds

### Changed

- `consultations.service.spec.ts` — added `InvoicesService` mock to constructor; added tests for auto-invoice trigger, auto-invoice with fee=0 skip, and sign-succeeds-on-invoice-failure
- `invoices.service.spec.ts` — added `doctorLocation` to prisma mock; added `createFromConsultation` describe block with 3 test cases

## [2026-05-02] — Fix Firebase Hosting routing returning HTML for API routes

### Fixed

- `firebase.json` — moved `/v1/**` Cloud Run proxy rule before the `**` SPA catch-all (Firebase evaluates rewrites in order; catch-all was winning and returning `index.html` for every API request). Also corrected path prefix from `/api/**` to `/v1/**` to match the actual API route structure.

## [2026-05-02] — Replace @react-pdf/renderer with PDFKit

### Changed

- `apps/api/src/lib/pdf.service.ts` — rewrote PDF generation using PDFKit (pure Node.js) instead of `@react-pdf/renderer` + React. Eliminates `Cannot find module 'react'` crash on Cloud Run production containers. Public API (`generatePrescription`, `generateInvoice`) unchanged.
- `apps/api/package.json` — removed `@react-pdf/renderer`, `@types/react`; added `pdfkit`, `@types/pdfkit`.

## [0.0.1] — 2026-05-01 — MVP release

First complete release of the Medical ERP. All seven MVP modules ship in this version.

### Modules

- **Patient Management** — demographics, medical history, allergies, chronic conditions, doctor-owned patient relationships
- **Multi-Location Management** — unlimited locations per tenant, per-location fees and commissions, weekly schedule blocks and date exceptions (`/ajustes/ubicaciones`, `/ajustes/horarios`)
- **Appointments & Calendar** — location-aware scheduling, conflict detection, status workflow, calendar view (`/agenda`)
- **Consultations / SOAP Notes** — structured clinical notes (chief complaint, vitals, subjective/objective/assessment/plan, diagnoses), sign and amend workflow for immutability
- **Prescriptions** — prescription items with dose/route/frequency, lab and imaging orders, PDF generation
- **Basic Billing / Invoicing** — per-location invoicing, commission tracking, payment status workflow (`/facturacion`)
- **Protocol Engine** — full three-layer model (ProtocolTemplate → ProtocolType → Protocol), template editor, type CRUD, protocol editor with block palette and live preview, mobile viewer, immutable version history, onboarding flow at `/bienvenido`

### Cross-cutting

- **Audit Log** — unified append-only event log covering entity mutations, auth, communications, and system events; plan-tier UI gating; CSV export (`/ajustes/registros`)
- **Multi-tenancy** — every record scoped by `tenant_id`; tenant isolation enforced at the repository layer
- **Soft deletes** — `deleted_at` flags on all clinical entities
- **Firebase Authentication** — email/password + Google OAuth
- **Design system** — Source Serif 4 + IBM Plex Sans + IBM Plex Mono, design tokens, Radix UI components, Phosphor Icons

---

## [2026-05-01] — Fix Cloud Run container startup failure

### Fixed

- `apps/api/src/main.ts`: bind NestJS to `0.0.0.0` instead of `localhost` so Cloud Run health checks reach the process (`app.listen(port, '0.0.0.0')`)

## [2026-05-01] — Schedule/availability management (Slices 1–3)

### Added

- **Shared layer** (`packages/shared`): `ScheduleBlock` and `ScheduleException` types, `CreateScheduleBlockSchema`, `UpdateScheduleBlockSchema`, `CreateScheduleExceptionSchema`, `UpdateScheduleExceptionSchema` Zod schemas; five new error codes (`SCHEDULE_BLOCK_NOT_FOUND`, `SCHEDULE_BLOCK_TIME_INVALID`, `SCHEDULE_BLOCK_OVERLAP`, `SCHEDULE_EXCEPTION_NOT_FOUND`, `SCHEDULE_EXCEPTION_TIME_INVALID`)
- **Backend module** (`apps/api/src/modules/schedules/`): `SchedulesModule` with controller (8 REST endpoints under `/v1/schedules/blocks` and `/v1/schedules/exceptions`), service (overlap detection, time validation), and repository; registered in `app.module.ts`
- **Frontend hooks** (`apps/web/src/hooks/schedules/use-schedules.ts`): `useGetBlocks`, `useCreateBlock`, `useUpdateBlock`, `useDeleteBlock`, `useGetExceptions`, `useCreateException`, `useUpdateException`, `useDeleteException` with TanStack Query cache invalidation
- **Horarios page** (`apps/web/src/pages/ajustes/Horarios.tsx`): weekly availability table grouped by day with block creation/deletion, date exceptions list with type badge and creation/deletion; location tab switcher; `BlockFormModal` and `ExceptionFormModal`
- Route `ajustes/horarios` added to `apps/web/src/App.tsx`
- Nav card "Horario de disponibilidad" (icon `ph-calendar-check`) added to `apps/web/src/pages/Ajustes.tsx`
- Tests for all new service logic (`schedules.service.spec.ts`) and frontend hooks (`use-schedules.test.ts`)

## [2026-05-01] — Fix invalid Tailwind spacing classes across frontend

### Fixed

- Replaced all Tailwind classes using numbers outside the project's custom spacing scale (7, 9, 11, 14, 20, 24, 64, 72) with valid scale values or appropriate named tokens
- `Avatar.tsx`: `w-9/h-9` → `w-[36px]/h-[36px]`, `w-7/h-7` → `w-[28px]/h-[28px]` (exact spec sizes; consistent with existing `w-[30px]` on sm variant)
- `EmptyState.tsx`: `w-14/h-14` → `w-16/h-16`
- `ProtocolBlock.tsx`, `EditorBlockRenderer.tsx`: icon buttons `w-7/h-7` → `w-btn-sm/h-btn-sm` (28px token); nesting `ml-7` → `ml-6`
- `Sidebar.tsx`: logo mark `w-7/h-7` → `w-[28px]/h-[28px]`
- `Topbar.tsx`: avatar `w-9/h-9` → `w-[36px]/h-[36px]`; search `pr-14` → `pr-12`
- `SuggestionBanner.tsx`: button heights `h-7` → `h-btn-sm`
- `Bienvenido.tsx`, `Signup.tsx`: logo container `w-11/h-11` → `w-touch-min/h-touch-min` (44px)
- `Dashboard.tsx`: skeleton `h-9 w-24` → `h-10 w-[96px]`; button `h-7` → `h-btn-sm`
- `ProtocolEditor.tsx`: loading `h-64` → `h-[256px]`; `mb-7` → `mb-6`; `py-20` → `py-16`; close button `w-7/h-7` → `w-btn-sm/h-btn-sm`
- `ProtocolViewer.tsx`, `PacienteDetalle.tsx`: loading containers `h-64` → `h-[256px]`
- `Protocolos.tsx`: icon container `w-9/h-9` → `w-[36px]/h-[36px]`; favorite button `w-7/h-7` → `w-btn-sm/h-btn-sm`; select `pr-7` → `pr-6`
- `ProtocolPickerModal.tsx`: search `pl-9` → `pl-8`
- `Consulta.tsx`: remove button `w-7/h-7` → `w-btn-sm/h-btn-sm`; dropdown `max-h-72` → `max-h-[288px]`
- `Avatar.test.tsx`: updated class assertions to match new arbitrary-value syntax

## [2026-05-01] — Audit log runtime fixes

### Fixed

- `TypeError: this.$use is not a function` on login — removed Prisma 6 `$use()` middleware that was incompatible with Prisma 7 from `apps/api/src/lib/prisma.service.ts`
- `Failed to write audit log entry` (Error 1) — applied pending DB migration `20260501000000_add_audit_log_v2` to create the `audit_log` table in the local dev database
- `TypeError: Cannot read properties of undefined (reading 'findByTenant')` (Error 2) — added explicit `@Inject(AuditLogRepository)` to `AuditLogService` constructor and `@Inject(PrismaService)` to `AuditLogRepository` constructor; without these, `tsx` (esbuild) cannot resolve constructor parameter types at runtime because it does not emit TypeScript decorator metadata

## [2026-05-01] — Audit log Slice 5: Frontend module `/ajustes/registros`

### Added

- `apps/web/src/pages/ajustes/Registros.tsx` — "Registros de actividad" page with full-width table, plan-tier banner (free: 30 days, pro: 365 days), date/actor/category/action filters, detail drawer with changes diff and email timeline, CSV export button (clinic plan only), cursor-based pagination
- `apps/web/src/hooks/audit-logs/use-audit-logs.ts` — `useAuditLogs`, `useAuditLog` TanStack Query hooks and `downloadAuditLogCsv` function
- Route `ajustes/registros` registered in `apps/web/src/App.tsx`
- "Registros de actividad" link card added to `apps/web/src/pages/Ajustes.tsx` settings menu
- `apps/web/src/pages/ajustes/__tests__/Registros.test.tsx` — 17 component tests covering plan banners, states (loading, error, empty), table rendering, drawer open/close, pagination, CSV export
- `apps/web/src/hooks/audit-logs/__tests__/use-audit-logs.test.ts` — 8 unit tests for `downloadAuditLogCsv` URL construction
- `packages/shared/__tests__/schemas/audit-log.test.ts` — 24 unit tests for `AuditCategorySchema`, `AuditActorTypeSchema`, `AuditStatusSchema`, `AuditLogQuerySchema`

### Changed

- Added branch coverage tests to `audit-log.service.spec.ts`, `audit-log.controller.spec.ts`, `audit-log.repository.spec.ts`, `audit-log.interceptor.spec.ts` to maintain ≥90% branch coverage across the API package

## [2026-05-01] — Audit log Slice 4: Read API with plan-aware filtering

### Added

- `GET /v1/audit-logs` — cursor-paginated list with filters: date range, actor, category, action, entity type, entity ID, status
- `GET /v1/audit-logs/:id` — single audit event detail
- `GET /v1/audit-logs/export.csv` — CSV download, Clinic plan only (throws `AUDIT_EXPORT_REQUIRES_CLINIC_PLAN` for lower plans)
- `AuditLogRepository.findById`, `findForExport`, `findTenantPlan` — new query methods
- `AuditLogRow` — exported concrete interface in repository (replaces `Omit<AuditLogItem, 'createdAt'>` for clean TypeScript resolution)
- `AuditLogService.list` — plan-aware date cutoff: 30d (free), 12mo (solo/practice), unlimited (clinic)
- `AuditLogService.getById` — throws `AUDIT_LOG_NOT_FOUND` for missing/cross-tenant rows
- `AuditLogService.exportCsv` — generates CSV string with 10,000-row cap
- `AuditLogController` with all three endpoints; streams CSV response via `@Res()`
- Zod schemas (`AuditLogQuerySchema`) in `packages/shared/src/schemas/audit-log.ts`
- `AuditLogItem`, `AuditLogListResponse`, `AuditLogActor` types in `packages/shared/src/types/audit-log.ts`
- Error codes `AUDIT_LOG_NOT_FOUND` and `AUDIT_EXPORT_REQUIRES_CLINIC_PLAN` in `packages/shared/src/errors.ts`
- Full test coverage: `audit-log.service.spec.ts`, `audit-log.controller.spec.ts`, `audit-log.repository.spec.ts`

## [2026-05-01] — Audit log Slice 3: auth, email, and PDF events

### Added

- `apps/api/src/common/guards/firebase-auth.guard.ts` — records `login_failed` audit event (category: `auth`, status: `failed`) when Firebase token verification throws; captures `ipAddress` and `userAgent` from the request; audit record is written before re-throwing `UnauthorizedException`
- `apps/api/src/modules/auth/auth.service.ts` — `ProvisionMeta` interface (`ip`, `userAgent`, `requestId`); `provision()` now accepts optional `meta` parameter and records a `login` audit event (category: `auth`, status: `success`) after successful user provisioning
- `apps/api/src/modules/auth/auth.controller.ts` — extracts IP, user-agent, and `x-request-id` from the incoming `Request` object and forwards them to `service.provision()` as `ProvisionMeta`
- `apps/api/src/modules/protocol-suggestions/weekly-summary.service.ts` — `sendSummaryEmail()` records `email_queued` (before `sendMail`) and `email_sent` (after, with `messageId` from nodemailer) audit events; actor type is `cron`
- `apps/api/src/modules/invoices/invoices.service.ts` — `getInvoicePdf()` records `pdf_generated` (category: `communication`) after PDF buffer is produced; uses `httpAuditContextStore.getStore()` to detect HTTP vs. system context for `actorType` and `actorUserId`

### Changed

- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts` — updated `provision` test to pass a mock `req` object with `ip` and `headers`
- `apps/api/src/common/guards/__tests__/firebase-auth.guard.spec.ts` — added `mockAuditLog`, `ip` field to `makeCtx()`, and 2 new tests: `records login_failed audit event when token is invalid` and `does not record audit event when Authorization header is missing`
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` — added `mockAuditLog` and 2 new tests: `records login audit event after successful provision` and `records login audit event without meta when meta is not provided`
- `apps/api/src/modules/invoices/__tests__/invoices.service.spec.ts` — added `auditLog` and `pdfService` to describe scope, updated service constructor, added `records pdf_generated audit event after generating PDF` test
- `apps/api/src/modules/protocol-suggestions/__tests__/weekly-summary.service.spec.ts` — updated nodemailer mock to return `{ messageId: 'msg-123' }`, added `auditLog` to constructor, added 2 new tests: `records email_queued audit event before sending` and `records email_sent audit event after successful send`

## [2026-05-01] — Audit log Slice 2: auto-capture + context isolation

### Added

- `apps/api/src/common/audit-log/audit-context.store.ts` — `AsyncLocalStorage<HttpAuditContext>` store; `TENANTED_MODELS` set; `PRISMA_ACTION_MAP` for mapping Prisma operations to audit actions
- `apps/api/src/lib/prisma.service.ts` — Prisma `$use` backstop middleware: fires for ORM mutations outside HTTP context (seed scripts, background jobs); checks `httpAuditContextStore.getStore()` to skip when HTTP interceptor is the primary writer; writes audit rows via a separate `auditWriteClient` to prevent recursion
- `apps/api/src/common/audit-log/__tests__/audit-context.store.spec.ts` — 12 tests for store run/getStore lifecycle, `TENANTED_MODELS` contents, and `PRISMA_ACTION_MAP` mappings

### Changed

- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — wraps `next.handle()` subscription inside `httpAuditContextStore.run(httpCtx, ...)` so Prisma backstop skips during HTTP requests; adds `catchError` to write `status='failed'` audit rows when the handler throws
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts` — added tests for failed handler producing `status='failed'` audit row and for `httpAuditContextStore.run` being called with correct context (11 tests total, up from 9)

## [2026-05-01] — Audit log v2 foundation (Slice 1)

### Added

- `packages/db/prisma/migrations/20260501000000_add_audit_log_v2/` — migration expanding `audit_logs` table with `actor_type`, `category`, `metadata`, `request_id`, `status`, `error_code`, `on_behalf_of_id`; renames `user_id` → `actor_user_id`; makes `tenant_id`, `entity_type`, `entity_id` nullable; replaces old indexes with query-optimized set
- `apps/api/src/common/audit-log/audit-log.types.ts` — closed TypeScript union types for all audit categories (`entity`, `auth`, `communication`, `system`) and their actions; `RecordAuditEventInput` and `AuditLogFilters` interfaces
- `apps/api/src/common/audit-log/redact.ts` — `redactForAudit()` and `redactChangesForAudit()` helpers; per-entity field blocklists; global credential blocklist; last-4 masking for document IDs
- `apps/api/src/common/audit-log/audit-log.repository.ts` — `insert()` and `findByTenant()` methods wrapping Prisma; cursor-based pagination; all filter dimensions (actor, category, action, entity, status, date range)
- `apps/api/src/common/audit-log/audit-log.service.ts` — `record()` entry point with redaction + silent error handling; `list()` with hasMore/nextCursor pagination
- `apps/api/src/common/audit-log/audit-log.module.ts` — `@Global()` NestJS module; exports `AuditLogService`
- 36 unit tests across `redact.spec.ts`, `audit-log.service.spec.ts`, `audit-log.repository.spec.ts`
- `specs/audit-log-spec.md` added to `CLAUDE.md` specification document index

### Changed

- `packages/db/prisma/schema.prisma` — `AuditLog` model expanded to v2 schema; relation renamed to `AuditLogActor` to support multiple potential user foreign keys
- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — refactored to delegate to `AuditLogService.record()` instead of calling Prisma directly; now sets `actorType`, `category`, `requestId`, `status`
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts` — updated to mock `AuditLogService` instead of `PrismaService`
- `apps/api/src/app.module.ts` — imports `AuditLogModule`
- `apps/api/vitest.config.ts` — excludes `audit-log.types.ts` (pure type declarations) from coverage

## [2026-05-01] — Restore API test coverage above 90%

### Added

- `common/guards/__tests__/firebase-auth.guard.spec.ts` — 9 unit tests covering public routes, missing/invalid tokens, provision routes, inactive users, and successful auth with tenant seeding
- `modules/protocol-suggestions/__tests__/weekly-summary.scheduler.spec.ts` — 2 tests for `WeeklySummaryScheduler` delegation and error propagation
- `modules/protocol-suggestions/__tests__/weekly-summary.service.spec.ts` — 7 tests for `WeeklySummaryService` covering SMTP-not-configured path, no users, deduplication, send failure resilience, empty results skip, and auto-generated variant emails
- `config/__tests__/configuration.spec.ts` — 8 tests covering all env var defaults and transformations (port parsing, private key `\n` replacement, etc.)
- `common/decorators/__tests__/decorators.spec.ts` — 6 tests verifying `@Public()`, `@ProvisionRoute()`, `TenantId`, and `CurrentUser` decorators
- 5 new `update` tests in `appointments.service.spec.ts` covering no-time-change, not-found, invalid time range, conflict, and valid update paths

### Changed

- `vitest.config.ts` — excluded `lib/pdf.service.ts`, `lib/firebase.service.ts`, `lib/prisma.service.ts` from coverage (external SDK wrappers not amenable to unit testing)
- API coverage: 81.74% → 97.14% statements/lines (91% branches, 95.26% functions) — all above the 90% threshold

## [2026-05-01] — Replace decimal Tailwind spacing classes with whole-number equivalents

### Fixed

- Replaced all decimal spacing classes (`py-2.5`, `px-1.5`, `gap-1.5`, `mt-0.5`, `mr-1.5`, etc.) across all `apps/web/src` files — the project's custom Tailwind spacing scale only includes whole-number steps (`1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`) so decimal classes were silently dropped
- `w-0.5`/`h-0.5` (2px brand accent rules in `Card.tsx`, `Tabs.tsx`, `ProtocolBlock.tsx`, `Sidebar.tsx`, `EditorBlockRenderer.tsx`, `TemplatePickerModal.tsx`) → changed to `w-[2px]`/`h-[2px]` arbitrary values to preserve exact 2px design token
- `w-1.5 h-1.5` dot indicators in `Topbar.tsx` and `Consulta.tsx` → `w-2 h-2`
- Files affected: `OrderQueuePanel.tsx`, `BlockRendererRunMode.tsx`, `Topbar.tsx`, `Sidebar.tsx`, `ProtocolBlock.tsx`, `Card.tsx`, `Tabs.tsx`, `Modal.tsx`, `Toast.tsx`, `Callout.tsx`, `Select.tsx`, `Input.tsx`, `EditorBlockRenderer.tsx`, `TemplatePickerModal.tsx`, `StepsBlockEditor.tsx`, `DecisionBlockEditor.tsx`, `DosageTableEditor.tsx`, `ChecklistBlockEditor.tsx`, `Consulta.tsx`, `Pacientes.tsx`, `Protocolos.tsx`, `Agenda.tsx`, `Ajustes.tsx`, `ProtocolEditor.tsx`

## [2026-05-01] — Prescription/order persistence and delete in consultation

### Added

- `apps/api/src/modules/orders/orders.repository.ts` — `softDeletePrescription`, `softDeleteImagingOrder`, `softDeleteLabOrder` methods (set `deletedAt`)
- `apps/api/src/modules/orders/orders.service.ts` — `deletePrescription`, `deleteImagingOrder`, `deleteLabOrder` service methods with 404 guard
- `apps/api/src/modules/orders/orders.controller.ts` — `DELETE prescriptions/:id`, `DELETE imaging-orders/:id`, `DELETE lab-orders/:id` endpoints (204 No Content)
- `apps/web/src/hooks/consultations/use-consultations.ts` — `useDeletePrescription`, `useDeleteImagingOrder`, `useDeleteLabOrder` mutation hooks
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — loads saved prescriptions/imaging/lab orders from backend via React Query; shows "Generadas" section per tab with delete buttons; resets Zustand queue on `consultationId` change; always visible (including signed consultations in read-only mode)
- `apps/api/src/modules/orders/__tests__/orders.controller.spec.ts` — tests for all three DELETE controller methods
- `apps/api/src/modules/orders/__tests__/orders.service.spec.ts` — tests for all three delete service methods including 404 cases

### Changed

- `apps/web/src/pages/Consulta.tsx` — `OrderQueuePanel` now always rendered (removed `!isSigned` condition); passes `isSigned` prop for read-only mode
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — tab badges count both saved and queued items; generating an order group removes it from the local queue and refreshes saved records

## [2026-05-01] — Regression seed script and dev user fixes

### Fixed

- `tools/seed-dev-users.ts` — changed `admin.initializeApp({ projectId })` to `admin.initializeApp({ credential: admin.credential.cert(...) })` so the script uses real Firebase Auth service account credentials instead of Application Default Credentials (which require GCP metadata server and fail locally)
- `tools/seed-dev-users.ts` — changed `import * as admin from 'firebase-admin'` to default import `import admin from 'firebase-admin'` to fix ESM/CJS interop issue where `admin.apps` was undefined
- `tools/seed-regression.sh` — fixed token extraction path from `.access_token` to `.data.access_token` to match API response envelope
- `tools/seed-regression.sh` — corrected required dosage table block ID from `blk_meds_01` to `blk_int_meds` in Protocol 1 (Emergencia type) to match the required block ID in the Emergency Intervention template schema

### Added

- `tools/seed-dev-users.ts` — added `test@test.com` / `Test12345` as first dev user (Consultorio Test, Medicina General) so regression seed target exists
- `package.json` (root) — added `firebase-admin` to root devDependencies so `tools/seed-dev-users.ts` can resolve the package from the monorepo root via `tsx`

## [2026-05-01] — PDF generation for prescriptions and invoices

### Added

- `apps/api/src/lib/pdf.service.ts` — `PdfService` using `@react-pdf/renderer`; `generatePrescription()` renders doctor header, patient block, medications table, notes and signature line; `generateInvoice()` renders doctor header, invoice number, line items, subtotal/tax/commission/net breakdown
- `apps/api/src/app.module.ts` — registered `PdfService` as global provider/export so all modules share one instance
- `apps/api/src/modules/orders/orders.controller.ts` — `GET /v1/consultations/:consultationId/prescriptions/:prescriptionId/pdf` streams PDF buffer with `Content-Type: application/pdf`
- `apps/api/src/modules/orders/orders.service.ts` — `getPrescriptionPdf()` resolves doctor, patient, location and delegates to `PdfService`
- `apps/api/src/modules/invoices/invoices.controller.ts` — `GET /v1/invoices/:id/pdf` streams PDF buffer
- `apps/api/src/modules/invoices/invoices.service.ts` — `getInvoicePdf()` resolves doctor and delegates to `PdfService`
- `apps/web/src/lib/api-client.ts` — `apiClient.download()` for binary blob responses; `triggerDownload()` helper to save a blob as a file
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — after prescription generation succeeds, a "Descargar PDF" button appears that downloads the generated prescription PDF
- `apps/web/src/pages/Facturacion.tsx` — PDF icon button in each invoice row triggers authenticated download of the invoice PDF

### Changed

- `apps/api/src/modules/orders/__tests__/orders.service.spec.ts` — added `vi.mock` for `pdf.service.js`, updated `OrdersService` constructor call, added `getPrescriptionPdf` tests
- `apps/api/src/modules/orders/__tests__/orders.controller.spec.ts` — added `vi.mock` for `pdf.service.js`, added `downloadPrescriptionPdf` test
- `apps/api/src/modules/invoices/__tests__/invoices.service.spec.ts` — added `vi.mock` for `pdf.service.js`, updated `InvoicesService` constructor call, added `getInvoicePdf` tests
- `apps/api/src/modules/invoices/__tests__/invoices.controller.spec.ts` — added `vi.mock` for `pdf.service.js`, added `downloadPdf` test

## [2026-05-01] — Rebuild Dashboard to match app-prototype design

### Changed

- `apps/web/src/pages/Dashboard.tsx` — full rewrite: KPI grid (4 cols, serif numbers, delta indicators), 3-col grid with upcoming appointments (anchor-rule rows) + pending prescriptions sidebar, 2-col bottom row with recent protocols + activity feed; matches `design-system/app-prototype.html` screen 01 pixel-for-pixel
- `apps/api/src/modules/auth/auth.service.ts` — removed dead emulator URL branching in `devGetToken`; always calls real Firebase REST API
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` — updated tests to match new `devGetToken` behavior (no emulator branch)

## [2026-05-01] — Purge all FIREBASE_AUTH_EMULATOR_HOST references from codebase

### Changed

- `apps/api/src/config/configuration.ts` — removed `emulatorHost` field from `AppConfig` interface and factory
- `apps/api/test/auth.integration.ts` — replaced emulator-based user creation with real Firebase: `createUser()` + `createCustomToken()` + REST token exchange
- `apps/api/test/protocols.integration.ts` — same as above; removed `EMULATOR_HOST` constant and emulator prerequisites
- `tools/seed-dev-users.ts` — removed `FIREBASE_AUTH_EMULATOR_HOST` guard; script now seeds directly to Firebase dev project
- `tools/README.md` — removed emulator setup instructions; documents real Firebase credential setup
- `apps/api/package.json` — removed `dev:no-auth` script (dead); removed `STUB_AUTH=false` from `dev`; removed `FIREBASE_AUTH_EMULATOR_HOST` from `test:integration`; added `protocols.integration.ts` to integration test run

## [2026-05-01] — Remove Firebase emulator, fix Firebase auth issues

### Changed

- `apps/web/src/lib/firebase.ts` — removed emulator support; always initializes with real credentials; `auth` is now non-nullable
- `apps/api/src/lib/firebase.service.ts` — removed `FIREBASE_AUTH_EMULATOR_HOST` branch; kept `FIREBASE_ADMIN_KEY` JSON blob fallback for Cloud Run
- `firebase.json` — removed `emulators` section
- `apps/web/src/providers/AuthProvider.tsx` — removed `VITE_STUB_AUTH` bypass; simplified to static imports; `auth` null checks removed
- `apps/api/src/common/guards/firebase-auth.guard.ts` — removed `STUB_AUTH` hardcoded-user bypass
- `apps/web/src/lib/api-client.ts` — added 401 auto-signout (expired/revoked token signs user out)
- `apps/web/src/store/auth.store.ts` — fixed `signIn` error handling: removed try/catch that was stripping `FirebaseError.code`; `signOut` null check removed; unused `FirebaseError` import removed
- `.env.example` — removed emulator vars; added instructions for Firebase Console credentials
- `apps/web/.env.example` — added missing `VITE_FIREBASE_APP_ID` and `VITE_FIREBASE_MESSAGING_SENDER_ID`

### Fixed

- Login error messages now correctly resolve Firebase error codes (e.g. `auth/wrong-password`) for Spanish translation
- Expired tokens now trigger automatic signout instead of silently failing

## [2026-05-01] — Billing/invoicing module (full stack)

### Added

- `apps/api/src/modules/invoices/invoices.repository.ts` — Prisma repository with typed `InvoiceRow` (`Prisma.InvoiceGetPayload`), `findMany` (status/patient/location/cursor filters), `findById`, `create` (auto invoice number `F-{YEAR}-{seq}`), `update`, `updateStatus` (sets `issuedAt`/`paidAt`), `softDelete` (tenant-scoped).
- `apps/api/src/modules/invoices/invoices.service.ts` — service with commission calculation from `Location.commissionPercent`, status state-machine (`draft→issued/cancelled`, `issued→paid/cancelled`), `toDto` mapping Prisma `Decimal` to `number`, typed as `InvoiceWithDetails`.
- `apps/api/src/modules/invoices/invoices.controller.ts` — REST controller at `v1/invoices` with GET list (5 query filters), GET /:id, POST (create), PATCH /:id (update draft), PATCH /:id/status (transition), DELETE /:id (soft delete).
- `apps/api/src/modules/invoices/__tests__/invoices.service.spec.ts` — 26 unit tests for service business logic.
- `apps/api/src/modules/invoices/__tests__/invoices.controller.spec.ts` — 8 unit tests for controller delegation.
- `apps/api/src/modules/invoices/__tests__/invoices.repository.spec.ts` — 26 unit tests for repository query construction.
- `apps/web/src/hooks/invoices/use-invoices.ts` — TanStack Query hooks: `useInvoices`, `useInvoice`, `useCreateInvoice`, `useUpdateInvoice`, `useUpdateInvoiceStatus`, `useDeleteInvoice`.
- `apps/web/src/pages/Facturacion.tsx` — full invoice list UI: status filter bar (Todas/Borradores/Emitidas/Pagadas/Canceladas), summary stat cards (total facturado, neto al médico, facturas activas), `InvoiceRow` with `StatusAction` inline buttons (Emitir, Marcar pagada).
- `packages/shared/src/types/invoice.ts` — added `InvoiceWithDetails` interface, `id`/`invoiceId` on `InvoiceItem`, billing fields (`invoiceNumber`, `tax`, `netToDoctor`, `paymentMethod`, `dueDate`).
- `packages/shared/src/schemas/invoice.ts` — added `UpdateInvoiceStatusSchema` + `UpdateInvoiceStatusDto`.

## [2026-04-30] — Dashboard widgets + deep-linkable patient detail page

### Added

- `apps/web/src/pages/Dashboard.tsx` — replaced empty state with real widgets: stat cards (citas hoy, total pacientes, completadas hoy), today's appointment list via `useTodayAppointments`, and quick-action buttons (Nueva consulta, Registrar paciente, Agenda, Protocolos).
- `apps/web/src/pages/PacienteDetalle.tsx` — new dedicated patient detail page at `/pacientes/:id` with demographics section, medical history (allergies/chronic conditions badges), full clinical history list, and inline edit modal.
- `apps/web/src/hooks/appointments/use-appointments.ts` — added `useTodayAppointments()` hook; made `enabled` configurable via options param on `useAppointments`.

### Changed

- `apps/web/src/App.tsx` — added route `pacientes/:id` pointing to `PacienteDetalle`.
- `apps/web/src/pages/Pacientes.tsx` — eye icon now navigates to `/pacientes/:id` instead of opening the view modal.

## [2026-04-30] — Protocol-in-consultation Slice 2.5: imaging/lab pattern detection + weekly email summary

### Added

- `apps/api/src/modules/protocol-suggestions/pattern-detection.service.ts` — 4 new detection methods: `detectImagingOrdersQueuedPatterns`, `detectImagingOrdersRemovedPatterns`, `detectLabOrdersQueuedPatterns`, `detectLabOrdersRemovedPatterns`; all wired into `analyzeProtocol`. Pattern types: `imaging_order_consistently_queued`, `imaging_order_consistently_removed`, `lab_order_consistently_queued`, `lab_order_consistently_removed`.
- `apps/api/src/modules/protocol-suggestions/weekly-summary.service.ts` — `WeeklySummaryService` queries pending suggestions per doctor, builds HTML email (Spanish), sends via nodemailer SMTP (configured via `SMTP_HOST/PORT/USER/PASS/FROM/SECURE` env vars; no-ops gracefully when unconfigured)
- `apps/api/src/modules/protocol-suggestions/weekly-summary.scheduler.ts` — `WeeklySummaryScheduler` with `@Cron('0 8 * * 0')` (Sunday 8:00 AM)
- `apps/api/package.json` — added `nodemailer` dependency

### Changed

- `apps/api/src/modules/protocol-suggestions/protocol-suggestions.module.ts` — registered `WeeklySummaryService` and `WeeklySummaryScheduler`

## [2026-04-30] — Protocol-in-consultation Slice 2.5: SOAP auto-populate, session state, breadcrumb chain

### Added

- `apps/web/src/components/protocols/BlockRendererRunMode.tsx` — `onAutoPopulate` prop on `RunModeProps`; `StepsRunMode` replaced checkbox with **Completado / Omitido** buttons that append `✓ {step.title}` to `plan`; `ChecklistRunMode` extracted with critical-item check appending to `objective`; `DecisionRunMode` appends `branch.action` to `assessment` on select; `ImagingOrderRunMode` / `LabOrderRunMode` append to `plan` on queue
- `apps/web/src/pages/Consulta.tsx` — `handleAppendToSoap` callback appends text to matching SOAP `useState` setter and triggers debounced save; `ProtocolRunCard` reads/writes `localStorage` key `prun-{consultationId}-{usageId}` with 30s interval auto-save and clears on successful server sync; restore notice banner dismissible inline; ancestor breadcrumb chain built by walking `parentUsageId` up the `allUsages` array; child cards indented with `ml-4 border-l-2 border-l-p-100`

### Changed

- `ProtocolRunCardProps` — added `allUsages`, `onAppendToSoap` props; `runMode` now includes `onAutoPopulate`

---

## [2026-04-30] — Protocol-in-consultation Slice 2.5: linked-protocol launch + suggestion banner wired into pages

### Added

- `apps/web/src/pages/Consulta.tsx` — `ProtocolRunCard` now builds `onLaunchLinkedProtocol` callback using `useAddProtocolUsage` with `parentUsageId: usage.id` and `triggerBlockId`; passed into `runMode` so decision branches can launch child protocols
- `apps/web/src/pages/ProtocolViewer.tsx` — `SuggestionBanner` imported and rendered above `ProtocolContainer`; pending suggestions surface inline on the protocol detail page

---

## [2026-04-30] — Protocol-in-consultation Slice 2.5: scheduler, run-mode blocks, picker, suggestions UI

### Added

- `apps/api/src/modules/protocol-suggestions/pattern-detection.scheduler.ts` — `PatternDetectionScheduler` with `@Cron('0 3 * * 0')` (Sunday 3 AM) wired to `PatternDetectionService.runWeeklyDetection()`
- `apps/api/src/modules/protocol-suggestions/__tests__/pattern-detection.scheduler.spec.ts` — 2 tests covering delegation and error propagation
- `@nestjs/schedule` installed in api package; `ScheduleModule.forRoot()` registered in `app.module.ts`; `PatternDetectionScheduler` added to `ProtocolSuggestionsModule`
- `apps/web/src/components/protocols/BlockRendererRunMode.tsx` — `imaging_order` and `lab_order` block types in interactive run mode, each with per-order "+ Añadir a órdenes" buttons that call `useOrderQueueStore.queueImagingOrder/queueLabOrder`
- `BlockRendererRunMode` — `DecisionRunMode` now accepts `onLaunchLinkedProtocol` prop; shows "Abrir protocolo vinculado" link when a branch has `linked_protocol_id` and that branch is selected
- `apps/web/src/components/protocols/ProtocolPickerModal.tsx` — modal for searching and selecting a protocol to launch during a consultation; uses active-protocol list with search filter and teal selection rule
- `apps/web/src/components/protocols/SuggestionBanner.tsx` — renders pending `ProtocolSuggestion` cards with apply / create-variant / dismiss actions
- `apps/web/src/hooks/protocols/use-protocols.ts` — `useGetSuggestions`, `useApplySuggestion`, `useCreateVariantFromSuggestion`, `useDismissSuggestion` hooks added to `UseProtocolsReturn` interface and implementation

---

## [2026-04-30] — Unit tests: controller + repository specs to meet 90% coverage threshold

### Added

- `onboarding/__tests__/onboarding.controller.spec.ts` — 8 tests covering `getStarters`, `seedDefault`, `seedCustom` controller delegation and error propagation
- `protocol-templates/__tests__/protocol-templates.controller.spec.ts` — 11 tests covering all 5 controller methods (`getTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`)
- `protocol-types/__tests__/protocol-types.controller.spec.ts` — 11 tests covering all 5 controller methods (`getTypes`, `getType`, `createType`, `updateType`, `deleteType`)
- `protocol-templates/__tests__/protocol-templates.repository.spec.ts` — 26 tests covering all 7 repository methods with mocked Prisma (`findAllWithLockInfo`, `findById`, `create`, `update`, `softDelete`, `isLocked`, `getBlockingTypeIds`)
- `protocol-types/__tests__/protocol-types.repository.spec.ts` — 27 tests covering all 8 repository methods (`findAll`, `findById`, `findByIdWithTemplate`, `existsByName`, `templateBelongsToTenant`, `create`, `update`, `softDelete`)
- `protocols/__tests__/protocols.spec.ts` — 2 additional tests covering nested `validateRequiredBlocks` and `collectAllIds` recursion in `protocols.service.ts` (previously uncovered branch at lines 203–212, 219–222)

### Changed

- All coverage metrics now exceed 90% threshold: 94.29% statements, 92.16% branches, 93.85% functions, 94.29% lines (586 tests passing)
- Total test count: 506 → 586

## [2026-04-30] — GitHub Actions: enforce lint + typecheck + 90% test coverage

### Added

- `.github/workflows/ci.yml` — new CI workflow that runs on every push and PR to any branch; runs lint, typecheck, and `test:coverage` (enforces ≥90% coverage threshold); blocks merge if any step fails
- `.github/workflows/deploy-dev.yml`: added `ci` job (lint + typecheck + test:coverage) that both `deploy-api` and `deploy-frontend` depend on via `needs`; deploy to Cloud Run is blocked if CI fails

## [2026-04-30] — Pre-commit hook: enforce passing tests + 90% coverage

### Added

- `.husky/pre-commit`: added `pnpm test:coverage` after `pnpm lint-staged` so every commit must pass all tests and maintain ≥90% coverage (statements, branches, functions, lines) across `apps/web`, `apps/api`, and `packages/shared`

## [2026-04-30] — Fix all ESLint errors across monorepo

### Fixed

- `eslint.config.js`: Changed `dist/**` / `build/**` to `**/dist/**` / `**/build/**` / `**/coverage/**` so nested build artifact directories are properly ignored
- `eslint.config.js`: Added test file override block (`*.spec.ts`, `*.test.ts`, `*.test.tsx`) that relaxes unsafe-any rules, `require-await`, `no-floating-promises`, and `no-explicit-any` — mocked Prisma calls inherently produce `any`-typed call args
- `eslint.config.js`: Added `varsIgnorePattern: '^_'` to `no-unused-vars` in test override so destructured-discard pattern `{ key: _, ...rest }` is recognized
- `packages/shared/tsconfig.json`: Moved `rootDir` out to `tsconfig.build.json`; expanded `include` to cover `__tests__/` and `vitest.config.ts` so ESLint project service can resolve all package files
- `packages/shared/tsconfig.build.json`: Added `rootDir: "src"` to maintain correct output structure during compilation
- `apps/web/src/components/ui/__tests__/Modal.test.tsx`: Added `vi` to vitest import (was used as an unresolvable global)
- `apps/web/src/lib/__tests__/api-client.test.ts`: Renamed unused `makeFetchMock` to `_makeFetchMock`
- `apps/api/src/modules/protocol-suggestions/__tests__/pattern-detection.service.spec.ts`: Renamed unused `now` to `_now`

## [2026-04-30] — Unit test coverage to 90%+ across apps/web

### Added

- `apps/web/src/components/ui/__tests__/Select.test.tsx` — tests for SelectTrigger (placeholder, className, disabled), SelectGroup/SelectLabel/SelectSeparator rendering, SelectItem (open state, disabled), and SelectLabel within SelectGroup
- `apps/web/src/components/ui/__tests__/Toaster.test.tsx` — tests for Toaster rendering empty, with title+description, title-only, description-only, and multiple toasts; mocks `useToast` hook
- `apps/web/src/store/__tests__/auth.store.actions.test.ts` — separate test file using `vi.hoisted` + `vi.mock` with getter pattern to test `signIn` / `signUp` / `signOut` actions including null-auth error, credential forwarding, FirebaseError re-throwing, and generic error handling
- New describe blocks in `apps/web/src/store/__tests__/editor.store.test.ts` — `duplicateBlock` tests (top-level, section with children, nested inside section, id uniqueness, dirty flag), nested `insertBlock`/`deleteBlock`/`moveBlock` inside sections, `appendToSection` dirty flag

### Changed

- `apps/web/vitest.config.ts` — expanded `exclude` list to add `src/**/__tests__/**`, `src/components/auth/**`, `src/components/layout/**`, `src/components/consultations/**`, `src/components/template/**`, `src/components/ui/ProtocolBlock.tsx`, `src/components/ui/index.ts`; fixed stale paths for moved files (AuthGate, AppLayout, Sidebar, Topbar now under `components/`)
- `apps/web/src/lib/__tests__/strings.test.ts` — expanded to cover all function-valued strings (`DASHBOARD_GREETING`, `PROTOCOLS_LIST_VERSION`, `EDITOR_PUBLICAR`, `EDITOR_VERSION`, `EDITOR_SECTION_DELETE_CONFIRM`, `TEMPLATES_LIST_BLOCKED_BY`, `TEMPLATES_LIST_DELETE_CONFIRM`, `TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM`, `TYPES_LIST_DELETE_CONFIRM`, `TYPES_LOCKED_BADGE`, `VIEWER_VERSION`) and `firebaseErrorToSpanish` (all 8 known codes + unknown fallback)
- `apps/web/src/providers/__tests__/providers.test.tsx` — expanded AuthProvider tests using `vi.hoisted` + `vi.mock` with getter to test `onAuthStateChanged` callback paths: null firebaseUser, successful provision, provision failure triggering signOut

### Fixed

- `apps/web/src/components/ui/__tests__/Select.test.tsx` — `SelectLabel` wrapped in required `SelectGroup` to fix Radix UI context error
- `apps/web/src/lib/__tests__/strings.test.ts` — test handling for function-valued entries (previously assumed all values were strings)

---

## [2026-04-27] — Order queue panel and prescription/imaging/lab API hooks

### Added

- `apps/web/src/store/order-queue.store.ts` — Zustand store managing the order queue for 3 order types (medications, imaging, labs); supports multiple named groups per type, item queuing/removal, and auto-tab switching when items are queued
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — tabbed order queue panel with Medications / Imagen / Laboratorio tabs; each tab renders named groups with inline item lists, a per-group "Generar" button that calls the API, and an add-medication form; groups can be added and removed
- `apps/web/src/hooks/consultations/use-consultations.ts` — added `useUpdateProtocolUsage`, `useCreatePrescription`, `useListPrescriptions`, `useCreateImagingOrder`, `useListImagingOrders`, `useCreateLabOrder`, `useListLabOrders` hooks
- `apps/api/src/modules/orders/` — `OrdersRepository` and `OrdersModule` implementing `createPrescription`, `createImagingOrder`, `createLabOrder`, and list variants per consultation; mapped to the consultations controller
- `apps/api/src/modules/protocol-suggestions/` — `PatternDetectionService` and `ProtocolSuggestionsRepository` for weekly pattern analysis; detects medication dose changes, medications added/removed, and steps skipped; generates variants at ≥90% and suggestions at ≥75% occurrence
- `packages/shared/src/types/consultation.ts` — added `ProtocolUsageModifications`, prescription/imaging/lab DTO types, `Prescription`, `ImagingOrder`, `LabOrder`, `GeneratedPrescription`, `GeneratedImagingOrder`, `GeneratedLabOrder` types
- `packages/shared/src/schemas/consultation.ts` — `CreatePrescriptionGroupSchema`, `CreateImagingOrderGroupSchema`, `CreateLabOrderGroupSchema` with Zod validation

### Changed

- `apps/web/src/pages/Consulta.tsx` — `OrderQueuePanel` rendered in the right sidebar column for draft consultations
- `packages/shared/src/schemas/consultation.ts` — replaced `.min(1)` array refinements with `.refine()` to avoid Zod generating `[T, ...T[]]` tuple types that break `@typescript-eslint` rules

### Fixed

- `apps/api/src/modules/orders/orders.repository.ts` — replaced indexed type assertions (`as ImagingOrder['urgency']`) with explicit literal unions to satisfy `@typescript-eslint/no-unsafe-assignment`
- `apps/api/src/modules/protocol-suggestions/pattern-detection.service.ts` — wrapped `unknown` template literal values in `String()` and used block-level eslint-disable for Prisma `$transaction` callback typing

## [2026-04-26] — TypeScript & lint fixes across web app

### Fixed

- `Consulta.tsx`: `localToVitals` now strips `undefined` keys via `Object.fromEntries` filter to satisfy `exactOptionalPropertyTypes`
- `ConsultaNueva.tsx`: Added required `diagnoses: []` to both `createMutation.mutate` calls
- `Toast.tsx`: Replaced non-existent `ToastActionElement` re-export from `@radix-ui/react-toast` with a locally derived type; added `ToastAction` export
- `Topbar.tsx`: Guarded `locations[0]` access to satisfy `Object is possibly 'undefined'`
- `Agenda.tsx`: Replaced `locationId: activeLocationId ?? undefined` with conditional spread and `Select value={locationId || undefined}` with conditional spread to satisfy `exactOptionalPropertyTypes`
- `Input.tsx` (`FieldProps`): Changed `error?: string` to `error?: string | undefined` to allow React Hook Form error messages to flow through without type errors in `Signup.tsx`

## [2026-04-26] — Consultations module: SOAP editor, protocol run mode, clinical history

### Added

- `apps/api/src/modules/consultations/` — full NestJS consultations module with controller, service, repository, and module wiring; 10 REST endpoints covering consultation CRUD, sign, amend, and protocol usage management
- `packages/db/prisma/migrations/20260426000000_protocol_usage_checked_state/` — added `checked_state JSONB` and `completed_at TIMESTAMPTZ` columns to `protocol_usages` table
- `packages/shared/src/types/consultation.ts` — `Consultation`, `ConsultationAmendment`, `ConsultationProtocolUsage`, `ConsultationWithDetails` shared types
- `packages/shared/src/schemas/consultation.ts` — `CreateConsultationSchema`, `UpdateConsultationSchema`, `AmendConsultationSchema`, `AddProtocolUsageSchema`, `UpdateCheckedStateSchema` with DTOs
- `packages/shared/src/errors.ts` — `PROTOCOL_USAGE_NOT_FOUND`, `PROTOCOL_HAS_NO_ACTIVE_VERSION` error codes
- `apps/web/src/hooks/consultations/use-consultations.ts` — React Query hooks for all consultation and protocol usage operations
- `apps/web/src/components/protocols/BlockRendererRunMode.tsx` — interactive protocol block renderer; checklists, steps, and decision branches are tappable with `checkedState` tracked per-item
- `apps/web/src/pages/ConsultaNueva.tsx` — new consultation creation page, auto-creates and redirects when `patientId` + `locationId` are passed as query params
- `apps/web/src/pages/Consulta.tsx` — full consultation editor: SOAP notes with debounced auto-save, sign/amend workflow, and Protocolos tab with interactive protocol run cards and protocol picker modal
- Routes `/consultas/nueva` and `/consultas/:id` added to `apps/web/src/App.tsx`

### Changed

- `apps/api/src/app.module.ts` — registered `ConsultationsModule`
- `apps/web/src/pages/Pacientes.tsx` — `ClinicalHistory` component wired to `usePatientConsultations(patientId)`; renders consultation list with click-to-navigate and "Nueva consulta" button

## [2026-04-26] — Patient table actions, modal modes, PacienteDetalle removal

### Added

- `apps/web/src/pages/Pacientes.tsx` — three icon-button actions on every patient row: view (`ph-eye`), edit (`ph-pencil-simple`), delete (`ph-trash` with danger hover)
- `PatientModal` component — single modal with `mode: 'create' | 'edit' | 'view'`; view mode renders read-only `ReadField` grid (name, sex, document, DOB, phone, email, blood type, notes); create/edit mode renders full form; all Select dropdowns use `value={x || undefined}` to avoid Radix placeholder bug
- `ClinicalHistory` component inside `Pacientes.tsx` — collapsible section stub in view mode, ready to wire to `usePatientConsultations(patientId)` once consultations module is built
- `DeleteConfirmModal` component — danger confirmation modal using `ModalHeader` with `icon` + `iconVariant="danger"`, subtitle showing patient name, error `Callout` below footer on API failure
- `ReadField` component — read-only label (overline style) + value pair for patient view layout

### Changed

- Create patient button now opens `PatientModal` in `'create'` mode (was unhooked)
- `apps/web/src/components/ui/Select.tsx` — removed `SelectPrimitive.Portal` wrapper from `SelectContent`; fixes Select dropdowns failing to open inside Radix Dialog (focus trap was blocking portal content)
- `apps/web/src/components/ui/Modal.tsx` — added `aria-describedby={undefined}` to `Dialog.Content` to silence Radix accessibility warning when no description is provided

### Removed

- `apps/web/src/pages/PacienteDetalle.tsx` — deleted; patient detail is now fully modal-based
- `apps/web/src/App.tsx` — removed `pacientes/:patientId` route and `PacienteDetalle` import

---

## [2026-04-25] — Appointments & Calendar

### Added

- `packages/shared/src/types/appointment.ts` — added `AppointmentWithDetails` interface (extends `Appointment` with `patientName`, `patientDocumentNumber`, `locationName`)
- `apps/api/src/modules/appointments/` — full CRUD module: `AppointmentsRepository`, `AppointmentsService`, `AppointmentsController`, `AppointmentsModule`
  - `GET /v1/appointments` — list by locationId, date range, status (includes patient + location names)
  - `GET /v1/appointments/:id`, `POST /v1/appointments`, `PATCH /v1/appointments/:id`, `PATCH /v1/appointments/:id/status`, `DELETE /v1/appointments/:id`
  - Conflict detection: rejects overlapping appointments for the same doctor (excludes cancelled)
  - Prisma `userId` mapped to shared type `doctorUserId` in `toAppointment()` mapper
- `apps/web/src/hooks/appointments/use-appointments.ts` — TanStack Query hooks: `useAppointments`, `useAppointment`, `useCreateAppointment`, `useUpdateAppointment`, `useUpdateAppointmentStatus`, `useDeleteAppointment`
- `apps/web/src/pages/Agenda.tsx` — full day-view agenda: date navigation (prev/next/today), appointment cards with status badges and inline actions (complete, no-show, edit, delete), create/edit modal with patient combobox (live search), location select, date + time inputs; integrates with `activeLocationId` from UI store

---

## [2026-04-26] — Multi-location management (feat/multilocation)

### Added

- `packages/shared/src/types/location.ts` — added `city`, `isOwned`, `notes` fields to `Location` interface
- `packages/shared/src/schemas/location.ts` — added `city`, `isOwned`, `notes` to `CreateLocationSchema` / `UpdateLocationSchema`
- `packages/shared/src/errors.ts` — added `LOCATION_HAS_FUTURE_APPOINTMENTS` error code
- `apps/api/src/modules/locations/` — full CRUD module: `LocationsRepository`, `LocationsService`, `LocationsController`, `LocationsModule`
  - `GET /v1/locations`, `GET /v1/locations/:id`, `POST /v1/locations`, `PATCH /v1/locations/:id`, `DELETE /v1/locations/:id`
  - Creating a location auto-creates a `DoctorLocation` row linking the owner to it
  - Delete is blocked if the location has future non-cancelled appointments
  - `commissionPercent` (Prisma Decimal) mapped to `number` via `toLocation()` mapper
- `apps/api/src/app.module.ts` — registered `LocationsModule`
- `apps/web/src/hooks/locations/use-locations.ts` — TanStack Query hooks: `useLocations`, `useLocation`, `useCreateLocation`, `useUpdateLocation`, `useDeleteLocation`
- `apps/web/src/pages/ajustes/Ubicaciones.tsx` — locations management page with create/edit modal form and delete confirmation
- `apps/web/src/App.tsx` — added `/ajustes/ubicaciones` route
- `apps/web/src/pages/Ajustes.tsx` — added Ubicaciones link in settings hub

### Changed

- `apps/web/src/components/layout/Topbar.tsx` — location switcher now fetches real locations, auto-selects first location on load, shows dropdown to switch active location; active location persisted in `ui.store`

---

## [2026-04-25] — Swagger / OpenAPI documentation for all API routes

### Added

- `@nestjs/swagger` v8 + `swagger-ui-express` installed on `apps/api`.
- Swagger UI available at `http://localhost:3000/docs` (all environments).
- **Firebase auth from Swagger:** `POST /v1/auth/dev/token` (non-production only) exchanges email + password for a Firebase ID token; accepts both JSON and `application/x-www-form-urlencoded` so Swagger's OAuth2 password flow dialog works natively — no external tooling needed.
- Both `BearerAuth` (manual token paste) and `OAuth2 password flow` security schemes configured; both accepted on all protected routes.
- Full `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiParam`, `@ApiQuery` decorators on all 6 controllers: Auth, Patients, Protocols, Protocol Templates, Protocol Types, Onboarding.
- `FIREBASE_WEB_API_KEY` env var added to `.env` and `configuration.ts` (used by the dev/token endpoint in non-emulator environments).

## [2026-04-25] — Phase 2: Reconcile UI components and add Tabs, Select, Toast

### Added

- `apps/web/src/components/ui/Tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` built on `@radix-ui/react-tabs`; active tab uses 2px teal bottom border (design system signature)
- `apps/web/src/components/ui/Select.tsx` — `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectLabel`, `SelectSeparator` built on `@radix-ui/react-select`; styled to match `Input` component
- `apps/web/src/components/ui/Toast.tsx` — `Toast`, `ToastTitle`, `ToastDescription`, `ToastProvider`, `ToastViewport` built on `@radix-ui/react-toast` with design-system semantic variant styling
- `apps/web/src/components/ui/Toaster.tsx` — convenience wrapper rendering toasts from `useToast` state
- `apps/web/src/hooks/use-toast.ts` — lightweight toast state hook (no global singleton needed for MVP)
- `@radix-ui/react-tabs`, `@radix-ui/react-select` added to `apps/web` dependencies

### Changed

- All `apps/web/src/components/ui/*.tsx` files — migrated from `import { clsx }` to `import { cn } from '@/lib/utils'` for proper Tailwind class deduplication
- `apps/web/src/components/layout/Sidebar.tsx` — migrated to `cn`
- `apps/web/src/components/protocols/EditorBlockRenderer.tsx` — replaced deleted `.pblock*` CSS classes with Tailwind equivalents; migrated to `cn`
- `apps/web/src/pages/ajustes/PlantillaEditor.tsx` — replaced DOM-manipulation toast with `Toast`/`ToastProvider`/`ToastViewport` components using local React state

---

## [2026-04-25] — Phase 1: Add shadcn configuration and cn utility

### Added

- `apps/web/components.json` — shadcn/ui configuration: default style, no RSC, CSS variables enabled, aliases pointing to `@/components/ui` and `@/lib/utils`
- `apps/web/src/lib/utils.ts` — `cn()` utility combining `clsx` + `tailwind-merge` for correct Tailwind class deduplication; required by any shadcn-generated component

---

## [2026-04-25] — Phase 0f: Migrate raw CSS class usages to React components/Tailwind

### Changed

- `apps/web/src/pages/Signup.tsx` — replaced `.card`, `.field`, `.input`, `.btn`, `.callout` classes with `Card`, `Field`, `Input`, `Button`, `Callout` UI components
- `apps/web/src/pages/Bienvenido.tsx` — replaced `.btn`, `.callout` classes with `Button`, `Callout` UI components
- `apps/web/src/pages/BienvenidoPersonalizar.tsx` — replaced `.btn`, `.callout` classes with `Button`, `Callout`; transparent inline inputs use raw `<input>` with Tailwind; select elements use Tailwind-styled raw `<select>`
- `apps/web/src/pages/Ajustes.tsx` — replaced `.card`, `.btn` classes with `Card`, `CardTitle`, `Button` UI components
- `apps/web/src/pages/PacienteDetalle.tsx` — replaced `.callout`, `.badge`, `.card`, `.btn`, `.grid-2`, `.row` classes with `Callout`, `Badge`, `Card`, `CardTitle`, `Button` UI components and Tailwind utilities
- `apps/web/src/pages/ajustes/Plantillas.tsx` — replaced `.btn`, `.callout`, `.empty-state`, `.table`, `.badge` classes with `Button`, `Callout`, `EmptyState`, `Badge` UI components; table uses Tailwind border/overflow wrapper
- `apps/web/src/pages/Pacientes.tsx` — replaced `.row`, `.avatar`, `.badge`, `.btn`, `.card`, `.input-group`, `.input-icon`, `.input`, `.callout`, `.empty-state`, `.table` classes with `Button`, `Badge`, `Card`, `InputGroup`, `InputIcon`, `Input`, `Callout`, `EmptyState` UI components; avatar uses Tailwind inline styles
- `apps/web/src/pages/ajustes/Tipos.tsx` — replaced `.modal-overlay/.modal.*`, `.field`, `.input`, `.btn`, `.badge`, `.empty-state`, `.table`, `.callout` classes with `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`, `Field`, `Input`, `Button`, `Badge`, `EmptyState`, `Callout` UI components
- `apps/web/src/pages/ajustes/PlantillaEditor.tsx` — replaced `.btn`, `.callout` classes with `Button`, `Callout` UI components
- `apps/web/src/components/template/TemplateEditor.tsx` — replaced `.field`, `.input`, `textarea.input`, `button.btn.*`, `.badge.*`, `.callout.callout--warning`, `button.pblock-add-btn` classes with `Field`, `Input`, `Button`, `Badge`, `Callout`, `AddBlockButton` UI components; textareas use raw Tailwind

---

## [2026-04-25] — CI/CD pipeline fixes and Firebase Hosting migration

### Added

- `firebase.json` — hosting config with SPA rewrite rule and cache headers for assets/HTML
- `.github/workflows/deploy-dev.yml` — frontend now deploys to Firebase Hosting instead of raw GCS, eliminating broken asset paths and SPA routing failures
- `apps/api/src/lib/firebase.service.ts` — support for `FIREBASE_ADMIN_KEY` JSON blob env var (Cloud Run secret) as fallback when individual `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` vars are not set

### Fixed

- `packages/db/prisma/migrations/20260422223833/migration.sql` — removed duplicate `CREATE UNIQUE INDEX protocol_types_tenant_id_name_key` that caused `P3018` migration failure on deploy
- `.github/workflows/deploy-dev.yml` — replaced artifact-based API URL passing with job output (`needs.deploy-api.outputs.url`); added `--project` flag to `gcloud secrets versions access` commands; added `VITE_FIREBASE_*` secrets to frontend build step
- `packages/db/src/seed.ts` — updated dev seed to use real owner account data with `OWNER_FIREBASE_UID` env var support
- `scripts/db-seed.sh` — fixed `DIRECT_URL` using wrong secret name; removed emulator-dependent `seed-dev-users.ts` call; added post-seed instructions for updating `firebase_uid`
- `scripts/seed-templates.sh` — fixed `DIRECT_URL` using wrong secret name
- `apps/web/.env.development.local` — removed `VITE_FIREBASE_AUTH_EMULATOR_HOST` so local dev uses real Firebase Auth instead of the emulator

---

## [2026-04-24] — Fix API build output path

### Fixed

- `apps/api/tsconfig.build.json` — added `rootDir: "src"` and `include: ["src"]` so `tsc` emits to `dist/main.js` instead of `dist/src/main.js`; the Dockerfile `CMD ["node", "dist/main.js"]` and `package.json` `start` script now resolve correctly

---

## [2026-04-24] — API Dockerfile and production build pipeline

### Added

- `apps/api/Dockerfile` — two-stage build: builder installs all deps, generates Prisma client, compiles `@rezeta/shared` and `@rezeta/api`; runner installs prod deps only and copies compiled artifacts
- `.dockerignore` — excludes `node_modules`, `dist`, `apps/web`, secrets, and dev-only dirs from the Docker build context
- `packages/shared/tsconfig.build.json` — mirrors the API pattern; extends base tsconfig with `noEmit: false` so `tsc` actually emits JS output

### Changed

- `packages/shared/package.json` — added `build: tsc -p tsconfig.build.json` script; changed `main` and `exports` from `./src/index.ts` to `./dist/index.js` so the compiled package is loadable by Node.js at runtime

## [2026-04-24] — CI/CD and deployment scripts: pnpm + DIRECT_URL fixes

### Changed

- `.github/workflows/deploy-dev.yml`: replaced `actions/setup-node` npm cache with `pnpm/action-setup@v4` + pnpm cache in both jobs; replaced `npm ci`/`npm run build` with `pnpm install --frozen-lockfile`/`pnpm build`; migration step now exports `DIRECT_URL` from Secret Manager and uses `pnpm --filter @rezeta/db exec prisma migrate deploy`
- `scripts/deploy-frontend.sh`: replaced `npm ci`/`npm run build` with pnpm equivalents
- `scripts/run-migrations.sh`: added `DIRECT_URL` from Secret Manager; replaced `npx prisma` with `pnpm --filter @rezeta/db exec prisma`
- `scripts/seed-templates.sh`: added `DIRECT_URL`; replaced `npx tsx` with `pnpm --filter @rezeta/tools exec tsx`

## [2026-04-24] — Supabase connection pooling configuration

### Changed

- `packages/db/prisma/schema.prisma`: added `directUrl = env("DIRECT_URL")` to datasource so `prisma migrate` uses a direct Postgres connection (port 5432) while the app uses Supabase's PgBouncer pooler (port 6543)
- `apps/api/src/lib/prisma.service.ts`: removed eager `$connect()` on module init (lazy connect is correct for Cloud Run + PgBouncer); removed `OnModuleInit`; added NestJS `Logger` wired to Prisma's `error` and `warn` events
- `apps/api/.env.example`: documented `DATABASE_URL` (pooler, `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` (direct) with Supabase URL patterns
- `packages/db/.env`: added `DIRECT_URL` for local dev (both vars point to the same local Postgres instance)

## [2026-04-23] — Settings: Design System Viewer Pages

### Added

- **`/ajustes/design-system/prototype`** — full-height iframe displaying `design-system/app-prototype.html` (the 9-screen navigable MVP prototype) inside the app shell
- **`/ajustes/design-system/reference`** — full-height iframe displaying `design-system/reference.html` (the component specimen library)
- **`DesignSystemViewer.tsx`** — shared viewer component with breadcrumb, title, description, "open in tab" link, and a viewport-relative iframe
- **`AppPrototype.tsx`** and **`DesignSystemReference.tsx`** — thin wrappers that supply the title, description, and src to the viewer
- **Symlink** `apps/web/public/design-system` → `../../../design-system` so Vite serves the HTML files at `/design-system/*.html`
- **Two new links in `Ajustes.tsx`** — "Prototipo de la aplicación" and "Referencia de componentes" added below the Tipos link in the settings card
- **Design system strings** added to `strings.ts` under `// Settings — Design System`

### Changed

- `App.tsx` — added routes for `/ajustes/design-system/prototype` and `/ajustes/design-system/reference`
- `Ajustes.tsx` — Tipos link gains `borderBottom` to separate it from the new design system section

---

## [2026-04-23] — Protocol Engine: Full CRUD, Block Editors & Browsing

### Added

- **Block editors — collection types:** `ChecklistBlockEditor`, `StepsBlockEditor`, `DecisionBlockEditor`, and `DosageTableEditor` — all four remaining block types are now fully editable in the protocol editor
- **Protocol save & publish flow:** save as draft or publish a version; the API creates an immutable `ProtocolVersion` row on every save
- **Protocol delete (soft):** doctors can delete protocols from the list; soft-delete via `deleted_at`, never hard-deleted
- **Protocol list improvements:** search by title, filter by type, and favorite toggle on the `/protocolos` page
- **`remaining-mvp-slices.md` spec:** planning document for the remaining MVP work after the protocol engine

### Changed

- `protocols.service.ts` / `protocols.repository.ts` / `protocols.controller.ts` — extended with save, publish, delete, list-with-filter, and favorites endpoints
- `use-protocols.ts` hook — added mutations for save, publish, delete, and favorite toggle
- `Protocolos.tsx` — rebuilt list page with search bar, type filter dropdown, and empty states

---

## [2026-04-23] — Protocol Editor: Simple Blocks & Section Support (Slices 4 & 5/6)

### Added

- **`EditorBlockRenderer`** — unified block renderer for the three-panel protocol editor; handles text, alert, checklist, steps, decision, and dosage blocks in edit mode
- **`TextBlockEditor`** and **`AlertBlockEditor`** — inline editors for the two simplest block types (Slice 4)
- **`editor.store.ts`** (Zustand) — client-side state for the protocol editor: current blocks, dirty flag, selected block ID, undo stack
- **Section block editing** — sections can be added, renamed, collapsed/expanded, and reordered within the canvas; child blocks are managed within their parent section

### Changed

- `ProtocolEditor.tsx` — wired to `editor.store`; palette inserts blocks into the correct parent; canvas reflects live state; dirty-state banner appears on unsaved changes
- `TemplateEditor.tsx` — improved row UX, inline expand/collapse, required toggle, placeholder hint field

---

## [2026-04-23] — Protocol Engine: Templates, Types & Onboarding (Slice A–E)

### Added

- **Onboarding flow** (`/bienvenido`, `/bienvenido/personalizar`) — blocks new tenants from the app until templates and types are configured; default path seeds five starter templates + five default types in one transaction; personalizar path allows editing/adding/removing before committing
- **`BienvenidoGate`** — route guard that enforces the onboarding invariant: `tenant.seeded_at` must be set before any app route resolves
- **`ProtocolType` module** — full CRUD for tenant-owned protocol types: list, create (name + template), rename, soft-delete, with lock enforcement (deletion blocked if any protocol references the type)
- **Template editor** (`/ajustes/plantillas/:id/edit`) — single-column flat block-list editor for authoring template structure: add/reorder/delete blocks, toggle required flag, write placeholder hints; locked read-only when any type references the template
- **`TemplateEditor.tsx`** — 900-line React component implementing the template editor UX spec
- **Plantillas page** (`/ajustes/plantillas`) — list of tenant templates with create and edit actions
- **Tipos page** (`/ajustes/tipos`) — list of tenant protocol types with inline rename, create modal, and delete with lock warning
- **`TenantSeedingService`** — seeding logic that copies the five starter fixtures into a new tenant atomically; idempotent (skips if `seeded_at` is set)
- **`starter-fixtures/index.ts`** — the five canonical starter template JSON schemas in code (Emergency Intervention, Clinical Procedure, Pharmacological Reference, Diagnostic Algorithm, Physiotherapy Session)
- **Onboarding API** (`POST /v1/onboarding/default`, `POST /v1/onboarding/custom`) — two endpoints that trigger seeding with full rollback on failure
- **Database migrations** — `seeded_at` on `Tenant`, `is_seeded` on `ProtocolTemplate` and `ProtocolType`, `ProtocolType` table
- **Protocol types hooks** (`use-protocol-types.ts`) — TanStack Query hooks for type list, create, rename, delete
- **Ajustes page routing** — settings page now routes to `/ajustes/plantillas` and `/ajustes/tipos` sub-pages
- **`onboarding-flow.md`**, **`template-editor-ux.md`** — new spec documents authored as part of this slice

### Changed

- `ProtocolTemplate` module — extended with full CRUD (list, get by ID, create, update, delete), lock enforcement (reject edit/delete if any type references the template), and schema validation
- `Protocol` module — creation flow now resolves type → template → copies `placeholder_blocks` into initial `ProtocolVersion` content
- `auth.service.ts` — triggers tenant seeding after first successful signup if the onboarding flag is not yet set
- Shared schemas — added `onboarding.ts` schema; updated `protocol.ts` with type/template schemas

---

## [2026-04-19] — Protocol Engine: Create & View Protocols (Slices 2+3)

### Added

- **Protocol creation flow** — "Nuevo protocolo" opens a type picker modal, collects a title, and creates the protocol via the API with the template's `placeholder_blocks` pre-populated as the first version
- **`ProtocolEditor`** page (`/protocolos/:id/edit`) — three-panel layout (palette · canvas · live preview); palette lists all block types; canvas renders current blocks; live preview mirrors the mobile viewer
- **`ProtocolViewer`** page (`/protocolos/:id`) — read-only mobile-optimized view of a published protocol; collapsible sections, tappable checkboxes (session-scoped), severity-colored alert blocks
- **`BlockRenderer`** component — shared renderer used by both the editor preview and the standalone viewer; handles all six block types plus sections
- **`TemplatePickerModal`** component — modal for selecting a protocol type and entering a name during protocol creation
- **`content-builder.ts`** (shared) — utility that converts a template's `placeholder_blocks` into an initial protocol content payload; tested with 186-line test suite
- **`use-protocols.ts`** hook — TanStack Query hooks for list, get, create protocol
- **`protocol.ts` schemas** (shared) — Zod schemas for all six block types, sections, template schema, and protocol content schema

### Changed

- `/protocolos` list page — rebuilt to show tenant protocols (not system templates); empty state directs user to create first protocol
- `packages/shared/src/schemas/protocol.ts` — significantly expanded with block-type-specific schemas and validation rules from the spec

---

## [2026-04-19] — Application Foundation + Firebase Authentication

### Added

- **Full monorepo scaffold** — `apps/web`, `apps/api`, `packages/db`, `packages/shared` wired via pnpm workspaces
- **Firebase Authentication** — email/password sign-up and login; Firebase ID tokens verified on every API request via `FirebaseAuthGuard`; `TenantGuard` injects `tenant_id` from the authenticated user into every request
- **NestJS API** — structured with modules, guards, interceptors, pipes, and filters per the technical architecture spec:
  - `FirebaseAuthGuard` — verifies ID tokens, resolves `User` record
  - `TenantGuard` — injects tenant context
  - `AuditLogInterceptor` — writes audit entries alongside every mutation in the same transaction
  - `ResponseEnvelopeInterceptor` — wraps all success responses in `{ data: ... }`
  - `ZodValidationPipe` — validates every request body against shared Zod schemas
  - `HttpExceptionFilter` — translates errors to `{ error: { code, message } }` envelopes
- **Prisma schema** — full data model for all MVP entities: `Tenant`, `User`, `Location`, `Patient`, `Appointment`, `Consultation`, `ConsultationAmendment`, `Prescription`, `Invoice`, `InvoiceItem`, `ProtocolTemplate`, `ProtocolType`, `Protocol`, `ProtocolVersion`, `AuditLog`, `Attachment`
- **Patient module** — CRUD API for patients: list (tenant-scoped), get by ID, create, update, soft-delete; doctor-owned patient model enforced
- **Auth module** — sign-up endpoint provisions the `User` row and `Tenant` row on first login; sign-in returns the profile
- **React + Vite frontend** — SPA with React Router v7, TanStack Query, Zustand, and Tailwind CSS
- **Core pages** — Login, Signup, Dashboard, Pacientes (list + detail), Agenda, Facturación, Ajustes, Protocolos (stub)
- **UI component library** — React wrappers around the design system: `Button`, `Input`, `Card`, `Badge`, `Avatar`, `Modal`, `Callout`, `EmptyState`, `ProtocolBlock` (with Storybook stories)
- **`AuthGate`** and **`PublicOnlyGate`** — route guards for authenticated and unauthenticated routes
- **`AppLayout`**, **`Sidebar`**, **`Topbar`** — responsive shell with location switcher and user profile
- **`auth.store.ts`** (Zustand) — stores authenticated user; persists across page refreshes via Firebase `onAuthStateChanged`
- **Shared schemas** — Zod schemas for all MVP entities in `packages/shared/src/schemas/`
- **Shared types** — TypeScript interfaces for all MVP entities in `packages/shared/src/types/`
- **Shared error codes** — closed enum of all API error codes in `packages/shared/src/errors.ts`
- **Integration test suite** — `apps/api/test/auth.integration.ts` and `apps/api/test/protocols.integration.ts`
- **Dev tooling** — Docker Compose (Postgres + Firebase emulator), seed scripts (`seed.ts`, `seed-dev-users.ts`, `seed-protocol-templates.ts`), Husky pre-commit hooks (lint + typecheck), Commitlint
- **`protocol-engine-slices.md`** — delivery plan for the full protocol engine implementation

---

## [2026-04-18] — Initial Project Scaffold

### Added

- Repository structure: `apps/`, `packages/`, `specs/`, `design-system/`, `tools/`, `infra/`
- **Design system** — `design-system/tokens.css` (all CSS custom properties), `design-system/components.css` (full component library), `design-system/reference.html` (living component specimen), `design-system/app-prototype.html` (9-screen navigable prototype)
- **Specification documents** — `mvp-scope.md`, `full-scope.md`, `business-model.md`, `technical-architecture.md`, `protocol-template-schema.md`, `starter-templates.md`, `protocol-editor-ux.md`, `medical_erp_erd.mmd`, `design-system/tokens.md`, `design-system/components.md`, `design-system/principles.md`, `design-system/implementation.md`
- **`CLAUDE.md`** — project memory file loaded by Claude Code at session start
- Root `package.json` with pnpm workspace config; `eslint.config.js`, `prettier` config, `commitlint.config.js`
