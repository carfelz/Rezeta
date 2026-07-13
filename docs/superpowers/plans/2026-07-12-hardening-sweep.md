# Hardening sweep — findings and fix plan

> **STATUS: COMPLETE — 2026-07-12.** Every confirmed work item shipped to `main`. The only
> remaining items are the three under "Not fixed here (deliberate)". Full suite green on `main`
> (API 1,308, shared 467, web 1,252), coverage 99.92%.
>
> Shipped commits:
> - Foundation (error codes + this plan): `6a7803d`
> - WI-A consultation immutability guards + amend retry: `6e24e64`
> - WI-B order immutability guards: `dce3522`
> - WI-C schedules cross-tenant location check: `30658a6`
> - WI-D invoice correctness: `065ce8c`
> - WI-G protocol version atomicity: `c5a201c`
> - WI-E appointments advisory lock + error code: `10a123c`
> - WI-F validation infra (pipe/filter/query schemas): `d5ad483`
> - WI-H onboarding bounds + error code: `fa10ccb`; order idempotency partial indexes (imm #7): `470abea`
> - Commission source resolved (billing #2): `ef32069`; follow-up column drop: `b8517a6`
> - Changelogs: `edc35c7` (wave 1), `5586613` (wave 2)

> Created 2026-07-12. Source: a 5-agent parallel audit (concurrency, tenant isolation,
> clinical immutability/soft-delete, validation/error-leakage, billing) of the shipped
> Rezeta API, followed by independent verification of every finding against the code and
> the live DB. Severities below are the VERIFIED severities, which in two cases are lower
> than the raw audit claimed (see WI-G note).

## Execution model

- Each work item (WI) below is **file-disjoint** from the others in its wave, so fix agents
  run in parallel **git worktrees** (max 5 concurrent) without colliding.
- Each WI becomes **one commit** (occasionally two when a DB migration is involved), authored
  by its agent in a `fix/<slug>` branch, TDD-first, gates green in the worktree.
- Fix agents do **not** edit `CHANGELOG.md` (it conflicts across parallel branches); the
  integrator writes the changelog centrally during merge.
- New `ErrorCode` enum values are added up front in a single foundation commit so no two
  agents touch `packages/shared/src/errors.ts`.
- The integrator merges each branch to `main` sequentially, re-running gates between merges.

## Foundation commit (integrator, before Wave 1)

Add to `packages/shared/src/errors.ts`:
- `APPOINTMENT_TIME_INVALID` (replaces the off-enum literal `'INVALID_TIME_RANGE'`).
- `ONBOARDING_UNKNOWN_TEMPLATE` (replaces the off-enum literal `'UNKNOWN_TEMPLATE_CLIENT_ID'`).

## Not fixed here (deliberate)

- **Commission source divergence** (billing #2: `Location.commissionPercent` vs
  `DoctorLocation.commissionPct`): RESOLVED 2026-07-12. Investigation showed it is a bug, not a
  toss-up — the settings UI (`locations.repository.ts` update path) maintains only
  `Location.commissionPercent`, while `DoctorLocation.commissionPct` is stamped once at create
  and never updated. The manual-invoice path already read the authoritative
  `Location.commissionPercent`; the auto-invoice-on-sign path read the stale
  `DoctorLocation.commissionPct`. Fixed so both read `Location.commissionPercent`.
  `DoctorLocation.commissionPct` is now write-only (still stamped at create/seed but read
  nowhere) — a candidate for removal in a future schema-cleanup migration.
- **Patient / consultation `ownerUserId` gaps** (tenant #2/#3): latent until multi-user ships,
  which is explicitly deferred (CLAUDE.md Non-Goals). Left as-is.
- **`ConsultationRecord (consultationId, versionNumber)` full-unique** (imm #8): no soft-delete
  path exists for records, so no current risk. Documented, not changed.

---

## Wave 1 (parallel, file-disjoint)

### WI-A — Consultation immutability guards  [HIGH]
- **Files:** `apps/api/src/modules/consultations/consultations.service.ts` (+ its `__tests__`).
- **Errors:**
  - `addProtocolUsage` (:377) and `removeProtocolUsage` (:517) call `getById` for existence but
    never check `status === 'signed'`, so clinical blocks can be **added to / deleted from a
    signed consultation**, bypassing the amendment flow. Violates the immutable-records
    non-negotiable. Sibling `updateProtocolUsage` (:449) already throws
    `CONSULTATION_ALREADY_SIGNED`.
  - `updateCheckedState` (:478) has the same gap (mutates a usage's `completedAt`/`notes` post-sign).
- **Fix:** capture the consultation returned by `getById` and throw `CONSULTATION_ALREADY_SIGNED`
  when `status === 'signed'` in all three methods, matching `updateProtocolUsage`. Also fold in
  the `amend` P2002-on-amendment-number remap (below) since it lives in the same module.
  - **Concurrency #5 (amendment number race):** `createAmendment` reads max amendment number
    then inserts with no lock; the `(consultationId, amendmentNumber)` unique constraint arbitrates
    but the loser leaks a generic 409. Catch P2002 in `amend` and retry once (re-read max), mirroring
    `consultation-records` regenerate.
- **Tests (first, red):** DELETE/POST/PATCH protocol-usage on a signed consultation → 409
  `CONSULTATION_ALREADY_SIGNED`; unsigned still works; amend retry returns the next number on a
  simulated P2002.

### WI-B — Order immutability guards  [MEDIUM]
- **Files:** `apps/api/src/modules/orders/orders.service.ts` (+ `__tests__`).
- **Errors:** `patchImagingOrder`/`patchLabOrder` (:401) and `renameImagingOrderGroup`/
  `renameLabOrderGroup` (:433) mutate `groupOrder`/`groupTitle` on **signed** orders with no
  status guard, while the sibling `delete*` methods correctly reject `status === 'signed'`.
- **Fix:** add the same signed-status rejection to the two `patch*` and two `rename*` methods.
- **Tests:** patch/rename a signed order → rejected; unsigned still works.

### WI-C — Schedules cross-tenant location check  [HIGH]
- **Files:** `apps/api/src/modules/schedules/schedules.service.ts`,
  `schedules.controller.ts` (thread `tenantId`), `schedules.module.ts` (provide
  `ReferenceGuardService`), (+ `__tests__`).
- **Error:** `createBlock`/`updateBlock`/`createException` pass client `dto.locationId` straight
  to the insert with **no tenant check** — the only module handling a client location FK that
  skips `ReferenceGuardService.assertLocation`. A doctor can attach another tenant's location to
  a schedule block and its name leaks back via `LOCATION_INCLUDE`.
- **Fix:** thread the caller's `tenantId` into the three methods and call
  `references.assertLocation(dto.locationId, tenantId)` before persisting (matching appointments/
  consultations/invoices).
- **Tests:** create/update block/exception with a foreign-tenant locationId → rejected
  (LOCATION_NOT_FOUND / reference error); same-tenant still works.

### WI-D — Invoice correctness  [HIGH]
- **Files:** `apps/api/src/modules/invoices/invoices.repository.ts`,
  `invoices.service.ts`, `packages/shared/src/schemas/invoice.ts` (+ `__tests__` on both api and
  shared; verify `apps/web` invoice consumers still typecheck).
- **Errors:**
  - **Billing #1 (HIGH):** `subtotal` is summed from the **client-supplied** `item.total`
    (`invoices.repository.ts:66`,`:110`); the server never recomputes `quantity × unitPrice`, so a
    crafted request under/over-charges.
  - **Billing #3 (MED):** `commissionAmount`/`netToDoctor` computed as JS floats and stored into
    separate Decimal(12,2) columns → the split can fail to reconcile with `total` by a cent.
  - **Billing #4 (LOW/dormant):** `update()` sets `total = subtotal`, dropping `tax` (create uses
    `subtotal + tax`). Harmless while `tax` is always 0, but the paths disagree.
  - **Concurrency #1 (LOW):** invoice-number generation is count-then-create with no lock; the
    `(tenant_id, invoice_number)` partial unique index prevents duplicates but the loser leaks a
    generic 409.
- **Fix:** derive each line `total = round2(quantity * unitPrice)` server-side (ignore/validate the
  client value) and compute `subtotal` from those; round `commissionAmount` first then derive
  `netToDoctor = subtotal − commissionAmount`; make `update()` total consistent with create;
  catch P2002 on invoice-number insert and retry with a recomputed number (bounded retries).
  Add a `.max()`/`.finite()` bound and (optionally) a cross-field refinement to `InvoiceItemSchema`.
- **Tests:** posting a mismatched `total` yields the recomputed amount; commission split reconciles
  to the cent; concurrent number assignment retries instead of leaking 409.

### WI-G — Protocol version + improvements atomicity  [MEDIUM/LOW]
- **Files:** `apps/api/src/modules/protocols/protocols.repository.ts`,
  `apps/api/src/modules/protocol-improvements/protocol-improvements.service.ts` (+ `__tests__`).
- **Errors:**
  - **Concurrency #3 (MED):** `protocol-improvements.apply` (:62) does
    `aggregate max → create version → protocol.update currentVersionId` via `this.prisma` with
    **no `$transaction`**; a crash between the create and the update leaves `currentVersionId`
    stale / an orphan version.
  - **Concurrency #2 (LOW, severity-corrected):** `saveVersion` reads latest version then creates
    with no `FOR UPDATE`. **The raw-SQL partial unique index
    `protocol_versions (protocol_id, version_number) WHERE deleted_at IS NULL` exists** (verified
    against the live DB), so this does NOT silently duplicate — the raw audit over-claimed it. Real
    defect is only a leaked generic 409 on a rare race.
- **Fix:** wrap `apply` in a single `$transaction` (tx-scoped writes); catch P2002 on version
  insert in both `apply` and `saveVersion` and retry once with a recomputed version number
  (mirroring `consultation-records`).
- **Tests:** `apply` writes version + currentVersionId atomically; a simulated P2002 retries to the
  next version number.

---

## Wave 2 (after Wave 1 merged — touches controllers / shared schemas)

### WI-E — Appointments: double-booking + idempotency + error code  [MEDIUM]
- **Files:** `apps/api/src/modules/appointments/appointments.service.ts`,
  `appointments.repository.ts`, `packages/shared/src/schemas/appointment.ts` (+ `__tests__`).
- **Errors:**
  - **Concurrency #4 (MED):** overlap check (`findOverlappingBlocks`/`hasConflict`) is a TOCTOU
    race — two concurrent creates for overlapping slots both pass and both insert. No DB
    arbitration (overlap can't be a plain unique index).
  - **Concurrency #6 (MED):** `create` has no `clientRequestId` dedup; double-submit → two
    appointments.
  - **Validation #5 (LOW):** off-enum `code: 'INVALID_TIME_RANGE'` → use `APPOINTMENT_TIME_INVALID`.
- **Fix:** serialize the conflict-check-then-insert with a per-doctor advisory lock
  (`pg_advisory_xact_lock(hashtext(userId))`) inside a `$transaction`, or add a
  `clientRequestId` + partial unique index and catch/return on P2002 (choose the advisory-lock
  route for true overlap safety; document the choice). Swap the error code.
- **Note:** the locking strategy is a small design decision — the agent should implement the
  advisory-lock-in-transaction approach and note it in the PR/commit.

### WI-F — Validation infra: query validation + exception mapping  [HIGH]
- **Files:** `apps/api/src/common/pipes/zod-validation.pipe.ts`,
  `apps/api/src/common/filters/http-exception.filter.ts`, and the `@Query` decorators + shared
  query schemas for `protocols`, `invoices`, `appointments`, `consultations`, `schedules`
  controllers (+ `__tests__` for pipe and filter).
- **Errors:**
  - **Validation #1 (HIGH):** `ZodValidationPipe` short-circuits `if (metadata.type !== 'body')`,
    so `@Query`/`@Param` schemas never run (e.g. `protocols.controller.ts:86`). Bad `categoryId`
    → raw Prisma P2023 → 500.
  - **Validation #2 (MED-HIGH):** invoices/appointments/consultations list endpoints read raw
    `@Query` UUID/date strings into Prisma → 500 on malformed input.
  - **Validation #3 (MED-HIGH):** the exception filter maps only P2002; P2003/P2025/P2023 and
    `PrismaClientValidationError` fall through to 500, leaking name+stack in non-prod.
- **Fix:** make `ZodValidationPipe` validate `query` and `param` too; add/verify Zod query schemas
  on the five list endpoints; extend the filter to map P2025→404, P2003→409/400, P2023 &
  `PrismaClientValidationError`→400 `VALIDATION_ERROR`, keeping prod detail suppression.
- **Note:** WI-C also edits `schedules.controller.ts`; sequence WI-F after WI-C merges (Wave 2).

### WI-H — Misc low-severity  [LOW]
- **Files:** `packages/shared/src/schemas/onboarding.ts`,
  `apps/api/src/modules/onboarding/onboarding.service.ts`, plus a new Prisma migration for order
  idempotency indexes (+ `__tests__`).
- **Errors:**
  - **Validation #6:** onboarding `templates`/`types` arrays and `name`/`clientId` strings have no
    `.max()` → unbounded payload. Add caps.
  - **Validation #5:** off-enum `'UNKNOWN_TEMPLATE_CLIENT_ID'` → `ONBOARDING_UNKNOWN_TEMPLATE`.
  - **Immutability #7:** `Prescription`/`ImagingOrder`/`LabOrder` `(consultationId, clientRequestId)`
    are **full** unique indexes despite `deletedAt`; a create→soft-delete→retry-with-same-token
    hits a raw P2002. Convert to partial `WHERE deleted_at IS NULL` indexes (new migration),
    matching migration `20260626000000`.
  - **Validation #7 (note only):** the public `POST /v1/logs/client-error` is unauthenticated and
    log-writable; body is length-capped so impact is bounded. Recommend a rate limit later — not
    fixed here beyond a doc note.
- **Tests:** oversized onboarding payload rejected; soft-deleted order token reusable after the
  migration.
