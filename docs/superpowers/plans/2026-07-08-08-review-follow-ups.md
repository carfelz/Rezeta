# Review Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 7 follow-ups deferred by the chore/todo-cleanup final review: the cross-tab false-stale design fix (contentUpdatedAt — decision by Carlos 2026-07-08), plus six small cleanups.

**Architecture:** Branch `chore/review-follow-ups` off main (post PR #33+#34). Three tasks/commits: (1) the db+shared+api+web contentUpdatedAt slice, (2) DRY/placement cleanups, (3) editor-draft/invalidate/test cleanups. Every shared change ships with all consumers in the same commit; the typecheck gate now includes test files, so test fixtures constructing changed types are hard consumers too.

**Tech stack:** NestJS + Prisma, React 18 + TanStack Query + Zustand, Zod in @rezeta/shared, vitest.

## Global Constraints

- TDD per task. Gates per task: `pnpm --filter <touched> test`, `pnpm lint`, `pnpm -r typecheck` (test-inclusive). Final: full `pnpm test` + `pnpm test:coverage` (95% per-file).
- No TODO/FIXME. 2-space indent. Spanish user-facing strings colocated. Lower-case commit subjects + trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` (blank line before).
- CHANGELOG.md entry per task under a NEW distinct `## [2026-07-08]` heading (check existing titles first — many exist for this date).
- Immutable signed records: no weakening of signed guards.

## Verified facts (from the review + session; re-locate line numbers)

- Stale check lives in `apps/api/src/modules/consultations/consultations.service.ts` `updateProtocolUsage` (compares serialized `usage.updatedAt` string vs `dto.expectedUpdatedAt`, throws 409 `PROTOCOL_USAGE_STALE` with `details.currentUpdatedAt`, strips the field before repo call). Serializer `toProtocolUsage` in `consultations.repository.ts` emits `updatedAt`. Web sender: `use-pending-modifications.ts` builds `contentUpdate = { content, expectedUpdatedAt: usage.updatedAt }`; stale branch drops contentEdits, re-buffers modifications, toasts `errorProtocolUsageStale`, invalidates.
- `ProtocolUsage` content is replaced wholesale ONLY via `updateProtocolUsage` with `dto.content`; checked-state/skip/off-note send modification events (append-merge, no content). Prisma bumps row `updatedAt` on ANY update — that's the false-stale bug.
- Duplicated label maps: `apps/web/src/pages/settings/AuditLog.tsx` `ENTITY_TYPE_LABELS` and `apps/web/src/pages/Dashboard/helpers.ts` `friendlyEntity` (historical kebab keys duplicated verbatim; Dashboard uses lowercase article phrasing "una historia médica" — the two maps serve different rendering contexts, so extract the SHARED KEY SET, not one merged map).
- `consultation-records.service.ts`: `ensureDraft` and `regenerate` duplicate the create-payload object; `getById`/`getVersion` duplicate the 404 block; `getVersion`'s 404 message is not version-specific.
- `apps/web/src/hooks/__tests__/use-consultations.create-toasts.test.tsx` belongs in `hooks/consultations/__tests__/` — but NOTE: its source `use-consultations.ts` lives in `src/hooks/consultations/`? Verify the source location first; move the test alongside whichever dir the source is in. Update any relative mocks/imports on move.
- `RecordDocument.tsx` `handleDownloadRecordPdf` has a pointless `versionNumber !== undefined ? f(id, v) : f(id)` ternary (param is optional).
- `editor.store.ts` `saveLocalDraft(protocolId, blocks, historiaMapping?)` omits `historia_mapping` when empty; a crash draft whose only change was CLEARING a mapping restores without the clear. Decision: persist the key whenever the caller passes a defined mapping (including `{}`), keep omitting when undefined; `loadLocalDraft` back-compat unchanged (absent key → undefined). `applyDraft` in `ProtocolEditor/index.tsx` guards `if (draftBanner.historiaMapping)` — `{}` is truthy so it applies; verify.
- `use-consultation-record.ts`: `useEnsureRecord` invalidates only `[QK, consultationId]`; regenerate/sign also invalidate `[QK, consultationId, 'versions']` — align.
- Task 5 minor from the old review: no test asserts `qc.invalidateQueries` still fires under `{ silent: true }` in the three create hooks (`use-consultations.ts`). The harness for hook-level toast tests is `use-consultations.create-toasts.test.tsx`.

---

### Task 1: contentUpdatedAt — content-specific stale precondition (db+shared+api+web, ONE commit)

**Files:** `packages/db/prisma/schema.prisma` (+migration `protocol_usage_content_updated_at`), `packages/shared/src/types/consultation.ts`, `packages/shared/src/schemas/consultation.ts`, `apps/api/src/modules/consultations/consultations.repository.ts`, `consultations.service.ts`, `apps/web/src/hooks/consultations/use-pending-modifications.ts` + all affected specs/fixtures (the test-inclusive typecheck will enumerate them — every fixture constructing `ConsultationProtocolUsage` gains the new field).

**Interfaces:**
- Schema: `ProtocolUsage.contentUpdatedAt DateTime @default(now()) @map("content_updated_at")`. Migration backfills existing rows: `UPDATE protocol_usages SET content_updated_at = updated_at`.
- Repo: `updateProtocolUsage` sets `contentUpdatedAt: new Date()` in the update data ONLY when `dto.content !== undefined`. `toProtocolUsage` emits `contentUpdatedAt` ISO string (keep emitting `updatedAt` too).
- Shared: `ConsultationProtocolUsage.contentUpdatedAt: string`. `UpdateProtocolUsageSchema`: RENAME `expectedUpdatedAt` → `expectedContentUpdatedAt` (web is the only client; single deploy unit — no compat shim).
- API service: compare `usage.contentUpdatedAt !== dto.expectedContentUpdatedAt` (only when `content` present, after signed/not-found guards, strip before repo). 409 details: `{ currentContentUpdatedAt }`. Error code `PROTOCOL_USAGE_STALE` unchanged.
- Web: flush sends `expectedContentUpdatedAt: usage.contentUpdatedAt` with content. Stale branch semantics unchanged.
- Behavior contract (THE fix): a modifications-only PATCH (checklist tick / skip / off-note) MUST NOT change `contentUpdatedAt` — a subsequent content flush with a precondition taken before that PATCH succeeds.

- [ ] Failing tests first: api service (modifications-only update then content update with pre-modification precondition → succeeds; content update with stale content precondition → 409 with new details key; repo emits contentUpdatedAt; repo bumps it only on content writes), web flush (sends the renamed field from usage.contentUpdatedAt).
- [ ] Red → implement (+ real `prisma migrate dev`) → green + gates.
- [ ] CHANGELOG + commit `feat: content-specific stale precondition on protocol usage`

### Task 2: DRY + placement cleanups (items 2, 3, 4 — one commit)

- Extract the historical/current audit entity-label KEY SETS shared by `AuditLog.tsx` and `Dashboard/helpers.ts` into one module (suggest `apps/web/src/lib/audit-entities.ts`) exporting the two label maps (formal + article phrasing) or a base map + per-context overrides — choose the smallest shape that removes the verbatim duplication without merging distinct copy.
- `consultation-records.service.ts`: factor the duplicated create-payload into a private helper; factor the duplicated 404 throw; `getVersion` message becomes version-specific (e.g. `Historia record version N not found`).
- Move `use-consultations.create-toasts.test.tsx` next to its source's `__tests__` dir (verify source location first); fix imports/mocks. Drop the redundant ternary in `RecordDocument.tsx` `handleDownloadRecordPdf`.
- [ ] Tests: existing suites keep passing (moves/refactors); add/adjust minimal tests only where behavior text changed (404 message).
- [ ] Gates. CHANGELOG + commit `refactor: dedupe audit entity labels and consultation-record service internals`

### Task 3: Draft clear-marker + versions invalidate + silent-invalidation test (items 5, 6, 7 — one commit)

- `editor.store.ts` `saveLocalDraft`: persist `historia_mapping` whenever the param is defined (including `{}`); `loadLocalDraft` unchanged (absent → undefined). Page `applyDraft`: ensure a loaded `{}` mapping is applied (guard must treat `{}` as present — adjust to `!== undefined` check). Autosave call site passes `mappingRef.current` already — verify it passes `{}` (not undefined) after a clear.
- `use-consultation-record.ts` `useEnsureRecord`: also invalidate `[QK, consultationId, 'versions']`.
- `use-consultations.create-toasts.test.tsx` (post-move path): add cases asserting `qc.invalidateQueries`/refetch still fires under `{ silent: true }` for the three create hooks.
- [ ] TDD; gates. CHANGELOG + commit `fix(web): persist cleared historia mapping in drafts, align record invalidation, cover silent invalidation`

### Task 4: Final gates + wrap-up

- [ ] Full `pnpm lint && pnpm -r typecheck && pnpm test && pnpm test:coverage`.
- [ ] Whole-branch review (SDD final review), then push + PR.
