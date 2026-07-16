# Staff Platform + Platform Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rezeta platform staff a guarded, always-audited way to create new institutions (tenants) and to reach across tenant boundaries — the one deliberate, isolated break in the "every query filters `tenant_id`" invariant.

**Architecture:** This is Slice 7 (the last slice) of the permissions/multi-user feature and depends on Slices 1–6. `User.isPlatformAdmin` (column added in Slice 2, surfaced on `AuthUser`) becomes behavioral here: `TenantGuard` grows a **narrow, explicit, audited** cross-tenant override keyed on an `X-Target-Tenant` header that is consulted **only** when `request.user.isPlatformAdmin` is true — an ordinary user's request is always pinned to its own tenant. A new staff-only module exposes `POST /v1/staff/institutions`, gated by a `PlatformAdminGuard`, which creates a `Tenant`, seeds its `RolePermission` defaults + starter data, and creates the initial `super_admin` via the Slice-5 provisioning flow. A dev CLI performs the same bootstrap and can mark a user `isPlatformAdmin`. A minimal, English, staff-facing web screen (kept entirely separate from the institution app shell) posts to the endpoint.

**Tech Stack:** NestJS 10 + Prisma 6 (`@rezeta/db`), Zod (`@rezeta/shared`), Firebase Admin SDK (`IAuthProvider`), React 18 + Vite + React Router + TanStack Query + Zustand + Tailwind, Vitest.

## Global Constraints

- Monorepo, pnpm workspaces: `apps/api` (NestJS + Prisma), `apps/web` (React 18 + Vite + Zustand + TanStack Query + Tailwind), `packages/shared` (Zod + types + `ErrorCode`), `packages/db` (Prisma, imported as `@rezeta/db`).
- PKs are `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`. DB columns `snake_case` via `@map`; TS fields `camelCase`. Soft-delete via `deletedAt`.
- `ErrorCode` closed enum: `packages/shared/src/errors.ts`. `FORBIDDEN` already exists (reuse it — do not invent a new platform-admin error code). Slice 3 adds `INSUFFICIENT_PERMISSION`.
- Shared barrel: `packages/shared/src/index.ts` re-exports `types/*` and `schemas/*`. Import in app code as `@rezeta/shared`.
- Global guards, order in `apps/api/src/app.module.ts`: `AuthGuard` → `TenantGuard` → (Slice 3) `PermissionGuard`. Controller/route-scoped `@UseGuards(...)` run **after** all global guards, so `request.user` is populated.
- `AuthGuard` sets `request.user: AuthUser`. `AuthUser` already carries `role` (four roles, Slice 1) and `isPlatformAdmin: boolean` (Slice 2).
- `AuditLogService` (`apps/api/src/common/audit-log/audit-log.service.ts`, `@Global`) via `.record({ actorType, category, action, ... })`. `record()` swallows its own errors; call it fire-and-forget (`void ...`) inside guards, exactly as `AuthGuard` does for `login_failed`.
- Controllers follow the patients/locations pattern: `@ApiTags`, `ZodValidationPipe`, `@CurrentUser() user: AuthUser`.
- Tests live in `__tests__/` beside source. API + shared use `*.spec.ts`; web uses `*.test.tsx`. Match the framework/imports of the nearest sibling test file (Vitest everywhere; `vi.fn()` mocks).
- Coverage gate: `pnpm test:coverage` enforces **95% per-file**. Every new **counted** file needs tests. API coverage excludes already cover `**/*.module.ts`, `**/index.ts`, `**/*.repository.ts`, decorators, `audit-log.types.ts`, `main.ts`. Web coverage excludes already cover `src/pages/**`, `src/components/auth/**`, `src/components/layout/**`, `src/hooks/**/use-*.ts`. Run `pnpm lint` and `pnpm test` before considering a task done.
- Language rule: ALL code/comments/docs/tests/commits in English. ONLY end-user-facing product UI strings are Spanish. **Exception for this slice:** the staff console is internal Rezeta-staff tooling, not the patient-facing product — its user-facing strings are **English** (per the feature spec §7). Strings are still colocated in a `strings.ts` file.
- No `TODO/FIXME/HACK/XXX` comments (ESLint fails CI). No arbitrary Tailwind `prop-[value]` classes — use design tokens from `apps/web/src/index.css` / `tailwind.config.ts`.
- Do NOT run `git commit --amend` on other slices' commits and do NOT rebase; each step below commits its own work.

**Dependencies on prior slices (must be merged before executing this plan):**
- Slice 1: `UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'`, `ROLE_RANK`, `canManageRole(actorRole, targetRole)` in `packages/shared/src/permissions/roles.ts`.
- Slice 2: `RolePermission` model; `PermissionsService.seedDefaults(tx, tenantId)`; `User.isPlatformAdmin Boolean @default(false)` column + on `AuthUser` + `UserApiSchema`.
- Slice 5: `IAuthProvider.createUser(email): Promise<{ externalUid }>` and `generatePasswordResetLink(email): Promise<string>`; `UsersService.createUser(tenantId, actorRole, actorUserId, dto)` (Admin SDK + set-password email; enforces `canManageRole`); `UsersModule` exports `UsersService`.
- Slice 6: `PermissionsModule` exports `PermissionsService`.

---

### Task 1: Shared `CreateInstitutionSchema` + response schema

**Files:**
- Create: `packages/shared/src/schemas/staff.ts`
- Modify: `packages/shared/src/schemas/index.ts` (add `export * from './staff.js'`)
- Test: `packages/shared/src/schemas/__tests__/staff.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `CreateInstitutionSchema` (Zod) with `type CreateInstitutionDto = z.infer<typeof CreateInstitutionSchema>`:
    `{ institutionName: string; type: 'solo'|'practice'|'clinic'|'enterprise'; plan: 'free'|'solo'|'practice'|'clinic'; adminFullName: string; adminEmail: string }`.
  - `InstitutionCreatedSchema` (Zod) with `type InstitutionCreatedDto = z.infer<typeof InstitutionCreatedSchema>`:
    `{ tenantId: string; userId: string; email: string }`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/schemas/__tests__/staff.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { CreateInstitutionSchema, InstitutionCreatedSchema } from '../staff.js'

describe('CreateInstitutionSchema', () => {
  const valid = {
    institutionName: 'Clínica Norte',
    type: 'clinic' as const,
    plan: 'free' as const,
    adminFullName: 'Dra. Ana Reyes',
    adminEmail: 'ana@clinica.com',
  }

  it('accepts a well-formed payload', () => {
    expect(CreateInstitutionSchema.parse(valid)).toEqual(valid)
  })

  it('rejects an invalid admin email', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, adminEmail: 'not-an-email' })
    expect(r.success).toBe(false)
  })

  it('rejects an institution name shorter than 2 chars', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, institutionName: 'X' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown tenant type', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, type: 'hospital' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown plan', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, plan: 'enterprise' })
    expect(r.success).toBe(false)
  })
})

describe('InstitutionCreatedSchema', () => {
  it('accepts a well-formed response', () => {
    const v = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      email: 'ana@clinica.com',
    }
    expect(InstitutionCreatedSchema.parse(v)).toEqual(v)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared exec vitest run src/schemas/__tests__/staff.spec.ts`
Expected: FAIL — cannot resolve module `../staff.js`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/schemas/staff.ts`:

```ts
import { z } from 'zod'

// Tenant `type` and `plan` value sets mirror the Prisma `Tenant` column comments
// (packages/db/prisma/schema.prisma): type = solo|practice|clinic|enterprise,
// plan = free|solo|practice|clinic.
export const CreateInstitutionSchema = z.object({
  institutionName: z
    .string()
    .min(2, 'Institution name must be at least 2 characters')
    .max(200, 'Institution name must be at most 200 characters'),
  type: z.enum(['solo', 'practice', 'clinic', 'enterprise']),
  plan: z.enum(['free', 'solo', 'practice', 'clinic']),
  adminFullName: z
    .string()
    .min(2, 'Admin name must be at least 2 characters')
    .max(200, 'Admin name must be at most 200 characters'),
  adminEmail: z.string().email('Invalid email address'),
})

export const InstitutionCreatedSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
})

export type CreateInstitutionDto = z.infer<typeof CreateInstitutionSchema>
export type InstitutionCreatedDto = z.infer<typeof InstitutionCreatedSchema>
```

Add to `packages/shared/src/schemas/index.ts` (after the existing `export * from './schedule.js'` line):

```ts
export * from './staff.js'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared exec vitest run src/schemas/__tests__/staff.spec.ts`
Expected: PASS (8 assertions across the two describe blocks).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/staff.ts packages/shared/src/schemas/index.ts packages/shared/src/schemas/__tests__/staff.spec.ts
git commit -m "feat(shared): add CreateInstitution + InstitutionCreated schemas"
```

---

### Task 2: Reserve the `cross_tenant_access` audit action

**Files:**
- Modify: `apps/api/src/common/audit-log/audit-log.types.ts` (extend `AuditAuthAction`)

**Interfaces:**
- Consumes: nothing.
- Produces: `AuditAuthAction` now includes the string literal `'cross_tenant_access'`, usable in `AuditLogService.record({ category: 'auth', action: 'cross_tenant_access', ... })`.

> `audit-log.types.ts` is a type-only file and is in the API coverage `exclude` list, so no dedicated test — Task 3's guard test exercises the value at runtime.

- [ ] **Step 1: Add the action literal**

In `apps/api/src/common/audit-log/audit-log.types.ts`, extend `AuditAuthAction` (it currently ends with `| 'permission_granted' | 'permission_revoked'`):

```ts
export type AuditAuthAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'mfa_enabled'
  | 'session_revoked'
  | 'permission_granted'
  | 'permission_revoked'
  | 'cross_tenant_access'
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/audit-log/audit-log.types.ts
git commit -m "feat(api): reserve cross_tenant_access audit action"
```

---

### Task 3: `TenantGuard` cross-tenant override for platform admins

**Files:**
- Modify: `apps/api/src/common/guards/tenant.guard.ts`
- Modify (rewrite): `apps/api/src/common/guards/__tests__/tenant.guard.spec.ts`

**Interfaces:**
- Consumes: `AuditLogService` (`@Global`); `AuthenticatedRequest` (has `user: AuthUser` with `isPlatformAdmin`, `id`, `tenantId`; and Express `headers` / `ip`).
- Produces: `TenantGuard` still exposes `canActivate(ctx): boolean`. New behavior: when `request.user.isPlatformAdmin` is true AND a valid-UUID `X-Target-Tenant` header is present, `request.tenantId` is set to that target and one `cross_tenant_access` audit event is recorded; in every other case `request.tenantId === request.user.tenantId`.

- [ ] **Step 1: Rewrite the failing test**

Replace the entire contents of `apps/api/src/common/guards/__tests__/tenant.guard.spec.ts`:

```ts
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TenantGuard } from '../tenant.guard.js'
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../../decorators/provision-route.decorator.js'
import type { AuditLogService } from '../../audit-log/audit-log.service.js'

const OWN_TENANT = 'tenant-own'
const TARGET_TENANT = '33333333-3333-3333-3333-333333333333'

function makeContext(options: {
  isPublic?: boolean
  isProvisionRoute?: boolean
  tenantId?: string
  isPlatformAdmin?: boolean
  targetHeader?: string
}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return options.isPublic ?? false
      if (key === IS_PROVISION_ROUTE_KEY) return options.isProvisionRoute ?? false
      return undefined
    }),
  }

  const request: Record<string, unknown> = {
    user: {
      id: 'user-1',
      tenantId: options.tenantId ?? OWN_TENANT,
      isPlatformAdmin: options.isPlatformAdmin ?? false,
    },
    headers: options.targetHeader ? { 'x-target-tenant': options.targetHeader } : {},
    ip: '10.0.0.9',
  }

  const ctx = {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn().mockReturnValue(request) }),
  }

  return { reflector, ctx, request }
}

describe('TenantGuard', () => {
  let auditLog: AuditLogService
  let guard: TenantGuard

  beforeEach(() => {
    auditLog = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogService
  })

  function build(reflector: unknown): TenantGuard {
    return new TenantGuard(reflector as never, auditLog)
  }

  it('returns true for public routes without setting tenantId', () => {
    const { reflector, ctx, request } = makeContext({ isPublic: true })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    expect(request['tenantId']).toBeUndefined()
    expect(auditLog.record).not.toHaveBeenCalled()
  })

  it('returns true for provision routes without setting tenantId', () => {
    const { reflector, ctx, request } = makeContext({ isProvisionRoute: true })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    expect(request['tenantId']).toBeUndefined()
  })

  it('pins an ordinary user to their own tenant', () => {
    const { reflector, ctx, request } = makeContext({ tenantId: 'my-tenant' })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    expect(request['tenantId']).toBe('my-tenant')
    expect(auditLog.record).not.toHaveBeenCalled()
  })

  // ── Isolation guarantee ─────────────────────────────────────────────────────
  it('IGNORES X-Target-Tenant for a non-platform-admin (isolation preserved)', () => {
    const { reflector, ctx, request } = makeContext({
      isPlatformAdmin: false,
      targetHeader: TARGET_TENANT,
    })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    // The header is NOT consulted — the user stays pinned to their own tenant.
    expect(request['tenantId']).toBe(OWN_TENANT)
    expect(auditLog.record).not.toHaveBeenCalled()
  })

  it('platform admin without the header stays on their own tenant', () => {
    const { reflector, ctx, request } = makeContext({ isPlatformAdmin: true })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    expect(request['tenantId']).toBe(OWN_TENANT)
    expect(auditLog.record).not.toHaveBeenCalled()
  })

  it('platform admin WITH a valid target header reaches that tenant and is audited', () => {
    const { reflector, ctx, request } = makeContext({
      isPlatformAdmin: true,
      targetHeader: TARGET_TENANT,
    })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    expect(request['tenantId']).toBe(TARGET_TENANT)
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TARGET_TENANT,
        actorUserId: 'user-1',
        actorType: 'user',
        category: 'auth',
        action: 'cross_tenant_access',
        metadata: { targetTenantId: TARGET_TENANT, actorTenantId: OWN_TENANT },
      }),
    )
  })

  it('platform admin with a malformed target header falls back to own tenant, no audit', () => {
    const { reflector, ctx, request } = makeContext({
      isPlatformAdmin: true,
      targetHeader: 'not-a-uuid',
    })
    guard = build(reflector)
    expect(guard.canActivate(ctx as never)).toBe(true)
    expect(request['tenantId']).toBe(OWN_TENANT)
    expect(auditLog.record).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/tenant.guard.spec.ts`
Expected: FAIL — `TenantGuard` constructor takes one arg (the new `auditLog` arg is not yet accepted), and the cross-tenant assertions fail.

- [ ] **Step 3: Implement the override**

Replace the contents of `apps/api/src/common/guards/tenant.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'
import { AuditLogService } from '../audit-log/audit-log.service.js'

/** Header a platform admin sets to explicitly target a tenant other than their own. */
const TARGET_TENANT_HEADER = 'x-target-tenant'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * TenantGuard — runs after AuthGuard.
 *
 * Default behavior: pins the request to the authenticated user's own tenant
 * (`request.tenantId = request.user.tenantId`), which the `@TenantId()`
 * decorator reads. This is the tenant-isolation invariant.
 *
 * The ONLY exception is a platform admin (`request.user.isPlatformAdmin`), who
 * may target another tenant by sending an explicit `X-Target-Tenant` header.
 * The override branch is gated entirely on `isPlatformAdmin`, so an ordinary
 * user sending the header can never reach another tenant — it is simply not
 * read. Every cross-tenant access is audited (actor + target tenant).
 *
 * Skipped for @Public() and @ProvisionRoute() endpoints (no resolved user yet).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler()
    const classRef = ctx.getClass()

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, classRef])
    if (isPublic) return true

    const isProvisionRoute = this.reflector.getAllAndOverride<boolean>(IS_PROVISION_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isProvisionRoute) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    const user = request.user

    // Default: strict isolation — the user is pinned to their own tenant.
    request.tenantId = user.tenantId

    // Cross-tenant override is available to platform admins ONLY, and only when
    // an explicit, well-formed target is supplied. Ordinary users never enter
    // this branch, so the header cannot broaden their reach.
    if (user.isPlatformAdmin) {
      const raw = request.headers[TARGET_TENANT_HEADER]
      const target = typeof raw === 'string' ? raw : undefined
      if (target && UUID_RE.test(target) && target !== user.tenantId) {
        request.tenantId = target
        void this.auditLog.record({
          tenantId: target,
          actorUserId: user.id,
          actorType: 'user',
          category: 'auth',
          action: 'cross_tenant_access',
          metadata: { targetTenantId: target, actorTenantId: user.tenantId },
          ...(request.ip ? { ipAddress: request.ip } : {}),
        })
      }
    }

    return true
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/tenant.guard.spec.ts`
Expected: PASS (all 8 cases).

- [ ] **Step 5: Verify the guard still wires up (DI smoke)**

`TenantGuard` is provided via `APP_GUARD` in `app.module.ts`; `AuditLogService` is `@Global`, so no module edit is needed. Confirm the whole API suite still builds:

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/guards/tenant.guard.ts apps/api/src/common/guards/__tests__/tenant.guard.spec.ts
git commit -m "feat(api): platform-admin cross-tenant override in TenantGuard (explicit + audited)"
```

---

### Task 4: `PlatformAdminGuard`

**Files:**
- Create: `apps/api/src/common/guards/platform-admin.guard.ts`
- Test: `apps/api/src/common/guards/__tests__/platform-admin.guard.spec.ts`

**Interfaces:**
- Consumes: `AuthenticatedRequest` (`user.isPlatformAdmin`), `ErrorCode.FORBIDDEN`.
- Produces: `PlatformAdminGuard implements CanActivate` with `canActivate(ctx): boolean` — returns `true` when `request.user.isPlatformAdmin`, otherwise throws `ForbiddenException({ code: ErrorCode.FORBIDDEN, ... })`. Applied via `@UseGuards(PlatformAdminGuard)` on the staff controller (Task 6).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/guards/__tests__/platform-admin.guard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { PlatformAdminGuard } from '../platform-admin.guard.js'

function ctxWith(user: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never
}

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard()

  it('allows a platform admin', () => {
    expect(guard.canActivate(ctxWith({ id: 'u1', isPlatformAdmin: true }))).toBe(true)
  })

  it('rejects a non-platform-admin with 403 FORBIDDEN', () => {
    expect(() => guard.canActivate(ctxWith({ id: 'u1', isPlatformAdmin: false }))).toThrow(
      ForbiddenException,
    )
  })

  it('rejects when there is no user', () => {
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(ForbiddenException)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/platform-admin.guard.spec.ts`
Expected: FAIL — cannot resolve `../platform-admin.guard.js`.

- [ ] **Step 3: Write minimal implementation**

Create `apps/api/src/common/guards/platform-admin.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import type { AuthenticatedRequest } from './auth.guard.js'

/**
 * PlatformAdminGuard — controller-scoped guard for the staff platform.
 *
 * Runs after the global AuthGuard/TenantGuard, so `request.user` is populated.
 * Admits only Rezeta platform staff (`isPlatformAdmin`); everyone else gets 403.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.user?.isPlatformAdmin) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Platform admin access required',
      })
    }
    return true
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/platform-admin.guard.spec.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/guards/platform-admin.guard.ts apps/api/src/common/guards/__tests__/platform-admin.guard.spec.ts
git commit -m "feat(api): add PlatformAdminGuard for staff-only routes"
```

---

### Task 5: Let `UsersService.createUser` bypass the rank rule for platform bootstrap

> **Depends on Slice 5.** `apps/api/src/modules/users/users.service.ts` gains a `createUser(tenantId, actorRole, actorUserId, dto)` method in Slice 5 that enforces `canManageRole(actorRole, role)`. Creating the **initial** `super_admin` of a brand-new institution legitimately sits *above* the institution rank rule (there is no existing super_admin to rank against, and the caller is a platform admin gated by `PlatformAdminGuard`). This task adds a narrow, opt-in bypass so `StaffService` (Task 6) can reuse the exact Slice-5 provisioning flow (Admin SDK + set-password email) instead of duplicating it.

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts` (add an optional `options` parameter to `createUser`)
- Modify: `apps/api/src/modules/users/__tests__/users.service.spec.ts` (add a bypass case; match whatever the Slice-5 spec is named — adapt the filename if different)

**Interfaces:**
- Consumes: the Slice-5 `createUser` and its `canManageRole` guard.
- Produces: `createUser(tenantId: string, actorRole: UserRole, actorUserId: string | null, dto: CreateUserDto, options?: { bypassRankCheck?: boolean }): Promise<ManagedUserDto>`. This extends Slice 5's real signature `createUser(tenantId, actorRole, actorUserId, dto)` in two ways: (a) it appends the optional `options` param, and (b) it **widens** `actorUserId` from `string` to `string | null` so the CLI/system bootstrap (no acting user) can call it — the `user_invited` audit already tolerates a null actor via `actorType: 'system'`. When `options.bypassRankCheck === true`, the `canManageRole` throw is skipped; default (`undefined`/`false`) preserves Slice-5 behavior exactly.

- [ ] **Step 1: Read the current implementation**

Open `apps/api/src/modules/users/users.service.ts` and locate the `createUser` method and its rank-rule check (a call to `canManageRole(actorRole, dto.role)` that throws `ForbiddenException({ code: ErrorCode.FORBIDDEN, ... })` when it returns false).

- [ ] **Step 2: Write the failing test**

Add to the Slice-5 users service spec (e.g. `apps/api/src/modules/users/__tests__/users.service.spec.ts`). This assumes the spec already stands up `UsersService` with mocked `UsersRepository` + `IAuthProvider` — reuse that harness; only the two cases below are new:

```ts
it('rejects super_admin -> super_admin by default (rank rule holds)', async () => {
  await expect(
    service.createUser('t1', 'super_admin', 'actor-1', {
      email: 'a@b.com',
      fullName: 'Ana',
      role: 'super_admin',
    }),
  ).rejects.toThrow(ForbiddenException)
})

it('allows super_admin -> super_admin when bypassRankCheck is set', async () => {
  // The provider + repository mocks must be configured as in the existing
  // happy-path createUser test (authProvider.createUser -> { externalUid },
  // repository write -> a User row, generatePasswordResetLink -> a link).
  const user = await service.createUser(
    't1',
    'super_admin',
    'actor-1',
    { email: 'a@b.com', fullName: 'Ana', role: 'super_admin' },
    { bypassRankCheck: true },
  )
  expect(user).toBeDefined()
})
```

Ensure `ForbiddenException` is imported from `@nestjs/common` in the spec (it likely already is).

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/users/__tests__/users.service.spec.ts`
Expected: FAIL — the bypass case still throws because `createUser` ignores the 4th argument.

- [ ] **Step 4: Implement the bypass**

In `createUser`, add the optional parameter and gate the existing rank check. The signature becomes:

```ts
async createUser(
  tenantId: string,
  actorRole: UserRole,
  actorUserId: string | null,
  dto: CreateUserDto,
  options?: { bypassRankCheck?: boolean },
): Promise<ManagedUserDto> {
```

> Keep Slice 5's `actorUserId` parameter and `ManagedUserDto` return type — this
> task only appends `options` and widens `actorUserId` to `string | null`. Do not
> drop the parameter or change the return type.

and wrap the existing guard so it only runs when not bypassed:

```ts
if (!options?.bypassRankCheck && !canManageRole(actorRole, dto.role)) {
  throw new ForbiddenException({
    code: ErrorCode.FORBIDDEN,
    message: 'Cannot create a user at or above your own role',
  })
}
```

Leave the rest of the method (Firebase Admin SDK `createUser`, `User` row write with `externalUid`, set-password email) untouched.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/users/__tests__/users.service.spec.ts`
Expected: PASS (existing Slice-5 cases plus the two new ones).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/users/users.service.ts apps/api/src/modules/users/__tests__/users.service.spec.ts
git commit -m "feat(api): opt-in bypassRankCheck on UsersService.createUser for platform bootstrap"
```

---

### Task 6: Staff module — `POST /v1/staff/institutions`

**Files:**
- Create: `apps/api/src/modules/staff/staff.service.ts`
- Create: `apps/api/src/modules/staff/staff.controller.ts`
- Create: `apps/api/src/modules/staff/staff.module.ts`
- Create: `apps/api/src/modules/staff/index.ts`
- Modify: `apps/api/src/app.module.ts` (register `StaffModule`)
- Test: `apps/api/src/modules/staff/__tests__/staff.service.spec.ts`
- Test: `apps/api/src/modules/staff/__tests__/staff.controller.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`; `PermissionsService.seedDefaults(tx, tenantId)` (Slice 2/6); `TenantSeedingService.seedDefault(tenantId, locale)` (existing); `UsersService.createUser(tenantId, actorRole, actorUserId, dto, options)` (Task 5); `AuditLogService`; `PlatformAdminGuard` (Task 4); `CreateInstitutionSchema` / `CreateInstitutionDto` / `InstitutionCreatedDto` (Task 1); `@CurrentUser()` (existing); `ZodValidationPipe` (existing).
- Produces:
  - `StaffService.createInstitution(dto: CreateInstitutionDto, actorUserId: string | null): Promise<InstitutionCreatedDto>` — creates the tenant + seeds `RolePermission` defaults (in one transaction), seeds starter data, creates the initial `super_admin`, audits, and returns `{ tenantId, userId, email }`. `actorUserId` is `null` for the CLI bootstrap (Task 7) → audit `actorType: 'system'`.
  - `StaffController` at `@Controller('v1/staff')`, `@UseGuards(PlatformAdminGuard)`, `POST institutions`.

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/modules/staff/__tests__/staff.service.spec.ts`:

```ts
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StaffService } from '../staff.service.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { PermissionsService } from '../../permissions/permissions.service.js'
import type { TenantSeedingService } from '../../tenant-seeding/tenant-seeding.service.js'
import type { UsersService } from '../../users/users.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { CreateInstitutionDto } from '@rezeta/shared'

const dto: CreateInstitutionDto = {
  institutionName: 'Clínica Norte',
  type: 'clinic',
  plan: 'free',
  adminFullName: 'Dra. Ana Reyes',
  adminEmail: 'ana@clinica.com',
}

describe('StaffService.createInstitution', () => {
  let prisma: PrismaService
  let permissions: PermissionsService
  let tenantSeeding: TenantSeedingService
  let users: UsersService
  let auditLog: AuditLogService
  let service: StaffService
  const tx = { tenant: { create: vi.fn() } }

  beforeEach(() => {
    tx.tenant.create.mockReset()
    tx.tenant.create.mockResolvedValue({ id: 'new-tenant' })
    prisma = {
      $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
    } as unknown as PrismaService
    permissions = { seedDefaults: vi.fn().mockResolvedValue(undefined) } as unknown as PermissionsService
    tenantSeeding = { seedDefault: vi.fn().mockResolvedValue(undefined) } as unknown as TenantSeedingService
    users = {
      createUser: vi.fn().mockResolvedValue({ id: 'new-user', email: 'ana@clinica.com' }),
    } as unknown as UsersService
    auditLog = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogService
    service = new StaffService(prisma, permissions, tenantSeeding, users, auditLog)
  })

  it('creates the tenant and seeds RolePermission defaults in one transaction', async () => {
    await service.createInstitution(dto, 'actor-1')
    expect(tx.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Clínica Norte', type: 'clinic', plan: 'free' }),
    })
    expect(permissions.seedDefaults).toHaveBeenCalledWith(tx, 'new-tenant')
  })

  it('seeds starter data for the new tenant', async () => {
    await service.createInstitution(dto, 'actor-1')
    expect(tenantSeeding.seedDefault).toHaveBeenCalledWith('new-tenant', 'es')
  })

  it('creates the initial super_admin via the users flow with a rank bypass', async () => {
    await service.createInstitution(dto, 'actor-1')
    expect(users.createUser).toHaveBeenCalledWith(
      'new-tenant',
      'super_admin',
      { email: 'ana@clinica.com', fullName: 'Dra. Ana Reyes', role: 'super_admin' },
      { bypassRankCheck: true },
    )
  })

  it('audits the institution creation with the acting user', async () => {
    await service.createInstitution(dto, 'actor-1')
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'new-tenant',
        actorUserId: 'actor-1',
        actorType: 'user',
        category: 'entity',
        action: 'create',
        entityType: 'tenant',
        entityId: 'new-tenant',
      }),
    )
  })

  it('audits as system when there is no acting user (CLI bootstrap)', async () => {
    await service.createInstitution(dto, null)
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system', tenantId: 'new-tenant' }),
    )
  })

  it('returns the created tenant, user id, and email', async () => {
    const result = await service.createInstitution(dto, 'actor-1')
    expect(result).toEqual({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' })
  })
})
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/staff/__tests__/staff.service.spec.ts`
Expected: FAIL — cannot resolve `../staff.service.js`.

- [ ] **Step 3: Implement `StaffService`**

Create `apps/api/src/modules/staff/staff.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'
import { PermissionsService } from '../permissions/permissions.service.js'
import { TenantSeedingService } from '../tenant-seeding/tenant-seeding.service.js'
import { UsersService } from '../users/users.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'

/**
 * StaffService — the staff platform's create-institution orchestration.
 *
 * There is no self-service signup, so this is the only path that mints a new
 * Tenant. It reuses the same building blocks the rest of the app uses:
 *   1. Tenant row + RolePermission defaults (one transaction).
 *   2. Starter templates/categories (tenant-seeding).
 *   3. Initial super_admin via the Slice-5 users flow (Admin SDK + set-password
 *      email), with an explicit rank-check bypass because bootstrapping the
 *      first super_admin sits above the institution rank rule.
 * Every creation is audited.
 */
@Injectable()
export class StaffService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionsService) private permissions: PermissionsService,
    @Inject(TenantSeedingService) private tenantSeeding: TenantSeedingService,
    @Inject(UsersService) private users: UsersService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async createInstitution(
    dto: CreateInstitutionDto,
    actorUserId: string | null,
  ): Promise<InstitutionCreatedDto> {
    // 1. Tenant + permission defaults, atomically.
    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          name: dto.institutionName,
          type: dto.type,
          plan: dto.plan,
          country: 'DO',
          language: 'es',
          timezone: 'America/Santo_Domingo',
        },
      })
      await this.permissions.seedDefaults(tx, created.id)
      return created
    })

    // 2. Starter templates + categories (own transaction; sets seededAt).
    await this.tenantSeeding.seedDefault(tenant.id, 'es')

    // 3. Initial super_admin. bypassRankCheck: this is the platform-admin
    //    bootstrap, which is above the institution rank rule.
    const user = await this.users.createUser(
      tenant.id,
      'super_admin',
      actorUserId,
      { email: dto.adminEmail, fullName: dto.adminFullName, role: 'super_admin' },
      { bypassRankCheck: true },
    )

    // 4. Audit.
    await this.auditLog.record({
      tenantId: tenant.id,
      ...(actorUserId ? { actorUserId } : {}),
      actorType: actorUserId ? 'user' : 'system',
      category: 'entity',
      action: 'create',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: {
        institutionName: dto.institutionName,
        adminEmail: dto.adminEmail,
        initialUserId: user.id,
      },
    })

    return { tenantId: tenant.id, userId: user.id, email: user.email }
  }
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/staff/__tests__/staff.service.spec.ts`
Expected: PASS (6 cases).

- [ ] **Step 5: Write the failing controller test**

Create `apps/api/src/modules/staff/__tests__/staff.controller.spec.ts`:

```ts
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { StaffController } from '../staff.controller.js'
import type { StaffService } from '../staff.service.js'
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard.js'
import type { AuthUser, CreateInstitutionDto } from '@rezeta/shared'

const dto: CreateInstitutionDto = {
  institutionName: 'Clínica Norte',
  type: 'clinic',
  plan: 'free',
  adminFullName: 'Dra. Ana Reyes',
  adminEmail: 'ana@clinica.com',
}

function admin(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'staff-1',
    externalUid: 'ext-staff',
    tenantId: 'tenant-staff',
    email: 'staff@rezeta.com',
    fullName: 'Staff',
    role: 'super_admin',
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: '2026-01-01T00:00:00Z',
    isPlatformAdmin: true,
    capabilities: {} as AuthUser['capabilities'],
    preferences: {},
    ...overrides,
  } as AuthUser
}

describe('StaffController', () => {
  let service: StaffService
  let controller: StaffController

  beforeEach(() => {
    service = {
      createInstitution: vi
        .fn()
        .mockResolvedValue({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' }),
    } as unknown as StaffService
    controller = new StaffController(service)
  })

  it('delegates to the service with the acting user id', async () => {
    const result = await controller.createInstitution(admin(), dto)
    expect(service.createInstitution).toHaveBeenCalledWith(dto, 'staff-1')
    expect(result).toEqual({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' })
  })

  it('PlatformAdminGuard rejects a non-platform-admin (authz)', () => {
    const guard = new PlatformAdminGuard()
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user: admin({ isPlatformAdmin: false }) }) }),
    } as never
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException)
  })
})
```

> `capabilities` on `AuthUser` is added in Slice 2. If the exact type name differs, cast as needed — the field is not exercised by these tests.

- [ ] **Step 6: Run the controller test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/staff/__tests__/staff.controller.spec.ts`
Expected: FAIL — cannot resolve `../staff.controller.js`.

- [ ] **Step 7: Implement the controller and module**

Create `apps/api/src/modules/staff/staff.controller.ts`:

```ts
import { Body, Controller, HttpCode, HttpStatus, Inject, Post, UseGuards, UsePipes } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreateInstitutionSchema,
  type AuthUser,
  type CreateInstitutionDto,
  type InstitutionCreatedDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard.js'
import { StaffService } from './staff.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@UseGuards(PlatformAdminGuard)
@Controller('v1/staff')
export class StaffController {
  constructor(@Inject(StaffService) private svc: StaffService) {}

  @Post('institutions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateInstitutionSchema))
  @ApiOperation({ summary: 'Create a new institution (tenant) and its initial super_admin' })
  @ApiResponse({ status: 201, description: 'Institution created.' })
  @ApiResponse({ status: 403, description: 'Caller is not a platform admin.' })
  async createInstitution(
    @CurrentUser() actor: AuthUser,
    @Body() dto: CreateInstitutionDto,
  ): Promise<InstitutionCreatedDto> {
    return this.svc.createInstitution(dto, actor.id)
  }
}
```

Create `apps/api/src/modules/staff/staff.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PermissionsModule } from '../permissions/index.js'
import { TenantSeedingModule } from '../tenant-seeding/index.js'
import { UsersModule } from '../users/index.js'
import { StaffController } from './staff.controller.js'
import { StaffService } from './staff.service.js'

@Module({
  imports: [PermissionsModule, TenantSeedingModule, UsersModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
```

> Confirm the import specifier for `PermissionsModule` matches Slice 6's barrel (`../permissions/index.js` if it exposes one, otherwise `../permissions/permissions.module.js`). `AuditLogService`/`PrismaService` are global — no import needed.

Create `apps/api/src/modules/staff/index.ts`:

```ts
export { StaffModule } from './staff.module.js'
export { StaffService } from './staff.service.js'
```

- [ ] **Step 8: Register `StaffModule` in `app.module.ts`**

In `apps/api/src/app.module.ts`, add the import near the other module imports:

```ts
import { StaffModule } from './modules/staff/index.js'
```

and add `StaffModule` to the `imports` array (after `LogsModule`).

- [ ] **Step 9: Run the controller test + typecheck**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/staff/__tests__/staff.controller.spec.ts`
Expected: PASS (2 cases).

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/staff apps/api/src/app.module.ts
git commit -m "feat(api): staff platform module — POST /v1/staff/institutions (platform-admin only)"
```

---

### Task 7: Dev bootstrap CLI — create an institution + first platform admin

**Files:**
- Create: `apps/api/src/scripts/create-institution.ts`
- Modify: `apps/api/vitest.config.ts` (exclude `src/scripts/**` from coverage, like `main.ts`)
- Modify: `apps/api/package.json` (add a `bootstrap:institution` script)
- Test: `apps/api/src/scripts/__tests__/create-institution.spec.ts`

**Interfaces:**
- Consumes: `StaffService.createInstitution(dto, null)` (Task 6); `PrismaService` (to set `isPlatformAdmin`); `NestFactory.createApplicationContext(AppModule)`.
- Produces (all exported for testing):
  - `parseArgs(argv: string[]): BootstrapArgs` where `BootstrapArgs = { institutionName; type; plan; adminFullName; adminEmail; platformAdmin: boolean }`.
  - `bootstrapInstitution(staff: Pick<StaffService,'createInstitution'>, prisma: { user: { update: Function } }, args: BootstrapArgs): Promise<InstitutionCreatedDto>` — calls `createInstitution(dto, null)` then, when `args.platformAdmin`, sets `isPlatformAdmin = true` on the created user.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/scripts/__tests__/create-institution.spec.ts`:

```ts
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi } from 'vitest'
import { parseArgs, bootstrapInstitution } from '../create-institution.js'

describe('parseArgs', () => {
  it('parses the flags into a BootstrapArgs', () => {
    const args = parseArgs([
      '--name=Clínica Norte',
      '--type=clinic',
      '--plan=free',
      '--admin-name=Dra. Ana',
      '--admin-email=ana@clinica.com',
      '--platform-admin',
    ])
    expect(args).toEqual({
      institutionName: 'Clínica Norte',
      type: 'clinic',
      plan: 'free',
      adminFullName: 'Dra. Ana',
      adminEmail: 'ana@clinica.com',
      platformAdmin: true,
    })
  })

  it('defaults platformAdmin to false when the flag is absent', () => {
    const args = parseArgs([
      '--name=Clínica Sur',
      '--type=solo',
      '--plan=free',
      '--admin-name=Dr. Luis',
      '--admin-email=luis@clinica.com',
    ])
    expect(args.platformAdmin).toBe(false)
  })

  it('throws when a required flag is missing', () => {
    expect(() => parseArgs(['--type=solo'])).toThrow(/required/i)
  })
})

describe('bootstrapInstitution', () => {
  const args = {
    institutionName: 'Clínica Norte',
    type: 'clinic',
    plan: 'free',
    adminFullName: 'Dra. Ana',
    adminEmail: 'ana@clinica.com',
    platformAdmin: true,
  } as const

  it('creates the institution as a system actor and flags the user as platform admin', async () => {
    const staff = {
      createInstitution: vi
        .fn()
        .mockResolvedValue({ tenantId: 't1', userId: 'u1', email: 'ana@clinica.com' }),
    }
    const prisma = { user: { update: vi.fn().mockResolvedValue({}) } }
    const result = await bootstrapInstitution(staff, prisma as never, args)
    expect(staff.createInstitution).toHaveBeenCalledWith(
      {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
      null,
    )
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { isPlatformAdmin: true },
    })
    expect(result.tenantId).toBe('t1')
  })

  it('does not flag the user when platformAdmin is false', async () => {
    const staff = {
      createInstitution: vi
        .fn()
        .mockResolvedValue({ tenantId: 't1', userId: 'u1', email: 'x@y.com' }),
    }
    const prisma = { user: { update: vi.fn() } }
    await bootstrapInstitution(staff, prisma as never, { ...args, platformAdmin: false })
    expect(prisma.user.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/scripts/__tests__/create-institution.spec.ts`
Expected: FAIL — cannot resolve `../create-institution.js`.

- [ ] **Step 3: Implement the CLI**

Create `apps/api/src/scripts/create-institution.ts`:

```ts
import { NestFactory } from '@nestjs/core'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { AppModule } from '../app.module.js'
import { StaffService } from '../modules/staff/index.js'
import { PrismaService } from '../lib/prisma.service.js'

export interface BootstrapArgs {
  institutionName: string
  type: string
  plan: string
  adminFullName: string
  adminEmail: string
  platformAdmin: boolean
}

/**
 * Parses `--name`, `--type`, `--plan`, `--admin-name`, `--admin-email`, and the
 * boolean `--platform-admin` flag from a raw argv slice. Validation of the
 * value sets is delegated to CreateInstitutionSchema inside StaffService.
 */
export function parseArgs(argv: string[]): BootstrapArgs {
  const map = new Map<string, string>()
  let platformAdmin = false
  for (const arg of argv) {
    if (arg === '--platform-admin') {
      platformAdmin = true
      continue
    }
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) map.set(match[1]!, match[2]!)
  }
  const require = (key: string): string => {
    const value = map.get(key)
    if (value === undefined || value.trim() === '') {
      throw new Error(`Missing required flag --${key}`)
    }
    return value
  }
  return {
    institutionName: require('name'),
    type: require('type'),
    plan: require('plan'),
    adminFullName: require('admin-name'),
    adminEmail: require('admin-email'),
    platformAdmin,
  }
}

export async function bootstrapInstitution(
  staff: Pick<StaffService, 'createInstitution'>,
  prisma: Pick<PrismaService, 'user'>,
  args: BootstrapArgs,
): Promise<InstitutionCreatedDto> {
  const dto: CreateInstitutionDto = {
    institutionName: args.institutionName,
    type: args.type as CreateInstitutionDto['type'],
    plan: args.plan as CreateInstitutionDto['plan'],
    adminFullName: args.adminFullName,
    adminEmail: args.adminEmail,
  }
  const result = await staff.createInstitution(dto, null)
  if (args.platformAdmin) {
    await prisma.user.update({ where: { id: result.userId }, data: { isPlatformAdmin: true } })
  }
  return result
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const staff = app.get(StaffService)
    const prisma = app.get(PrismaService)
    const result = await bootstrapInstitution(staff, prisma, args)
    // eslint-disable-next-line no-console
    console.log(
      `✓ Institution ${result.tenantId} created; super_admin ${result.userId} (${result.email})` +
        (args.platformAdmin ? ' [platform admin]' : ''),
    )
  } finally {
    await app.close()
  }
}

// Only self-invoke when run as a script (not when imported by tests).
if (process.argv[1]?.endsWith('create-institution.ts')) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Exclude scripts from coverage**

In `apps/api/vitest.config.ts`, add `'src/scripts/**'` to the `coverage.exclude` array (next to `'src/main.ts'`). The `main()` / self-invoke lines require a live Nest context and DB, so the file is excluded from coverage exactly like `main.ts`; the pure `parseArgs`/`bootstrapInstitution` functions are still unit-tested.

- [ ] **Step 5: Add the package script**

In `apps/api/package.json` `scripts`, add:

```json
"bootstrap:institution": "tsx --env-file=../../.env src/scripts/create-institution.ts"
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/scripts/__tests__/create-institution.spec.ts`
Expected: PASS (5 cases).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/scripts/create-institution.ts apps/api/src/scripts/__tests__/create-institution.spec.ts apps/api/vitest.config.ts apps/api/package.json
git commit -m "feat(api): dev CLI to bootstrap an institution + first platform admin"
```

---

### Task 8: Web mutation hook — `useCreateInstitution`

**Files:**
- Create: `apps/web/src/hooks/staff/use-create-institution.ts`

**Interfaces:**
- Consumes: `apiClient.post` (`apps/web/src/lib/api-client.ts`); `CreateInstitutionDto` / `InstitutionCreatedDto` (`@rezeta/shared`).
- Produces: `useCreateInstitution(): UseMutationResult<InstitutionCreatedDto, Error, CreateInstitutionDto>` posting to `/v1/staff/institutions`.

> `src/hooks/**/use-*.ts` is in the web coverage `exclude` list (TanStack wrappers are integration-tested), so no dedicated unit test — it is exercised via the page test in Task 9.

- [ ] **Step 1: Implement the hook**

Create `apps/web/src/hooks/staff/use-create-institution.ts`:

```ts
import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'

export function useCreateInstitution(): UseMutationResult<
  InstitutionCreatedDto,
  Error,
  CreateInstitutionDto
> {
  return useMutation({
    mutationFn: (dto: CreateInstitutionDto) =>
      apiClient.post<InstitutionCreatedDto>('/v1/staff/institutions', dto),
  })
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @rezeta/web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/staff/use-create-institution.ts
git commit -m "feat(web): add useCreateInstitution mutation hook"
```

---

### Task 9: Web staff console — platform-admin gate + "New institution" screen

**Files:**
- Create: `apps/web/src/components/auth/RequirePlatformAdmin.tsx`
- Create: `apps/web/src/components/layout/StaffLayout.tsx`
- Create: `apps/web/src/pages/staff/NewInstitution.tsx`
- Create: `apps/web/src/pages/staff/strings.ts`
- Modify: `apps/web/src/App.tsx` (add the `/staff` route tree, separate from `AppLayout`)
- Test: `apps/web/src/pages/staff/__tests__/NewInstitution.test.tsx`
- Test: `apps/web/src/components/auth/__tests__/RequirePlatformAdmin.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore` (`apps/web/src/store/auth.store.ts`, `user.isPlatformAdmin`); `useCreateInstitution` (Task 8); UI components from `@/components/ui` (`Button`, `Field`, `Input`, `Callout`); React Router (`Navigate`, `Outlet`).
- Produces: `RequirePlatformAdmin` (redirects non-admins to `/dashboard`); `StaffLayout` (minimal English shell, no Sidebar); `NewInstitution` page at `/staff/institutions/new`.

> `src/pages/**`, `src/components/auth/**`, and `src/components/layout/**` are all in the web coverage `exclude` list, so these files are integration-tested (the tests below run and must pass, but do not count toward coverage).

- [ ] **Step 1: Write the failing gate test**

Create `apps/web/src/components/auth/__tests__/RequirePlatformAdmin.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mocks = vi.hoisted(() => ({ useAuthStore: vi.fn() }))
vi.mock('@/store/auth.store', () => ({ useAuthStore: mocks.useAuthStore }))

import { RequirePlatformAdmin } from '../RequirePlatformAdmin'

function renderAt(user: unknown) {
  mocks.useAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector({ user }),
  )
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route
          path="/staff"
          element={
            <RequirePlatformAdmin>
              <div>STAFF AREA</div>
            </RequirePlatformAdmin>
          }
        />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequirePlatformAdmin', () => {
  beforeEach(() => mocks.useAuthStore.mockReset())

  it('renders children for a platform admin', () => {
    renderAt({ id: 'u1', isPlatformAdmin: true })
    expect(screen.getByText('STAFF AREA')).toBeInTheDocument()
  })

  it('redirects a non-platform-admin to the dashboard', () => {
    renderAt({ id: 'u1', isPlatformAdmin: false })
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
  })

  it('redirects when unauthenticated', () => {
    renderAt(null)
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the gate test to verify it fails**

Run: `pnpm --filter @rezeta/web exec vitest run src/components/auth/__tests__/RequirePlatformAdmin.test.tsx`
Expected: FAIL — cannot resolve `../RequirePlatformAdmin`.

- [ ] **Step 3: Implement the gate and layout**

Create `apps/web/src/components/auth/RequirePlatformAdmin.tsx`:

```tsx
import type { JSX, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

/**
 * Route gate for the staff console. Only platform admins may pass; everyone
 * else is redirected to the institution dashboard. This is a UX gate — the
 * backend PlatformAdminGuard is the real authorization boundary.
 */
export function RequirePlatformAdmin({ children }: { children: ReactNode }): JSX.Element {
  const isPlatformAdmin = useAuthStore((s) => s.user?.isPlatformAdmin ?? false)
  if (!isPlatformAdmin) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
```

Create `apps/web/src/components/layout/StaffLayout.tsx`:

```tsx
import type { JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { staffStrings } from '@/pages/staff/strings'

/**
 * Minimal shell for the staff console — deliberately separate from AppLayout /
 * Sidebar (the institution app shell). Staff-facing copy is English.
 */
export function StaffLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-n-25">
      <header className="flex items-center gap-3 border-b border-n-200 bg-n-0 px-6 py-4">
        <div className="flex h-btn-sm w-btn-sm items-center justify-center rounded-sm bg-p-500 font-serif text-body-lg font-medium text-n-0">
          R
        </div>
        <span className="text-h3 font-serif font-medium tracking-heading text-n-900">
          {staffStrings.consoleTitle}
        </span>
      </header>
      <main className="mx-auto max-w-form px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}
```

> If `max-w-form` is not a token in `apps/web/tailwind.config.ts`, use the nearest existing max-width token (e.g. `max-w-2xl` if registered) — do not introduce an arbitrary `max-w-[…]`. Verify against the config before choosing.

- [ ] **Step 4: Run the gate test to verify it passes**

Run: `pnpm --filter @rezeta/web exec vitest run src/components/auth/__tests__/RequirePlatformAdmin.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Write the failing page test**

Create `apps/web/src/pages/staff/__tests__/NewInstitution.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  useCreateInstitution: vi.fn(),
  mutateAsync: vi.fn(),
}))
vi.mock('@/hooks/staff/use-create-institution', () => ({
  useCreateInstitution: mocks.useCreateInstitution,
}))

import { NewInstitution } from '../NewInstitution'

describe('NewInstitution', () => {
  beforeEach(() => {
    mocks.mutateAsync.mockReset().mockResolvedValue({
      tenantId: 't1',
      userId: 'u1',
      email: 'ana@clinica.com',
    })
    mocks.useCreateInstitution.mockReturnValue({
      mutateAsync: mocks.mutateAsync,
      isPending: false,
    })
  })

  it('renders the English form', () => {
    render(<NewInstitution />)
    expect(screen.getByRole('heading', { name: /new institution/i })).toBeInTheDocument()
  })

  it('submits the payload to the mutation', async () => {
    render(<NewInstitution />)
    fireEvent.change(screen.getByLabelText(/institution name/i), {
      target: { value: 'Clínica Norte' },
    })
    fireEvent.change(screen.getByLabelText(/admin name/i), { target: { value: 'Dra. Ana' } })
    fireEvent.change(screen.getByLabelText(/admin email/i), {
      target: { value: 'ana@clinica.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create institution/i }))

    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          institutionName: 'Clínica Norte',
          adminFullName: 'Dra. Ana',
          adminEmail: 'ana@clinica.com',
        }),
      )
    })
    expect(await screen.findByText(/created/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run the page test to verify it fails**

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/staff/__tests__/NewInstitution.test.tsx`
Expected: FAIL — cannot resolve `../NewInstitution`.

- [ ] **Step 7: Implement the strings and page**

Create `apps/web/src/pages/staff/strings.ts`:

```ts
// Staff console is internal Rezeta-staff tooling (not the patient-facing
// product), so its copy is English per the feature spec §7.
export const staffStrings = {
  consoleTitle: 'Rezeta Staff',
  pageTitle: 'New institution',
  pageSubtitle: 'Create a new institution and its initial super admin.',
  fieldInstitutionName: 'Institution name',
  fieldType: 'Type',
  fieldPlan: 'Plan',
  fieldAdminName: 'Admin name',
  fieldAdminEmail: 'Admin email',
  typeOptions: {
    solo: 'Solo',
    practice: 'Practice',
    clinic: 'Clinic',
    enterprise: 'Enterprise',
  },
  planOptions: {
    free: 'Free',
    solo: 'Solo',
    practice: 'Practice',
    clinic: 'Clinic',
  },
  submit: 'Create institution',
  submitting: 'Creating…',
  error: 'Could not create the institution. Check the details and try again.',
  successTitle: 'Institution created',
  successBody: (email: string): string =>
    `A set-password email was sent to ${email}.`,
} as const
```

Create `apps/web/src/pages/staff/NewInstitution.tsx`:

```tsx
import { useState } from 'react'
import type { JSX } from 'react'
import { useCreateInstitution } from '@/hooks/staff/use-create-institution'
import { Button, Callout, Field, Input } from '@/components/ui'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { staffStrings } from './strings'

type TenantType = CreateInstitutionDto['type']
type TenantPlan = CreateInstitutionDto['plan']

const SELECT_CLASS =
  'h-9 w-full rounded-sm border border-n-200 bg-n-0 px-3 text-sm text-n-800'

export function NewInstitution(): JSX.Element {
  const mutation = useCreateInstitution()
  const [institutionName, setInstitutionName] = useState('')
  const [type, setType] = useState<TenantType>('solo')
  const [plan, setPlan] = useState<TenantPlan>('free')
  const [adminFullName, setAdminFullName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<InstitutionCreatedDto | null>(null)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    try {
      const result = await mutation.mutateAsync({
        institutionName: institutionName.trim(),
        type,
        plan,
        adminFullName: adminFullName.trim(),
        adminEmail: adminEmail.trim(),
      })
      setCreated(result)
    } catch {
      setError(staffStrings.error)
    }
  }

  const canSubmit =
    institutionName.trim().length >= 2 &&
    adminFullName.trim().length >= 2 &&
    adminEmail.trim().length > 0

  return (
    <div>
      <h1 className="text-h1 m-0">{staffStrings.pageTitle}</h1>
      <p className="mt-1 mb-6 text-sm text-n-500">{staffStrings.pageSubtitle}</p>

      {created && (
        <Callout variant="success" icon={<i className="ph ph-check-circle" style={{ fontSize: 18 }} />}>
          <div className="font-semibold">{staffStrings.successTitle}</div>
          <div>{staffStrings.successBody(created.email)}</div>
        </Callout>
      )}

      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          void handleSubmit(e)
        }}
      >
        <Field label={staffStrings.fieldInstitutionName} required>
          <Input
            type="text"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label={staffStrings.fieldType}>
          <select
            className={SELECT_CLASS}
            value={type}
            onChange={(e) => setType(e.target.value as TenantType)}
          >
            {(Object.keys(staffStrings.typeOptions) as TenantType[]).map((key) => (
              <option key={key} value={key}>
                {staffStrings.typeOptions[key]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={staffStrings.fieldPlan}>
          <select
            className={SELECT_CLASS}
            value={plan}
            onChange={(e) => setPlan(e.target.value as TenantPlan)}
          >
            {(Object.keys(staffStrings.planOptions) as TenantPlan[]).map((key) => (
              <option key={key} value={key}>
                {staffStrings.planOptions[key]}
              </option>
            ))}
          </select>
        </Field>

        <Field label={staffStrings.fieldAdminName} required>
          <Input
            type="text"
            value={adminFullName}
            onChange={(e) => setAdminFullName(e.target.value)}
          />
        </Field>

        <Field label={staffStrings.fieldAdminEmail} required>
          <Input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
          />
        </Field>

        {error && (
          <Callout variant="danger" icon={<i className="ph ph-warning" style={{ fontSize: 16 }} />}>
            {error}
          </Callout>
        )}

        <div>
          <Button type="submit" variant="primary" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? staffStrings.submitting : staffStrings.submit}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

> Verify that `Field`, `Input`, `Button`, and `Callout` are exported from `@/components/ui` (they are used across settings pages) and that `Callout` supports `variant="success"`. If `success` is not a `Callout` variant, use the nearest supported positive/info variant — check `apps/web/src/components/ui`. Confirm `text-sm` and the border/height tokens used in `SELECT_CLASS` exist; adjust to registered tokens if not.

- [ ] **Step 8: Run the page test to verify it passes**

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/staff/__tests__/NewInstitution.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 9: Wire the routes in `App.tsx`**

In `apps/web/src/App.tsx`, add imports near the other page imports:

```tsx
import { StaffLayout } from '@/components/layout/StaffLayout'
import { RequirePlatformAdmin } from '@/components/auth/RequirePlatformAdmin'
import { NewInstitution } from '@/pages/staff/NewInstitution'
```

Add a new top-level route object to the `createBrowserRouter([...])` array — **outside** the `AppLayout` children, so the staff console does not share the institution shell — placed just before the catch-all `{ path: '*', element: <NotFound /> }` entry:

```tsx
  // ── Staff console (platform admins only; separate from the app shell) ───────
  {
    element: (
      <AuthGate>
        <RequirePlatformAdmin>
          <StaffLayout />
        </RequirePlatformAdmin>
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { path: 'staff', element: <Navigate to="/staff/institutions/new" replace /> },
      { path: 'staff/institutions/new', element: <NewInstitution /> },
    ],
  },
```

- [ ] **Step 10: Typecheck + run the two new web test files**

Run: `pnpm --filter @rezeta/web exec tsc --noEmit`
Expected: PASS.

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/staff src/components/auth/__tests__/RequirePlatformAdmin.test.tsx`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/auth/RequirePlatformAdmin.tsx apps/web/src/components/layout/StaffLayout.tsx apps/web/src/pages/staff apps/web/src/App.tsx apps/web/src/components/auth/__tests__/RequirePlatformAdmin.test.tsx
git commit -m "feat(web): staff console — platform-admin gate + New institution screen"
```

---

### Task 10: Full gates + changelog

**Files:**
- Modify: `CHANGELOG.md` (prepend an entry)

- [ ] **Step 1: Run the full lint + test gates**

Run: `pnpm lint`
Expected: PASS (zero errors).

Run: `pnpm test`
Expected: PASS (all packages green, including the new staff/guard/schema suites).

- [ ] **Step 2: Run coverage to confirm the 95% per-file gate**

Run: `pnpm test:coverage`
Expected: PASS. The new counted files (`staff.service.ts`, `staff.controller.ts`, `platform-admin.guard.ts`, `tenant.guard.ts`, `packages/shared/src/schemas/staff.ts`, `apps/api/src/modules/users/users.service.ts`) all meet 95%. `staff.module.ts`, `staff/index.ts`, `create-institution.ts` (scripts), the web pages/gate/layout, and the `use-create-institution.ts` hook are covered by existing coverage `exclude` entries.

- [ ] **Step 3: Prepend the changelog entry**

Prepend to `CHANGELOG.md` (English, per the language rule):

```markdown
## [2026-07-15] Staff platform + platform admin

### Added
- Staff platform module (`apps/api/src/modules/staff/`) with `POST /v1/staff/institutions`, guarded by `PlatformAdminGuard` so only platform admins can create an institution. It creates the `Tenant`, seeds `RolePermission` defaults + starter data, and creates the initial `super_admin` via the users provisioning flow (Admin SDK + set-password email), emitting a `tenant`/`create` audit event.
- `PlatformAdminGuard` (`apps/api/src/common/guards/platform-admin.guard.ts`) — admits only `isPlatformAdmin` users (403 `FORBIDDEN` otherwise).
- `CreateInstitutionSchema` + `InstitutionCreatedSchema` in `packages/shared/src/schemas/staff.ts`.
- Dev CLI `apps/api/src/scripts/create-institution.ts` (`pnpm --filter @rezeta/api bootstrap:institution`) to bootstrap an institution and optionally flag the created user `isPlatformAdmin`.
- Web staff console: `RequirePlatformAdmin` route gate, `StaffLayout`, and the English "New institution" screen at `/staff/institutions/new`, plus the `useCreateInstitution` hook. Kept separate from the institution app shell.

### Changed
- `TenantGuard` now grants platform admins an explicit, audited cross-tenant override via the `X-Target-Tenant` header; ordinary users remain pinned to their own tenant (the header is never consulted for them). Cross-tenant access records a `cross_tenant_access` audit event (actor + target tenant).
- `UsersService.createUser` accepts an opt-in `{ bypassRankCheck }` option used by the platform bootstrap to create the first `super_admin`.
- Reserved the `cross_tenant_access` audit action.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for staff platform + platform admin slice"
```

---

## Self-Review

**Spec coverage (design §7/§8 + contract §Platform admin):**
- `isPlatformAdmin` behavior: `TenantGuard` cross-tenant override (Task 3) + `PermissionGuard` bypass is Slice 3's (noted, not re-done). ✓
- Explicit + audited cross-tenant, isolation preserved for ordinary users: Task 3 + its dedicated isolation test ("IGNORES X-Target-Tenant for a non-platform-admin"). ✓
- Staff platform backend `POST /v1/staff/institutions`, platform-admin only: Tasks 4 + 6. ✓
- Creates Tenant + seeds `RolePermission` defaults + starter data + initial `super_admin` via createUser flow + audit: Task 6 (`StaffService`). ✓
- Zod `CreateInstitutionSchema` in shared: Task 1. ✓
- Dev bootstrap seed/CLI + mark `isPlatformAdmin`: Task 7. ✓
- Staff frontend "New institution", platform-admins only, separate shell, design tokens, English: Tasks 8 + 9. ✓
- Tests: TenantGuard bypass + isolation (Task 3), staff endpoint authz 403 (Task 6 controller test + Task 4), create-institution seeds/creates/audits (Task 6 service test), CLI test (Task 7). ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step carries complete code; every command has expected output. The Slice-5 dependency in Task 5 is flagged explicitly with a concrete edit shape (unavoidable — that file is authored by a prior slice).

**Type consistency:** `CreateInstitutionDto`/`InstitutionCreatedDto` (Task 1) are used identically in Tasks 6–9. `StaffService.createInstitution(dto, actorUserId: string | null)` signature is consistent across Tasks 6 and 7. `createUser(tenantId, actorRole, actorUserId, dto, { bypassRankCheck: true })` matches Task 5's produced signature (5 args, `ManagedUserDto` return). `cross_tenant_access` action string matches Task 2's reserved literal and Task 3's audit call.
