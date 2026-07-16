# Staff Platform + Platform Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Rezeta platform staff a guarded, always-audited way to create new institutions (tenants). Platform staff are a **separate identity** from institution users — a distinct `PlatformUser` table (the control plane) with **no `tenant_id`** — so a platform principal can never be returned by a tenant-scoped query. This is the standard control-plane / data-plane split.

**Architecture:** This is Slice 7 (the last slice) of the permissions/multi-user feature and depends on Slices 1–6. Slice 7 **owns the entire platform identity**:

- A new `PlatformUser` Prisma model + migration (no tenant relation, soft-deletable, keyed by Firebase `externalUid`).
- A shared `PlatformPrincipal` type; `AuthenticatedRequest.platformUser?: PlatformPrincipal` (set for platform routes only — never together with `request.user`).
- A `@PlatformRoute()` decorator (metadata key `IS_PLATFORM_ROUTE_KEY`) that marks the staff endpoints platform-only + not tenant-scoped.
- `AuthGuard` grows a branch: on an `IS_PLATFORM_ROUTE_KEY` handler it resolves a `PlatformUser` by `externalUid` (via `PlatformUsersRepository`) and sets `request.platformUser`; `UnauthorizedException` if missing/inactive. On every other route it keeps the existing institution-`User` resolution.
- `TenantGuard` skips tenant resolution on platform routes.
- A new global `PlatformGuard` requires `request.platformUser` on platform routes (else `ForbiddenException({ code: FORBIDDEN })`) and is a no-op elsewhere.
- A staff module exposing `POST /v1/staff/institutions` (creates a `Tenant`, seeds `RolePermission` defaults + starter data, and mints the initial `super_admin` via the Slice-5 provisioning flow) and `GET /v1/staff/me` (returns the `PlatformPrincipal`).
- A dev CLI that seeds the first `PlatformUser` (Admin SDK + row + set-password link) and can optionally create the first institution.
- A minimal, English, staff-facing web console (kept entirely separate from the institution app shell), gated on `GET /v1/staff/me`.

**Global guard order (final):** `AuthGuard → PlatformGuard → TenantGuard → PermissionGuard`. `PlatformGuard` is registered in `app.module.ts` immediately after `AuthGuard`; `PermissionGuard` (Slice 3) stays last.

**Isolation guarantee (no cross-tenant bypass this milestone):** Platform principals do **not** access tenant-scoped endpoints at all. There is no cross-tenant header override, and institution identity carries no platform flag. A platform token that hits a tenant route resolves no institution `User` and 401s; a tenant user that hits a `/v1/staff/*` route resolves no `PlatformUser` and 401s (or 403s at `PlatformGuard`). Tenant isolation for ordinary users is therefore fully intact. Staff create/administer institutions only through `/v1/staff/*` endpoints whose services perform the necessary writes directly and audited.

**Out of scope (this milestone / non-goals):**
- **Cross-tenant access to institution DATA by platform staff (support impersonation).** Staff can create and administer institutions but cannot read or write a tenant's clinical/business data on that tenant's behalf. There is deliberately no mechanism for a platform principal to enter a tenant-scoped query path.
- Self-service signup (there is no public tenant creation path; institutions are minted only via `/v1/staff/institutions` or the CLI).

**Tech Stack:** NestJS 10 + Prisma 6 (`@rezeta/db`), Zod (`@rezeta/shared`), Firebase Admin SDK (`IAuthProvider`), React 18 + Vite + React Router + TanStack Query + Zustand + Tailwind, Vitest.

## Global Constraints

- Monorepo, pnpm workspaces: `apps/api` (NestJS + Prisma), `apps/web` (React 18 + Vite + Zustand + TanStack Query + Tailwind), `packages/shared` (Zod + types + `ErrorCode`), `packages/db` (Prisma, imported as `@rezeta/db`).
- PKs are `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`. DB columns `snake_case` via `@map`; TS fields `camelCase`. Soft-delete via `deletedAt`.
- `ErrorCode` closed enum: `packages/shared/src/errors.ts`. `FORBIDDEN` already exists (reuse it — do not invent a new platform error code). Slice 3 adds `INSUFFICIENT_PERMISSION`.
- Shared barrel: `packages/shared/src/index.ts` re-exports `types/*` and `schemas/*`. Import in app code as `@rezeta/shared`.
- Global guards, order in `apps/api/src/app.module.ts`: `AuthGuard` → **`PlatformGuard` (this slice)** → `TenantGuard` → (Slice 3) `PermissionGuard`. Controller/route-scoped `@UseGuards(...)` run **after** all global guards.
- `AuthGuard` sets `request.user: AuthUser` on institution routes, or `request.platformUser: PlatformPrincipal` on platform routes — **never both**. `AuthUser` stays **institution-only**: it carries `role` (Slice 1) and `capabilities: CapabilityMap` (Slice 2) and has **no** platform field.
- `AuditLogService` (`apps/api/src/common/audit-log/audit-log.service.ts`, `@Global`) via `.record({ actorType, category, action, ... })`. `record()` swallows its own errors; call it fire-and-forget (`void ...`) inside guards, exactly as `AuthGuard` does for `login_failed`. Valid `actorType` values: `'user' | 'system' | 'webhook' | 'cron'`.
- Controllers follow the patients/locations pattern: `@ApiTags`, `ZodValidationPipe`, param decorators (`@CurrentUser()` for institution routes, `@CurrentPlatformUser()` for platform routes).
- Tests live in `__tests__/` beside source. API + shared use `*.spec.ts`; web uses `*.test.tsx`. Match the framework/imports of the nearest sibling test file (Vitest everywhere; `vi.fn()` mocks).
- Coverage gate: `pnpm test:coverage` enforces **95% per-file**. Every new **counted** file needs tests. API coverage excludes already cover `**/*.module.ts`, `**/index.ts`, `**/*.repository.ts`, decorators, `audit-log.types.ts`, `main.ts`. Web coverage excludes already cover `src/pages/**`, `src/components/auth/**`, `src/components/layout/**`, `src/hooks/**/use-*.ts`. Run `pnpm lint` and `pnpm test` before considering a task done.
- Language rule: ALL code/comments/docs/tests/commits in English. ONLY end-user-facing product UI strings are Spanish. **Exception for this slice:** the staff console is internal Rezeta-staff tooling, not the patient-facing product — its user-facing strings are **English** (per the feature spec §7). Strings are still colocated in a `strings.ts` file.
- No `TODO/FIXME/HACK/XXX` comments (ESLint fails CI). No arbitrary Tailwind `prop-[value]` classes — use design tokens from `apps/web/src/index.css` / `tailwind.config.ts`.
- Do NOT run `git commit --amend` on other slices' commits and do NOT rebase; each step below commits its own work.

**Dependencies on prior slices (must be merged before executing this plan):**
- Slice 1: `UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'`, `ROLE_RANK`, `canManageRole(actorRole, targetRole)` in `packages/shared/src/permissions/roles.ts`.
- Slice 2: `RolePermission` model; `PermissionsService.seedDefaults(tx, tenantId)`; `capabilities: CapabilityMap` on `AuthUser` + `UserApiSchema`. (Slice 2 adds **no** platform flag — platform identity is entirely this slice.)
- Slice 3: `PermissionGuard` registered as the last global guard; skips when there is no `@RequirePermission` metadata (staff routes carry none, so they are already skipped by `PermissionGuard`).
- Slice 5: `IAuthProvider.createUser(email): Promise<{ externalUid }>` and `generatePasswordResetLink(email): Promise<string>`; `UsersService.createUser(tenantId, actorRole, actorUserId, dto)` (Admin SDK + set-password email; enforces `canManageRole`); `UsersModule` exports `UsersService`; migration `20260715030000_*` is the latest permissions migration.
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

### Task 2: `PlatformUser` Prisma model + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add the `PlatformUser` model)
- Create: `packages/db/prisma/migrations/20260715040000_platform_users/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a standalone `platform_users` table (no tenant relation) and a generated `PlatformUser` Prisma type importable as `import type { PlatformUser } from '@rezeta/db'`. Consumed by `PlatformUsersRepository` (Task 5), `AuthGuard` (Task 6), and the CLI (Task 11).

> The migration timestamp `20260715040000` sorts **after** Slice 5's latest permissions migration `20260715030000_*`, so it applies last. No test — Prisma models/migrations are validated by `prisma generate` + the downstream repository/guard tests.

- [ ] **Step 1: Add the model to the schema**

In `packages/db/prisma/schema.prisma`, add this model (place it alongside the other top-level models; it has no relations, so ordering is cosmetic):

```prisma
model PlatformUser {
  id          String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  externalUid String    @unique @map("external_uid") @db.VarChar(128)
  email       String    @db.VarChar(320)
  fullName    String?   @map("full_name") @db.VarChar(200)
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")

  @@index([externalUid])
  @@map("platform_users")
}
```

> Note: `PlatformUser` intentionally has **no** `tenantId` and **no** relation to `Tenant`. It is the control-plane identity; do not add it to the `Tenant` model's relations.

- [ ] **Step 2: Create the migration SQL**

Create `packages/db/prisma/migrations/20260715040000_platform_users/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "external_uid" VARCHAR(128) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "full_name" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_external_uid_key" ON "platform_users"("external_uid");

-- CreateIndex
CREATE INDEX "platform_users_external_uid_idx" ON "platform_users"("external_uid");
```

- [ ] **Step 3: Regenerate the Prisma client and validate**

Run: `pnpm --filter @rezeta/db exec prisma generate`
Expected: PASS — the client regenerates with a `PlatformUser` model. (`prisma migrate` against a live dev DB is a deploy-time step; generation is what unblocks the typed repository below.)

Run: `pnpm --filter @rezeta/db exec prisma validate`
Expected: PASS — schema is valid.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260715040000_platform_users
git commit -m "feat(db): add PlatformUser model + migration (control-plane identity, no tenant)"
```

---

### Task 3: Shared `PlatformPrincipal` type

**Files:**
- Modify: `packages/shared/src/types/auth.ts` (add `PlatformPrincipal`)

**Interfaces:**
- Consumes: nothing.
- Produces: `PlatformPrincipal` re-exported through the shared barrel (`packages/shared/src/index.ts` already re-exports `types/*`), importable as `import type { PlatformPrincipal } from '@rezeta/shared'`. Consumed by `AuthenticatedRequest.platformUser` (Task 6), the `@CurrentPlatformUser()` decorator (Task 4), the staff controller (Task 10), and the web gate/hook (Task 13).

> Pure type addition (no runtime); verified by typecheck, no dedicated spec.

- [ ] **Step 1: Add the interface**

In `packages/shared/src/types/auth.ts`, add (after the `AuthUser` interface):

```ts
/**
 * A Rezeta platform-staff principal (control plane). Distinct from AuthUser:
 * a PlatformUser has NO tenant, NO role, and NO capabilities — it exists only
 * to administer institutions through the /v1/staff/* endpoints. Set on
 * `request.platformUser` for @PlatformRoute() handlers; never alongside `user`.
 */
export interface PlatformPrincipal {
  id: string
  externalUid: string
  email: string
  fullName: string | null
}
```

- [ ] **Step 2: Verify it typechecks and is re-exported**

Run: `pnpm --filter @rezeta/shared exec tsc --noEmit`
Expected: PASS. `PlatformPrincipal` is now reachable via `@rezeta/shared` (the barrel re-exports `types/*` — no barrel edit needed; confirm the `export * from './types/auth.js'` line already exists in `packages/shared/src/index.ts`).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types/auth.ts
git commit -m "feat(shared): add PlatformPrincipal control-plane type"
```

---

### Task 4: `@PlatformRoute()` + `@CurrentPlatformUser()` decorators

**Files:**
- Create: `apps/api/src/common/decorators/platform-route.decorator.ts`
- Create: `apps/api/src/common/decorators/current-platform-user.decorator.ts`

**Interfaces:**
- Consumes: `PlatformPrincipal` (Task 3).
- Produces:
  - `IS_PLATFORM_ROUTE_KEY = 'isPlatformRoute'` constant + `PlatformRoute(): CustomDecorator` (mirrors `public.decorator.ts`). Marks a handler/controller as platform-only + not tenant-scoped. Read by `AuthGuard` (Task 6), `TenantGuard` (Task 7), and `PlatformGuard` (Task 8).
  - `CurrentPlatformUser` param decorator yielding `request.platformUser: PlatformPrincipal` (mirrors `current-user.decorator.ts`).

> Both files are decorators, which the API coverage config excludes — no dedicated spec; verified by typecheck + the guard/controller tests that use them.

- [ ] **Step 1: Create the route-marker decorator**

Create `apps/api/src/common/decorators/platform-route.decorator.ts` (mirrors `public.decorator.ts`):

```ts
import { SetMetadata, type CustomDecorator } from '@nestjs/common'

/**
 * Mark an endpoint (or controller) as a PLATFORM route.
 *
 * Platform routes are served to Rezeta staff (a PlatformUser), not institution
 * users. AuthGuard resolves a PlatformUser by externalUid and sets
 * `request.platformUser` (401 if none/inactive); TenantGuard skips tenant
 * resolution; PlatformGuard requires `request.platformUser` to be present.
 *
 * Used by the /v1/staff/* controller.
 */
export const IS_PLATFORM_ROUTE_KEY = 'isPlatformRoute'
export const PlatformRoute = (): CustomDecorator => SetMetadata(IS_PLATFORM_ROUTE_KEY, true)
```

- [ ] **Step 2: Create the current-platform-user param decorator**

Create `apps/api/src/common/decorators/current-platform-user.decorator.ts` (mirrors `current-user.decorator.ts`):

```ts
import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'
import type { PlatformPrincipal } from '@rezeta/shared'

/**
 * Yields the resolved PlatformPrincipal from a @PlatformRoute() handler.
 * `request.platformUser` is set by AuthGuard and required by PlatformGuard, so
 * it is always present by the time a controller method runs.
 */
export const CurrentPlatformUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PlatformPrincipal => {
    const request = ctx.switchToHttp().getRequest<{ platformUser: PlatformPrincipal }>()
    return request.platformUser
  },
)
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/decorators/platform-route.decorator.ts apps/api/src/common/decorators/current-platform-user.decorator.ts
git commit -m "feat(api): add @PlatformRoute() + @CurrentPlatformUser() decorators"
```

---

### Task 5: `PlatformUsersModule` + `PlatformUsersRepository`

**Files:**
- Create: `apps/api/src/modules/platform-users/platform-users.repository.ts`
- Create: `apps/api/src/modules/platform-users/platform-users.module.ts`
- Create: `apps/api/src/modules/platform-users/index.ts`
- Modify: `apps/api/src/app.module.ts` (import `PlatformUsersModule` so the global `AuthGuard` can inject the repository)

**Interfaces:**
- Consumes: `PrismaService` (global); `PlatformUser` Prisma type (Task 2).
- Produces: `PlatformUsersRepository` with:
  - `findByExternalUid(externalUid: string): Promise<PlatformUser | null>` — soft-delete-aware lookup used by `AuthGuard` (Task 6).
  - `create(data: { externalUid: string; email: string; fullName: string | null }): Promise<PlatformUser>` — used by the CLI (Task 11).
  `PlatformUsersModule` exports the repository; imported into `AppModule` so the app-level `AuthGuard` provider can resolve it (same pattern as `UsersModule` exporting `UsersRepository`).

> `*.repository.ts`, `*.module.ts`, and `index.ts` are all in the API coverage `exclude` list, so no dedicated spec — the repository is exercised indirectly by the AuthGuard test (Task 6) via a mock.

- [ ] **Step 1: Implement the repository**

Create `apps/api/src/modules/platform-users/platform-users.repository.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common'
import type { PlatformUser } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'

/**
 * PlatformUsersRepository — control-plane identity lookups.
 *
 * PlatformUser rows have no tenant; there is no tenant filter here (that is the
 * point of the control plane). Soft-deleted rows are excluded.
 */
@Injectable()
export class PlatformUsersRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findByExternalUid(externalUid: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findFirst({
      where: { externalUid, deletedAt: null },
    })
  }

  async create(data: {
    externalUid: string
    email: string
    fullName: string | null
  }): Promise<PlatformUser> {
    return this.prisma.platformUser.create({ data })
  }
}
```

- [ ] **Step 2: Implement the module + barrel**

Create `apps/api/src/modules/platform-users/platform-users.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PlatformUsersRepository } from './platform-users.repository.js'

@Module({
  providers: [PlatformUsersRepository],
  exports: [PlatformUsersRepository],
})
export class PlatformUsersModule {}
```

Create `apps/api/src/modules/platform-users/index.ts`:

```ts
export { PlatformUsersModule } from './platform-users.module.js'
export { PlatformUsersRepository } from './platform-users.repository.js'
```

- [ ] **Step 3: Register the module in `app.module.ts`**

In `apps/api/src/app.module.ts`, add the import near the other module imports:

```ts
import { PlatformUsersModule } from './modules/platform-users/index.js'
```

and add `PlatformUsersModule` to the `imports` array (place it next to `UsersModule`). This makes `PlatformUsersRepository` resolvable by the app-level `AuthGuard` provider, exactly as `UsersModule` does for `UsersRepository`.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/platform-users apps/api/src/app.module.ts
git commit -m "feat(api): add PlatformUsersModule + repository (control-plane lookups)"
```

---

### Task 6: `AuthGuard` platform branch + `AuthenticatedRequest.platformUser`

**Files:**
- Modify: `apps/api/src/common/guards/auth.guard.ts`
- Modify: `apps/api/src/common/guards/__tests__/auth.guard.spec.ts` (add platform-route cases; adapt to the existing harness)

**Interfaces:**
- Consumes: `PlatformUsersRepository` (Task 5); `IS_PLATFORM_ROUTE_KEY` (Task 4); `PlatformPrincipal` (Task 3).
- Produces: `AuthenticatedRequest` gains `platformUser?: PlatformPrincipal`. New `AuthGuard` behavior: after token verification, if the handler carries `IS_PLATFORM_ROUTE_KEY`, resolve a `PlatformUser` by `externalUid`; throw `UnauthorizedException` if missing or inactive; otherwise set `request.platformUser` and return `true` (no tenant, no institution `User`, no capabilities). All other routes keep the existing institution path unchanged.

- [ ] **Step 1: Extend `AuthenticatedRequest` and inject the repository**

In `apps/api/src/common/guards/auth.guard.ts`:

Add imports (next to the existing decorator/repository imports):

```ts
import type { AuthUser, UserPreferences, PlatformPrincipal } from '@rezeta/shared'
import { PlatformUsersRepository } from '../../modules/platform-users/platform-users.repository.js'
import { IS_PLATFORM_ROUTE_KEY } from '../decorators/platform-route.decorator.js'
```

> The `AuthUser, UserPreferences` import already exists as a `import type { AuthUser, UserPreferences } from '@rezeta/shared'` line — extend it to also import `PlatformPrincipal` rather than adding a second import.

Extend the `AuthenticatedRequest` interface:

```ts
export interface AuthenticatedRequest extends Request {
  user: AuthUser
  tenantId: string
  verifiedToken?: VerifiedToken // only populated on provision route
  platformUser?: PlatformPrincipal // only populated on @PlatformRoute() routes
}
```

Add `PlatformUsersRepository` to the constructor:

```ts
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(UsersRepository) private users: UsersRepository,
    @Inject(PlatformUsersRepository) private platformUsers: PlatformUsersRepository,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}
```

- [ ] **Step 2: Add the platform branch**

Insert the platform branch **after** the `isProvisionRoute` block (which returns early) and **before** the institution `const user = await this.users.findByExternalUid(...)` line:

```ts
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isPlatformRoute) {
      const platformUser = await this.platformUsers.findByExternalUid(verified.externalUid)
      if (!platformUser || !platformUser.isActive) {
        throw new UnauthorizedException({
          code: ErrorCode.UNAUTHORIZED,
          message: 'Platform user not found or inactive',
        })
      }
      request.platformUser = {
        id: platformUser.id,
        externalUid: platformUser.externalUid,
        email: platformUser.email,
        fullName: platformUser.fullName,
      }
      return true
    }
```

Leave the institution path (`findByExternalUid`, `isActive`, `request.user = { ... }`) exactly as-is.

- [ ] **Step 3: Add tests for the platform branch**

In `apps/api/src/common/guards/__tests__/auth.guard.spec.ts`, reuse the existing harness (it already mocks `Reflector`, `IAuthProvider`, `UsersRepository`, `AuditLogService`). Add a mocked `PlatformUsersRepository` to the guard construction and add these cases (adapt variable names to the file's existing helpers):

```ts
it('sets request.platformUser for a @PlatformRoute() with an active PlatformUser', async () => {
  reflector.getAllAndOverride.mockImplementation((key: string) =>
    key === IS_PLATFORM_ROUTE_KEY ? true : false,
  )
  authProvider.verifyToken.mockResolvedValue({ externalUid: 'ext-1', email: 's@r.com', rawClaims: {} })
  platformUsers.findByExternalUid.mockResolvedValue({
    id: 'p1',
    externalUid: 'ext-1',
    email: 's@r.com',
    fullName: 'Staff',
    isActive: true,
  })
  const request: Record<string, unknown> = { headers: { authorization: 'Bearer tok' } }
  const ctx = makeCtx(request)
  await expect(guard.canActivate(ctx)).resolves.toBe(true)
  expect(request['platformUser']).toEqual({
    id: 'p1',
    externalUid: 'ext-1',
    email: 's@r.com',
    fullName: 'Staff',
  })
  expect(request['user']).toBeUndefined()
})

it('401s on a @PlatformRoute() when no PlatformUser matches (tenant user cannot enter staff routes)', async () => {
  reflector.getAllAndOverride.mockImplementation((key: string) =>
    key === IS_PLATFORM_ROUTE_KEY ? true : false,
  )
  authProvider.verifyToken.mockResolvedValue({ externalUid: 'ext-2', email: 'x@y.com', rawClaims: {} })
  platformUsers.findByExternalUid.mockResolvedValue(null)
  const ctx = makeCtx({ headers: { authorization: 'Bearer tok' } })
  await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
})

it('401s on a @PlatformRoute() when the PlatformUser is inactive', async () => {
  reflector.getAllAndOverride.mockImplementation((key: string) =>
    key === IS_PLATFORM_ROUTE_KEY ? true : false,
  )
  authProvider.verifyToken.mockResolvedValue({ externalUid: 'ext-3', email: 'z@y.com', rawClaims: {} })
  platformUsers.findByExternalUid.mockResolvedValue({
    id: 'p3',
    externalUid: 'ext-3',
    email: 'z@y.com',
    fullName: null,
    isActive: false,
  })
  const ctx = makeCtx({ headers: { authorization: 'Bearer tok' } })
  await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException)
})
```

> Import `IS_PLATFORM_ROUTE_KEY` from `../../decorators/platform-route.decorator.js` and `UnauthorizedException` from `@nestjs/common` in the spec. `platformUsers` is a `{ findByExternalUid: vi.fn() }` mock passed as the new 4th constructor arg. `makeCtx` stands in for whatever request/context helper the existing spec uses — reuse it; do not invent a new one if the file already has one.

- [ ] **Step 4: Run the AuthGuard test**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/auth.guard.spec.ts`
Expected: PASS (existing institution/provision/public cases plus the three new platform cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS. (DI wiring: `PlatformUsersModule` was imported into `AppModule` in Task 5, so the new constructor arg resolves.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/guards/auth.guard.ts apps/api/src/common/guards/__tests__/auth.guard.spec.ts
git commit -m "feat(api): AuthGuard resolves PlatformUser on @PlatformRoute() endpoints"
```

---

### Task 7: `TenantGuard` skips platform routes

**Files:**
- Modify: `apps/api/src/common/guards/tenant.guard.ts`
- Modify: `apps/api/src/common/guards/__tests__/tenant.guard.spec.ts` (add a platform-route skip case)

**Interfaces:**
- Consumes: `IS_PLATFORM_ROUTE_KEY` (Task 4).
- Produces: `TenantGuard.canActivate` returns `true` **without** setting `request.tenantId` when the handler is a `@PlatformRoute()` (platform routes are not tenant-scoped). Public and provision routes still short-circuit as before; all other routes still pin `request.tenantId = request.user.tenantId`. The constructor is unchanged (single `Reflector` arg — there is no cross-tenant override and no `AuditLogService` dependency).

- [ ] **Step 1: Add the platform-route skip**

Replace the contents of `apps/api/src/common/guards/tenant.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'
import { IS_PLATFORM_ROUTE_KEY } from '../decorators/platform-route.decorator.js'

/**
 * TenantGuard — runs after AuthGuard (and PlatformGuard).
 *
 * Reads tenantId from the authenticated institution user (set by AuthGuard) and
 * exposes it on req.tenantId, which the @TenantId() decorator reads. This is the
 * tenant-isolation invariant: an institution user is always pinned to their own
 * tenant.
 *
 * Skipped for @Public() and @ProvisionRoute() endpoints (no resolved user yet),
 * and for @PlatformRoute() endpoints (platform staff have NO tenant — they never
 * enter a tenant-scoped query path).
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

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

    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isPlatformRoute) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    // req.user is guaranteed to be set by AuthGuard on non-platform routes.
    request.tenantId = request.user.tenantId
    return true
  }
}
```

- [ ] **Step 2: Update the test**

In `apps/api/src/common/guards/__tests__/tenant.guard.spec.ts`, keep the existing public/provision/own-tenant cases and add a platform-route case. If the spec's context helper does not already know `IS_PLATFORM_ROUTE_KEY`, extend its reflector mock to return `options.isPlatformRoute ?? false` for that key (mirroring the existing `IS_PROVISION_ROUTE_KEY` handling). Then add:

```ts
it('returns true for platform routes without setting tenantId', () => {
  const { reflector, ctx, request } = makeContext({ isPlatformRoute: true })
  guard = build(reflector)
  expect(guard.canActivate(ctx as never)).toBe(true)
  expect(request['tenantId']).toBeUndefined()
})
```

> The `build(reflector)` helper constructs `new TenantGuard(reflector)` — a single argument. If the current spec's helper passed a second `auditLog` argument (from an earlier draft), drop it: `TenantGuard` takes only the `Reflector`.

- [ ] **Step 3: Run the test**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/tenant.guard.spec.ts`
Expected: PASS (public, provision, platform-skip, and own-tenant pinning cases).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/guards/tenant.guard.ts apps/api/src/common/guards/__tests__/tenant.guard.spec.ts
git commit -m "feat(api): TenantGuard skips @PlatformRoute() endpoints (platform staff have no tenant)"
```

---

### Task 8: `PlatformGuard` + global registration

**Files:**
- Create: `apps/api/src/common/guards/platform.guard.ts`
- Test: `apps/api/src/common/guards/__tests__/platform.guard.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `PlatformGuard` as the 2nd global guard)

**Interfaces:**
- Consumes: `Reflector`; `IS_PLATFORM_ROUTE_KEY` (Task 4); `AuthenticatedRequest` (Task 6); `ErrorCode.FORBIDDEN`.
- Produces: `PlatformGuard implements CanActivate` with `canActivate(ctx): boolean` — a **no-op** (`true`) on non-platform routes; on `@PlatformRoute()` handlers it requires `request.platformUser` to be set, else throws `ForbiddenException({ code: ErrorCode.FORBIDDEN })`. Registered globally immediately after `AuthGuard`, so the final guard order is `AuthGuard → PlatformGuard → TenantGuard → PermissionGuard`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/guards/__tests__/platform.guard.spec.ts`:

```ts
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { PlatformGuard } from '../platform.guard.js'
import { IS_PLATFORM_ROUTE_KEY } from '../../decorators/platform-route.decorator.js'

function makeCtx(request: unknown) {
  return {
    getHandler: vi.fn().mockReturnValue({}),
    getClass: vi.fn().mockReturnValue({}),
    switchToHttp: vi.fn().mockReturnValue({ getRequest: vi.fn().mockReturnValue(request) }),
  } as never
}

function build(isPlatformRoute: boolean): PlatformGuard {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) =>
      key === IS_PLATFORM_ROUTE_KEY ? isPlatformRoute : false,
    ),
  }
  return new PlatformGuard(reflector as never)
}

describe('PlatformGuard', () => {
  it('is a no-op (returns true) on non-platform routes even without a platformUser', () => {
    const guard = build(false)
    expect(guard.canActivate(makeCtx({}))).toBe(true)
  })

  it('allows a platform route when request.platformUser is set', () => {
    const guard = build(true)
    expect(guard.canActivate(makeCtx({ platformUser: { id: 'p1' } }))).toBe(true)
  })

  it('rejects a platform route with 403 FORBIDDEN when platformUser is missing', () => {
    const guard = build(true)
    expect(() => guard.canActivate(makeCtx({}))).toThrow(ForbiddenException)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/platform.guard.spec.ts`
Expected: FAIL — cannot resolve `../platform.guard.js`.

- [ ] **Step 3: Implement the guard**

Create `apps/api/src/common/guards/platform.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ErrorCode } from '@rezeta/shared'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PLATFORM_ROUTE_KEY } from '../decorators/platform-route.decorator.js'

/**
 * PlatformGuard — 2nd global guard (AuthGuard → PlatformGuard → TenantGuard →
 * PermissionGuard).
 *
 * No-op on every non-platform route. On a @PlatformRoute() handler it requires
 * that AuthGuard resolved a PlatformUser (`request.platformUser`); if not, the
 * caller is not platform staff → 403 FORBIDDEN. AuthGuard already 401s a token
 * that resolves no PlatformUser, so in practice this is defense-in-depth for the
 * platform boundary.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPlatformRoute = this.reflector.getAllAndOverride<boolean>(IS_PLATFORM_ROUTE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!isPlatformRoute) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    if (!request.platformUser) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Platform access required',
      })
    }
    return true
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/platform.guard.spec.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Register as the 2nd global guard**

In `apps/api/src/app.module.ts`, add the import:

```ts
import { PlatformGuard } from './common/guards/platform.guard.js'
```

and insert it between `AuthGuard` and `TenantGuard` in the `providers` array:

```ts
    // Global guards — order matters:
    // AuthGuard → PlatformGuard → TenantGuard → (Slice 3) PermissionGuard
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PlatformGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
```

> If Slice 3's `PermissionGuard` registration is already present, leave it immediately after `TenantGuard` — the final order becomes `AuthGuard → PlatformGuard → TenantGuard → PermissionGuard`.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/guards/platform.guard.ts apps/api/src/common/guards/__tests__/platform.guard.spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): add global PlatformGuard (2nd guard; requires platformUser on @PlatformRoute())"
```

---

### Task 9: Let `UsersService.createUser` bypass the rank rule for platform bootstrap

> **Depends on Slice 5.** `apps/api/src/modules/users/users.service.ts` gains a `createUser(tenantId, actorRole, actorUserId, dto)` method in Slice 5 that enforces `canManageRole(actorRole, dto.role)`. Creating the **initial** `super_admin` of a brand-new institution legitimately sits *above* the institution rank rule (there is no existing super_admin to rank against, and the actor is a `PlatformUser`, not an institution user). This task adds a narrow, opt-in bypass so `StaffService` (Task 10) can reuse the exact Slice-5 provisioning flow (Admin SDK + set-password email) instead of duplicating it.

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts` (add an optional `options` parameter to `createUser`; widen `actorUserId` to `string | null`)
- Modify: `apps/api/src/modules/users/__tests__/users.service.spec.ts` (add a bypass case; match whatever the Slice-5 spec is named — adapt the filename if different)

**Interfaces:**
- Consumes: the Slice-5 `createUser` and its `canManageRole` guard.
- Produces: `createUser(tenantId: string, actorRole: UserRole, actorUserId: string | null, dto: CreateUserDto, options?: { bypassRankCheck?: boolean }): Promise<ManagedUserDto>`. This extends Slice 5's real signature `createUser(tenantId, actorRole, actorUserId, dto)` in two ways: (a) it appends the optional `options` param, and (b) it **widens** `actorUserId` from `string` to `string | null` so a platform/system bootstrap (no acting institution user) can call it — the `user_invited` audit already tolerates a null actor via `actorType: 'system'`. When `options.bypassRankCheck === true`, the `canManageRole` throw is skipped; default (`undefined`/`false`) preserves Slice-5 behavior exactly.

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

it('allows the super_admin bootstrap with a null actor when bypassRankCheck is set', async () => {
  // The provider + repository mocks must be configured as in the existing
  // happy-path createUser test (authProvider.createUser -> { externalUid },
  // repository write -> a User row, generatePasswordResetLink -> a link).
  const user = await service.createUser(
    't1',
    'super_admin',
    null, // actor is a PlatformUser, not an institution user
    { email: 'a@b.com', fullName: 'Ana', role: 'super_admin' },
    { bypassRankCheck: true },
  )
  expect(user).toBeDefined()
})
```

Ensure `ForbiddenException` is imported from `@nestjs/common` in the spec (it likely already is).

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/users/__tests__/users.service.spec.ts`
Expected: FAIL — the bypass case still throws because `createUser` ignores the 5th argument (and may reject a `null` actor type).

- [ ] **Step 4: Implement the bypass**

In `createUser`, add the optional parameter, widen `actorUserId`, and gate the existing rank check. The signature becomes:

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
> drop the parameter or change the return type. Wherever the method records the
> `user_invited` audit, it already sets `actorType: 'system'` when the actor id is
> null (Slice 5) — no change needed there.

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
git commit -m "feat(api): opt-in bypassRankCheck + null actor on UsersService.createUser for platform bootstrap"
```

---

### Task 10: Staff module — `POST /v1/staff/institutions` + `GET /v1/staff/me`

**Files:**
- Create: `apps/api/src/modules/staff/staff.service.ts`
- Create: `apps/api/src/modules/staff/staff.controller.ts`
- Create: `apps/api/src/modules/staff/staff.module.ts`
- Create: `apps/api/src/modules/staff/index.ts`
- Modify: `apps/api/src/app.module.ts` (register `StaffModule`)
- Test: `apps/api/src/modules/staff/__tests__/staff.service.spec.ts`
- Test: `apps/api/src/modules/staff/__tests__/staff.controller.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`; `PermissionsService.seedDefaults(tx, tenantId)` (Slice 2/6); `TenantSeedingService.seedDefault(tenantId, locale)` (existing); `UsersService.createUser(tenantId, actorRole, actorUserId, dto, options)` (Task 9); `AuditLogService`; `@PlatformRoute()` + `@CurrentPlatformUser()` (Task 4); `PlatformPrincipal` (Task 3); `CreateInstitutionSchema` / `CreateInstitutionDto` / `InstitutionCreatedDto` (Task 1); `ZodValidationPipe` (existing).
- Produces:
  - `StaffService.createInstitution(dto: CreateInstitutionDto, actorPlatformUserId: string | null): Promise<InstitutionCreatedDto>` — creates the tenant + seeds `RolePermission` defaults (in one transaction), seeds starter data, creates the initial `super_admin` (via `UsersService.createUser` with `actorUserId: null` + `bypassRankCheck: true`), audits with `actorType: 'system'` and the acting `PlatformUser` id in metadata, and returns `{ tenantId, userId, email }`.
  - `StaffController` at `@Controller('v1/staff')`, annotated `@PlatformRoute()` (all endpoints platform-only): `POST institutions` and `GET me`. No `@UseGuards(...)` — the global `PlatformGuard` enforces the boundary via the `@PlatformRoute()` metadata.

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
    await service.createInstitution(dto, 'platform-1')
    expect(tx.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Clínica Norte', type: 'clinic', plan: 'free' }),
    })
    expect(permissions.seedDefaults).toHaveBeenCalledWith(tx, 'new-tenant')
  })

  it('seeds starter data for the new tenant', async () => {
    await service.createInstitution(dto, 'platform-1')
    expect(tenantSeeding.seedDefault).toHaveBeenCalledWith('new-tenant', 'es')
  })

  it('creates the initial super_admin via the users flow with a null actor + rank bypass', async () => {
    await service.createInstitution(dto, 'platform-1')
    expect(users.createUser).toHaveBeenCalledWith(
      'new-tenant',
      'super_admin',
      null,
      { email: 'ana@clinica.com', fullName: 'Dra. Ana Reyes', role: 'super_admin' },
      { bypassRankCheck: true },
    )
  })

  it('audits the institution creation as system with the acting platform user in metadata', async () => {
    await service.createInstitution(dto, 'platform-1')
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'new-tenant',
        actorType: 'system',
        category: 'entity',
        action: 'create',
        entityType: 'tenant',
        entityId: 'new-tenant',
        metadata: expect.objectContaining({ platformUserId: 'platform-1' }),
      }),
    )
  })

  it('audits as system with no platformUserId when there is no platform actor (CLI)', async () => {
    await service.createInstitution(dto, null)
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system', tenantId: 'new-tenant' }),
    )
  })

  it('returns the created tenant, user id, and email', async () => {
    const result = await service.createInstitution(dto, 'platform-1')
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
 * Tenant. The actor is a PlatformUser (control plane), NOT an institution user,
 * so no institution actorUserId is threaded into the tenant's data; the audit
 * records actorType 'system' with the acting PlatformUser id in metadata.
 *
 * It reuses the same building blocks the rest of the app uses:
 *   1. Tenant row + RolePermission defaults (one transaction).
 *   2. Starter templates/categories (tenant-seeding).
 *   3. Initial super_admin via the Slice-5 users flow (Admin SDK + set-password
 *      email), with actorUserId=null + a rank-check bypass because bootstrapping
 *      the first super_admin sits above the institution rank rule.
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
    actorPlatformUserId: string | null,
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

    // 3. Initial super_admin. The actor is a PlatformUser (not an institution
    //    user), so actorUserId is null; bypassRankCheck because this bootstrap
    //    is above the institution rank rule.
    const user = await this.users.createUser(
      tenant.id,
      'super_admin',
      null,
      { email: dto.adminEmail, fullName: dto.adminFullName, role: 'super_admin' },
      { bypassRankCheck: true },
    )

    // 4. Audit — actorType 'system' (no institution actor); acting PlatformUser
    //    id (if any) recorded in metadata.
    await this.auditLog.record({
      tenantId: tenant.id,
      actorType: 'system',
      category: 'entity',
      action: 'create',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: {
        institutionName: dto.institutionName,
        adminEmail: dto.adminEmail,
        initialUserId: user.id,
        ...(actorPlatformUserId ? { platformUserId: actorPlatformUserId } : {}),
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
import { StaffController } from '../staff.controller.js'
import type { StaffService } from '../staff.service.js'
import type { CreateInstitutionDto, PlatformPrincipal } from '@rezeta/shared'

const dto: CreateInstitutionDto = {
  institutionName: 'Clínica Norte',
  type: 'clinic',
  plan: 'free',
  adminFullName: 'Dra. Ana Reyes',
  adminEmail: 'ana@clinica.com',
}

function principal(overrides: Partial<PlatformPrincipal> = {}): PlatformPrincipal {
  return {
    id: 'platform-1',
    externalUid: 'ext-staff',
    email: 'staff@rezeta.com',
    fullName: 'Staff',
    ...overrides,
  }
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

  it('createInstitution delegates to the service with the acting platform user id', async () => {
    const result = await controller.createInstitution(principal(), dto)
    expect(service.createInstitution).toHaveBeenCalledWith(dto, 'platform-1')
    expect(result).toEqual({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' })
  })

  it('me returns the current platform principal', () => {
    const p = principal()
    expect(controller.me(p)).toEqual(p)
  })
})
```

> The authorization boundary (a tenant user cannot reach `/v1/staff/*`) is covered by the AuthGuard tests (Task 6, the 401 case) and the PlatformGuard tests (Task 8, the 403 case), not re-tested here.

- [ ] **Step 6: Run the controller test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/staff/__tests__/staff.controller.spec.ts`
Expected: FAIL — cannot resolve `../staff.controller.js`.

- [ ] **Step 7: Implement the controller and module**

Create `apps/api/src/modules/staff/staff.controller.ts`:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, UsePipes } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreateInstitutionSchema,
  type CreateInstitutionDto,
  type InstitutionCreatedDto,
  type PlatformPrincipal,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { StaffService } from './staff.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff')
export class StaffController {
  constructor(@Inject(StaffService) private svc: StaffService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated platform principal' })
  @ApiResponse({ status: 200, description: 'Platform principal.' })
  @ApiResponse({ status: 401, description: 'Caller is not a platform user.' })
  me(@CurrentPlatformUser() platformUser: PlatformPrincipal): PlatformPrincipal {
    return platformUser
  }

  @Post('institutions')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateInstitutionSchema))
  @ApiOperation({ summary: 'Create a new institution (tenant) and its initial super_admin' })
  @ApiResponse({ status: 201, description: 'Institution created.' })
  @ApiResponse({ status: 401, description: 'Caller is not a platform user.' })
  async createInstitution(
    @CurrentPlatformUser() actor: PlatformPrincipal,
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
git commit -m "feat(api): staff platform module — POST /v1/staff/institutions + GET /v1/staff/me (@PlatformRoute)"
```

---

### Task 11: Dev bootstrap CLI — seed the first `PlatformUser` + optional institution

**Files:**
- Create: `apps/api/src/scripts/create-institution.ts`
- Modify: `apps/api/vitest.config.ts` (exclude `src/scripts/**` from coverage, like `main.ts`)
- Modify: `apps/api/package.json` (add a `bootstrap:platform` script)
- Test: `apps/api/src/scripts/__tests__/create-institution.spec.ts`

**Interfaces:**
- Consumes: `IAuthProvider.createUser(email)` + `generatePasswordResetLink(email)` (Slice 5); `PlatformUsersRepository.create(...)` (Task 5); `StaffService.createInstitution(dto, platformUserId)` (Task 10); `NestFactory.createApplicationContext(AppModule)`.
- Produces (all exported for testing):
  - `parseArgs(argv: string[]): BootstrapArgs` — requires `--platform-email`; `--platform-name` optional; institution flags (`--name`/`--type`/`--plan`/`--admin-name`/`--admin-email`) optional (all-or-nothing).
  - `bootstrapPlatform(deps, args): Promise<BootstrapResult>` — creates the first `PlatformUser` (Admin SDK user + `platform_users` row + set-password link), then, when the institution flags are present, calls `StaffService.createInstitution(dto, platformUserId)`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/scripts/__tests__/create-institution.spec.ts`:

```ts
/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi } from 'vitest'
import { parseArgs, bootstrapPlatform } from '../create-institution.js'

describe('parseArgs', () => {
  it('parses the platform flags plus optional institution flags', () => {
    const args = parseArgs([
      '--platform-email=staff@rezeta.com',
      '--platform-name=Rezeta Staff',
      '--name=Clínica Norte',
      '--type=clinic',
      '--plan=free',
      '--admin-name=Dra. Ana',
      '--admin-email=ana@clinica.com',
    ])
    expect(args).toEqual({
      platformEmail: 'staff@rezeta.com',
      platformName: 'Rezeta Staff',
      institution: {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
    })
  })

  it('parses a platform-only bootstrap (no institution)', () => {
    const args = parseArgs(['--platform-email=staff@rezeta.com'])
    expect(args.platformEmail).toBe('staff@rezeta.com')
    expect(args.platformName).toBeNull()
    expect(args.institution).toBeNull()
  })

  it('throws when --platform-email is missing', () => {
    expect(() => parseArgs(['--platform-name=Staff'])).toThrow(/platform-email/i)
  })
})

describe('bootstrapPlatform', () => {
  function makeDeps() {
    return {
      authProvider: {
        createUser: vi.fn().mockResolvedValue({ externalUid: 'ext-staff' }),
        generatePasswordResetLink: vi.fn().mockResolvedValue('https://reset/link'),
      },
      platformUsers: { create: vi.fn().mockResolvedValue({ id: 'p1', externalUid: 'ext-staff' }) },
      staff: {
        createInstitution: vi
          .fn()
          .mockResolvedValue({ tenantId: 't1', userId: 'u1', email: 'ana@clinica.com' }),
      },
    }
  }

  it('creates the platform identity (Admin SDK + row + reset link) and returns the link', async () => {
    const deps = makeDeps()
    const result = await bootstrapPlatform(deps as never, {
      platformEmail: 'staff@rezeta.com',
      platformName: 'Rezeta Staff',
      institution: null,
    })
    expect(deps.authProvider.createUser).toHaveBeenCalledWith('staff@rezeta.com')
    expect(deps.platformUsers.create).toHaveBeenCalledWith({
      externalUid: 'ext-staff',
      email: 'staff@rezeta.com',
      fullName: 'Rezeta Staff',
    })
    expect(deps.authProvider.generatePasswordResetLink).toHaveBeenCalledWith('staff@rezeta.com')
    expect(result.platformUserId).toBe('p1')
    expect(result.setPasswordLink).toBe('https://reset/link')
    expect(result.institution).toBeNull()
    expect(deps.staff.createInstitution).not.toHaveBeenCalled()
  })

  it('also creates the first institution attributed to the new platform user', async () => {
    const deps = makeDeps()
    const result = await bootstrapPlatform(deps as never, {
      platformEmail: 'staff@rezeta.com',
      platformName: null,
      institution: {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
    })
    expect(deps.platformUsers.create).toHaveBeenCalledWith({
      externalUid: 'ext-staff',
      email: 'staff@rezeta.com',
      fullName: null,
    })
    expect(deps.staff.createInstitution).toHaveBeenCalledWith(
      {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
      'p1',
    )
    expect(result.institution).toEqual({ tenantId: 't1', userId: 'u1', email: 'ana@clinica.com' })
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
import { PlatformUsersRepository } from '../modules/platform-users/index.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../lib/auth/index.js'

export interface BootstrapArgs {
  platformEmail: string
  platformName: string | null
  institution: CreateInstitutionDto | null
}

export interface BootstrapDeps {
  authProvider: Pick<IAuthProvider, 'createUser' | 'generatePasswordResetLink'>
  platformUsers: Pick<PlatformUsersRepository, 'create'>
  staff: Pick<StaffService, 'createInstitution'>
}

export interface BootstrapResult {
  platformUserId: string
  setPasswordLink: string
  institution: InstitutionCreatedDto | null
}

/**
 * Parses `--platform-email` (required), `--platform-name` (optional), and the
 * optional institution block (`--name`, `--type`, `--plan`, `--admin-name`,
 * `--admin-email` — all required together). Value-set validation for the
 * institution is delegated to CreateInstitutionSchema inside StaffService.
 */
export function parseArgs(argv: string[]): BootstrapArgs {
  const map = new Map<string, string>()
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) map.set(match[1]!, match[2]!)
  }
  const platformEmail = map.get('platform-email')
  if (!platformEmail || platformEmail.trim() === '') {
    throw new Error('Missing required flag --platform-email')
  }
  const instKeys = ['name', 'type', 'plan', 'admin-name', 'admin-email']
  const anyInst = instKeys.some((k) => map.has(k))
  let institution: CreateInstitutionDto | null = null
  if (anyInst) {
    for (const k of instKeys) {
      if (!map.get(k)) throw new Error(`Institution flag --${k} is required when creating one`)
    }
    institution = {
      institutionName: map.get('name')!,
      type: map.get('type')! as CreateInstitutionDto['type'],
      plan: map.get('plan')! as CreateInstitutionDto['plan'],
      adminFullName: map.get('admin-name')!,
      adminEmail: map.get('admin-email')!,
    }
  }
  return {
    platformEmail,
    platformName: map.get('platform-name') ?? null,
    institution,
  }
}

export async function bootstrapPlatform(
  deps: BootstrapDeps,
  args: BootstrapArgs,
): Promise<BootstrapResult> {
  // 1. Control-plane identity: Admin SDK user + platform_users row.
  const { externalUid } = await deps.authProvider.createUser(args.platformEmail)
  const platformUser = await deps.platformUsers.create({
    externalUid,
    email: args.platformEmail,
    fullName: args.platformName,
  })
  const setPasswordLink = await deps.authProvider.generatePasswordResetLink(args.platformEmail)

  // 2. Optionally create the first institution, attributed to this platform user.
  let institution: InstitutionCreatedDto | null = null
  if (args.institution) {
    institution = await deps.staff.createInstitution(args.institution, platformUser.id)
  }

  return { platformUserId: platformUser.id, setPasswordLink, institution }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const deps: BootstrapDeps = {
      authProvider: app.get<IAuthProvider>(AUTH_PROVIDER),
      platformUsers: app.get(PlatformUsersRepository),
      staff: app.get(StaffService),
    }
    const result = await bootstrapPlatform(deps, args)
    // eslint-disable-next-line no-console
    console.log(
      `✓ Platform user ${result.platformUserId} (${args.platformEmail}) created.\n` +
        `  Set-password link: ${result.setPasswordLink}` +
        (result.institution
          ? `\n✓ Institution ${result.institution.tenantId}; super_admin ${result.institution.userId} (${result.institution.email})`
          : ''),
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

> `PlatformUsersRepository` must be resolvable from the app context — it is, because `PlatformUsersModule` is imported (Task 5) and exports it. `AUTH_PROVIDER` is the existing Firebase provider token.

- [ ] **Step 4: Exclude scripts from coverage**

In `apps/api/vitest.config.ts`, add `'src/scripts/**'` to the `coverage.exclude` array (next to `'src/main.ts'`). The `main()` / self-invoke lines require a live Nest context and DB, so the file is excluded from coverage exactly like `main.ts`; the pure `parseArgs`/`bootstrapPlatform` functions are still unit-tested.

- [ ] **Step 5: Add the package script**

In `apps/api/package.json` `scripts`, add:

```json
"bootstrap:platform": "tsx --env-file=../../.env src/scripts/create-institution.ts"
```

> Usage: `pnpm --filter @rezeta/api bootstrap:platform --platform-email=staff@rezeta.com --platform-name="Rezeta Staff"` seeds the first platform user; add the institution flags to also create the first tenant.

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/scripts/__tests__/create-institution.spec.ts`
Expected: PASS (5 cases).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/scripts/create-institution.ts apps/api/src/scripts/__tests__/create-institution.spec.ts apps/api/vitest.config.ts apps/api/package.json
git commit -m "feat(api): dev CLI to seed the first PlatformUser + optional first institution"
```

---

### Task 12: Web mutation hook — `useCreateInstitution`

**Files:**
- Create: `apps/web/src/hooks/staff/use-create-institution.ts`

**Interfaces:**
- Consumes: `apiClient.post` (`apps/web/src/lib/api-client.ts`); `CreateInstitutionDto` / `InstitutionCreatedDto` (`@rezeta/shared`).
- Produces: `useCreateInstitution(): UseMutationResult<InstitutionCreatedDto, Error, CreateInstitutionDto>` posting to `/v1/staff/institutions`.

> `src/hooks/**/use-*.ts` is in the web coverage `exclude` list (TanStack wrappers are integration-tested), so no dedicated unit test — it is exercised via the page test in Task 13.

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

### Task 13: Web staff console — `GET /v1/staff/me` gate + "New institution" screen

**Files:**
- Create: `apps/web/src/hooks/staff/use-staff-me.ts`
- Create: `apps/web/src/components/auth/RequirePlatform.tsx`
- Create: `apps/web/src/components/layout/StaffLayout.tsx`
- Create: `apps/web/src/pages/staff/NewInstitution.tsx`
- Create: `apps/web/src/pages/staff/strings.ts`
- Modify: `apps/web/src/App.tsx` (add the `/staff` route tree, separate from `AppLayout`)
- Test: `apps/web/src/pages/staff/__tests__/NewInstitution.test.tsx`
- Test: `apps/web/src/components/auth/__tests__/RequirePlatform.test.tsx`

**Interfaces:**
- Consumes: `apiClient.get` (`apps/web/src/lib/api-client.ts`); `PlatformPrincipal` (`@rezeta/shared`); `useCreateInstitution` (Task 12); UI components from `@/components/ui` (`Button`, `Field`, `Input`, `Callout`); React Router (`Navigate`, `Outlet`).
- Produces:
  - `useStaffMe()` — a TanStack query hook GETting `/v1/staff/me` (`retry: false`), returning the `PlatformPrincipal`.
  - `RequirePlatform` — route gate that renders children only when `useStaffMe()` succeeds; redirects to `/dashboard` on error/401. **The `AuthUser` no longer carries any platform flag** — the gate is driven entirely by the staff-me query, which 401s for institution users (the isolation guarantee, surfaced client-side).
  - `StaffLayout` (minimal English shell, no Sidebar); `NewInstitution` page at `/staff/institutions/new`.

> `src/pages/**`, `src/components/auth/**`, `src/components/layout/**`, and `src/hooks/**/use-*.ts` are all in the web coverage `exclude` list, so these files are integration-tested (the tests below run and must pass, but do not count toward coverage).

- [ ] **Step 1: Implement the staff-me query hook**

Create `apps/web/src/hooks/staff/use-staff-me.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { PlatformPrincipal } from '@rezeta/shared'

/**
 * Resolves the current platform principal via GET /v1/staff/me. Returns a 401
 * for any non-platform (institution) user — that error is what the RequirePlatform
 * gate keys off. `retry: false` so a 401 fails fast instead of retrying.
 */
export function useStaffMe(): UseQueryResult<PlatformPrincipal, Error> {
  return useQuery({
    queryKey: ['staff', 'me'],
    queryFn: () => apiClient.get<PlatformPrincipal>('/v1/staff/me'),
    retry: false,
  })
}
```

- [ ] **Step 2: Write the failing gate test**

Create `apps/web/src/components/auth/__tests__/RequirePlatform.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mocks = vi.hoisted(() => ({ useStaffMe: vi.fn() }))
vi.mock('@/hooks/staff/use-staff-me', () => ({ useStaffMe: mocks.useStaffMe }))

import { RequirePlatform } from '../RequirePlatform'

function renderGate() {
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route
          path="/staff"
          element={
            <RequirePlatform>
              <div>STAFF AREA</div>
            </RequirePlatform>
          }
        />
        <Route path="/dashboard" element={<div>DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequirePlatform', () => {
  beforeEach(() => mocks.useStaffMe.mockReset())

  it('renders children when the staff-me query succeeds', () => {
    mocks.useStaffMe.mockReturnValue({ data: { id: 'p1' }, isLoading: false, isError: false })
    renderGate()
    expect(screen.getByText('STAFF AREA')).toBeInTheDocument()
  })

  it('redirects to the dashboard when the staff-me query errors (401 for institution users)', () => {
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    renderGate()
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
  })

  it('renders neither while the query is loading', () => {
    mocks.useStaffMe.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    renderGate()
    expect(screen.queryByText('STAFF AREA')).not.toBeInTheDocument()
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the gate test to verify it fails**

Run: `pnpm --filter @rezeta/web exec vitest run src/components/auth/__tests__/RequirePlatform.test.tsx`
Expected: FAIL — cannot resolve `../RequirePlatform`.

- [ ] **Step 4: Implement the gate and layout**

Create `apps/web/src/components/auth/RequirePlatform.tsx`:

```tsx
import type { JSX, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStaffMe } from '@/hooks/staff/use-staff-me'

/**
 * Route gate for the staff console. Passes only when GET /v1/staff/me resolves a
 * platform principal; an institution user's token 401s there, so they are
 * redirected to the institution dashboard. This is a UX gate — the backend
 * AuthGuard/PlatformGuard on @PlatformRoute() is the real authorization boundary.
 */
export function RequirePlatform({ children }: { children: ReactNode }): JSX.Element | null {
  const { data, isLoading, isError } = useStaffMe()
  if (isLoading) return null
  if (isError || !data) return <Navigate to="/dashboard" replace />
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

- [ ] **Step 5: Run the gate test to verify it passes**

Run: `pnpm --filter @rezeta/web exec vitest run src/components/auth/__tests__/RequirePlatform.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 6: Write the failing page test**

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

- [ ] **Step 7: Run the page test to verify it fails**

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/staff/__tests__/NewInstitution.test.tsx`
Expected: FAIL — cannot resolve `../NewInstitution`.

- [ ] **Step 8: Implement the strings and page**

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
  successBody: (email: string): string => `A set-password email was sent to ${email}.`,
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

const SELECT_CLASS = 'h-9 w-full rounded-sm border border-n-200 bg-n-0 px-3 text-sm text-n-800'

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

- [ ] **Step 9: Run the page test to verify it passes**

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/staff/__tests__/NewInstitution.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 10: Wire the routes in `App.tsx`**

In `apps/web/src/App.tsx`, add imports near the other page imports:

```tsx
import { StaffLayout } from '@/components/layout/StaffLayout'
import { RequirePlatform } from '@/components/auth/RequirePlatform'
import { NewInstitution } from '@/pages/staff/NewInstitution'
```

Add a new top-level route object to the `createBrowserRouter([...])` array — **outside** the `AppLayout` children, so the staff console does not share the institution shell — placed just before the catch-all `{ path: '*', element: <NotFound /> }` entry:

```tsx
  // ── Staff console (platform staff only; separate from the app shell) ────────
  {
    element: (
      <AuthGate>
        <RequirePlatform>
          <StaffLayout />
        </RequirePlatform>
      </AuthGate>
    ),
    errorElement: <NotFound />,
    children: [
      { path: 'staff', element: <Navigate to="/staff/institutions/new" replace /> },
      { path: 'staff/institutions/new', element: <NewInstitution /> },
    ],
  },
```

> `AuthGate` still runs first (the user must be signed in with Firebase); `RequirePlatform` then confirms the signed-in identity is a platform principal via `GET /v1/staff/me`.

- [ ] **Step 11: Typecheck + run the two new web test files**

Run: `pnpm --filter @rezeta/web exec tsc --noEmit`
Expected: PASS.

Run: `pnpm --filter @rezeta/web exec vitest run src/pages/staff src/components/auth/__tests__/RequirePlatform.test.tsx`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/hooks/staff/use-staff-me.ts apps/web/src/components/auth/RequirePlatform.tsx apps/web/src/components/layout/StaffLayout.tsx apps/web/src/pages/staff apps/web/src/App.tsx apps/web/src/components/auth/__tests__/RequirePlatform.test.tsx
git commit -m "feat(web): staff console — GET /v1/staff/me gate + New institution screen"
```

---

### Task 14: Full gates + changelog

**Files:**
- Modify: `CHANGELOG.md` (prepend an entry)

- [ ] **Step 1: Run the full lint + test gates**

Run: `pnpm lint`
Expected: PASS (zero errors).

Run: `pnpm test`
Expected: PASS (all packages green, including the new staff/guard/schema/platform-user suites).

- [ ] **Step 2: Run coverage to confirm the 95% per-file gate**

Run: `pnpm test:coverage`
Expected: PASS. The new counted files (`staff.service.ts`, `staff.controller.ts`, `platform.guard.ts`, `tenant.guard.ts`, `auth.guard.ts`, `packages/shared/src/schemas/staff.ts`, `apps/api/src/modules/users/users.service.ts`) all meet 95%. `staff.module.ts`, `platform-users.module.ts`, `*/index.ts`, `platform-users.repository.ts`, the decorators, `create-institution.ts` (scripts), the web pages/gate/layout, and the `use-*.ts` hooks are covered by existing coverage `exclude` entries. `PlatformPrincipal` is a pure type (no runtime).

- [ ] **Step 3: Prepend the changelog entry**

Prepend to `CHANGELOG.md` (English, per the language rule):

```markdown
## [2026-07-15] Staff platform + platform identity

### Added
- `PlatformUser` control-plane identity (`packages/db/prisma/schema.prisma` + migration `20260715040000_platform_users`) — Rezeta staff are a separate table with no `tenant_id`, keyed by Firebase `externalUid`, so a platform principal can never be returned by a tenant-scoped query. Shared `PlatformPrincipal` type in `packages/shared/src/types/auth.ts`.
- `@PlatformRoute()` decorator (`IS_PLATFORM_ROUTE_KEY`) + `@CurrentPlatformUser()` param decorator. `AuthGuard` resolves a `PlatformUser` on `@PlatformRoute()` endpoints and sets `request.platformUser` (401 if missing/inactive); `TenantGuard` skips those routes; new global `PlatformGuard` (2nd guard) requires `request.platformUser` (403 `FORBIDDEN` otherwise). Guard order: `AuthGuard → PlatformGuard → TenantGuard → PermissionGuard`.
- `PlatformUsersModule` + `PlatformUsersRepository` (`findByExternalUid`, `create`).
- Staff platform module (`apps/api/src/modules/staff/`) with `POST /v1/staff/institutions` and `GET /v1/staff/me`, all `@PlatformRoute()`. Create-institution builds the `Tenant`, seeds `RolePermission` defaults + starter data, and mints the initial `super_admin` via the users provisioning flow (Admin SDK + set-password email) with `actorUserId: null` + `bypassRankCheck`; audits with `actorType: 'system'` and the acting `PlatformUser` id in metadata.
- `CreateInstitutionSchema` + `InstitutionCreatedSchema` in `packages/shared/src/schemas/staff.ts`.
- Dev CLI `apps/api/src/scripts/create-institution.ts` (`pnpm --filter @rezeta/api bootstrap:platform`) to seed the first `PlatformUser` (Admin SDK user + row + set-password link) and optionally the first institution.
- Web staff console: `RequirePlatform` route gate (driven by `GET /v1/staff/me`), `useStaffMe` hook, `StaffLayout`, and the English "New institution" screen at `/staff/institutions/new`, plus the `useCreateInstitution` hook. Kept separate from the institution app shell.

### Changed
- `UsersService.createUser` accepts an opt-in `{ bypassRankCheck }` option and a nullable `actorUserId`, used by the platform bootstrap to create the first `super_admin`.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for staff platform + platform identity slice"
```

---

## Self-Review

**Spec coverage (design §7/§8 + revision brief §Platform identity):**
- Platform staff as a separate `PlatformUser` table (control plane, no `tenant_id`): Task 2 (model + migration `20260715040000`, sorted after Slice 5's `20260715030000`). ✓
- Shared `PlatformPrincipal` + `AuthenticatedRequest.platformUser?`: Tasks 3 + 6. ✓
- `@PlatformRoute()` + `IS_PLATFORM_ROUTE_KEY` (mirrors `public.decorator.ts`): Task 4. ✓
- `PlatformUsersRepository` (`findByExternalUid`, `create`): Task 5. ✓
- `AuthGuard` branch (resolve PlatformUser → set `request.platformUser`; 401 if missing/inactive; else institution path): Task 6, with the exact edit against the real `auth.guard.ts` (insert after the provision block, before institution resolution). ✓
- `TenantGuard` skip on platform routes (single-arg constructor; no cross-tenant override): Task 7, exact edit against the real `tenant.guard.ts`. ✓
- New global `PlatformGuard` (require `request.platformUser`, else 403 `FORBIDDEN`; no-op otherwise), registered right after `AuthGuard`; final order `AuthGuard → PlatformGuard → TenantGuard → PermissionGuard`: Task 8. ✓
- The former cross-tenant header bypass and the institution platform-flag mechanism are fully removed. ✓ (No task reuses either; verified by grep in the report.)
- Security tests re-framed: (a) platform token cannot use a tenant endpoint (Task 6 institution path still resolves a `User`; a platform token resolves none → 401) and the AuthGuard 401 case for a non-PlatformUser on a staff route; (b) a tenant user cannot use `/v1/staff/*` (AuthGuard 401 in Task 6 + PlatformGuard 403 in Task 8). Ordinary-user tenant isolation is intact (TenantGuard still pins `request.tenantId = request.user.tenantId` on all non-platform routes). ✓
- Staff module: all `/v1/staff/*` `@PlatformRoute()`; `POST /v1/staff/institutions` creates Tenant + seeds RolePermission defaults + starter data + initial `super_admin` via `UsersService.createUser(tenantId, 'super_admin', null, dto, { bypassRankCheck: true })` (actor is a PlatformUser → `actorUserId: null`; audit `actorType: 'system'` with PlatformUser id in metadata); `GET /v1/staff/me` returns the `PlatformPrincipal`: Task 10. ✓
- Bootstrap CLI creates a `PlatformUser` (Admin SDK + row + set-password link) and optionally the first institution; seeds the first platform user: Task 11. ✓
- Frontend gates the staff console on `GET /v1/staff/me` (`RequirePlatform` renamed from `RequirePlatformAdmin`) via `useStaffMe`; the institution app keeps `/v1/auth/me`: Task 13. ✓
- Non-goal added: cross-tenant access to institution DATA by platform staff (support impersonation) is out of scope this milestone. ✓ (Header + Out-of-scope section.)

**Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step carries complete code; every command has expected output. Prior-slice dependencies (Task 9's Slice-5 `createUser`, the Slice-5 migration timestamp) are flagged explicitly with concrete edit shapes — unavoidable, as those files are authored by earlier slices.

**Type consistency:** `CreateInstitutionDto`/`InstitutionCreatedDto` (Task 1) are used identically in Tasks 10–13. `PlatformPrincipal` (Task 3) flows through `AuthenticatedRequest` (Task 6), `@CurrentPlatformUser()` (Task 4), the staff controller (Task 10), and the web hook/gate (Task 13). `StaffService.createInstitution(dto, actorPlatformUserId: string | null)` is consistent across Tasks 10 and 11. `createUser(tenantId, 'super_admin', null, dto, { bypassRankCheck: true })` matches Task 9's produced signature `(tenantId, actorRole, actorUserId: string | null, dto, options?)` (5 args, `ManagedUserDto` return). No institution platform-flag field and no cross-tenant header override remain anywhere in the plan.
