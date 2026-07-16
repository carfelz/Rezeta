# Backend Permission Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce the per-tenant permission matrix on every existing API endpoint. Add a closed-enum `INSUFFICIENT_PERMISSION` error code, a `@RequirePermission(module, level)` decorator, and a global `PermissionGuard` that runs third (after `AuthGuard`, `TenantGuard`), reads the resolved `capabilities` map already placed on `request.user` by Slice 2, and returns HTTP 403 when the caller's effective access level for the endpoint's module is below what the endpoint requires. Annotate every non-auth/non-onboarding controller endpoint: GET/read routes require `'view'`, mutations require `'manage'`.

**Architecture:** NestJS 10 + Prisma, pnpm monorepo. Global guards are registered via `APP_GUARD` providers in `apps/api/src/app.module.ts`; order is significant — `AuthGuard` (resolves `request.user`, populates `capabilities` + `isPlatformAdmin` from Slice 2) → `TenantGuard` (sets `request.tenantId`) → **new `PermissionGuard`**. The guard is a thin, synchronous check: it does no DB work because Slice 2 pre-resolves the capability map onto `request.user.capabilities`. Enforcement is always per-module; the frontend section bulk-control (Slice 6) never reaches the API. Platform-admin requests bypass the guard entirely (`request.user.isPlatformAdmin === true`). `ForbiddenException({ code, message })` is converted to a `403 { error: { code, message } }` envelope by the existing `HttpExceptionFilter`.

**Tech Stack:** TypeScript, NestJS 10, `@nestjs/core` `Reflector`, `@rezeta/shared` (`ErrorCode`, `ModuleKey`, `AccessLevel`, `CapabilityMap`, `hasCapability`), Vitest.

**Prerequisite:** Slices 1 and 2 complete and merged.
- Slice 1 widened `UserRole` to `'assistant' | 'doctor' | 'admin' | 'super_admin'` in `packages/shared/src/types/auth.ts`.
- Slice 2 created `packages/shared/src/permissions/{catalog,capabilities,roles}.ts` (exporting `ModuleKey`, `AccessLevel`, `CapabilityMap`, `MODULE_KEYS`, `hasCapability`, `defaultCapabilitiesFor`), created `PermissionsService.resolveCapabilities(tenantId, role)`, added `capabilities: CapabilityMap` and `isPlatformAdmin: boolean` to `AuthUser`, and made `AuthGuard` populate `request.user.capabilities` + `request.user.isPlatformAdmin`. All are exported from the `@rezeta/shared` barrel (`packages/shared/src/index.ts`).

**Reference for framework/imports:** `apps/api/src/common/guards/__tests__/tenant.guard.spec.ts` and `.../auth.guard.spec.ts` (guard unit-test style: mock `Reflector`, hand-built `ExecutionContext`), `apps/api/src/common/decorators/__tests__/decorators.spec.ts` (decorator metadata assertions via `Reflect.getMetadata`), `apps/api/src/modules/patients/__tests__/patients.controller.spec.ts` (controller spec style). Tests use Vitest; `@rezeta/shared` resolves to its **built** `dist/` (see `packages/shared/package.json` `exports`), so shared must be rebuilt after editing `errors.ts` before API tests can see the new code.

## Global Constraints

These are copied verbatim from `permissions-contracts.md` (the authoritative shared-contracts doc) and apply to every task below:

- Monorepo, pnpm workspaces: `apps/api` (NestJS + Prisma), `apps/web` (React 18 + Vite + Zustand + TanStack Query + Tailwind), `packages/shared` (Zod schemas + types + `ErrorCode`), `packages/db` (Prisma schema + generated client, imported as `@rezeta/db`).
- `ErrorCode` closed enum: `packages/shared/src/errors.ts`. `FORBIDDEN` already exists. Add `INSUFFICIENT_PERMISSION`.
- Shared types barrel exports from `packages/shared/src/index.ts` (re-exports `types/*` and `schemas/*`). Import in app code as `@rezeta/shared`.
- Global guards in `apps/api/src/app.module.ts` (order matters): `{ provide: APP_GUARD, useClass: AuthGuard }` then `TenantGuard`. The new `PermissionGuard` is registered THIRD, after TenantGuard.
- `AuthGuard` (`apps/api/src/common/guards/auth.guard.ts`) resolves the DB user and sets `request.user: AuthUser`. It already reads `IS_PUBLIC_KEY` (from `common/decorators/public.decorator.ts`) and `IS_PROVISION_ROUTE_KEY`.
- Decorators live in `apps/api/src/common/decorators/`. `@CurrentUser()` yields `AuthUser`; `@TenantId()` yields the tenant id string.
- Controllers follow the patients pattern: `@ApiTags`, Zod validation via `ZodValidationPipe`, `@CurrentUser() user: AuthUser`, `@TenantId() tenantId`.
- Tests live in `__tests__/` beside source. API uses `*.spec.ts`; web uses `*.test.tsx`. Match the framework/imports of the nearest sibling test file.
- Language rule: ALL code/comments/docs/tests/commits in English. ONLY user-facing UI strings are Spanish.
- Coverage gate: `pnpm test:coverage` enforces 95% per-file. Every new file needs tests. Run `pnpm lint` and `pnpm test` before considering a task done.
- No `TODO/FIXME/HACK/XXX` comments (ESLint fails CI). No arbitrary Tailwind `prop-[value]` classes — use design tokens (see CLAUDE.md).

Slice-specific constraints:

- The guard uses the **pre-resolved** `request.user.capabilities` (populated by Slice 2's `AuthGuard`); it must NOT inject `PermissionsService` or hit the DB.
- Convention: GET/read endpoints require `'view'`; POST/PATCH/DELETE require `'manage'`. The only exceptions are `schedules` reads (`GET /v1/schedules/blocks`, `GET /v1/schedules/exceptions`) which map to `appointments`/`view`, and `schedules` writes which map to `schedules_config`/`manage`.
- Exempt (do NOT annotate — they stay public or self-service): `AuthController` (`/v1/auth/*`), `OnboardingController` (`/v1/onboarding/*`), `LogsController` (`/v1/logs/client-error`, already `@Public()`), and `UsersController` (`/v1/users/me/*` — self-service profile/preferences; gating these on the `users` module would lock every non-admin out of their own profile). The `users` module key guards the future user-management endpoints built in Slice 5, not `/users/me`.

---

## File Map

| Action | File |
|---|---|
| Modify | `packages/shared/src/errors.ts` (add `INSUFFICIENT_PERMISSION`) |
| Create | `apps/api/src/common/decorators/require-permission.decorator.ts` |
| Modify | `apps/api/src/common/decorators/__tests__/decorators.spec.ts` (add `RequirePermission` cases) |
| Create | `apps/api/src/common/guards/permission.guard.ts` |
| Create | `apps/api/src/common/guards/__tests__/permission.guard.spec.ts` |
| Modify | `apps/api/src/app.module.ts` (register `PermissionGuard` as 3rd `APP_GUARD`) |
| Modify | `apps/api/src/modules/patients/patients.controller.ts` |
| Modify | `apps/api/src/modules/appointments/appointments.controller.ts` |
| Modify | `apps/api/src/modules/consultations/consultations.controller.ts` |
| Modify | `apps/api/src/modules/consultation-records/consultation-records.controller.ts` |
| Modify | `apps/api/src/modules/orders/orders.controller.ts` |
| Modify | `apps/api/src/modules/invoices/invoices.controller.ts` |
| Modify | `apps/api/src/modules/protocols/protocols.controller.ts` |
| Modify | `apps/api/src/modules/protocol-templates/protocol-templates.controller.ts` |
| Modify | `apps/api/src/modules/protocol-categories/protocol-categories.controller.ts` |
| Modify | `apps/api/src/modules/protocol-improvements/protocol-improvements.controller.ts` |
| Modify | `apps/api/src/modules/protocol-recommendations/protocol-recommendations.controller.ts` |
| Modify | `apps/api/src/modules/locations/locations.controller.ts` |
| Modify | `apps/api/src/modules/schedules/schedules.controller.ts` |
| Modify | `apps/api/src/common/audit-log/audit-log.controller.ts` |
| Create | `apps/api/src/common/guards/__tests__/permission.guard.integration.spec.ts` |
| Modify | `CHANGELOG.md` |

---

## Task 1: Add `INSUFFICIENT_PERMISSION` to the `ErrorCode` enum

**Files:**
- Modify: `packages/shared/src/errors.ts`
- Modify (test): `packages/shared/src/__tests__/errors.spec.ts` if it exists; otherwise assert via the guard spec in Task 3.

**Interfaces:**
- Produces: `ErrorCode.INSUFFICIENT_PERMISSION` (string literal `'INSUFFICIENT_PERMISSION'`), consumed by `PermissionGuard` (Task 3).

- [ ] **Step 1: Check for an existing errors test to extend**

```bash
cd /Users/carlosfeliz/PersonalProjects/Rezeta
ls packages/shared/src/__tests__/ 2>/dev/null | grep -i error || echo "no errors spec — assertion covered by guard spec in Task 3"
```

If a `packages/shared/src/__tests__/errors.spec.ts` exists, add a failing assertion first:

```typescript
it('exposes INSUFFICIENT_PERMISSION under the Auth group', () => {
  expect(ErrorCode.INSUFFICIENT_PERMISSION).toBe('INSUFFICIENT_PERMISSION')
})
```

Run it and confirm it FAILS (`ErrorCode.INSUFFICIENT_PERMISSION` is `undefined`):

```bash
pnpm --filter @rezeta/shared test
```

If no errors spec exists, skip the failing-test step here — `INSUFFICIENT_PERMISSION` is exercised end-to-end by the guard specs (Tasks 3 and 9), which fail until this code is added.

- [ ] **Step 2: Add the code to the Auth group**

In `packages/shared/src/errors.ts`, under the `// ── Auth ──` block, add the line after `TOKEN_INVALID`:

```typescript
  // ── Auth ────────────────────────────────────────────────────
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INSUFFICIENT_PERMISSION: 'INSUFFICIENT_PERMISSION',
```

- [ ] **Step 3: Rebuild shared and verify**

`@rezeta/shared` is consumed from its built `dist/`, so the API cannot see the new code until shared is rebuilt.

```bash
pnpm --filter @rezeta/shared build
pnpm --filter @rezeta/shared test
```

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/errors.ts packages/shared/dist packages/shared/src/__tests__/errors.spec.ts 2>/dev/null; git add -A packages/shared
git commit -m "feat(shared): add INSUFFICIENT_PERMISSION error code"
```

---

## Task 2: Create the `@RequirePermission` decorator

**Files:**
- Create: `apps/api/src/common/decorators/require-permission.decorator.ts`
- Modify (test): `apps/api/src/common/decorators/__tests__/decorators.spec.ts`

**Interfaces:**
- Consumes: `ModuleKey`, `AccessLevel` from `@rezeta/shared` (Slice 2).
- Produces:
  - `export const PERMISSION_KEY = 'requiredPermission'`
  - `export interface RequiredPermission { module: ModuleKey; level: AccessLevel }`
  - `export const RequirePermission: (module: ModuleKey, level: AccessLevel) => CustomDecorator` — implemented as `SetMetadata(PERMISSION_KEY, { module, level })`.

Both `PERMISSION_KEY` and `RequiredPermission` are consumed by `PermissionGuard` (Task 3); `RequirePermission` is consumed by every controller (Tasks 5–8).

- [ ] **Step 1: Write the failing decorator test**

Append to `apps/api/src/common/decorators/__tests__/decorators.spec.ts` (this file already imports from sibling decorators — follow its `Reflect.getMetadata` pattern exactly):

```typescript
import { PERMISSION_KEY, RequirePermission } from '../require-permission.decorator.js'

describe('RequirePermission decorator', () => {
  it('PERMISSION_KEY equals requiredPermission', () => {
    expect(PERMISSION_KEY).toBe('requiredPermission')
  })

  it('sets PERMISSION_KEY metadata to { module, level }', () => {
    const decorator = RequirePermission('patients', 'manage')
    const target = {}
    const descriptor = Object.getOwnPropertyDescriptor(target, 'method') ?? {
      value: function () {},
      writable: true,
      enumerable: true,
      configurable: true,
    }
    decorator(target, 'method', descriptor)
    expect(Reflect.getMetadata(PERMISSION_KEY, descriptor.value)).toEqual({
      module: 'patients',
      level: 'manage',
    })
  })
})
```

Run and confirm it FAILS (module not found — the decorator file does not exist yet):

```bash
pnpm --filter @rezeta/api test src/common/decorators/__tests__/decorators.spec.ts
```

- [ ] **Step 2: Create the decorator**

Create `apps/api/src/common/decorators/require-permission.decorator.ts`:

```typescript
import { SetMetadata, type CustomDecorator } from '@nestjs/common'
import type { AccessLevel, ModuleKey } from '@rezeta/shared'

/**
 * Metadata attached by @RequirePermission, read by PermissionGuard.
 */
export const PERMISSION_KEY = 'requiredPermission'

export interface RequiredPermission {
  module: ModuleKey
  level: AccessLevel
}

/**
 * Declare the permission an endpoint requires. GET/read routes use 'view';
 * POST/PATCH/DELETE mutations use 'manage'. PermissionGuard checks the caller's
 * resolved capability for `module` against `level`.
 *
 * @example
 * @RequirePermission('patients', 'manage')
 * @Post()
 * create() { ... }
 */
export const RequirePermission = (module: ModuleKey, level: AccessLevel): CustomDecorator =>
  SetMetadata(PERMISSION_KEY, { module, level })
```

- [ ] **Step 3: Verify the test passes**

```bash
pnpm --filter @rezeta/api test src/common/decorators/__tests__/decorators.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/decorators/require-permission.decorator.ts apps/api/src/common/decorators/__tests__/decorators.spec.ts
git commit -m "feat(api): add @RequirePermission decorator"
```

---

## Task 3: Create the `PermissionGuard` (with unit tests)

**Files:**
- Create: `apps/api/src/common/guards/permission.guard.ts`
- Create: `apps/api/src/common/guards/__tests__/permission.guard.spec.ts`

**Interfaces:**
- Consumes:
  - `PERMISSION_KEY`, `RequiredPermission` from `../decorators/require-permission.decorator.js`.
  - `IS_PUBLIC_KEY` from `../decorators/public.decorator.js`.
  - `AuthenticatedRequest` from `./auth.guard.js` (its `.user: AuthUser` carries `capabilities: CapabilityMap` and `isPlatformAdmin: boolean` post-Slice 2).
  - `hasCapability(caps, module, level)`, `ErrorCode` from `@rezeta/shared`.
  - `Reflector` from `@nestjs/core`.
- Produces: `export class PermissionGuard implements CanActivate` — `canActivate(ctx): boolean`.

Guard contract:
1. `IS_PUBLIC_KEY` truthy → return `true`.
2. No `PERMISSION_KEY` metadata → return `true` (pass-through for un-annotated endpoints).
3. `request.user.isPlatformAdmin` truthy → return `true` (bypass).
4. `hasCapability(request.user.capabilities, module, level)` truthy → return `true`.
5. Otherwise `throw new ForbiddenException({ code: ErrorCode.INSUFFICIENT_PERMISSION, message })`.

- [ ] **Step 1: Write the failing guard unit test**

Create `apps/api/src/common/guards/__tests__/permission.guard.spec.ts`. Mirror the mock-`Reflector` + hand-built context style of `tenant.guard.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { ErrorCode, type CapabilityMap } from '@rezeta/shared'
import { PermissionGuard } from '../permission.guard.js'
import { IS_PUBLIC_KEY } from '../../decorators/public.decorator.js'
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../../decorators/require-permission.decorator.js'

function makeCtx(options: {
  isPublic?: boolean
  required?: RequiredPermission
  capabilities?: Partial<CapabilityMap>
  isPlatformAdmin?: boolean
}) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === IS_PUBLIC_KEY) return options.isPublic ?? false
      if (key === PERMISSION_KEY) return options.required
      return undefined
    }),
  }
  const request = {
    user: {
      capabilities: (options.capabilities ?? {}) as CapabilityMap,
      isPlatformAdmin: options.isPlatformAdmin ?? false,
    },
  }
  const ctx = {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn().mockReturnValue(request) }),
  }
  return { reflector, ctx }
}

describe('PermissionGuard', () => {
  it('passes through when there is no @RequirePermission metadata', () => {
    const { reflector, ctx } = makeCtx({ required: undefined })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('passes through for public routes even if metadata is present', () => {
    const { reflector, ctx } = makeCtx({
      isPublic: true,
      required: { module: 'patients', level: 'manage' },
    })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('bypasses the check for platform admins', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'users', level: 'manage' },
      capabilities: { users: 'none' },
      isPlatformAdmin: true,
    })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('allows when the caller has sufficient capability', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'patients', level: 'view' },
      capabilities: { patients: 'manage' },
    })
    const guard = new PermissionGuard(reflector as never)
    expect(guard.canActivate(ctx as never)).toBe(true)
  })

  it('throws ForbiddenException with INSUFFICIENT_PERMISSION when under-privileged', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'patients', level: 'manage' },
      capabilities: { patients: 'view' },
    })
    const guard = new PermissionGuard(reflector as never)
    try {
      guard.canActivate(ctx as never)
      expect.unreachable('guard should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException)
      const body = (err as ForbiddenException).getResponse()
      expect(body).toMatchObject({ code: ErrorCode.INSUFFICIENT_PERMISSION })
    }
  })

  it('denies when the module is absent from the capability map (defaults to none)', () => {
    const { reflector, ctx } = makeCtx({
      required: { module: 'protocols', level: 'view' },
      capabilities: {},
    })
    const guard = new PermissionGuard(reflector as never)
    expect(() => guard.canActivate(ctx as never)).toThrow(ForbiddenException)
  })
})
```

Run and confirm it FAILS (guard module does not exist):

```bash
pnpm --filter @rezeta/api test src/common/guards/__tests__/permission.guard.spec.ts
```

- [ ] **Step 2: Create the guard**

Create `apps/api/src/common/guards/permission.guard.ts`:

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ErrorCode, hasCapability } from '@rezeta/shared'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../decorators/require-permission.decorator.js'

/**
 * PermissionGuard — runs third, after AuthGuard and TenantGuard.
 *
 * Reads the @RequirePermission metadata on the handler and checks it against the
 * capability map that AuthGuard (Slice 2) resolved onto request.user.capabilities.
 * Does no DB work. Skips public routes, un-annotated routes, and platform admins.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler()
    const classRef = ctx.getClass()

    // Public routes are never permission-gated.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, classRef])
    if (isPublic) return true

    // No @RequirePermission on this endpoint — nothing to enforce.
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [handler, classRef],
    )
    if (!required) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    // Platform admins operate across tenants and bypass per-tenant permissions.
    if (request.user.isPlatformAdmin) return true

    if (hasCapability(request.user.capabilities, required.module, required.level)) {
      return true
    }

    throw new ForbiddenException({
      code: ErrorCode.INSUFFICIENT_PERMISSION,
      message: `Missing '${required.level}' permission on '${required.module}'`,
    })
  }
}
```

- [ ] **Step 3: Verify the unit tests pass**

```bash
pnpm --filter @rezeta/api test src/common/guards/__tests__/permission.guard.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/guards/permission.guard.ts apps/api/src/common/guards/__tests__/permission.guard.spec.ts
git commit -m "feat(api): add PermissionGuard"
```

---

## Task 4: Register `PermissionGuard` as the third global guard

**Files:**
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PermissionGuard` (Task 3), `APP_GUARD` from `@nestjs/core`.
- Produces: an active third global guard. Because it passes through any endpoint without `@RequirePermission` metadata, registering it here is a no-op until Tasks 5–8 annotate controllers.

- [ ] **Step 1: Add the import**

In `apps/api/src/app.module.ts`, next to the existing guard imports:

```typescript
import { AuthGuard } from './common/guards/auth.guard.js'
import { TenantGuard } from './common/guards/tenant.guard.js'
import { PermissionGuard } from './common/guards/permission.guard.js'
```

- [ ] **Step 2: Register it after `TenantGuard`**

In the `providers` array, update the guard block so the three guards are ordered:

```typescript
    // Global guards — order matters: AuthGuard resolves the user and its
    // capabilities, TenantGuard sets tenantId, PermissionGuard enforces
    // @RequirePermission against the resolved capability map.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
```

- [ ] **Step 3: Verify the app still boots and the full suite is green**

The guard is registered but no endpoint is annotated yet, so behavior is unchanged.

```bash
pnpm --filter @rezeta/api test
pnpm --filter @rezeta/api build
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(api): register PermissionGuard as the third global guard"
```

---

## Task 5: Annotate the core clinical controllers (patients, appointments, consultations, consultation-records)

**Files:**
- Modify: `apps/api/src/modules/patients/patients.controller.ts` → module `patients`
- Modify: `apps/api/src/modules/appointments/appointments.controller.ts` → module `appointments`
- Modify: `apps/api/src/modules/consultations/consultations.controller.ts` → module `consultations` (both `ConsultationsController` and `PatientConsultationsController`)
- Modify: `apps/api/src/modules/consultation-records/consultation-records.controller.ts` → module `consultations`

**Interfaces:**
- Consumes: `RequirePermission` from `../../common/decorators/require-permission.decorator.js`.
- Produces: `@RequirePermission(module, level)` metadata on every listed handler.

For each controller add the import line:

```typescript
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
```

Then add one decorator per endpoint. Place `@RequirePermission(...)` immediately above the existing HTTP-method decorator (`@Get`/`@Post`/`@Patch`/`@Delete`) for each handler.

- [ ] **Step 1: Annotate `patients.controller.ts`** (module `patients`)

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('patients', 'view')` |
| `getOne` | `@Get(':id')` | `@RequirePermission('patients', 'view')` |
| `create` | `@Post()` | `@RequirePermission('patients', 'manage')` |
| `update` | `@Patch(':id')` | `@RequirePermission('patients', 'manage')` |
| `remove` | `@Delete(':id')` | `@RequirePermission('patients', 'manage')` |
| `recordExport` | `@Get(':id/record-export')` | `@RequirePermission('patients', 'view')` |

- [ ] **Step 2: Annotate `appointments.controller.ts`** (module `appointments`)

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('appointments', 'view')` |
| `getById` | `@Get(':id')` | `@RequirePermission('appointments', 'view')` |
| `create` | `@Post()` | `@RequirePermission('appointments', 'manage')` |
| `update` | `@Patch(':id')` | `@RequirePermission('appointments', 'manage')` |
| `updateStatus` | `@Patch(':id/status')` | `@RequirePermission('appointments', 'manage')` |
| `remove` | `@Delete(':id')` | `@RequirePermission('appointments', 'manage')` |

- [ ] **Step 3: Annotate `consultations.controller.ts`** (module `consultations`, BOTH controllers in the file)

`ConsultationsController`:

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('consultations', 'view')` |
| `getById` | `@Get(':id')` | `@RequirePermission('consultations', 'view')` |
| `create` | `@Post()` | `@RequirePermission('consultations', 'manage')` |
| `update` | `@Patch(':id')` | `@RequirePermission('consultations', 'manage')` |
| `sign` | `@Patch(':id/sign')` | `@RequirePermission('consultations', 'manage')` |
| `amend` | `@Post(':id/amend')` | `@RequirePermission('consultations', 'manage')` |
| `remove` | `@Delete(':id')` | `@RequirePermission('consultations', 'manage')` |
| `addProtocol` | `@Post(':id/protocols')` | `@RequirePermission('consultations', 'manage')` |
| `getProtocolUsage` | `@Get(':id/protocols/:usageId')` | `@RequirePermission('consultations', 'view')` |
| `updateProtocolUsage` | `@Patch(':id/protocols/:usageId')` | `@RequirePermission('consultations', 'manage')` |
| `updateCheckedState` | `@Patch(':id/protocols/:usageId/checked-state')` | `@RequirePermission('consultations', 'manage')` |
| `removeProtocol` | `@Delete(':id/protocols/:usageId')` | `@RequirePermission('consultations', 'manage')` |

`PatientConsultationsController` (same file):

| Handler | HTTP | Decorator |
|---|---|---|
| `getResumable` | `@Get('in-progress-consultation')` | `@RequirePermission('consultations', 'view')` |
| `listPatientPrescriptions` | `@Get('prescriptions')` | `@RequirePermission('consultations', 'view')` |

- [ ] **Step 4: Annotate `consultation-records.controller.ts`** (module `consultations`)

| Handler | HTTP | Decorator |
|---|---|---|
| `get` | `@Get()` | `@RequirePermission('consultations', 'view')` |
| `create` | `@Post()` | `@RequirePermission('consultations', 'manage')` |
| `update` | `@Patch()` | `@RequirePermission('consultations', 'manage')` |
| `regenerate` | `@Post('regenerate')` | `@RequirePermission('consultations', 'manage')` |
| `sign` | `@Post('sign')` | `@RequirePermission('consultations', 'manage')` |
| `getVersions` | `@Get('versions')` | `@RequirePermission('consultations', 'view')` |
| `getVersion` | `@Get('versions/:versionNumber')` | `@RequirePermission('consultations', 'view')` |
| `pdfDownload` | `@Get('pdf')` | `@RequirePermission('consultations', 'view')` |

- [ ] **Step 5: Verify build + existing controller specs still pass**

The existing controller specs instantiate controllers directly with mocked services (they do not run the guard), so annotations do not break them. Confirm nothing regressed and typecheck is clean:

```bash
pnpm --filter @rezeta/api build
pnpm --filter @rezeta/api test src/modules/patients src/modules/appointments src/modules/consultations src/modules/consultation-records
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/patients/patients.controller.ts apps/api/src/modules/appointments/appointments.controller.ts apps/api/src/modules/consultations/consultations.controller.ts apps/api/src/modules/consultation-records/consultation-records.controller.ts
git commit -m "feat(api): enforce permissions on patients, appointments, consultations controllers"
```

---

## Task 6: Annotate the orders and invoices (billing) controllers

**Files:**
- Modify: `apps/api/src/modules/orders/orders.controller.ts` → module `orders`
- Modify: `apps/api/src/modules/invoices/invoices.controller.ts` → module `billing`

**Interfaces:**
- Consumes: `RequirePermission` from `../../common/decorators/require-permission.decorator.js`.
- Produces: `@RequirePermission(module, level)` metadata on every listed handler.

Add the import line to each controller:

```typescript
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
```

- [ ] **Step 1: Annotate `orders.controller.ts`** (module `orders`)

| Handler | HTTP | Decorator |
|---|---|---|
| `getOrders` | `@Get('orders')` | `@RequirePermission('orders', 'view')` |
| `listPrescriptions` | `@Get('prescriptions')` | `@RequirePermission('orders', 'view')` |
| `downloadPrescriptionPdf` | `@Get('prescriptions/:prescriptionId/pdf')` | `@RequirePermission('orders', 'view')` |
| `getPrescription` | `@Get('prescriptions/:prescriptionId')` | `@RequirePermission('orders', 'view')` |
| `createPrescription` | `@Post('prescriptions')` | `@RequirePermission('orders', 'manage')` |
| `deletePrescription` | `@Delete('prescriptions/:prescriptionId')` | `@RequirePermission('orders', 'manage')` |
| `listImagingOrders` | `@Get('imaging-orders')` | `@RequirePermission('orders', 'view')` |
| `getImagingOrder` | `@Get('imaging-orders/:orderId')` | `@RequirePermission('orders', 'view')` |
| `createImagingOrder` | `@Post('imaging-orders')` | `@RequirePermission('orders', 'manage')` |
| `downloadImagingOrderGroupPdf` | `@Get('imaging-orders/group-pdf')` | `@RequirePermission('orders', 'view')` |
| `renameImagingOrderGroup` | `@Patch('imaging-orders/rename-group')` | `@RequirePermission('orders', 'manage')` |
| `patchImagingOrder` | `@Patch('imaging-orders/:orderId')` | `@RequirePermission('orders', 'manage')` |
| `deleteImagingOrder` | `@Delete('imaging-orders/:orderId')` | `@RequirePermission('orders', 'manage')` |
| `listLabOrders` | `@Get('lab-orders')` | `@RequirePermission('orders', 'view')` |
| `getLabOrder` | `@Get('lab-orders/:orderId')` | `@RequirePermission('orders', 'view')` |
| `createLabOrder` | `@Post('lab-orders')` | `@RequirePermission('orders', 'manage')` |
| `downloadLabOrderGroupPdf` | `@Get('lab-orders/group-pdf')` | `@RequirePermission('orders', 'view')` |
| `renameLabOrderGroup` | `@Patch('lab-orders/rename-group')` | `@RequirePermission('orders', 'manage')` |
| `patchLabOrder` | `@Patch('lab-orders/:orderId')` | `@RequirePermission('orders', 'manage')` |
| `deleteLabOrder` | `@Delete('lab-orders/:orderId')` | `@RequirePermission('orders', 'manage')` |
| `generateAll` | `@Post('orders/generate-all')` | `@RequirePermission('orders', 'manage')` |

Note: the two `rename-group` PATCH routes are declared before the `:orderId` PATCH routes in the source; keep that ordering and annotate them in place.

- [ ] **Step 2: Annotate `invoices.controller.ts`** (module `billing`)

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('billing', 'view')` |
| `downloadPdf` | `@Get(':id/pdf')` | `@RequirePermission('billing', 'view')` |
| `getById` | `@Get(':id')` | `@RequirePermission('billing', 'view')` |
| `create` | `@Post()` | `@RequirePermission('billing', 'manage')` |
| `update` | `@Patch(':id')` | `@RequirePermission('billing', 'manage')` |
| `updateStatus` | `@Patch(':id/status')` | `@RequirePermission('billing', 'manage')` |
| `delete` | `@Delete(':id')` | `@RequirePermission('billing', 'manage')` |

- [ ] **Step 3: Verify build + specs**

```bash
pnpm --filter @rezeta/api build
pnpm --filter @rezeta/api test src/modules/orders src/modules/invoices
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/orders/orders.controller.ts apps/api/src/modules/invoices/invoices.controller.ts
git commit -m "feat(api): enforce permissions on orders and billing controllers"
```

---

## Task 7: Annotate the protocol controllers (protocols, templates, categories, improvements, recommendations)

**Files:**
- Modify: `apps/api/src/modules/protocols/protocols.controller.ts` → module `protocols`
- Modify: `apps/api/src/modules/protocol-templates/protocol-templates.controller.ts` → module `templates`
- Modify: `apps/api/src/modules/protocol-categories/protocol-categories.controller.ts` → module `categories`
- Modify: `apps/api/src/modules/protocol-improvements/protocol-improvements.controller.ts` → module `protocols`
- Modify: `apps/api/src/modules/protocol-recommendations/protocol-recommendations.controller.ts` → module `protocols`

**Interfaces:**
- Consumes: `RequirePermission` from `../../common/decorators/require-permission.decorator.js`.
- Produces: `@RequirePermission(module, level)` metadata on every listed handler.

Add the import line to each controller:

```typescript
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
```

- [ ] **Step 1: Annotate `protocols.controller.ts`** (module `protocols`)

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('protocols', 'view')` |
| `create` | `@Post()` | `@RequirePermission('protocols', 'manage')` |
| `getOne` | `@Get(':id')` | `@RequirePermission('protocols', 'view')` |
| `rename` | `@Patch(':id')` | `@RequirePermission('protocols', 'manage')` |
| `saveVersion` | `@Post(':id/versions')` | `@RequirePermission('protocols', 'manage')` |
| `listVersions` | `@Get(':id/versions')` | `@RequirePermission('protocols', 'view')` |
| `getVersion` | `@Get(':id/versions/:versionId')` | `@RequirePermission('protocols', 'view')` |
| `restoreVersion` | `@Post(':id/versions/:versionId/restore')` | `@RequirePermission('protocols', 'manage')` |
| `archive` | `@Patch(':id/archive')` | `@RequirePermission('protocols', 'manage')` |
| `addFavorite` | `@Post(':id/favorite')` | `@RequirePermission('protocols', 'manage')` |
| `removeFavorite` | `@Delete(':id/favorite')` | `@RequirePermission('protocols', 'manage')` |

- [ ] **Step 2: Annotate `protocol-templates.controller.ts`** (module `templates`)

| Handler | HTTP | Decorator |
|---|---|---|
| `getTemplates` | `@Get()` | `@RequirePermission('templates', 'view')` |
| `getTemplate` | `@Get(':id')` | `@RequirePermission('templates', 'view')` |
| `createTemplate` | `@Post()` | `@RequirePermission('templates', 'manage')` |
| `updateTemplate` | `@Patch(':id')` | `@RequirePermission('templates', 'manage')` |
| `deleteTemplate` | `@Delete(':id')` | `@RequirePermission('templates', 'manage')` |

- [ ] **Step 3: Annotate `protocol-categories.controller.ts`** (module `categories`)

| Handler | HTTP | Decorator |
|---|---|---|
| `findAll` | `@Get()` | `@RequirePermission('categories', 'view')` |
| `findOne` | `@Get(':id')` | `@RequirePermission('categories', 'view')` |
| `create` | `@Post()` | `@RequirePermission('categories', 'manage')` |
| `update` | `@Patch(':id')` | `@RequirePermission('categories', 'manage')` |
| `delete` | `@Delete(':id')` | `@RequirePermission('categories', 'manage')` |

- [ ] **Step 4: Annotate `protocol-improvements.controller.ts`** (module `protocols`)

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('protocols', 'view')` |
| `apply` | `@Post(':suggestionId/apply')` | `@RequirePermission('protocols', 'manage')` |
| `createVariant` | `@Post(':suggestionId/create-variant')` | `@RequirePermission('protocols', 'manage')` |
| `dismiss` | `@Delete(':suggestionId')` | `@RequirePermission('protocols', 'manage')` |

- [ ] **Step 5: Annotate `protocol-recommendations.controller.ts`** (module `protocols`)

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('protocols', 'view')` |

- [ ] **Step 6: Verify build + specs**

```bash
pnpm --filter @rezeta/api build
pnpm --filter @rezeta/api test src/modules/protocols src/modules/protocol-templates src/modules/protocol-categories src/modules/protocol-improvements src/modules/protocol-recommendations
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/protocols/protocols.controller.ts apps/api/src/modules/protocol-templates/protocol-templates.controller.ts apps/api/src/modules/protocol-categories/protocol-categories.controller.ts apps/api/src/modules/protocol-improvements/protocol-improvements.controller.ts apps/api/src/modules/protocol-recommendations/protocol-recommendations.controller.ts
git commit -m "feat(api): enforce permissions on protocol controllers"
```

---

## Task 8: Annotate the admin controllers (locations, schedules, audit-log)

**Files:**
- Modify: `apps/api/src/modules/locations/locations.controller.ts` → module `locations`
- Modify: `apps/api/src/modules/schedules/schedules.controller.ts` → reads → `appointments`/`view`; writes → `schedules_config`/`manage`
- Modify: `apps/api/src/common/audit-log/audit-log.controller.ts` → module `audit_log`

**Interfaces:**
- Consumes: `RequirePermission` from the decorator file. Note the relative-path depth differs for `audit-log.controller.ts` (it lives in `common/audit-log/`, so the import is `../decorators/require-permission.decorator.js`, not `../../common/decorators/...`).
- Produces: `@RequirePermission(module, level)` metadata on every listed handler.

- [ ] **Step 1: Annotate `locations.controller.ts`** (module `locations`)

Import: `import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'`

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('locations', 'view')` |
| `getOne` | `@Get(':id')` | `@RequirePermission('locations', 'view')` |
| `create` | `@Post()` | `@RequirePermission('locations', 'manage')` |
| `update` | `@Patch(':id')` | `@RequirePermission('locations', 'manage')` |
| `archive` | `@Patch(':id/archive')` | `@RequirePermission('locations', 'manage')` |
| `remove` | `@Delete(':id')` | `@RequirePermission('locations', 'manage')` |

- [ ] **Step 2: Annotate `schedules.controller.ts`** (reads → `appointments`/`view`; writes → `schedules_config`/`manage`)

Import: `import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'`

| Handler | HTTP | Decorator |
|---|---|---|
| `listBlocks` | `@Get('blocks')` | `@RequirePermission('appointments', 'view')` |
| `createBlock` | `@Post('blocks')` | `@RequirePermission('schedules_config', 'manage')` |
| `updateBlock` | `@Patch('blocks/:id')` | `@RequirePermission('schedules_config', 'manage')` |
| `deleteBlock` | `@Delete('blocks/:id')` | `@RequirePermission('schedules_config', 'manage')` |
| `listExceptions` | `@Get('exceptions')` | `@RequirePermission('appointments', 'view')` |
| `createException` | `@Post('exceptions')` | `@RequirePermission('schedules_config', 'manage')` |
| `updateException` | `@Patch('exceptions/:id')` | `@RequirePermission('schedules_config', 'manage')` |
| `deleteException` | `@Delete('exceptions/:id')` | `@RequirePermission('schedules_config', 'manage')` |

- [ ] **Step 3: Annotate `audit-log.controller.ts`** (module `audit_log`)

This controller is under `apps/api/src/common/audit-log/`. Import from the sibling decorators dir:

`import { RequirePermission } from '../decorators/require-permission.decorator.js'`

| Handler | HTTP | Decorator |
|---|---|---|
| `list` | `@Get()` | `@RequirePermission('audit_log', 'view')` |
| `exportCsv` | `@Get('export.csv')` | `@RequirePermission('audit_log', 'view')` |
| `getById` | `@Get(':id')` | `@RequirePermission('audit_log', 'view')` |

Note: `LogsController` (`apps/api/src/modules/logs/logs.controller.ts`, route `/v1/logs/client-error`) is the public client-error reporter and stays `@Public()` — do NOT annotate it. Do not confuse it with the audit-log controller.

- [ ] **Step 4: Verify build + specs**

```bash
pnpm --filter @rezeta/api build
pnpm --filter @rezeta/api test src/modules/locations src/modules/schedules src/common/audit-log
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/locations/locations.controller.ts apps/api/src/modules/schedules/schedules.controller.ts apps/api/src/common/audit-log/audit-log.controller.ts
git commit -m "feat(api): enforce permissions on locations, schedules, audit-log controllers"
```

---

## Task 9: Controller integration test — under-privileged 403, privileged pass

Prove the decorator + guard wire together against a REAL controller method: the `PermissionGuard` reads the actual `@RequirePermission` metadata off `PatientsController` handlers (via a real `Reflector`) and denies an assistant while allowing a doctor. This follows the codebase's unit-integration style (no supertest / `@nestjs/testing` HTTP bootstrap is used anywhere in this repo — see `apps/api/src` has zero `createTestingModule` usages).

**Files:**
- Create: `apps/api/src/common/guards/__tests__/permission.guard.integration.spec.ts`

**Interfaces:**
- Consumes: real `Reflector` from `@nestjs/core`, real `PatientsController` (for its decorated method references), `PermissionGuard`, `defaultCapabilitiesFor` from `@rezeta/shared` (Slice 2).
- Produces: passing assertions that `patients:manage` endpoints deny an `assistant` (default `patients: 'view'`) and allow a `doctor` (default `patients: 'manage'`).

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/src/common/guards/__tests__/permission.guard.integration.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { Reflector } from '@nestjs/core'
import { ForbiddenException, type ExecutionContext } from '@nestjs/common'
import { ErrorCode, defaultCapabilitiesFor, type CapabilityMap } from '@rezeta/shared'
import { PermissionGuard } from '../permission.guard.js'
import { PatientsController } from '../../../modules/patients/patients.controller.js'

/**
 * Build a context whose getHandler() returns a REAL decorated controller method,
 * so the guard reads the actual @RequirePermission metadata via a real Reflector.
 */
function ctxFor(
  handler: (...args: unknown[]) => unknown,
  capabilities: CapabilityMap,
): ExecutionContext {
  const request = { user: { capabilities, isPlatformAdmin: false } }
  return {
    getHandler: () => handler,
    getClass: () => PatientsController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext
}

describe('PermissionGuard × PatientsController (integration)', () => {
  const guard = new PermissionGuard(new Reflector())
  const create = PatientsController.prototype.create // @RequirePermission('patients', 'manage')
  const list = PatientsController.prototype.list // @RequirePermission('patients', 'view')

  it('denies an assistant (patients: view) on the manage endpoint with a 403 code', () => {
    const assistant = defaultCapabilitiesFor('assistant')
    expect(assistant.patients).toBe('view')
    try {
      guard.canActivate(ctxFor(create as never, assistant))
      expect.unreachable('assistant should be forbidden from creating patients')
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException)
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: ErrorCode.INSUFFICIENT_PERMISSION,
      })
    }
  })

  it('allows a doctor (patients: manage) on the manage endpoint', () => {
    const doctor = defaultCapabilitiesFor('doctor')
    expect(doctor.patients).toBe('manage')
    expect(guard.canActivate(ctxFor(create as never, doctor))).toBe(true)
  })

  it('allows an assistant on the view endpoint', () => {
    const assistant = defaultCapabilitiesFor('assistant')
    expect(guard.canActivate(ctxFor(list as never, assistant))).toBe(true)
  })
})
```

Run and confirm it FAILS until Task 5 annotated `PatientsController` (if running the whole plan in order it should already pass metadata reads; the guard-behavior assertions are the point):

```bash
pnpm --filter @rezeta/api test src/common/guards/__tests__/permission.guard.integration.spec.ts
```

If the assertions on `defaultCapabilitiesFor(...).patients` fail, the Slice 2 catalog defaults are wrong — stop and reconcile with `permissions-contracts.md` §Permission catalog before proceeding.

- [ ] **Step 2: Verify it passes and run the full API suite with coverage**

```bash
pnpm --filter @rezeta/api test
pnpm --filter @rezeta/api test:coverage
```

Coverage note: `src/common/guards/**` is NOT in the vitest `coverage.exclude` list, so `permission.guard.ts` must hit the 95% per-file gate — the Task 3 unit spec plus this integration spec cover every branch (public skip, no-metadata skip, platform-admin bypass, allow, deny-throw). `src/common/decorators/**` IS excluded, so the decorator file needs no coverage (its metadata test in Task 2 is still added for correctness).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/common/guards/__tests__/permission.guard.integration.spec.ts
git commit -m "test(api): integration test for PermissionGuard on a real controller"
```

---

## Task 10: Lint, changelog, and final verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the full gate**

```bash
cd /Users/carlosfeliz/PersonalProjects/Rezeta
pnpm --filter @rezeta/shared build
pnpm lint
pnpm --filter @rezeta/api test:coverage
pnpm --filter @rezeta/api build
```

Fix any lint or coverage failures before proceeding. Zero lint errors and 95%+ per-file coverage is the bar.

- [ ] **Step 2: Prepend a changelog entry**

Prepend to `CHANGELOG.md` (English only):

```markdown
## [2026-07-15] Backend permission enforcement

### Added
- `ErrorCode.INSUFFICIENT_PERMISSION` (`packages/shared/src/errors.ts`) — returned as HTTP 403 when a caller's effective access level is below what an endpoint requires.
- `@RequirePermission(module, level)` decorator (`apps/api/src/common/decorators/require-permission.decorator.ts`, metadata key `PERMISSION_KEY`).
- `PermissionGuard` (`apps/api/src/common/guards/permission.guard.ts`), registered as the third global guard after `AuthGuard` and `TenantGuard`. It enforces `@RequirePermission` against the capability map resolved onto `request.user.capabilities`; skips public/un-annotated routes and platform-admin requests.

### Changed
- Annotated every clinical and admin controller endpoint with `@RequirePermission` (GET → `view`, mutations → `manage`): patients, appointments, consultations, consultation-records, orders, invoices (billing), protocols, protocol-templates, protocol-categories, protocol-improvements, protocol-recommendations, locations, schedules (reads → `appointments`, writes → `schedules_config`), and audit-log. Auth, onboarding, client-error logging, and `/v1/users/me` self-service routes stay exempt.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for backend permission enforcement"
```

- [ ] **Step 4: Final self-check**

Confirm every non-exempt endpoint carries a decorator (spot-check with grep):

```bash
cd /Users/carlosfeliz/PersonalProjects/Rezeta
grep -rn "RequirePermission" apps/api/src/modules apps/api/src/common/audit-log | wc -l   # expect ~80 handler annotations + import lines
# Endpoints that MUST remain undecorated:
grep -rn "RequirePermission" apps/api/src/modules/auth apps/api/src/modules/onboarding apps/api/src/modules/logs apps/api/src/modules/users || echo "OK: auth/onboarding/logs/users(me) correctly unannotated"
```

---

## Enforcement map summary (module → guarded controllers)

| Module key | Controllers |
|---|---|
| `patients` | `patients.controller.ts` |
| `consultations` | `consultations.controller.ts` (both controllers), `consultation-records.controller.ts` |
| `protocols` | `protocols.controller.ts`, `protocol-improvements.controller.ts`, `protocol-recommendations.controller.ts` |
| `appointments` | `appointments.controller.ts`, `schedules.controller.ts` (reads only) |
| `orders` | `orders.controller.ts` |
| `billing` | `invoices.controller.ts` |
| `locations` | `locations.controller.ts` |
| `templates` | `protocol-templates.controller.ts` |
| `categories` | `protocol-categories.controller.ts` |
| `schedules_config` | `schedules.controller.ts` (writes only) |
| `audit_log` | `common/audit-log/audit-log.controller.ts` |
| `users` | (Slice 5 — user-management endpoints; `/v1/users/me` is exempt self-service) |
| `permissions` | (Slice 6 — permissions matrix endpoints) |

Exempt (no `@RequirePermission`): `auth.controller.ts`, `onboarding.controller.ts`, `logs.controller.ts` (public), `users.controller.ts` (`/v1/users/me` self-service).
