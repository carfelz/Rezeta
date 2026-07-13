# Live E2E dogfooding — findings (2026-07-13)

Live click-through of the running app (`http://localhost:5173`) covering signup/onboarding,
settings, templates, protocols, a consultation, and billing. Driven through the in-app browser
against the dev API + DB. Findings are ranked; each has a root cause and a suggested fix where known.

Test account: `test002@test.com` (fresh signup, tenant `d29b4898-911f-4694-ad3c-37298dad43b6`).

## Summary

The full happy path works — onboarding → profile → location → patient → protocol (create + publish)
→ walk-in consultation (notes, vitals, prescription, atomic sign) → auto-invoice with correct
commission → issue invoice. Six findings surfaced; the one **critical** issue was a regression that
broke nearly all write endpoints — **found and fixed during this session** (commit `6d846c0`).

| ID | Severity | Status | One-liner |
|----|----------|--------|-----------|
| F3 | **Critical** | **Fixed (`6d846c0`)** | `ZodValidationPipe` validated auth/param args against the body schema → all writes 400'd |
| F1 | High | Open | Signup name & specialty silently dropped (dual `/provision` caller race) |
| F2 | Medium | Advisory | `DROP COLUMN commission_pct` is not a backward-compatible migration (rolling-deploy 500s) |
| F4 | Low | Open | Two identical "Seleccionar protocolo" dialogs render at once |
| F5 | Low | Open | Patient subtitle shows literal "null" for document type |
| — | Note | — | New tenants have templates but no protocols → first consultation's picker is empty |

## Working as expected (verified live, end-to-end)
- **Onboarding (default path):** fresh signup seeded the tenant (`seeded_at` set) with 2 protocol
  categories and 2 templates. No seeding-race error (the 2026-07-12 advisory-lock/​remap fix held).
- **Profile edit** (Ajustes → Editar): name/specialty/license persisted; header + settings updated.
- **Location create** (after F3 fix): fee 1,500 + commission 10% saved.
- **Patient create:** with allergy tag (Penicilina); age computed correctly (46).
- **Protocol create + publish:** created from the "Algoritmo diagnóstico" template (11 blocks / 6
  sections), "Guardar y publicar" → status **Activo**, version bumped **v1 → v2** (exercises the
  WI-G version-atomicity path).
- **Consultation (walk-in):** patient + location → add protocol → filled Motivo, **vitals
  (BP 120/80, HR 72 — persisted and rendered)**, Diagnóstico, Plan → queued a prescription
  (Enalapril) → **"Firmar y cerrar"**. Sign is atomic: consultation locked (only "Enmienda"), the
  prescription became **Guardada**, and the historia médica **draft** was generated. Clinical
  content confirmed in the DB (`protocol_usages.content`).
- **Allergy alert:** the Penicilina allergy showed in the consultation header and right-rail
  "Alertas del paciente".
- **Auto-invoice on sign:** `F-2026-00001`, **RD$ 1,500.00** (location fee), commission 10% →
  **commission 150 / net 1,350**, and the split reconciles to total in the DB (WI-D commission-
  rounding + commission-source fixes verified). Invoice numbers are per-tenant (three tenants each
  hold one `F-2026-00001`, no duplicate).
- **Invoice lifecycle:** "Emitir" transitioned Borrador → **Emitida**, and Editar/Eliminar
  correctly disappeared (issued invoices are locked).

> Note: an initial worry that vitals didn't persist was a **false alarm** — the accessibility tree
> reported the input placeholder ("—") as the field name; the screenshot and DB both show 120/80
> and 72 correctly. Not a bug.

## Findings

### F1 — Signup name & specialty are silently dropped [HIGH]
- **Observed:** signed up with a full name and specialty; **Ajustes → Mi cuenta shows "Nombre:
  Sin definir"**, and the top-bar user menu shows the generic "Médico". DB confirms
  `users.full_name` and `users.specialty` are both empty for `test002@test.com`.
- **Root cause:** `/v1/auth/provision` has **two callers** that race at signup:
  1. `apps/web/src/providers/AuthProvider.tsx:25` — on `onAuthStateChanged`, posts to
     `/v1/auth/provision` with an **empty body** (`{}`), no profile.
  2. `apps/web/src/store/auth.store.ts:48` — the signup flow posts `{ fullName, specialty }`.
  Firebase `createUser` (in `authClient.signUp`) triggers `onAuthStateChanged`, so caller (1)
  fires first and creates the User with an empty name. Caller (2) then hits
  `provisionUser`'s existing-user branch (`apps/api/src/modules/users/users.repository.ts`), which
  **returns the existing row without applying the profile**. The name/specialty are lost.
- **Suggested fix:** in `provisionUser`, when an existing user is found *and* a profile is supplied
  *and* the stored `fullName` is empty, backfill `fullName`/`specialty` (a scoped update) before
  returning. This is idempotent-safe and fixes the bug regardless of which caller wins the race.
  (Alternative/also: have `AuthProvider` skip the empty provision immediately after a signup, but
  the backfill is the robust fix.)

### F2 — `DROP COLUMN commission_pct` is not a backward-compatible migration [MEDIUM — deploy risk]
- **Observed:** creating a location 500'd — `POST /v1/locations` → `The column commission_pct does not
  exist in the current database` at `locations.repository.ts:98` (`tx.doctorLocation.create`).
- **Root cause:** the running dev API server was started before the 2026-07-12 `commission_pct`
  column-drop (`b8517a6`) and kept a stale in-memory Prisma client that still emitted the column;
  the migration had already dropped it from the DB. The code on `main` is internally consistent, so
  a fresh server start resolves it — this is not a product bug in `main`.
- **Why it still matters (deploy):** `migrations/20260712010000_drop_doctor_location_commission_pct`
  is a one-shot `DROP COLUMN`. In a rolling deploy (or if `migrate deploy` runs before the new
  instances are live), old instances still running the previous client will 500 on any
  `doctorLocation` write until they restart. The safe pattern is expand/contract: ship the code that
  stops using the column first, deploy it everywhere, then drop the column in a later release.
- **Suggested action:** for future column removals, split into two deploys (stop-using → drop). For
  this specific one, ensure all instances are cycled immediately after the migration; low risk in a
  single-instance dev/early environment.

### F3 — Every write endpoint is broken: `@UsePipes(ZodValidationPipe)` validates auth/param args against the body schema [CRITICAL — regression]
- **Observed:** creating a location returned `400 VALIDATION_ERROR` with `{ name: ["Required"] }`
  even though a valid `name` was sent. Reproduced via the app's own client with a correct payload.
- **Root cause (regression from WI-F, commit `d5ad483`):** WI-F removed the
  `if (metadata.type !== 'body') return value` short-circuit from `ZodValidationPipe` so it could
  validate `@Query`. But controllers apply body validation with method-level
  `@UsePipes(new ZodValidationPipe(BodySchema))`, and `@UsePipes` runs the pipe against **every**
  parameter. So the pipe now also validates the `@TenantId()` string, the `@CurrentUser()` object,
  and `@Param('id')` against the *body* schema — the auth/context args fail (`name` missing), and the
  first failing arg 400s the request before the handler runs. Affected: locations, patients,
  invoices, appointments, schedules, consultations, orders, consultation-records, users — i.e.
  virtually all create/update endpoints (any method-level `@UsePipes(ZodValidationPipe)` that
  coexists with `@TenantId`/`@CurrentUser`/`@Param`). Handlers using per-param
  `@Body(new ZodValidationPipe(X))` (e.g. location *update*) are unaffected — which is why editing
  the profile worked but creating a location did not.
- **Why tests missed it:** controller unit tests invoke the handler methods directly, bypassing
  Nest's pipe pipeline; there is no HTTP-level/e2e test exercising `@UsePipes`.
- **Fix (applied 2026-07-13):** the pipe validates only `metadata.type === 'body' || 'query'` and
  returns `param`/`custom` args untouched — restoring WI-F's query validation while no longer
  clobbering auth/context/param args. Added a pipe test asserting `custom`/`param` args pass through.
- **Follow-up worth doing:** add at least one real HTTP-pipeline (supertest/e2e) smoke test per
  write endpoint so a pipe-level regression like this can't ship again.

### F4 — Two identical "Seleccionar protocolo" dialogs render at once [LOW — UI]
- **Observed:** in the consultation, clicking "Agregar protocolo" (empty-state) rendered **two**
  stacked, identical "Seleccionar protocolo" dialogs in the DOM simultaneously. Likely the
  center empty-state trigger and the right-rail "Agregar" trigger each mount their own controlled
  `Dialog`, and both open. Only one should be visible.
- **Where:** consultation view (`apps/web/src/pages/Consultation/…` — the protocol-add controls).
- **Suggested fix:** hoist a single dialog to one owner (or share open-state) so the empty-state
  button and the rail "Agregar" button open the same instance.

### F5 — Patient subtitle shows literal "null" for document type [LOW — UI]
- **Observed:** on the patient detail header the subtitle reads `46 años · null 001-9999999-9` — a
  literal `null` where the document-type label (e.g. "Cédula") should be.
- **Where:** patient detail header (`apps/web/src/pages/PatientDetail/…`).
- **Suggested fix:** guard the document-type label (map `documentType` → label, omit the segment
  when absent) instead of interpolating the raw value.

### Onboarding → consultation workflow note (not a bug, but friction)
- A brand-new tenant is seeded with 2 **templates** but 0 **protocols**, so the first consultation's
  "Agregar protocolo" shows "No se encontraron protocolos" until the doctor creates a protocol from a
  template. Consider seeding one ready-to-use protocol, or linking the empty state directly to
  "create a protocol from a template".
