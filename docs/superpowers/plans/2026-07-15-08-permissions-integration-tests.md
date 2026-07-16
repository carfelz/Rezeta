# Permissions & Multi-User — Integration Test Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the permissions & multi-user feature (spec: `docs/superpowers/specs/2026-07-15-permissions-multi-user-design.md`; slices: `docs/superpowers/plans/2026-07-15-0{1..7}-*.md`) works **end to end, across slices** — the guard chain, capability resolution, the editable matrix, provisioning, and platform isolation acting together — not just as isolated units. Every slice plan (01–07) ships thorough per-task unit tests with mocked collaborators; none of them exercise two-plus slices in the same test. This plan closes that gap.

**This is a test-authoring plan only.** No product code changes. Every task below adds test files; none touches `apps/api/src/modules/**/*.service.ts`, controllers, or web components except to add `__tests__/` siblings (and, where noted, one small, explicitly-scoped test-only seam).

---

## 1. Where this feature's tests actually live today (verified against the real repo)

I read the real test files, not just the slice plans, before writing this. Findings:

- **No HTTP/e2e harness exists.** `grep -rn "createTestingModule" apps/api/src` and `grep -rl "supertest"` (any `package.json` in the repo) both return **nothing**. Nobody in this codebase boots a NestJS `INestApplication` and fires real HTTP requests at it. Every existing `*.controller.spec.ts` (e.g. `apps/api/src/modules/patients/__tests__/patients.controller.spec.ts`) **instantiates the controller class directly** (`new PatientsController(mockService, ...)`) with hand-built mocks — no DI container, no guards run.
- **Guards are tested the same way**: `apps/api/src/common/guards/__tests__/auth.guard.spec.ts` builds a fake `Reflector` (`{ getAllAndOverride: vi.fn() }`) and a fake `ExecutionContext` (`{ getHandler, getClass, switchToHttp: () => ({ getRequest: () => req }) }`) by hand, then calls `guard.canActivate(ctx)` directly. `permission.guard.spec.ts` (Slice 3) and `platform.guard.spec.ts` (Slice 7) follow the identical pattern. There is exactly **one** exception worth reusing: `permission.guard.integration.spec.ts` (Slice 3, Task 9) builds a context whose `getHandler()` returns a **real** decorated controller method (`PatientsController.prototype.create`) so a real `Reflector` reads real `@RequirePermission` metadata off it. That is the closest thing to a "guard chain" test in the repo, and it only chains one guard against one controller.
- **No real Postgres test database is used anywhere.** `grep -rn "testcontainers"` across every `package.json` returns nothing. The only `DATABASE_URL` reference in tests is `apps/api/src/config/__tests__/configuration.spec.ts`, which sets an **environment variable string** to assert config parsing — no connection is ever opened. `apps/api/vitest.config.ts` excludes `src/**/*.repository.ts` from coverage entirely, with the comment *"Repositories are DB-integration code... Behavior verified via controller specs."* Every repository spec (e.g. `permissions.repository.spec.ts`, `users.repository.spec.ts`) mocks `PrismaService` as a plain object of `vi.fn()`s. There is no transaction-rollback fixture, no migration-then-seed setup, nothing that touches a live database in CI.
- **Web tests are Vitest + Testing Library, no Playwright despite the comment.** `apps/web/vitest.config.ts` coverage-excludes `src/pages/**`, `src/App.tsx`, `src/components/auth/**` with comments like *"E2E tested with Playwright"* — but `find . -iname "playwright.config.*"` and a grep for `"playwright"` in every `package.json` return **nothing**. No Playwright is configured anywhere in this repo. That comment describes an aspiration, not a real harness — flag this explicitly in §7 (Gaps) rather than silently trusting it.
- **Test style, confirmed from real files:**
  - API: `apps/api/src/modules/patients/__tests__/patients.controller.spec.ts`, `apps/api/src/common/guards/__tests__/{auth,tenant}.guard.spec.ts`, `apps/api/src/modules/permissions/__tests__/*.spec.ts` — Vitest (`globals: true`, but files still `import { describe, it, expect, vi, beforeEach } from 'vitest'`), manual class instantiation, hand-built mocks, `AuthUser` object literals cast `as never`/`as AuthUser`. Coverage gate is **95% per file** (`thresholds.perFile: true`), enforced via `pnpm test:coverage`.
  - Web: `apps/web/src/pages/settings/__tests__/AuditLog.test.tsx`, `apps/web/src/pages/Patients/__tests__/PatientsReadOnly.test.tsx` — Vitest + `@testing-library/react`, `vi.hoisted()` + `vi.mock()` for hooks/api-client, `MemoryRouter` wrapping, `render`/`screen`/`fireEvent`. Same 95%-per-file gate on non-excluded files.
- **Current implementation state** (so this plan targets what will exist, not what exists today): only **Slice 1** (role vocabulary widening) is committed to `main` (`git log`: `e6fb82d feat: widen role vocabulary...`). The working tree on `feat/permissions-multi-user-spec` has an **uncommitted** `RolePermission` Prisma model addition (Slice 2, in progress) — no `PlatformUser` model, no `lastLoginAt` column yet. **Every task below assumes its prerequisite slice(s) have merged** (mirroring the "STOP if a dependency symbol is missing" convention slices 5–7 already use) — do not attempt to run a task whose slice isn't merged.

**Conclusion for the harness decision (see §6):** this repo's convention is unit/service-level tests with hand-built mocks — deliberately, not by omission (the coverage config explicitly documents *why* repositories and decorators are excluded). Cross-slice integration in this codebase does **not** mean "boot the app and hit it with HTTP" — it means **compose the real, unmocked collaborators from two-plus slices in one test** (real `PermissionGuard` + real `@RequirePermission` metadata + a real `hasCapability`/`resolveCapabilities`-shaped capability map; a real `UsersService.createUser` + a real `canManageRole`; a real `AuthGuard` platform branch + a real `PlatformGuard`), while still mocking the outermost I/O seam (Prisma, Firebase Admin SDK, the mailer). This plan follows that convention and recommends one narrow, explicitly-scoped addition (§6.3) rather than introducing a new paradigm.

---

## 2. Scope

Covers the full feature across Slices 1–7 once all are merged:

1. Role enforcement end-to-end (§3.1)
2. Capability resolution on `/v1/auth/me` (§3.2)
3. Editable matrix ↔ enforcement round-trip + rank rule (§3.3)
4. Provisioning / invite flow (§3.4)
5. Platform isolation — security-critical (§3.5)
6. Tenant isolation regression (§3.6)

Each scenario below states: purpose, preconditions/fixtures, exact call sequence, expected outcomes (status/response shape/DB state/audit events), and the file it lives in.

---

## 3. Integration scenarios

### 3.1 Role enforcement end-to-end (per-role matrix against real endpoints)

**Purpose:** Prove that for each of the four roles, the **real** `PermissionGuard` reading **real** `@RequirePermission` metadata off the **real** controller classes, checked against the **real** `defaultCapabilitiesFor(role)` capability map, produces the exact allow/deny matrix from design spec §4.3 — not just for `PatientsController` (already covered by Slice 3 Task 9) but across every guarded controller family.

**Depends on:** Slice 1 (roles), Slice 2 (`defaultCapabilitiesFor`), Slice 3 (`PermissionGuard`, `@RequirePermission`, annotated controllers).

**File:** `apps/api/src/common/guards/__tests__/permission-guard.role-matrix.integration.spec.ts` (new — sibling of Slice 3's `permission.guard.integration.spec.ts`, same pattern, broadened).

**Fixtures:** No DB — `defaultCapabilitiesFor` from `@rezeta/shared` is the source of per-role capability maps (already the ground truth the catalog defines; no stored `RolePermission` overrides needed for the *default* matrix). Real `Reflector` (`new Reflector()`), real `PermissionGuard`.

**Call sequence (table-driven, one `it.each` per representative endpoint x role):**

| Endpoint (handler) | Module | Level | assistant | doctor | admin | super_admin |
|---|---|---|---|---|---|---|
| `PatientsController.list` (GET) | patients | view | 200(allow) | allow | allow | allow |
| `PatientsController.create` (POST) | patients | manage | **403** | allow | allow | allow |
| `ProtocolsController.list` (GET) | protocols | view | **403** | allow | allow | allow |
| `ConsultationsController.create` (POST) | consultations | manage | **403** | allow | allow | allow |
| `AppointmentsController.create` (POST) | appointments | manage | allow | allow | allow | allow |
| `InvoicesController.create` (POST, billing) | billing | manage | allow | allow | allow | allow |
| `LocationsController.create` (POST) | locations | manage | **403** | allow | allow | allow |
| `AuditLogController.list` (GET) | audit_log | view | **403** | allow | allow | allow |
| `UsersManagementController.list` (GET, Slice 5) | users | view | **403** | **403** | allow | allow |
| `UsersManagementController.create` (POST, Slice 5) | users | manage | **403** | **403** | allow | allow |
| `PermissionsController.getMatrix` (GET, Slice 6) | permissions | view | **403** | **403** | allow | allow |
| `PermissionsController.update` (PATCH, Slice 6) | permissions | manage | **403** | **403** | allow | allow |

**Mechanics:** for each row, build a context via a `ctxFor(handlerRef, classRef, capabilities)` helper (mirrors Slice 3's `ctxFor`), call `guard.canActivate(ctx)`. Assert `true` for "allow" cells; assert `toThrow(ForbiddenException)` **and** `err.getResponse()` matches `{ code: ErrorCode.INSUFFICIENT_PERMISSION }` for `403` cells.

**Expected outcomes:** every cell above matches exactly; a mismatch means either the catalog defaults (`packages/shared/src/permissions/catalog.ts`) or a controller's `@RequirePermission` annotation drifted from spec §4.3 — this test is the regression net for that drift, since Slice 3's own tests only ever assert the pattern once (`patients`), not the whole matrix.

**Note on doctor + users/permissions:** this is the one deliberately-asymmetric row in the matrix (§4.3 "doctor excludes users and permissions") — the two-role assertion above (`doctor: 403` alongside `assistant: 403`) is the single highest-value regression check in this whole scenario, since a future refactor that "helpfully" widens doctor access would otherwise slip through every slice's own unit tests untouched.

---

### 3.2 Capability resolution on `/v1/auth/me`

**Purpose:** Prove the full resolution chain — `AuthGuard` → `PermissionsService.resolveCapabilities` (catalog defaults merged with stored `RolePermission` overrides, stored wins) → `AuthService.toAuthUser`/`me()` — returns the right `capabilities` map, with a **real** `PermissionsService` (only `PrismaService` mocked), not the Slice-2 unit test's already-resolved stub.

**Depends on:** Slice 2 (`PermissionsService`, `PermissionsRepository`), Slice 7 attaches nothing extra here (institution routes unaffected by platform identity).

**File:** `apps/api/src/modules/auth/__tests__/auth-capabilities.integration.spec.ts` (new).

**Preconditions/fixtures:**
- Real `PermissionsService` + real `PermissionsRepository`, constructed with a mock `PrismaService` whose `rolePermission.findMany` is a `vi.fn()`.
- Real `AuthGuard`, constructed with mock `IAuthProvider`, mock `UsersRepository`, mock `PlatformUsersRepository`, mock `AuditLogService`, and the **real** `PermissionsService` from above (this is the cross-slice composition point: Slice 2's service is real, Slice 7's guard shape is real, only the DB/Firebase edges are mocked).
- A `doctor`-role `User` fixture with `tenantId: 't1'`.

**Call sequence:**
1. **No stored overrides** — `mockPrisma.rolePermission.findMany.mockResolvedValue([])`. Call `guard.canActivate(ctx)`. Assert `request.user.capabilities` equals `defaultCapabilitiesFor('doctor')` exactly (`patients: 'manage'`, `users: 'none'`, `permissions: 'none'`, ...).
2. **One stored override wins** — `findMany` returns `[{ role: 'doctor', moduleKey: 'protocols', accessLevel: 'view' }]` (doctor's catalog default for `protocols` is `'manage'`). Assert `request.user.capabilities.protocols === 'view'` (stored wins) while every other module still equals its catalog default (merge, not replace).
3. **`/v1/auth/me` returns the guard's resolved map unchanged** — construct `AuthController` directly with a mock `AuthService` whose `me()` returns the `request.user` object built in step 2; assert the controller returns `capabilities.protocols === 'view'` — proves the guard's resolution and the controller response are the same object, not re-derived.
4. **A module missing from the catalog is ignored gracefully (upgrade-safety)** — `findMany` returns `[{ role: 'doctor', moduleKey: 'a_module_removed_later', accessLevel: 'manage' }]`; assert the resolved map has no such key and every real module still resolves to its catalog default (this is the "tenants seeded before a new module existed still resolve it" guarantee from spec §4.2, now proven against the real merge function, not a mocked one).

**Expected outcomes:** `request.user.capabilities` is a full 13-key `CapabilityMap`; overrides merge without disturbing untouched modules; garbage rows are silently dropped. No audit event is asserted here (capability resolution is read-only and unaudited by design).

---

### 3.3 Editable matrix ↔ enforcement round-trip + rank rule

**Purpose:** This is the scenario **no single slice's unit tests cover**: Slice 6's `PermissionsService.updateModule` unit test asserts the repository upsert call and the audit event, but never re-resolves capabilities afterward against a **real** `PermissionGuard` to prove the edit actually changes what a subsequent request may do. This test proves the grant/revoke round-trip and the rank rule together.

**Depends on:** Slice 1 (`canManageRole`), Slice 2 (`PermissionsService.resolveCapabilities`), Slice 3 (`PermissionGuard`), Slice 6 (`PermissionsService.updateModule`, `PermissionsController`).

**File:** `apps/api/src/modules/permissions/__tests__/permissions-enforcement-roundtrip.integration.spec.ts` (new).

**Preconditions/fixtures:**
- Real `PermissionsService` + real `PermissionsRepository`, mock `PrismaService` — but this time the mock **stores state**: `rolePermission.upsert` writes into an in-memory `Map<string, string>` keyed by `` `${tenantId}:${role}:${moduleKey}` ``, and `rolePermission.findMany` reads back from that same map (a tiny fake, not a real DB — this is what makes the round-trip observable without a live Postgres instance; document this as a fake, not a mock, in the test file's header comment).
- Real `PermissionGuard` + real `Reflector`.
- Mock `AuditLogService` (`{ record: vi.fn() }`).
- Actor fixtures: `admin` (rank 3) and `super_admin` (rank 4) `AuthUser` objects for `tenantId: 't1'`.

**Scenario A — grant round-trip:**
1. Assert baseline: `resolveCapabilities('t1', 'assistant').protocols === 'none'` (catalog default).
2. Assert baseline enforcement: build a context for `ProtocolsController.list` (`protocols:view`) with `assistant`'s current capabilities → `guard.canActivate` throws `ForbiddenException`.
3. `super_admin` calls `updateModule('t1', 'super_admin', 'assistant', 'protocols', 'manage')`. Assert `auditLog.record` called once with `action: 'permission_granted'`.
4. Re-resolve: `resolveCapabilities('t1', 'assistant').protocols === 'manage'`.
5. Re-check enforcement with the **freshly resolved** capability map on the same `ProtocolsController.list` context → `guard.canActivate` now returns `true`.

**Scenario B — revoke round-trip:**
6. `super_admin` calls `updateModule('t1', 'super_admin', 'doctor', 'patients', 'none')` (doctor's catalog default is `manage`). Assert `auditLog.record` called with `action: 'permission_revoked'`.
7. Re-resolve + re-check: `PatientsController.create` (`patients:manage`) now throws `ForbiddenException` for `doctor`'s refreshed capabilities, where it previously allowed.

**Scenario C — rank rule blocks the edit before it ever reaches enforcement:**
8. `admin` (rank 3) attempts `updateModule('t1', 'admin', 'admin', 'patients', 'none')` (own rank) → `rejects.toThrow(ForbiddenException)`; assert `repo.upsertModule`/`prisma.rolePermission.upsert` was **never called** and `auditLog.record` was **never called** — the edit must fail closed before any write or audit.
9. `admin` attempts `updateModule('t1', 'admin', 'super_admin', 'users', 'none')` (higher rank) → same assertions.
10. Re-resolve `doctor`'s capabilities after steps 8–9 and confirm they are **byte-identical** to the pre-attempt snapshot — the rejected edits produced zero side effects anywhere in the chain.

**Expected outcomes:** grant/revoke each flip exactly the targeted `(role, moduleKey)` cell and nothing else; a subsequent `PermissionGuard.canActivate` check reflects the flip immediately (no caching layer to invalidate — this test is also the regression net if one is ever added without re-resolving); rank-rule violations produce **zero** DB writes and **zero** audit records, not just a caught exception.

---

### 3.4 Provisioning / invite flow

**Purpose:** Prove the full internal-creation path end to end: `admin`/`super_admin` calls `UsersService.createUser` → Firebase Admin SDK creates the identity (stubbed) → a fully-provisioned `User` row is written → a set-password link is generated and "sent" (logged, per the dev-path mailer) → `user_invited` is audited → the user's **first authenticated request** (via `AuthGuard`) stamps `lastLoginAt` → the roster (`listUsers`) status flips from `invited` to `active`. No single Slice-5 unit test threads all six of these steps together — the service spec stubs the repository at each seam and never re-reads the roster afterward.

**Depends on:** Slice 5 (`UsersService`, `UsersRepository`, `InvitationMailerService`, `IAuthProvider.createUser`/`generatePasswordResetLink`, `AuthGuard`'s `markSignedIn` stamp).

**File:** `apps/api/src/modules/users/__tests__/provisioning-flow.integration.spec.ts` (new).

**Preconditions/fixtures:**
- A tiny **fake** `UsersRepository` backed by an in-memory array of user rows (same rationale as §3.3 — document as a fake in the file header), exposing the real method signatures: `createProvisionedUser`, `findByExternalUid`, `listByTenant`, `markSignedIn`, `findById`.
- Mock `IAuthProvider`: `createUser` returns `{ externalUid: 'fb-new-1' }`; `generatePasswordResetLink` returns a fixed URL.
- Mock `InvitationMailerService` (`sendSetPasswordEmail: vi.fn()`), mock `AuditLogService`.
- Real `UsersService` composed from the above (real rank-rule logic via real `canManageRole`).
- Real `AuthGuard` for the "first sign-in" step, constructed with the same fake `UsersRepository`, a mock `IAuthProvider.verifyToken` returning `{ externalUid: 'fb-new-1', ... }`, mock `PlatformUsersRepository` (irrelevant here — not a platform route), a real (or Slice-2-mocked) `PermissionsService`, mock `AuditLogService`.

**Call sequence:**
1. `admin` calls `usersService.createUser('t1', 'admin', 'actor-1', { email: 'nurse@clinic.do', fullName: 'Ana Reyes', role: 'assistant' })`.
2. Assert, in order: `authProvider.createUser` called with the email; the fake repository now contains a row with `externalUid: 'fb-new-1'`, `role: 'assistant'`, `lastLoginAt: null`; `authProvider.generatePasswordResetLink` called with the email; `mailer.sendSetPasswordEmail` called with `(email, link)`; `auditLog.record` called once with `action: 'user_invited', category: 'auth', tenantId: 't1'`.
3. **Roster reflects "invited"** — `usersService.listUsers('t1')` includes the new user with `status: 'invited'`, `lastLoginAt: null`.
4. **No public signup path exists** — assert (by construction, documented as a comment, not a runtime check) that the only route to a new `User` row in this test is `UsersService.createUser`; there is no `SignUpSchema`/`/signup` codepath exercised anywhere in this file. (Cross-reference: Slice 5 Task 9 deletes `apps/web/src/pages/Signup/` and `SignUpSchema` outright — a companion assertion belongs in the web layer, see the Task list below.)
5. **First sign-in stamps `lastLoginAt`** — call `authGuard.canActivate(ctxForVerifiedToken('fb-new-1'))`. Assert `fakeRepo`'s row for `fb-new-1` now has `lastLoginAt` set to a `Date` (not `null`).
6. **Re-stamping does not happen on a second request** — call `canActivate` again with the same token; assert `markSignedIn` (or the repository write it causes) is **not** invoked a second time (no write amplification — this is the exact guarantee Slice 5 Task 2A's own unit test asserts in isolation; this integration test proves it survives the full create → first-login sequence, not just a synthetic "already has a date" fixture).
7. **Roster reflects "active"** — `usersService.listUsers('t1')` now shows the same user with `status: 'active'` and a non-null `lastLoginAt`.

**Rank-rule denial variant (same file, separate `describe`):**
8. `doctor` (rank 2) calls `createUser('t1', 'doctor', 'actor-2', { email: 'x@y.do', fullName: 'X Y', role: 'assistant' })` → `rejects.toThrow(ForbiddenException)`. Assert `authProvider.createUser` was **never called** (no Firebase account created for a rejected invite — no orphaned identity) and the fake repository gained no row.

**Expected outcomes:** exactly one new row, one Firebase call, one mail call, one audit record per successful invite; the roster's derived `status` field flips deterministically off `lastLoginAt`; a denied invite leaves no trace in either Firebase (mocked) or the repository.

---

### 3.5 Platform isolation (security-critical)

**Purpose:** This is explicitly called out in the design spec (§8) as "the highest-risk slice." Prove, with the **real** guard classes composed together (not each tested alone as Slice 7's own specs do), that: a platform token can never resolve an institution `User`; a tenant token can never resolve a `PlatformUser`; the guard chain order (`AuthGuard → PlatformGuard → TenantGuard → PermissionGuard`) enforces this at every stage, not just at `AuthGuard`.

**Depends on:** Slice 7 (`PlatformUser`, `@PlatformRoute()`, `AuthGuard`'s platform branch, `PlatformGuard`, `TenantGuard`'s platform skip). Slice 3's `PermissionGuard` participates because staff routes carry no `@RequirePermission` metadata.

**File:** `apps/api/src/common/guards/__tests__/platform-isolation.integration.spec.ts` (new).

**Preconditions/fixtures:**
- Real `AuthGuard`, real `PlatformGuard`, real `TenantGuard`, real `PermissionGuard`, real `Reflector` (`new Reflector()` — needed so `getAllAndOverride` reads real metadata off real handlers, not a hand-rolled stub that might silently diverge from the real decorators' key strings).
- Mock `IAuthProvider.verifyToken`, mock `UsersRepository`, mock `PlatformUsersRepository`, mock `PermissionsService` (`resolveCapabilities` → any fixed map — irrelevant to this scenario), mock `AuditLogService`.
- A **chain runner** helper: `async function runChain(guards: CanActivate[], ctx): Promise<'allow' | { guard: string; error: unknown }>` that calls each guard's `canActivate` in order, short-circuiting and recording which guard threw. This is the one small reusable helper this plan introduces — it exists purely to assert "which guard in the real chain rejects," matching the design spec's explicit claim that AuthGuard 401s a platform token on a tenant route and PlatformGuard is defense-in-depth, not the sole gate.

**Call sequence (four cases, one `it` each):**

1. **Platform token → tenant route (`PatientsController.list`, no `@PlatformRoute()`).** `verifyToken` resolves `{ externalUid: 'staff-ext-1' }`; `UsersRepository.findByExternalUid` (the *institution* lookup) resolves `null` (a platform identity is never in the `users` table). Run the chain against a context whose handler is the real `PatientsController.prototype.list`. **Expected:** `AuthGuard` throws `UnauthorizedException` — the chain never reaches `PlatformGuard`/`TenantGuard`/`PermissionGuard`. Assert `request.user` and `request.platformUser` are both still `undefined`.
2. **Tenant token → staff route (`StaffController.createInstitution`, real `@PlatformRoute()` metadata).** `verifyToken` resolves `{ externalUid: 'doc-ext-1' }`; `PlatformUsersRepository.findByExternalUid` resolves `null` (an institution user is never in `platform_users`). Run the chain against the real `StaffController.prototype.createInstitution`. **Expected:** `AuthGuard` throws `UnauthorizedException` (its platform branch fires because the real `@PlatformRoute()` metadata is present) — again the chain never reaches the later guards.
3. **Defense-in-depth: `PlatformGuard` alone rejects if `request.platformUser` were ever absent on a platform route.** Bypass `AuthGuard` (simulate a hypothetical wiring bug) by building a request with `platformUser: undefined` directly and running only `PlatformGuard` + `TenantGuard` + `PermissionGuard` against the real `StaffController` handler. **Expected:** `PlatformGuard` throws `ForbiddenException({ code: ErrorCode.FORBIDDEN })`. This is the test that justifies the design spec's own "stronger than a bypass" claim — it proves the boundary holds even if `AuthGuard`'s branch were ever accidentally skipped, which the two unit-level guard specs (each testing one guard in isolation) cannot demonstrate.
4. **Valid platform token → staff route, full chain succeeds and sets no institution fields.** `verifyToken` resolves a valid uid; `PlatformUsersRepository.findByExternalUid` resolves an active `PlatformUser`. Run the full chain. **Expected:** all four guards return `true`; `request.platformUser` is set to the resolved `PlatformPrincipal`; `request.user` and `request.tenantId` are **never set** (assert both `undefined` after the chain) — proving `TenantGuard`'s platform-route skip actually took effect inside the composed chain, not just in its own isolated spec.
5. **Valid tenant token → tenant route, full chain succeeds and sets no platform fields.** Symmetric to (4): `request.user` and `request.tenantId` are set; `request.platformUser` is **never set**.

**Expected outcomes:** in every cross-identity case the rejection happens at the earliest possible guard (`AuthGuard`) and the request object never acquires the "wrong side's" field; in the defense-in-depth case, `PlatformGuard` independently enforces the same boundary; in the two "everything lines up" cases, the two request-shape branches (`user`+`tenantId` vs. `platformUser`) are mutually exclusive, matching the design spec's "never both" invariant verbatim.

---

### 3.6 Tenant isolation regression (existing invariant, new guards must not weaken it)

**Purpose:** The new guards (`PermissionGuard`, `PlatformGuard`) sit alongside the pre-existing `TenantGuard`. Prove that stacking the new guards on top does not accidentally let a `PermissionGuard` allow, or a repository read leak, data across tenants — i.e., the feature adds a permission axis without touching the tenant axis.

**Depends on:** Slice 3 (`PermissionGuard` registration order), Slice 6 (`PermissionsRepository.findByTenantAndRole`, `upsertModule` — both take `tenantId` explicitly).

**File:** `apps/api/src/modules/permissions/__tests__/tenant-isolation-regression.integration.spec.ts` (new).

**Preconditions/fixtures:** the same in-memory fake `PrismaService`/`rolePermission` map from §3.3, seeded with rows for **two tenants** (`t1`, `t2`) where `t1`'s `doctor` role has been granted `users: manage` (an explicit override) and `t2`'s `doctor` role is untouched (catalog default `none`).

**Call sequence:**
1. `resolveCapabilities('t2', 'doctor').users === 'none'` — confirm `t1`'s override never leaks into `t2`'s resolution (proves `findByTenantAndRole`'s `where: { tenantId, role }` filter, not just its call-args assertion in the Slice-2 unit spec, actually partitions data in a multi-tenant fixture).
2. `updateModule('t1', 'super_admin', 'doctor', 'billing', 'none')` — after, assert `resolveCapabilities('t2', 'doctor').billing` is **still** its catalog default (`manage`) — an edit scoped to `t1` must never mutate `t2`'s effective permissions.
3. Build a `PermissionGuard` context whose `request.user` claims `tenantId: 't2'` but carries `t1`'s (more permissive) capability map by mistake (a deliberately "wrong" fixture simulating a hypothetical resolution bug) — the guard **should still allow**, because `PermissionGuard` only ever inspects `request.user.capabilities`, never `tenantId`. Immediately follow with a comment/assertion that **tenant scoping is `TenantGuard`'s job, not `PermissionGuard`'s** — this test documents and pins that division of responsibility so a future change doesn't try to fold tenant checks into `PermissionGuard` (which would duplicate and risk diverging from `TenantGuard`'s single source of truth).
4. Re-run a representative case from the existing `tenant.guard.spec.ts` pattern (own-tenant pinning) but with `PermissionGuard` chained immediately after, to confirm the two guards compose without interference: a `doctor` in `t1` requesting a `patients:manage` endpoint is allowed by both `TenantGuard` (pins `tenantId`) and `PermissionGuard` (capability check) independently.

**Expected outcomes:** no cross-tenant leakage in either the read (`resolveCapabilities`) or write (`updateModule`) path; the responsibility boundary between `TenantGuard` (tenant scoping) and `PermissionGuard` (capability scoping) is explicit and tested, not assumed.

---

## 4. Frontend integration scenarios (Vitest + Testing Library, no Playwright)

The web-layer equivalents of §3.1 and §3.4, since `useCan`/`RequireCan`/`Sidebar` filtering/read-only rendering are each unit-tested in isolation by Slice 4, but never composed with a real route tree + real capability map derived from a real role (only ever a hand-built `CapabilityMap` fixture).

**File:** `apps/web/src/__tests__/permission-gating.integration.test.tsx` (new, at `src/__tests__/` since it spans `App.tsx` routing + `Sidebar` + a page — no single existing directory owns all three; this mirrors how `providers.test.tsx` already sits at a similarly cross-cutting level).

**Scenario A — assistant's full route+nav experience in one render:**
1. Seed the auth store via the Slice-4 `makeAuthUser('assistant')`/`seedAuthUser` helpers (real `defaultCapabilitiesFor('assistant')` under the hood, not a hand-picked map).
2. Render the full `<Sidebar>` + a `<MemoryRouter>` with the real route tree from `App.tsx`'s protected children (import the same route config, not a re-declared stub) at `initialEntries={['/protocolos']}`.
3. Assert: the sidebar hides "Protocolos" and "Ajustes"; navigating to `/protocolos` directly (deep link, not a click) redirects to `/dashboard` (`RequireCan` firing); the Patients page (separately rendered) shows no "Registrar paciente" button.
4. This proves the **same** resolved capability map simultaneously drives nav filtering, route guarding, and in-page action gating — the three Slice-4 unit tests each assert one of these against a hand-built fixture; this test proves they agree with each other against one real fixture.

**Scenario B — doctor sees everything an assistant does not, in the same render pass:**
Mirror of A with `makeAuthUser('doctor')`; assert the inverse of every assertion in A.

**Note:** this stays inside the existing Vitest + Testing Library harness (jsdom) — it is still not a real browser, no real HTTP calls (the API client stays mocked as it is in every existing page test). It is "integration" only in the sense of composing real routing + real nav + real page instead of testing each in isolation. True cross-browser/E2E is out of scope per §7.

---

## 5. Provisioning-flow frontend note (companion to §3.4)

**File:** `apps/web/src/__tests__/no-public-signup.test.tsx` (new, small).

Purpose: assert the negative space Slice 5 Task 9 creates — there is no `/signup` route in `App.tsx`'s route config, and `IAuthClient` (checked via the real `firebase-auth-client.ts` module shape, e.g. `expect('signUp' in authClient).toBe(false)` or a TypeScript-level `expectTypeOf` if the repo's toolchain supports it) has no `signUp` method. Keep this test tiny — one file, two or three assertions — it exists purely so a future PR that re-adds a self-service signup path (violating design spec §2 decision 2 and §5.1) fails a test instead of silently reappearing.

---

## 6. Test harness & setup

### 6.1 No new global harness — extend the existing convention

Per §1's findings, do **not** introduce `@nestjs/testing`'s `Test.createTestingModule`, supertest, or a real Postgres test database for this plan. That would be a new paradigm alongside ~150 existing specs that all use manual instantiation + hand-built mocks, and none of the seven slice plans introduce one either (Slice 3's own "integration" test, Task 9, is manual instantiation with a real `Reflector`). Consistency with the existing convention matters more here than the theoretical rigor of a full HTTP stack, since:
- The guards' `canActivate(ctx)` contract is small and synchronous/promise-based — manual `ExecutionContext` construction exercises the exact same code path an HTTP request would, module the routing/param-binding machinery NestJS itself owns (and which the repo has zero tests for anywhere, guarded or not).
- Every one of the six product scenarios in §3 is expressible as "construct these two-to-four real classes with mocked I/O edges, drive them through a call sequence, assert on the returned/thrown values and the mock call args" — no scenario requires a real socket or a real SQL round trip to be meaningful.

### 6.2 How to compose "real" collaborators across slices

The recurring pattern across §3.1–3.6:
```ts
// Real: the classes under test for THIS integration scenario.
const reflector = new Reflector()
const guard = new PermissionGuard(reflector)
const permissionsService = new PermissionsService(permissionsRepo) // real
// Mocked: the outermost I/O edge only.
const mockPrisma = { rolePermission: { findMany: vi.fn(), upsert: vi.fn() } }
const permissionsRepo = new PermissionsRepository(mockPrisma as never)
```
Two scenarios (§3.3, §3.4) need the mock to **retain state across calls** (so a write is observable on a subsequent read) — implement this as a small in-memory fake (a `Map` keyed by the compound unique constraint, or an array for the user roster), not a stateless `vi.fn().mockResolvedValue(...)`. Label these clearly as fakes (not mocks) in a one-line header comment in each such spec file, per this repo's existing terminology discipline (the slice plans consistently distinguish "mock the repo" from nothing stateful — this plan is introducing the one new pattern the repo doesn't yet have, so name it explicitly to avoid confusion with the ~150 stateless mocks elsewhere).

### 6.3 The one recommended minimal addition: a shared chain-runner test helper

Both §3.1 and §3.5 build `ExecutionContext`s against **real** controller method references and run one-or-more **real** guards. Rather than each new spec file re-declaring its own `ctxFor`/`makeCtx` helper (as Slice 3's `permission.guard.integration.spec.ts` and Slice 7's `platform.guard.spec.ts` each already do independently), add one shared helper:

**File:** `apps/api/src/common/guards/__tests__/test-helpers/guard-chain.ts` (new, `__tests__`-scoped, not shipped in `src/**` proper — matches the existing convention of colocating test-only code beside its specs, e.g. how `apps/web/src/test/auth-helpers.ts` is Slice 4's reusable fixture).

```ts
import type { CanActivate, ExecutionContext } from '@nestjs/common'

/** Build a minimal ExecutionContext around a real handler/class + a request object. */
export function ctxFor(
  handler: (...args: unknown[]) => unknown,
  classRef: object,
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

/** Run guards in order; stop at the first false/throw and report which guard did it. */
export async function runChain(
  guards: CanActivate[],
  ctx: ExecutionContext,
): Promise<{ outcome: 'allow' } | { outcome: 'deny'; guardIndex: number; error: unknown }> {
  for (let i = 0; i < guards.length; i++) {
    try {
      const result = await guards[i]!.canActivate(ctx)
      if (!result) return { outcome: 'deny', guardIndex: i, error: null }
    } catch (error) {
      return { outcome: 'deny', guardIndex: i, error }
    }
  }
  return { outcome: 'allow' }
}
```

This is the **only** new non-test-spec file this plan proposes. It has no product-code dependents, sits entirely inside `__tests__/`, and is excluded from coverage the same way the rest of `src/common/guards/__tests__/**` already is (vitest config excludes `src/**/*.spec.ts`/`src/**/__tests__/**`, so a `.ts` helper file inside `__tests__/` also needs no dedicated coverage — confirm by naming it without a `.spec.ts` suffix so it isn't picked up as its own test file by `include: ['src/**/*.{spec,test}.ts']`, and isn't separately required to hit 95% since it isn't `.spec.ts`/`.test.ts` — but note this file **does** fall under `include: ['src/**/*.ts']` for coverage purposes since only `.spec.ts`/`.test.ts`/`__tests__/**` as directories/suffixes are excluded, not arbitrary `.ts` helpers inside them; re-verify against `apps/api/vitest.config.ts`'s exact exclude globs before merging — the `'src/**/__tests__/**'` glob does cover this path, so it is excluded; no action needed).

### 6.4 Seeding a platform user + institutions for these tests

None of §3's scenarios need a live-seeded `PlatformUser`/`Tenant` row (no live DB is used at all — see §6.1). Where a `PlatformUser` or `Tenant` is needed, it is a plain object literal matching the Prisma-generated shape (mirroring how every existing spec builds `AuthUser`/`Patient`/`User` fixtures today), returned from a mocked or faked repository method. If a later slice (or a future E2E effort, see §7) needs a **real** seeded platform user against a real dev database, reuse Slice 7 Task 11's `bootstrapPlatform` CLI function directly (it is already unit-tested with fakes in `apps/api/src/scripts/__tests__/create-institution.spec.ts`) rather than writing a second seeding path.

### 6.5 How to run this suite

- All of it: `pnpm --filter @rezeta/api test` (API scenarios, §3) and `pnpm --filter @rezeta/web test` (frontend scenarios, §4–5) — no new script, no new config. These new spec files are picked up automatically by each package's existing `include: ['src/**/*.{spec,test}.ts']` (API) / `include: ['src/**/*.{test,spec}.{ts,tsx}']` (web) glob.
- Targeted, while iterating on one scenario: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/permission-guard.role-matrix.integration.spec.ts` (swap the path per file).
- Coverage: `pnpm test:coverage` (root) still enforces the 95%-per-file gate repo-wide; these new spec files themselves need no coverage (specs never do), but where §3 exercises a **currently-under-covered branch** of an existing service (e.g. the "ignores a stored row whose module key is not in the catalog" merge branch in §3.2 step 4), it may incidentally raise that file's coverage — a welcome side effect, not the goal.

### 6.6 Where the files live (summary)

| File | Scenario(s) |
|---|---|
| `apps/api/src/common/guards/__tests__/test-helpers/guard-chain.ts` | shared helper (§6.3) |
| `apps/api/src/common/guards/__tests__/permission-guard.role-matrix.integration.spec.ts` | §3.1 |
| `apps/api/src/modules/auth/__tests__/auth-capabilities.integration.spec.ts` | §3.2 |
| `apps/api/src/modules/permissions/__tests__/permissions-enforcement-roundtrip.integration.spec.ts` | §3.3 |
| `apps/api/src/modules/users/__tests__/provisioning-flow.integration.spec.ts` | §3.4 |
| `apps/api/src/common/guards/__tests__/platform-isolation.integration.spec.ts` | §3.5 |
| `apps/api/src/modules/permissions/__tests__/tenant-isolation-regression.integration.spec.ts` | §3.6 |
| `apps/web/src/__tests__/permission-gating.integration.test.tsx` | §4 |
| `apps/web/src/__tests__/no-public-signup.test.tsx` | §5 |

All API integration specs use the `*.integration.spec.ts` suffix (still matched by the existing `*.spec.ts` glob) purely as a naming convention so `grep -l "integration.spec"` can distinguish this plan's cross-slice tests from each slice's own per-unit specs during review — it has no functional effect on how Vitest discovers or runs them.

---

## 7. Gaps / assumptions

- **No real HTTP/e2e harness exists, and this plan does not add one.** Every scenario above proves the *composition of real business-logic classes*, not "does an HTTP request to `/v1/patients` actually return 403 through Nest's full pipeline (routing, param binding, pipes, interceptors, exception filters)." The `HttpExceptionFilter` conversion of `ForbiddenException({ code, message })` into the `{ error: { code, message } }` HTTP envelope (mentioned in Slice 3's architecture section) is asserted **nowhere** in this repo, slice plans included — this plan does not add that coverage either. **Recommended minimal addition if this gap becomes a priority:** a single `@nestjs/testing` `Test.createTestingModule` + `supertest` smoke suite (3–5 requests total: one 200, one 403 with the correct JSON envelope shape, one 401) would close this specific gap without requiring a live Postgres instance (mock `PrismaService` at the module level via `overrideProvider`). This is a deliberately narrow ask — not a call to convert the whole suite to HTTP-level testing.
- **No live Postgres test database, no migration-then-seed fixture, no transaction-rollback pattern exists anywhere in this repo, and this plan does not add one.** All "cross-slice" state in §3.3/§3.4/§6.2 is simulated via small in-memory fakes behind the same `PrismaService`-shaped interface the mocks already use. This means the Prisma migrations themselves (`role_permissions`, `platform_users`, `last_login_at`, the `owner→super_admin` data migration) are validated only by `prisma validate`/`prisma generate` in each slice plan — never actually applied and queried in CI. If real-DB migration testing becomes a priority, the lightest addition consistent with this repo (no testcontainers dependency currently installed) would be a `docker compose` Postgres service (the repo already has `docker:up`/`docker:down` root scripts pointing at a local Postgres — confirm via `docker-compose.yml` whether it already provisions one) wired into a CI step that runs `prisma migrate deploy` against it before the rest of the suite, with a small number of `*.db-integration.spec.ts` files gated behind an env var (`RUN_DB_INTEGRATION_TESTS`) so local `pnpm test` stays fast and mock-only by default.
- **No Playwright is configured despite `apps/web/vitest.config.ts` comments claiming "E2E tested with Playwright."** `src/pages/**`, `src/App.tsx`, `src/components/auth/**` are coverage-excluded on that stated assumption, but `find . -iname "playwright.config.*"` returns nothing repo-wide. This plan's §4 frontend scenarios partially compensate (composing real routing + real nav + a real page under jsdom), but they are not a substitute for an actual browser-level check of, e.g., a real redirect changing the visible URL, or real CSS-driven visibility. Flag this as a pre-existing gap this plan does not attempt to close — introducing Playwright is a larger, separate infrastructure decision the user should make deliberately, not a side effect of a test-plan doc.
- **This plan assumes all seven slices merge in order 1→7 before every scenario in §3 can run.** Several scenarios (§3.3, §3.5) require Slice 6 and Slice 7 respectively; if the team wants integration coverage to land incrementally alongside each slice rather than all at once at the end, split this plan's tasks across the corresponding slice PRs (§3.1 lands with Slice 3, §3.2 with Slice 2, §3.3 with Slice 6, §3.4 with Slice 5, §3.5–3.6 with Slice 7) instead of as one final Slice 8. This document does not prescribe which; it assumes whoever executes it will pick one and say so.
- **The in-memory "fake repository" pattern (§3.3, §3.4, §6.2) is new to this codebase.** It is a reasonable, minimal way to observe write-then-read round trips without a live database, but it is not yet an established convention here (every existing repository spec is stateless `vi.fn().mockResolvedValue`). Recommend a brief team sign-off on the pattern (e.g. via code review on the first PR that introduces it) before it's copied into a third or fourth spec file, so it doesn't silently fork into inconsistent shapes across files.
