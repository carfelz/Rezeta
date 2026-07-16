# Permissions Slice 5 — Provisioning Rework + Users Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove public self-signup and its auto-tenant-creation. Users are now created internally by an `admin`/`super_admin` (or staff) who picks the role at creation time: the backend creates the Firebase account via the Admin SDK, writes a fully-provisioned `User` row with the returned `externalUid`, and sends a set-password link. Sign In stays; a new set-password / first-login screen lets the invited user set a password and land signed-in. All user-management endpoints enforce the rank rule (`canManageRole`) and tenant scoping.

**Architecture:** `IAuthProvider` gains `createUser(email)` and `generatePasswordResetLink(email)` (Firebase Admin SDK, confined to `firebase-auth.provider.ts`). `UsersRepository.provisionUser` stops creating tenants — it resolves an existing `User` by `externalUid` (created earlier by `createUser`) or rejects `USER_NOT_PROVISIONED`. A reworked `UsersService` adds `listUsers` / `createUser` / `changeRole` / `setActive`, each guarding `canManageRole(actorRole, targetRole)` and emitting audit events; a new `UsersManagementController` exposes them under `/v1/users`, annotated with slice-3's `@RequirePermission('users', …)`. The frontend drops the `/signup` route/page and the `signUp` store/auth-client entry, adds a `/establecer-contrasena` set-password screen (Firebase `confirmPasswordReset`), and adds a `/ajustes/usuarios` Users page gated by `useCan('users','manage')`.

**Tech Stack:** Prisma/PostgreSQL, NestJS, Firebase Admin SDK (`firebase-admin@^12`), Firebase Web SDK (`firebase/auth`), Zod, React + React Router + TanStack Query + Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-15-permissions-multi-user-design.md` (§5, §10) · Shared contracts: `scratchpad/permissions-contracts.md`

**Depends on (must be merged first):**
- Slice 1 — `UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'` in `packages/shared/src/types/auth.ts`; `ROLE_RANK` + `canManageRole(actorRole, targetRole)` in `packages/shared/src/permissions/roles.ts`, exported from `@rezeta/shared`. `AuthUser.role` widened. `User.role` DB default `'assistant'`.
- Slice 3 — `@RequirePermission(module, level)` in `apps/api/src/common/decorators/require-permission.decorator.js` and the registered `PermissionGuard`. `ErrorCode.INSUFFICIENT_PERMISSION`.
- Slice 4 — `useCan(module, level)` in `apps/web/src/hooks/use-can.ts`.

If a dependency symbol is missing when a step runs, STOP — the prerequisite slice is not merged.

## Global Constraints

- Monorepo packages: `@rezeta/shared`, `@rezeta/db`, `@rezeta/api`, `@rezeta/web`. 2-space indent, `snake_case` DB columns, `camelCase` TS.
- Error codes live in the closed enum `packages/shared/src/errors.ts`.
- Repository layer always filters by `tenant_id`. Soft deletes (`deleted_at` / `is_active`) — never hard-delete `User`.
- User-facing strings in Spanish, colocated in `strings.ts` files. All other prose (code, comments, docs, commits, CHANGELOG) in English. No raw hex/px in components — Tailwind token classes only (`text-n-700`, `bg-p-500`, `border-n-200`, `rounded-sm`); no arbitrary `prop-[value]` classes.
- No `TODO`/`FIXME`/`HACK`/`XXX` comments (ESLint `no-warning-comments` fails CI).
- Every task ends green: `pnpm lint` and the touched package's tests pass. Final task runs `pnpm test:coverage` (95% per-file gate).
- Commit messages: conventional commits, **lower-case subject** (commitlint enforces `subject-case`). End the body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Do NOT push.
- API response envelope is `{ data: ... }` (the web `apiClient` unwraps `body['data']`).
- Firebase Admin lives only in `apps/api/src/lib/auth/firebase-auth.provider.ts`; Firebase Web only in `apps/web/src/lib/auth/firebase-auth-client.ts`. Tests mock both.
- After the final task, prepend a `CHANGELOG.md` entry (English).

---

### Task 1: Audit actions — `role_changed` · `user_invited` · `user_deactivated`

**Files:**
- Modify: `apps/api/src/common/audit-log/audit-log.types.ts`

**Interfaces:**
- Extends `AuditAuthAction` with `'role_changed' | 'user_invited' | 'user_deactivated'`. These flow through the existing `AuditAction` union and `AuditLogService.record`. Category for all three is `'auth'`.

- [ ] **Step 1: Add the three actions to the auth-action union**

In `apps/api/src/common/audit-log/audit-log.types.ts`, extend `AuditAuthAction`:

```typescript
export type AuditAuthAction =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'mfa_enabled'
  | 'session_revoked'
  | 'permission_granted'
  | 'permission_revoked'
  | 'role_changed'
  | 'user_invited'
  | 'user_deactivated'
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @rezeta/api exec tsc --noEmit`
Expected: PASS (pure type addition, no consumers yet).

- [ ] **Step 3: Commit**

Run: `git add -A && git commit -m "feat(audit): add user-management auth actions"`

---

### Task 2: Shared schemas — CreateUser · ChangeRole · SetActive · ManagedUser

**Files:**
- Create: `packages/shared/src/schemas/user-management.ts`
- Create: `packages/shared/src/schemas/__tests__/user-management.spec.ts`
- Modify: `packages/shared/src/schemas/index.ts` (add export)

**Interfaces:**
- Produces `UserRoleSchema` (`z.enum(['assistant','doctor','admin','super_admin'])`), `CreateUserSchema`/`CreateUserDto`, `ChangeRoleSchema`/`ChangeRoleDto`, `SetActiveSchema`/`SetActiveDto`, `ManagedUserSchema`/`ManagedUserDto`. All later tasks (API + web) import these from `@rezeta/shared`.
- The four-role enum literals here MUST match slice-1's `UserRole` union exactly.

- [ ] **Step 1: Write the failing schema test**

`packages/shared/src/schemas/__tests__/user-management.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  CreateUserSchema,
  ChangeRoleSchema,
  SetActiveSchema,
} from '../user-management.js'

describe('CreateUserSchema', () => {
  it('accepts a valid invite payload', () => {
    const r = CreateUserSchema.safeParse({
      email: 'nurse@clinic.do',
      fullName: 'Ana Reyes',
      role: 'assistant',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown role', () => {
    const r = CreateUserSchema.safeParse({
      email: 'x@y.do',
      fullName: 'X',
      role: 'owner',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const r = CreateUserSchema.safeParse({ email: 'nope', fullName: 'X Y', role: 'doctor' })
    expect(r.success).toBe(false)
  })

  it('rejects a too-short name', () => {
    const r = CreateUserSchema.safeParse({ email: 'a@b.do', fullName: 'A', role: 'doctor' })
    expect(r.success).toBe(false)
  })
})

describe('ChangeRoleSchema', () => {
  it('accepts a valid role', () => {
    expect(ChangeRoleSchema.safeParse({ role: 'admin' }).success).toBe(true)
  })
  it('rejects an unknown role', () => {
    expect(ChangeRoleSchema.safeParse({ role: 'root' }).success).toBe(false)
  })
})

describe('SetActiveSchema', () => {
  it('accepts a boolean', () => {
    expect(SetActiveSchema.safeParse({ isActive: false }).success).toBe(true)
  })
  it('rejects a non-boolean', () => {
    expect(SetActiveSchema.safeParse({ isActive: 'no' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared test -- user-management`
Expected: FAIL — `Cannot find module '../user-management.js'`.

- [ ] **Step 3: Write the schema file**

`packages/shared/src/schemas/user-management.ts`:

```typescript
import { z } from 'zod'

/**
 * The four institution roles (see permissions design §3). Kept in sync with the
 * `UserRole` union in ../types/auth.ts. Values are validated in Zod because the
 * DB column is a plain String (no Prisma enum).
 */
export const UserRoleSchema = z.enum(['assistant', 'doctor', 'admin', 'super_admin'])

export const CreateUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  fullName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede superar 200 caracteres'),
  role: UserRoleSchema,
})

export const ChangeRoleSchema = z.object({
  role: UserRoleSchema,
})

export const SetActiveSchema = z.object({
  isActive: z.boolean(),
})

// ── API response schema (a user listed in the institution roster) ─────────────
export const ManagedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
})

export type UserRoleValue = z.infer<typeof UserRoleSchema>
export type CreateUserDto = z.infer<typeof CreateUserSchema>
export type ChangeRoleDto = z.infer<typeof ChangeRoleSchema>
export type SetActiveDto = z.infer<typeof SetActiveSchema>
export type ManagedUserDto = z.infer<typeof ManagedUserSchema>
```

- [ ] **Step 4: Export from the schemas barrel**

In `packages/shared/src/schemas/index.ts`, add (keep alphabetical-ish with siblings):

```typescript
export * from './user-management.js'
```

- [ ] **Step 5: Run test + typecheck to verify green**

Run: `pnpm --filter @rezeta/shared test -- user-management && pnpm --filter @rezeta/shared exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add -A && git commit -m "feat(shared): add user-management schemas"`

---

### Task 3: `IAuthProvider` — `createUser` + `generatePasswordResetLink`

**Files:**
- Modify: `apps/api/src/lib/auth/auth-provider.interface.ts`
- Modify: `apps/api/src/lib/auth/firebase-auth.provider.ts`
- Create: `apps/api/src/lib/auth/__tests__/firebase-auth.provider.spec.ts`

**Interfaces:**
- Adds to `IAuthProvider`:
  - `createUser(email: string): Promise<{ externalUid: string }>`
  - `generatePasswordResetLink(email: string): Promise<string>`
- Every existing inline mock of `IAuthProvider` in the API test suite (e.g. `auth.service.spec.ts`) must gain the two new stub methods — done in Task 8's test edits.

- [ ] **Step 1: Extend the interface**

In `apps/api/src/lib/auth/auth-provider.interface.ts`, add to `IAuthProvider` (after `deleteUser`):

```typescript
  /**
   * Create an identity record in the auth provider for an invited user.
   * Returns the provider UID to store on the User row. No password is set —
   * the user establishes one via the set-password link (generatePasswordResetLink).
   */
  createUser(email: string): Promise<{ externalUid: string }>

  /**
   * Generate a set-password / first-login link (a password-reset link) for the
   * given email. The caller emails it (or, in dev, logs it).
   */
  generatePasswordResetLink(email: string): Promise<string>
```

- [ ] **Step 2: Write the failing provider test**

`apps/api/src/lib/auth/__tests__/firebase-auth.provider.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InternalServerErrorException } from '@nestjs/common'
import { FirebaseAuthProvider } from '../firebase-auth.provider.js'

const createUser = vi.fn()
const generatePasswordResetLink = vi.fn()

function makeProvider(withApp = true): FirebaseAuthProvider {
  const config = { get: vi.fn(() => ({})) }
  const provider = new FirebaseAuthProvider(config as never)
  // Inject a fake firebase app exposing the auth() methods we call.
  ;(provider as unknown as { app: unknown }).app = withApp
    ? { auth: () => ({ createUser, generatePasswordResetLink }) }
    : null
  return provider
}

describe('FirebaseAuthProvider.createUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates the identity and returns its uid', async () => {
    createUser.mockResolvedValue({ uid: 'fb-new' })
    const provider = makeProvider()
    const result = await provider.createUser('nurse@clinic.do')
    expect(createUser).toHaveBeenCalledWith({ email: 'nurse@clinic.do' })
    expect(result).toEqual({ externalUid: 'fb-new' })
  })

  it('throws when the app is not initialized', async () => {
    const provider = makeProvider(false)
    await expect(provider.createUser('x@y.do')).rejects.toThrow(InternalServerErrorException)
  })
})

describe('FirebaseAuthProvider.generatePasswordResetLink', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the link from the Admin SDK', async () => {
    generatePasswordResetLink.mockResolvedValue('https://reset.example/abc')
    const provider = makeProvider()
    const link = await provider.generatePasswordResetLink('nurse@clinic.do')
    expect(generatePasswordResetLink).toHaveBeenCalledWith('nurse@clinic.do')
    expect(link).toBe('https://reset.example/abc')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- firebase-auth.provider`
Expected: FAIL — `createUser`/`generatePasswordResetLink` are not functions.

- [ ] **Step 4: Implement in FirebaseAuthProvider**

In `apps/api/src/lib/auth/firebase-auth.provider.ts`, add two methods (after `deleteUser`), mirroring the existing `!this.app` guard style:

```typescript
  async createUser(email: string): Promise<{ externalUid: string }> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      const record = await this.app.auth().createUser({ email })
      return { externalUid: record.uid }
    } catch (err) {
      this.logger.error(`Failed to create user ${email}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to create user in auth provider',
      })
    }
  }

  async generatePasswordResetLink(email: string): Promise<string> {
    if (!this.app) {
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Auth provider not initialized',
      })
    }
    try {
      return await this.app.auth().generatePasswordResetLink(email)
    } catch (err) {
      this.logger.error(`Failed to generate reset link for ${email}: ${(err as Error).message}`)
      throw new InternalServerErrorException({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Failed to generate set-password link',
      })
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api test -- firebase-auth.provider`
Expected: PASS.

- [ ] **Step 6: Commit**

Run: `git add -A && git commit -m "feat(auth): add createUser and generatePasswordResetLink to auth provider"`

---

### Task 4: `UsersRepository` rework — no tenant auto-create; add roster CRUD

**Files:**
- Modify: `apps/api/src/modules/users/users.repository.ts`
- Modify: `apps/api/src/modules/users/__tests__/users.repository.spec.ts`

**Interfaces:**
- `provisionUser(verified: VerifiedToken): Promise<UserWithTenant>` — NO profile arg, NO tenant/user creation. Finds by `externalUid`; if found returns it; else throws `UnauthorizedException({ code: USER_NOT_PROVISIONED })`. (First sign-in of an invited user simply finds the row `createUser` already wrote — no linking, no tenant creation.)
- New:
  - `listByTenant(tenantId: string): Promise<User[]>` — active-scoped roster (`deletedAt: null`), ordered by `createdAt`.
  - `findByIdInTenant(id: string, tenantId: string): Promise<User | null>` — same as `findById` (already exists; reuse it; no new method needed).
  - `createProvisionedUser(input: { tenantId: string; externalUid: string; email: string; fullName: string; role: string }): Promise<User>`.
  - `updateRole(id: string, tenantId: string, role: string): Promise<void>`.
  - `setActive(id: string, tenantId: string, isActive: boolean): Promise<void>` — soft-deactivate: sets `isActive` and, when deactivating, stamps `deletedAt`.

- [ ] **Step 1: Rewrite the failing repository tests**

Replace the entire `describe('provisionUser', …)` block in `apps/api/src/modules/users/__tests__/users.repository.spec.ts` (the old tenant-creation / profile-backfill / race-condition cases no longer apply) and add roster cases. Also drop `mockTx` from the mock (no more `$transaction`). New relevant portions:

```typescript
import { UnauthorizedException } from '@nestjs/common'

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}
// ...
describe('provisionUser', () => {
  it('returns the existing user for a known externalUid', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser)
    const result = await repo.provisionUser(verified)
    expect(result).toEqual(existingUser)
  })

  it('rejects USER_NOT_PROVISIONED when no user row exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    await expect(repo.provisionUser(verified)).rejects.toThrow(UnauthorizedException)
  })

  it('never creates a tenant', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(existingUser)
    await repo.provisionUser(verified)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })
})

describe('listByTenant', () => {
  it('lists active users for the tenant ordered by createdAt', async () => {
    mockPrisma.user.findMany.mockResolvedValue([existingUser])
    const result = await repo.listByTenant('t1')
    expect(result).toEqual([existingUser])
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
  })
})

describe('createProvisionedUser', () => {
  it('creates a user row with the supplied externalUid and role', async () => {
    const created = { ...existingUser, id: 'u2', role: 'assistant' }
    mockPrisma.user.create.mockResolvedValue(created)
    const result = await repo.createProvisionedUser({
      tenantId: 't1',
      externalUid: 'fb-new',
      email: 'nurse@clinic.do',
      fullName: 'Ana Reyes',
      role: 'assistant',
    })
    expect(result).toEqual(created)
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: {
        tenantId: 't1',
        externalUid: 'fb-new',
        email: 'nurse@clinic.do',
        fullName: 'Ana Reyes',
        role: 'assistant',
      },
    })
  })
})

describe('updateRole', () => {
  it('updates role with a tenant filter', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
    await repo.updateRole('u1', 't1', 'admin')
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', tenantId: 't1', deletedAt: null },
      data: { role: 'admin' },
    })
  })
})

describe('setActive', () => {
  it('deactivating stamps deletedAt and clears isActive', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
    await repo.setActive('u1', 't1', false)
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', tenantId: 't1' },
      data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
    })
  })

  it('reactivating clears deletedAt and sets isActive', async () => {
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
    await repo.setActive('u1', 't1', true)
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', tenantId: 't1' },
      data: { isActive: true, deletedAt: null },
    })
  })
})
```

Keep the existing `findById`, `updateProfile`, `findByExternalUid` describe blocks unchanged.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- users.repository`
Expected: FAIL — new methods missing; `provisionUser` still creates a tenant.

- [ ] **Step 3: Rewrite `provisionUser` and add roster methods**

In `apps/api/src/modules/users/users.repository.ts`:

Add `UnauthorizedException` and `ErrorCode` imports:

```typescript
import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
```

Replace the whole `provisionUser` method with:

```typescript
  /**
   * Resolve the DB user for a verified token. Users are provisioned internally
   * (UsersService.createUser writes the row with its externalUid), so first
   * sign-in simply finds the existing row. A verified Firebase token with no DB
   * user is rejected — there is no auto-tenant-creation anymore.
   */
  async provisionUser(verified: VerifiedToken): Promise<UserWithTenant> {
    const existing = await this.prisma.user.findUnique({
      where: { externalUid: verified.externalUid, deletedAt: null },
      include: TENANT_SELECT,
    })
    if (!existing) {
      throw new UnauthorizedException({
        code: ErrorCode.USER_NOT_PROVISIONED,
        message: 'User has not been provisioned.',
      })
    }
    return existing
  }
```

Add the roster methods:

```typescript
  async listByTenant(tenantId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    })
  }

  async createProvisionedUser(input: {
    tenantId: string
    externalUid: string
    email: string
    fullName: string
    role: string
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        externalUid: input.externalUid,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
      },
    })
  }

  async updateRole(id: string, tenantId: string, role: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, tenantId, deletedAt: null },
      data: { role },
    })
  }

  async setActive(id: string, tenantId: string, isActive: boolean): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, tenantId },
      data: isActive ? { isActive: true, deletedAt: null } : { isActive: false, deletedAt: new Date() },
    })
  }
```

Remove the now-unused `Prisma` import if the compiler flags it (the profile-backfill code that used `Prisma.UserUpdateManyMutationInput` is gone). Keep `Prisma` only if `updatePreferences` still uses `Prisma.InputJsonValue` — it does, so keep the import.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm --filter @rezeta/api test -- users.repository`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -A && git commit -m "refactor(users): drop tenant auto-provision, add roster repository methods"`

---

### Task 5: Invitation mailer (dev-path stub)

**Files:**
- Create: `apps/api/src/modules/users/invitation-mailer.service.ts`
- Create: `apps/api/src/modules/users/__tests__/invitation-mailer.service.spec.ts`

**Interfaces:**
- `InvitationMailerService.sendSetPasswordEmail(email: string, link: string): Promise<void>` — in dev/test it logs the link instead of emailing. This is the single seam a real transactional-email provider replaces later.

- [ ] **Step 1: Write the failing test**

`apps/api/src/modules/users/__tests__/invitation-mailer.service.spec.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { InvitationMailerService } from '../invitation-mailer.service.js'

describe('InvitationMailerService', () => {
  it('logs the set-password link (dev path)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const mailer = new InvitationMailerService()
    await mailer.sendSetPasswordEmail('nurse@clinic.do', 'https://reset.example/abc')
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('nurse@clinic.do'),
    )
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('https://reset.example/abc'))
    spy.mockRestore()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- invitation-mailer`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mailer**

`apps/api/src/modules/users/invitation-mailer.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common'

/**
 * Sends the set-password / first-login email to an invited user.
 *
 * There is no transactional-email provider wired yet, so this logs the link in
 * dev/test. Replace the body with a real send when email infrastructure lands;
 * the call site (UsersService.createUser) does not change.
 */
@Injectable()
export class InvitationMailerService {
  private readonly logger = new Logger(InvitationMailerService.name)

  async sendSetPasswordEmail(email: string, link: string): Promise<void> {
    this.logger.log(`Set-password email for ${email}: ${link}`)
    return Promise.resolve()
  }
}
```

- [ ] **Step 4: Run test to verify green**

Run: `pnpm --filter @rezeta/api test -- invitation-mailer`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -A && git commit -m "feat(users): add invitation mailer stub"`

---

### Task 6: `UsersService` — list / create / changeRole / setActive with the rank rule

**Files:**
- Modify: `apps/api/src/modules/users/users.service.ts`
- Modify: `apps/api/src/modules/users/__tests__/users.service.spec.ts`

**Interfaces:**
- Constructor gains `AUTH_PROVIDER` (`IAuthProvider`), `AuditLogService`, `InvitationMailerService`.
- `listUsers(tenantId: string): Promise<ManagedUserDto[]>`.
- `createUser(tenantId: string, actorRole: UserRole, actorUserId: string, dto: CreateUserDto): Promise<ManagedUserDto>` — enforces `canManageRole(actorRole, dto.role)` (else `ForbiddenException({ code: FORBIDDEN })`); creates Firebase user; writes provisioned row with returned `externalUid`; generates + sends set-password link; emits `user_invited` audit.
- `changeRole(tenantId, actorRole, actorUserId, targetUserId, dto: ChangeRoleDto): Promise<ManagedUserDto>` — enforces `canManageRole` against BOTH the target's current role AND the new role; emits `role_changed`.
- `setActive(tenantId, actorRole, actorUserId, targetUserId, dto: SetActiveDto): Promise<ManagedUserDto>` — enforces `canManageRole` against the target's current role; emits `user_deactivated` (on deactivate).

**Rank-rule detail:** an actor may only touch a user whose role rank is strictly below the actor's, and may only assign a role strictly below the actor's. `canManageRole(actor, target)` returns `ROLE_RANK[target] < ROLE_RANK[actor]`.

- [ ] **Step 1: Extend the failing service test**

Add to `apps/api/src/modules/users/__tests__/users.service.spec.ts`. Extend the mock repo and add provider/audit/mailer mocks, then rank-rule + createUser cases:

```typescript
import { ForbiddenException } from '@nestjs/common'

const mockRepo = {
  findById: vi.fn(),
  updateProfile: vi.fn(),
  updatePreferences: vi.fn(),
  listByTenant: vi.fn(),
  createProvisionedUser: vi.fn(),
  updateRole: vi.fn(),
  setActive: vi.fn(),
}
const mockProvider = {
  createUser: vi.fn(),
  generatePasswordResetLink: vi.fn(),
}
const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }
const mockMailer = { sendSetPasswordEmail: vi.fn().mockResolvedValue(undefined) }

function makeService(): UsersService {
  return new UsersService(
    mockRepo as never,
    mockProvider as never,
    mockAudit as never,
    mockMailer as never,
  )
}

describe('UsersService.createUser — rank rule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider.createUser.mockResolvedValue({ externalUid: 'fb-new' })
    mockProvider.generatePasswordResetLink.mockResolvedValue('https://reset/abc')
    mockRepo.createProvisionedUser.mockResolvedValue({
      id: 'u2',
      email: 'nurse@clinic.do',
      fullName: 'Ana Reyes',
      role: 'assistant',
      isActive: true,
      createdAt: new Date('2026-07-15'),
    })
  })

  it('admin can create a doctor (below admin)', async () => {
    const svc = makeService()
    await svc.createUser('t1', 'admin', 'actor', {
      email: 'doc@clinic.do',
      fullName: 'Dr. Nuevo',
      role: 'doctor',
    })
    expect(mockProvider.createUser).toHaveBeenCalledWith('doc@clinic.do')
    expect(mockRepo.createProvisionedUser).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', externalUid: 'fb-new', role: 'doctor' }),
    )
    expect(mockMailer.sendSetPasswordEmail).toHaveBeenCalledWith('doc@clinic.do', 'https://reset/abc')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_invited', category: 'auth', tenantId: 't1' }),
    )
  })

  it('admin CANNOT create another admin (same rank)', async () => {
    const svc = makeService()
    await expect(
      svc.createUser('t1', 'admin', 'actor', {
        email: 'a@b.do',
        fullName: 'Same Rank',
        role: 'admin',
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(mockProvider.createUser).not.toHaveBeenCalled()
  })

  it('admin CANNOT create a super_admin (higher rank)', async () => {
    const svc = makeService()
    await expect(
      svc.createUser('t1', 'admin', 'actor', {
        email: 'a@b.do',
        fullName: 'Higher',
        role: 'super_admin',
      }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('super_admin can create an admin', async () => {
    const svc = makeService()
    await svc.createUser('t1', 'super_admin', 'actor', {
      email: 'admin@clinic.do',
      fullName: 'New Admin',
      role: 'admin',
    })
    expect(mockRepo.createProvisionedUser).toHaveBeenCalled()
  })
})

describe('UsersService.changeRole — rank rule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'assistant' })
    mockRepo.updateRole.mockResolvedValue(undefined)
  })

  it('admin can promote an assistant to doctor', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValueOnce({ id: 'u2', role: 'assistant' })
    mockRepo.findById.mockResolvedValueOnce({
      id: 'u2',
      email: 'a@b.do',
      fullName: 'A',
      role: 'doctor',
      isActive: true,
      createdAt: new Date('2026-07-15'),
    })
    await svc.changeRole('t1', 'admin', 'actor', 'u2', { role: 'doctor' })
    expect(mockRepo.updateRole).toHaveBeenCalledWith('u2', 't1', 'doctor')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role_changed' }),
    )
  })

  it('admin CANNOT change an admin peer', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'admin' })
    await expect(
      svc.changeRole('t1', 'admin', 'actor', 'u2', { role: 'doctor' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('admin CANNOT promote an assistant to admin (target new role too high)', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'assistant' })
    await expect(
      svc.changeRole('t1', 'admin', 'actor', 'u2', { role: 'admin' }),
    ).rejects.toThrow(ForbiddenException)
  })
})

describe('UsersService.setActive — rank rule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('super_admin can deactivate an admin and audits it', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValueOnce({ id: 'u2', role: 'admin' })
    mockRepo.findById.mockResolvedValueOnce({
      id: 'u2',
      email: 'a@b.do',
      fullName: 'A',
      role: 'admin',
      isActive: false,
      createdAt: new Date('2026-07-15'),
    })
    mockRepo.setActive.mockResolvedValue(undefined)
    await svc.setActive('t1', 'super_admin', 'actor', 'u2', { isActive: false })
    expect(mockRepo.setActive).toHaveBeenCalledWith('u2', 't1', false)
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_deactivated' }),
    )
  })

  it('admin CANNOT deactivate a super_admin', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'super_admin' })
    await expect(
      svc.setActive('t1', 'admin', 'actor', 'u2', { isActive: false }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws NotFound when the target user is absent', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue(null)
    await expect(
      svc.setActive('t1', 'super_admin', 'actor', 'missing', { isActive: false }),
    ).rejects.toThrow()
  })
})
```

Note: the existing `getById` / `updateProfile` / `getPreferences` / `updatePreferences` describe blocks stay, but their `new UsersService(mockRepo as never)` construction must be updated to the new 4-arg `makeService()` — replace the local `service = new UsersService(mockRepo as never)` in the top `beforeEach` with `service = makeService()`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- users.service`
Expected: FAIL — new methods + constructor args missing.

- [ ] **Step 3: Implement the service methods**

In `apps/api/src/modules/users/users.service.ts`, update imports + constructor and add the methods:

```typescript
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common'
import type { User } from '@rezeta/db'
import {
  ErrorCode,
  UserPreferencesSchema,
  canManageRole,
  type UpdateProfileDto,
  type UpdateUserPreferencesDto,
  type UserPreferences,
  type UserRole,
  type CreateUserDto,
  type ChangeRoleDto,
  type SetActiveDto,
  type ManagedUserDto,
} from '@rezeta/shared'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { UsersRepository } from './users.repository.js'
import { InvitationMailerService } from './invitation-mailer.service.js'

@Injectable()
export class UsersService {
  constructor(
    @Inject(UsersRepository) private repository: UsersRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(InvitationMailerService) private mailer: InvitationMailerService,
  ) {}
```

Add a private mapper and the four methods (keep existing profile/preferences methods unchanged):

```typescript
  async listUsers(tenantId: string): Promise<ManagedUserDto[]> {
    const users = await this.repository.listByTenant(tenantId)
    return users.map(toManagedUser)
  }

  async createUser(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string,
    dto: CreateUserDto,
  ): Promise<ManagedUserDto> {
    this.assertCanManage(actorRole, dto.role)

    const { externalUid } = await this.authProvider.createUser(dto.email)
    const created = await this.repository.createProvisionedUser({
      tenantId,
      externalUid,
      email: dto.email,
      fullName: dto.fullName,
      role: dto.role,
    })

    const link = await this.authProvider.generatePasswordResetLink(dto.email)
    await this.mailer.sendSetPasswordEmail(dto.email, link)

    void this.auditLog.record({
      tenantId,
      actorUserId,
      actorType: 'user',
      category: 'auth',
      action: 'user_invited',
      entityType: 'User',
      entityId: created.id,
      metadata: { role: dto.role },
      status: 'success',
    })

    return toManagedUser(created)
  }

  async changeRole(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string,
    targetUserId: string,
    dto: ChangeRoleDto,
  ): Promise<ManagedUserDto> {
    const target = await this.requireUser(targetUserId, tenantId)
    // Actor must outrank both the current role and the new role.
    this.assertCanManage(actorRole, target.role as UserRole)
    this.assertCanManage(actorRole, dto.role)

    await this.repository.updateRole(targetUserId, tenantId, dto.role)
    void this.auditLog.record({
      tenantId,
      actorUserId,
      actorType: 'user',
      category: 'auth',
      action: 'role_changed',
      entityType: 'User',
      entityId: targetUserId,
      changes: { role: { before: target.role, after: dto.role } },
      status: 'success',
    })
    const updated = await this.requireUser(targetUserId, tenantId)
    return toManagedUser(updated)
  }

  async setActive(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string,
    targetUserId: string,
    dto: SetActiveDto,
  ): Promise<ManagedUserDto> {
    const target = await this.requireUser(targetUserId, tenantId)
    this.assertCanManage(actorRole, target.role as UserRole)

    await this.repository.setActive(targetUserId, tenantId, dto.isActive)
    if (!dto.isActive) {
      void this.auditLog.record({
        tenantId,
        actorUserId,
        actorType: 'user',
        category: 'auth',
        action: 'user_deactivated',
        entityType: 'User',
        entityId: targetUserId,
        status: 'success',
      })
    }
    return toManagedUser({ ...target, isActive: dto.isActive })
  }

  private assertCanManage(actorRole: UserRole, targetRole: UserRole): void {
    if (!canManageRole(actorRole, targetRole)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You may only manage users below your role.',
      })
    }
  }

  private async requireUser(id: string, tenantId: string): Promise<User> {
    const user = await this.repository.findById(id, tenantId)
    if (!user) {
      throw new NotFoundException({ code: ErrorCode.USER_NOT_FOUND, message: `User ${id} not found` })
    }
    return user
  }
```

At the bottom of the file, add the mapper:

```typescript
function toManagedUser(user: {
  id: string
  email: string
  fullName: string | null
  role: string
  isActive: boolean
  createdAt: Date
}): ManagedUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as ManagedUserDto['role'],
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }
}
```

Note: `setActive` returns the target with the new `isActive` optimistically (avoids a second read); the `deletedAt`/timestamp is DB-side only and not part of `ManagedUserDto`.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm --filter @rezeta/api test -- users.service`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -A && git commit -m "feat(users): add roster service with rank-rule enforcement"`

---

### Task 7: `UsersManagementController` — `/v1/users` endpoints

**Files:**
- Create: `apps/api/src/modules/users/users-management.controller.ts`
- Create: `apps/api/src/modules/users/__tests__/users-management.controller.spec.ts`

**Interfaces:**
- `@Controller('v1/users')`, `@RequirePermission('users', …)` per method (slice 3 enforces the capability; the service enforces the rank rule):
  - `GET /v1/users` → `listUsers(tenantId)` — `@RequirePermission('users', 'view')`.
  - `POST /v1/users` (body `CreateUserSchema`) → `createUser(...)` — `@RequirePermission('users', 'manage')`.
  - `PATCH /v1/users/:id/role` (body `ChangeRoleSchema`) → `changeRole(...)` — `'manage'`.
  - `PATCH /v1/users/:id/active` (body `SetActiveSchema`) → `setActive(...)` — `'manage'`.
- Uses `@CurrentUser() user: AuthUser` for `user.tenantId`, `user.role`, `user.id`.

- [ ] **Step 1: Write the failing controller test**

`apps/api/src/modules/users/__tests__/users-management.controller.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import type { AuthUser } from '@rezeta/shared'
import { UsersManagementController } from '../users-management.controller.js'

const mockSvc = {
  listUsers: vi.fn(),
  createUser: vi.fn(),
  changeRole: vi.fn(),
  setActive: vi.fn(),
}

const admin: AuthUser = {
  id: 'actor',
  externalUid: 'ext',
  tenantId: 't1',
  email: 'admin@clinic.do',
  fullName: 'Admin',
  role: 'admin',
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
  preferences: {},
} as never

describe('UsersManagementController', () => {
  let controller: UsersManagementController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new UsersManagementController(mockSvc as never)
  })

  it('GET /v1/users lists the tenant roster', async () => {
    mockSvc.listUsers.mockResolvedValue([{ id: 'u2' }])
    const result = await controller.list(admin)
    expect(mockSvc.listUsers).toHaveBeenCalledWith('t1')
    expect(result).toEqual([{ id: 'u2' }])
  })

  it('POST /v1/users forwards actor role + tenant to the service', async () => {
    mockSvc.createUser.mockResolvedValue({ id: 'u2' })
    const dto = { email: 'doc@clinic.do', fullName: 'Dr. Nuevo', role: 'doctor' as const }
    await controller.create(admin, dto)
    expect(mockSvc.createUser).toHaveBeenCalledWith('t1', 'admin', 'actor', dto)
  })

  it('propagates FORBIDDEN when the service rejects an under-privileged actor', async () => {
    mockSvc.createUser.mockRejectedValue(new ForbiddenException({ code: 'FORBIDDEN' }))
    await expect(
      controller.create(admin, { email: 'a@b.do', fullName: 'Same', role: 'admin' as const }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('PATCH /v1/users/:id/role forwards ids and body', async () => {
    mockSvc.changeRole.mockResolvedValue({ id: 'u2' })
    await controller.changeRole(admin, 'u2', { role: 'doctor' as const })
    expect(mockSvc.changeRole).toHaveBeenCalledWith('t1', 'admin', 'actor', 'u2', { role: 'doctor' })
  })

  it('PATCH /v1/users/:id/active forwards ids and body', async () => {
    mockSvc.setActive.mockResolvedValue({ id: 'u2' })
    await controller.setActive(admin, 'u2', { isActive: false })
    expect(mockSvc.setActive).toHaveBeenCalledWith('t1', 'admin', 'actor', 'u2', { isActive: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api test -- users-management.controller`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controller**

`apps/api/src/modules/users/users-management.controller.ts`:

```typescript
import { Body, Controller, Get, Inject, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreateUserSchema,
  ChangeRoleSchema,
  SetActiveSchema,
  type AuthUser,
  type UserRole,
  type CreateUserDto,
  type ChangeRoleDto,
  type SetActiveDto,
  type ManagedUserDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { UsersService } from './users.service.js'

@ApiTags('Users')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/users')
export class UsersManagementController {
  constructor(@Inject(UsersService) private svc: UsersService) {}

  @Get()
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'List users in the institution' })
  @ApiResponse({ status: 200 })
  async list(@CurrentUser() user: AuthUser): Promise<ManagedUserDto[]> {
    return this.svc.listUsers(user.tenantId)
  }

  @Post()
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: 'Invite a user (create Firebase account + provisioned row)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 403, description: 'Actor may only create roles below their own.' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
  ): Promise<ManagedUserDto> {
    return this.svc.createUser(user.tenantId, user.role as UserRole, user.id, dto)
  }

  @Patch(':id/role')
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: "Change a user's role" })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async changeRole(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ChangeRoleSchema)) dto: ChangeRoleDto,
  ): Promise<ManagedUserDto> {
    return this.svc.changeRole(user.tenantId, user.role as UserRole, user.id, id, dto)
  }

  @Patch(':id/active')
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: 'Activate or deactivate a user (soft-deactivate)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  async setActive(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetActiveSchema)) dto: SetActiveDto,
  ): Promise<ManagedUserDto> {
    return this.svc.setActive(user.tenantId, user.role as UserRole, user.id, id, dto)
  }
}
```

- [ ] **Step 4: Run test to verify green**

Run: `pnpm --filter @rezeta/api test -- users-management.controller`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add -A && git commit -m "feat(users): add /v1/users management controller"`

---

### Task 8: Wire the module + simplify provision; adjust existing auth tests

**Files:**
- Modify: `apps/api/src/modules/users/users.module.ts`
- Modify: `apps/api/src/modules/users/index.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts` (drop profile arg)
- Modify: `apps/api/src/modules/auth/auth.controller.ts` (drop profile extraction; update Swagger role enum)
- Modify: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`
- Modify: `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`
- Modify: `apps/api/src/modules/onboarding/__tests__/onboarding.service.spec.ts` and `apps/api/src/modules/onboarding/__tests__/onboarding.spec.ts` (only if they assert tenant auto-creation)

**Interfaces:**
- `UsersModule` registers `UsersManagementController` + `InvitationMailerService`. It must import `AuditLogModule` (for `AuditLogService`) — check how other feature modules obtain `AuditLogService`; if it is provided by a `@Global()` module, no import is needed. `AUTH_PROVIDER` is already global (`@Global() AuthModule`).
- `AuthService.provision(verified, meta?)` — profile param removed.

- [ ] **Step 1: Confirm AuditLogService provisioning**

Run: `grep -rn "AuditLogModule\|Global" apps/api/src/common/audit-log/`
If `AuditLogModule` is `@Global()`, `UsersModule` needs no explicit import. Otherwise add `imports: [AuditLogModule]`. Apply whichever the codebase requires in Step 2.

- [ ] **Step 2: Update `UsersModule`**

`apps/api/src/modules/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common'
import { UsersController } from './users.controller.js'
import { UsersManagementController } from './users-management.controller.js'
import { UsersService } from './users.service.js'
import { UsersRepository } from './users.repository.js'
import { InvitationMailerService } from './invitation-mailer.service.js'

@Module({
  controllers: [UsersController, UsersManagementController],
  providers: [UsersService, UsersRepository, InvitationMailerService],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
```

(Add `imports: [AuditLogModule]` here if Step 1 showed `AuditLogModule` is not global.)

Add to `apps/api/src/modules/users/index.ts`:

```typescript
export { UsersManagementController } from './users-management.controller.js'
export { InvitationMailerService } from './invitation-mailer.service.js'
```

- [ ] **Step 3: Simplify `AuthService.provision`**

In `apps/api/src/modules/auth/auth.service.ts`, drop the `profile` param and pass-through:

```typescript
  async provision(verified: VerifiedToken, meta?: ProvisionMeta): Promise<UserWithTenant> {
    const user = await this.repository.provisionUser(verified)
    void this.auditLog.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      actorType: 'user',
      category: 'auth',
      action: 'login',
      ...(meta?.ip ? { ipAddress: meta.ip } : {}),
      ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
      ...(meta?.requestId ? { requestId: meta.requestId } : {}),
      status: 'success',
    })
    return user
  }
```

- [ ] **Step 4: Simplify `AuthController.provision`**

In `apps/api/src/modules/auth/auth.controller.ts`, remove the `profile` extraction and the `@Body()` param; call `this.service.provision(verified, meta)`. Update the `@ApiOperation`/`@ApiResponse` description to note it resolves the existing user and rejects `USER_NOT_PROVISIONED` (no creation). Update the `me` Swagger `role` enum from `['owner','doctor']` to `['assistant','doctor','admin','super_admin']`.

- [ ] **Step 5: Fix the affected auth tests**

- `auth.service.spec.ts`: the `provision` cases call `service.provision(verified)` / `service.provision(verified, meta)`; update the `provisionUser` assertion from `toHaveBeenCalledWith(verified, undefined)` to `toHaveBeenCalledWith(verified)`. Add the two new provider stub methods (`createUser`, `generatePasswordResetLink`) to `mockAuthProvider`. Change `baseUser.role` sample values from `'owner'` to a valid new role (e.g. `'super_admin'`) so `toAuthUser` mapping stays representative.
- `auth.controller.spec.ts`: remove the two "passes profile fields" / "ignores non-string body" cases and the third `{}` argument in the remaining `provision` assertions (now `toHaveBeenCalledWith(decoded, expect.objectContaining({ ip }))` with no profile). Update `controller.provision(decoded, req)` call signature (no body arg). Change `role: 'owner'` fixtures to `'super_admin'`.

- [ ] **Step 6: Fix onboarding tests if they assert auto-creation**

Run: `grep -rn "provisionUser\|tenant.create\|role: 'owner'" apps/api/src/modules/onboarding/__tests__/`
Onboarding calls `users.findByExternalUid` (unchanged) — it should not depend on `provisionUser`. If any fixture uses `role: 'owner'`, switch to a valid new role. Make only the edits the failing run reveals.

- [ ] **Step 7: Run the full API suite**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS. Fix any remaining `owner`-role or profile-arg fallout the run surfaces.

- [ ] **Step 8: Commit**

Run: `git add -A && git commit -m "refactor(auth): resolve-only provision, wire users management module"`

---

### Task 9: Frontend — remove public signup

**Files:**
- Delete: `apps/web/src/pages/Signup/` (whole folder: `index.tsx`, `strings.ts`)
- Modify: `apps/web/src/App.tsx` (drop the `/signup` route + `Signup` import)
- Modify: `apps/web/src/store/auth.store.ts` (remove `signUp`, `_pendingProfile`, `_consumePendingProfile`, `SignupProfile`)
- Modify: `apps/web/src/providers/AuthProvider.tsx` (drop pending-profile consumption)
- Modify: `apps/web/src/lib/auth/auth-client.interface.ts` (remove `signUp`)
- Modify: `apps/web/src/lib/auth/firebase-auth-client.ts` (remove `signUp` + `createUserWithEmailAndPassword` import)
- Modify: `apps/web/src/pages/Login/index.tsx` + `apps/web/src/pages/Login/strings.ts` (remove the "¿No tienes cuenta? Regístrate" link)
- Modify: `packages/shared/src/schemas/auth.ts` (remove `SignUpSchema` + `SignUpDto`)
- Modify: `apps/web/src/store/__tests__/auth.store.actions.test.ts` (delete the `signUp` describe block)
- Modify: `apps/web/src/lib/auth/__tests__/firebase-auth-client.test.ts` (delete the `signUp` describe block + mock)
- Modify: `apps/web/src/providers/__tests__/providers.test.tsx` (remove `signUp` mock; drop any pending-profile assertion)

**Interfaces:**
- `IAuthClient` loses `signUp`. `useAuthStore` loses `signUp`/`_pendingProfile`/`_consumePendingProfile`. `AuthProvider` always provisions with an empty body.

- [ ] **Step 1: Remove `signUp` from the store**

Rewrite `apps/web/src/store/auth.store.ts`, deleting `SignupProfile`, `_pendingProfile`, `_consumePendingProfile`, and `signUp` from both the interface and the implementation. Keep `signIn`, `signOut`, `setPreferences`, `setUser`, and the `_set*` setters.

- [ ] **Step 2: Simplify `AuthProvider`**

In `apps/web/src/providers/AuthProvider.tsx`, replace the profile-consuming block with a fixed empty body:

```typescript
          const { apiClient } = await import('@/lib/api-client')
          const user = await apiClient.post<AuthUser>('/v1/auth/provision', {})
          _setUser(user)
          _setStatus('authenticated')
```

- [ ] **Step 3: Remove `signUp` from the auth client**

In `apps/web/src/lib/auth/auth-client.interface.ts`, delete the `signUp` member. In `apps/web/src/lib/auth/firebase-auth-client.ts`, delete the `signUp` method and remove `createUserWithEmailAndPassword` from the `firebase/auth` import.

- [ ] **Step 4: Remove signup route + page**

In `apps/web/src/App.tsx`, delete the `Signup` import and the `/signup` route object. Then delete the folder: `rm -rf apps/web/src/pages/Signup`.

- [ ] **Step 5: Remove the Login → signup link**

In `apps/web/src/pages/Login/index.tsx`, delete the trailing `<p>…{loginStrings.noAccount} … <Link to="/signup">{loginStrings.signupLink}</Link></p>` block (and the now-unused `Link` import if nothing else uses it). Remove `noAccount` + `signupLink` from `apps/web/src/pages/Login/strings.ts`.

- [ ] **Step 6: Remove `SignUpSchema` from shared**

In `packages/shared/src/schemas/auth.ts`, delete `SignUpSchema` and `export type SignUpDto`.

- [ ] **Step 7: Prune the affected tests**

- `apps/web/src/store/__tests__/auth.store.actions.test.ts`: delete the entire `describe('useAuthStore — signUp', …)` block and the `signUp` entry from the hoisted mocks + the `@/lib/auth` mock object.
- `apps/web/src/lib/auth/__tests__/firebase-auth-client.test.ts`: delete the `describe('signUp', …)` block, the `createUserWithEmailAndPassword` hoisted mock, and its entry in the `firebase/auth` `vi.mock`.
- `apps/web/src/providers/__tests__/providers.test.tsx`: remove `signUp: vi.fn()` from the auth-client mock; if any assertion checks pending-profile behavior in provision, replace it with an assertion that provision is posted with `{}`.

- [ ] **Step 8: Run web + shared suites**

Run: `pnpm --filter @rezeta/web test && pnpm --filter @rezeta/shared test`
Expected: PASS. Grep to confirm nothing else references the removed symbols:
`grep -rn "signUp\|SignUpSchema\|/signup\|_pendingProfile" apps/web/src packages/shared/src` → no hits (except this plan).

- [ ] **Step 9: Commit**

Run: `git add -A && git commit -m "feat(web): remove public self-signup"`

---

### Task 10: Frontend — set-password / first-login screen

**Files:**
- Modify: `apps/web/src/lib/auth/auth-client.interface.ts` (add `verifyPasswordResetCode`, `confirmPasswordReset`)
- Modify: `apps/web/src/lib/auth/firebase-auth-client.ts` (implement both)
- Modify: `apps/web/src/lib/auth/__tests__/firebase-auth-client.test.ts` (cover both)
- Create: `apps/web/src/pages/SetPassword/index.tsx`
- Create: `apps/web/src/pages/SetPassword/strings.ts`
- Create: `apps/web/src/pages/SetPassword/index.tsx` test → `apps/web/src/pages/SetPassword/__tests__/SetPassword.test.tsx`
- Modify: `apps/web/src/App.tsx` (add the `/establecer-contrasena` public-only route)

**Interfaces:**
- `IAuthClient` gains:
  - `verifyPasswordResetCode(oobCode: string): Promise<string>` — returns the account email.
  - `confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>`.
- Flow: the invited user opens the emailed link `…/establecer-contrasena?oobCode=…`; the page verifies the code (→ email), takes a new password, calls `confirmPasswordReset`, then `signIn(email, newPassword)`, then navigates to `/dashboard` (the `onAuthStateChanged` → provision finds their row).

- [ ] **Step 1: Add the two methods to the interface**

In `apps/web/src/lib/auth/auth-client.interface.ts`, add:

```typescript
  /** Verify a password-reset (set-password) code; resolves to the account email. */
  verifyPasswordResetCode(oobCode: string): Promise<string>

  /** Complete a password reset / first-login set-password with the given code. */
  confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>
```

- [ ] **Step 2: Write failing client tests**

Add to `apps/web/src/lib/auth/__tests__/firebase-auth-client.test.ts` — add hoisted mocks `verifyPasswordResetCode`, `confirmPasswordReset`, register them in the `firebase/auth` `vi.mock`, and:

```typescript
  describe('verifyPasswordResetCode', () => {
    it('returns the email for a valid code', async () => {
      m.verifyPasswordResetCode.mockResolvedValue('nurse@clinic.do')
      const email = await client.verifyPasswordResetCode('oob-1')
      expect(m.verifyPasswordResetCode).toHaveBeenCalledWith(expect.anything(), 'oob-1')
      expect(email).toBe('nurse@clinic.do')
    })
  })

  describe('confirmPasswordReset', () => {
    it('delegates to firebase confirmPasswordReset', async () => {
      m.confirmPasswordReset.mockResolvedValue(undefined)
      await client.confirmPasswordReset('oob-1', 'NewPass123')
      expect(m.confirmPasswordReset).toHaveBeenCalledWith(expect.anything(), 'oob-1', 'NewPass123')
    })
  })
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm --filter @rezeta/web test -- firebase-auth-client`
Expected: FAIL.

- [ ] **Step 4: Implement the two methods**

In `apps/web/src/lib/auth/firebase-auth-client.ts`, add to the `firebase/auth` import: `verifyPasswordResetCode as fbVerifyPasswordResetCode, confirmPasswordReset as fbConfirmPasswordReset`, then:

```typescript
  async verifyPasswordResetCode(oobCode: string): Promise<string> {
    return fbVerifyPasswordResetCode(this.auth, oobCode)
  }

  async confirmPasswordReset(oobCode: string, newPassword: string): Promise<void> {
    await fbConfirmPasswordReset(this.auth, oobCode, newPassword)
  }
```

- [ ] **Step 5: Run to verify green**

Run: `pnpm --filter @rezeta/web test -- firebase-auth-client`
Expected: PASS.

- [ ] **Step 6: Add the set-password strings**

`apps/web/src/pages/SetPassword/strings.ts`:

```typescript
export const setPasswordStrings = {
  title: 'Crea tu contraseña',
  subtitle: 'Establece una contraseña para acceder a tu cuenta.',
  fieldPassword: 'Contraseña',
  fieldPasswordPlaceholder: 'Mínimo 8 caracteres',
  fieldConfirm: 'Confirmar contraseña',
  fieldConfirmPlaceholder: 'Repite la contraseña',
  submit: 'Guardar y entrar',
  submitting: 'Guardando...',
  verifying: 'Verificando el enlace...',
  invalidLink: 'El enlace no es válido o ya expiró. Solicita uno nuevo a tu administrador.',
  passwordTooShort: 'La contraseña debe tener al menos 8 caracteres',
  passwordMismatch: 'Las contraseñas no coinciden',
  genericError: 'No se pudo guardar la contraseña. Intenta de nuevo.',
} as const
```

- [ ] **Step 7: Write the failing page test**

`apps/web/src/pages/SetPassword/__tests__/SetPassword.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
  signIn: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  authClient: {
    verifyPasswordResetCode: mocks.verifyPasswordResetCode,
    confirmPasswordReset: mocks.confirmPasswordReset,
    signIn: mocks.signIn,
    errorCodeToMessage: (c: string) => c,
  },
}))

vi.mock('react-router-dom', async (orig) => {
  const actual = (await orig()) as object
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [new URLSearchParams({ oobCode: 'oob-1' })],
  }
})

import { SetPassword } from '../index'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.verifyPasswordResetCode.mockResolvedValue('nurse@clinic.do')
  mocks.confirmPasswordReset.mockResolvedValue(undefined)
  mocks.signIn.mockResolvedValue(undefined)
})

describe('SetPassword', () => {
  it('sets the password then signs in and navigates to dashboard', async () => {
    render(<SetPassword />)
    await waitFor(() => expect(mocks.verifyPasswordResetCode).toHaveBeenCalledWith('oob-1'))

    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }))

    await waitFor(() => {
      expect(mocks.confirmPasswordReset).toHaveBeenCalledWith('oob-1', 'NewPass123')
      expect(mocks.signIn).toHaveBeenCalledWith('nurse@clinic.do', 'NewPass123')
      expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('shows a mismatch error and does not submit', async () => {
    render(<SetPassword />)
    await waitFor(() => expect(mocks.verifyPasswordResetCode).toHaveBeenCalled())
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), {
      target: { value: 'Different1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('shows an invalid-link message when the code cannot be verified', async () => {
    mocks.verifyPasswordResetCode.mockRejectedValue(new Error('expired'))
    render(<SetPassword />)
    await waitFor(() =>
      expect(
        screen.getByText(/El enlace no es válido o ya expiró/),
      ).toBeInTheDocument(),
    )
  })
})
```

- [ ] **Step 8: Run to verify fail**

Run: `pnpm --filter @rezeta/web test -- SetPassword`
Expected: FAIL — module not found.

- [ ] **Step 9: Implement the page**

`apps/web/src/pages/SetPassword/index.tsx` — mirror the `Login` page structure (Card + Field + Input + Button + Callout, token classes only):

```typescript
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authClient } from '@/lib/auth'
import { Card, Field, Input, Button, Callout } from '@/components/ui'
import { setPasswordStrings } from './strings'

export function SetPassword(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const oobCode = searchParams.get('oobCode') ?? ''

  const [email, setEmail] = useState<string | null>(null)
  const [linkValid, setLinkValid] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    void (async () => {
      if (!oobCode) {
        if (active) setLinkValid(false)
        return
      }
      try {
        const verifiedEmail = await authClient.verifyPasswordResetCode(oobCode)
        if (!active) return
        setEmail(verifiedEmail)
        setLinkValid(true)
      } catch {
        if (active) setLinkValid(false)
      }
    })()
    return () => {
      active = false
    }
  }, [oobCode])

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(setPasswordStrings.passwordTooShort)
      return
    }
    if (password !== confirm) {
      setError(setPasswordStrings.passwordMismatch)
      return
    }
    if (!email) return
    setSubmitting(true)
    try {
      await authClient.confirmPasswordReset(oobCode, password)
      await authClient.signIn(email, password)
      void navigate('/dashboard', { replace: true })
    } catch {
      setError(setPasswordStrings.genericError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-400">
        <div className="mb-6 text-center">
          <div className="w-touch-min h-touch-min bg-p-500 rounded-lg flex items-center justify-center font-serif text-h2 font-medium text-n-0 mx-auto mb-4">
            R
          </div>
          <h1 className="text-h2">{setPasswordStrings.title}</h1>
          <p className="text-body-sm mt-1">{setPasswordStrings.subtitle}</p>
        </div>

        {linkValid === null && (
          <p className="text-body-sm text-center text-n-500">{setPasswordStrings.verifying}</p>
        )}

        {linkValid === false && (
          <Callout variant="danger" icon={<i className="ph ph-warning" />}>
            {setPasswordStrings.invalidLink}
          </Callout>
        )}

        {linkValid === true && (
          <form
            onSubmit={(e) => {
              void handleSubmit(e)
            }}
            className="flex flex-col gap-4"
          >
            <Field label={setPasswordStrings.fieldPassword}>
              <Input
                id="set-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={setPasswordStrings.fieldPasswordPlaceholder}
                autoComplete="new-password"
                autoFocus
              />
            </Field>

            <Field label={setPasswordStrings.fieldConfirm}>
              <Input
                id="set-password-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={setPasswordStrings.fieldConfirmPlaceholder}
                autoComplete="new-password"
              />
            </Field>

            {error && (
              <Callout variant="danger" icon={<i className="ph ph-warning" />}>
                {error}
              </Callout>
            )}

            <Button
              variant="primary"
              size="lg"
              type="submit"
              disabled={submitting}
              className="w-full justify-center text-n-0"
            >
              {submitting ? setPasswordStrings.submitting : setPasswordStrings.submit}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
```

- [ ] **Step 10: Wire the route**

In `apps/web/src/App.tsx`, import `SetPassword` and add a public-only route beside `/login`:

```typescript
  {
    path: '/establecer-contrasena',
    element: (
      <PublicOnlyGate>
        <SetPassword />
      </PublicOnlyGate>
    ),
  },
```

- [ ] **Step 11: Run web suite**

Run: `pnpm --filter @rezeta/web test -- SetPassword firebase-auth-client`
Expected: PASS.

- [ ] **Step 12: Commit**

Run: `git add -A && git commit -m "feat(web): add set-password first-login screen"`

---

### Task 11: Frontend — Users page under `/ajustes/usuarios`

**Files:**
- Create: `apps/web/src/hooks/users/use-users.ts`
- Create: `apps/web/src/pages/settings/Users.tsx`
- Create: `apps/web/src/pages/settings/__tests__/Users.test.tsx`
- Modify: `apps/web/src/pages/settings/strings.ts` (add `usersStrings` + a Settings-menu label/description)
- Modify: `apps/web/src/App.tsx` (add `/ajustes/usuarios` route)
- Modify: `apps/web/src/pages/Settings.tsx` (add the roster link, gated by `useCan('users','view')`)

**Interfaces:**
- `use-users.ts` (TanStack Query, mirrors `use-locations.ts`):
  - `useUsers(): UseQueryResult<ManagedUserDto[], Error>` → `GET /v1/users`.
  - `useCreateUser(): UseMutationResult<ManagedUserDto, Error, CreateUserDto>` → `POST /v1/users`.
  - `useChangeUserRole(id): UseMutationResult<ManagedUserDto, Error, ChangeRoleDto>` → `PATCH /v1/users/:id/role`.
  - `useSetUserActive(id): UseMutationResult<ManagedUserDto, Error, SetActiveDto>` → `PATCH /v1/users/:id/active`.
- `Users.tsx` is gated by `useCan('users','manage')`; when the check is false it renders nothing actionable (an `EmptyState`/redirect), so an `assistant` cannot reach the create form.

- [ ] **Step 1: Add strings**

In `apps/web/src/pages/settings/strings.ts`, add to `settingsStrings` a `usersTitle`/`usersDescription`, and a new export:

```typescript
export const usersStrings = {
  pageTitle: 'Usuarios',
  newButton: 'Nuevo usuario',
  emptyTitle: 'Sin usuarios',
  emptyDescription: 'Invita al primer miembro de tu equipo.',
  noAccessTitle: 'Sin acceso',
  noAccessDescription: 'No tienes permiso para gestionar usuarios.',
  loading: 'Cargando usuarios...',
  loadError: 'No se pudieron cargar los usuarios.',
  tableName: 'Nombre',
  tableEmail: 'Correo',
  tableRole: 'Rol',
  tableStatus: 'Estado',
  statusActive: 'Activo',
  statusInactive: 'Inactivo',
  activateButton: 'Activar',
  deactivateButton: 'Desactivar',
  formTitle: 'Nuevo usuario',
  nameLabel: 'Nombre completo',
  namePlaceholder: 'Ej. Ana Reyes',
  emailLabel: 'Correo electrónico',
  emailPlaceholder: 'usuario@clinica.do',
  roleLabel: 'Rol',
  roleAssistant: 'Asistente',
  roleDoctor: 'Doctor',
  roleAdmin: 'Administrador',
  roleSuperAdmin: 'Propietario',
  cancelButton: 'Cancelar',
  createButton: 'Crear usuario',
  creatingButton: 'Creando...',
  createError: 'No se pudo crear el usuario. Intenta de nuevo.',
  createSuccess: 'Usuario creado. Se envió un enlace para crear la contraseña.',
} as const
```

- [ ] **Step 2: Write the failing hooks + page test**

`apps/web/src/pages/settings/__tests__/Users.test.tsx` (mirror `Types.test.tsx` mocking style; also mock `useCan`):

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const mocks = vi.hoisted(() => ({
  useUsers: vi.fn(),
  useCreateUser: vi.fn(),
  useChangeUserRole: vi.fn(),
  useSetUserActive: vi.fn(),
  useCan: vi.fn(),
  createMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/users/use-users', () => ({
  useUsers: mocks.useUsers,
  useCreateUser: mocks.useCreateUser,
  useChangeUserRole: mocks.useChangeUserRole,
  useSetUserActive: mocks.useSetUserActive,
}))

vi.mock('@/hooks/use-can', () => ({ useCan: mocks.useCan }))

import { Users } from '../Users'

const roster = [
  {
    id: 'u2',
    email: 'nurse@clinic.do',
    fullName: 'Ana Reyes',
    role: 'assistant' as const,
    isActive: true,
    createdAt: '2026-07-15T00:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useCan.mockReturnValue(true)
  mocks.useUsers.mockReturnValue({ data: roster, isLoading: false, isError: false })
  mocks.createMutateAsync.mockResolvedValue({ ...roster[0], id: 'u3' })
  mocks.useCreateUser.mockReturnValue({ mutateAsync: mocks.createMutateAsync, isPending: false })
  mocks.useChangeUserRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.useSetUserActive.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
})

describe('Users page — manager', () => {
  it('submits the create form with email, name and role', async () => {
    render(<Users />)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/i }))
    fireEvent.change(screen.getByPlaceholderText('Ej. Ana Reyes'), {
      target: { value: 'Dr. Nuevo' },
    })
    fireEvent.change(screen.getByPlaceholderText('usuario@clinica.do'), {
      target: { value: 'doc@clinic.do' },
    })
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'doctor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => {
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        email: 'doc@clinic.do',
        fullName: 'Dr. Nuevo',
        role: 'doctor',
      })
    })
  })

  it('lists existing users', () => {
    render(<Users />)
    expect(screen.getByText('Ana Reyes')).toBeInTheDocument()
    expect(screen.getByText('nurse@clinic.do')).toBeInTheDocument()
  })
})

describe('Users page — assistant (no manage capability)', () => {
  it('cannot reach the create form', () => {
    mocks.useCan.mockReturnValue(false)
    render(<Users />)
    expect(screen.queryByRole('button', { name: /Nuevo usuario/i })).not.toBeInTheDocument()
    expect(screen.getByText('Sin acceso')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run to verify fail**

Run: `pnpm --filter @rezeta/web test -- settings/__tests__/Users`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement the hooks**

`apps/web/src/hooks/users/use-users.ts` (mirror `use-locations.ts`; toasts optional — reuse `sonner` only if a matching `toastStrings` entry exists, otherwise handle errors in the page):

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ManagedUserDto, CreateUserDto, ChangeRoleDto, SetActiveDto } from '@rezeta/shared'

const QK = 'users'

export function useUsers(): UseQueryResult<ManagedUserDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<ManagedUserDto[]>('/v1/users'),
  })
}

export function useCreateUser(): UseMutationResult<ManagedUserDto, Error, CreateUserDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateUserDto) => apiClient.post<ManagedUserDto>('/v1/users', dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useChangeUserRole(
  id: string,
): UseMutationResult<ManagedUserDto, Error, ChangeRoleDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: ChangeRoleDto) =>
      apiClient.patch<ManagedUserDto>(`/v1/users/${id}/role`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useSetUserActive(
  id: string,
): UseMutationResult<ManagedUserDto, Error, SetActiveDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: SetActiveDto) =>
      apiClient.patch<ManagedUserDto>(`/v1/users/${id}/active`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
```

- [ ] **Step 5: Implement the page**

`apps/web/src/pages/settings/Users.tsx` — model on `Locations.tsx` (page + create modal, token classes only). Gate with `useCan`:

- Top of component: `const canManage = useCan('users', 'manage')`.
- If `!canManage`, render an `EmptyState` titled `usersStrings.noAccessTitle` / `usersStrings.noAccessDescription` and NO "Nuevo usuario" button and NO form.
- Otherwise: header with `usersStrings.newButton`, a table (`tableName`/`tableEmail`/`tableRole`/`tableStatus`) rendering `useUsers().data`, an active/inactive `Badge`, an activate/deactivate `Button` per row (calls `useSetUserActive(row.id)`), and a create `Modal` whose form has `Input` (name), `Input` (email), and a native `<select id="user-role" aria-label={usersStrings.roleLabel}>` with the four roles, submitting `{ email, fullName, role }` via `useCreateUser`.
- Wrap the role `<select>` in a `Field label={usersStrings.roleLabel}` and give it `aria-label={usersStrings.roleLabel}` so the test's `getByLabelText('Rol')` resolves.
- Handle create errors into a `Callout` using `usersStrings.createError` and log via `logger.error` (context `'Users.submit'`).

- [ ] **Step 6: Wire the route + settings link**

In `apps/web/src/App.tsx`, add `import { Users } from '@/pages/settings/Users'` and the route `{ path: 'ajustes/usuarios', element: <Users /> }` inside the protected `AppLayout` children (beside `ajustes/ubicaciones`).

In `apps/web/src/pages/Settings.tsx`, add a roster `<Link to="/ajustes/usuarios">` in the settings menu `Card`, gated so it only renders when `useCan('users', 'view')` is true:

```tsx
{useCan('users', 'view') && (
  <Link
    to="/ajustes/usuarios"
    className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-fast"
  >
    <i className="ph ph-users text-h3 text-p-500" />
    <div>
      <div className="text-sm font-semibold">{settingsStrings.usersTitle}</div>
      <div className="text-xs text-n-500">{settingsStrings.usersDescription}</div>
    </div>
    <i className="ph ph-caret-right ml-auto text-n-400" />
  </Link>
)}
```

Add `usersTitle: 'Usuarios'` and `usersDescription: 'Gestiona el equipo de tu institución'` to `settingsStrings`, and `import { useCan } from '@/hooks/use-can'` in `Settings.tsx`.

**Deviation note (state before implementing):** the task text says "nav in `Sidebar.tsx`", but every existing `/ajustes/*` sub-page (Ubicaciones, Plantillas, Tipos, Registros, Horarios) is surfaced from the `Settings.tsx` menu, not the top-level `Sidebar`. To match the established pattern, the Users entry is added to the `Settings.tsx` menu (capability-gated) rather than the Sidebar's top-level groups. If the reviewer wants a top-level Sidebar entry instead, add a `NAV_ADMIN` item `{ to: '/ajustes/usuarios', … }` filtered by `useCan('users','view')` — but that mixes a settings sub-page into top-level nav, so it is intentionally not done here.

- [ ] **Step 7: Run web suite**

Run: `pnpm --filter @rezeta/web test -- settings/__tests__/Users`
Expected: PASS.

- [ ] **Step 8: Commit**

Run: `git add -A && git commit -m "feat(web): add users roster page under /ajustes/usuarios"`

---

### Task 12: Full green + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Lint the whole repo**

Run: `pnpm lint`
Expected: zero errors. Fix any (unused imports from removed signup, etc.).

- [ ] **Step 2: Full test with coverage**

Run: `pnpm test:coverage`
Expected: all suites pass; 95% per-file gate holds. New files that dip below 95% need added cases (e.g. an error-path case for `firebase-auth.provider` createUser failure, or a `useChangeUserRole` row interaction test in `Users.test.tsx`). Add them until green.

- [ ] **Step 3: Prepend the changelog entry (English)**

Prepend to `CHANGELOG.md`:

```markdown
## [2026-07-15] Provisioning rework + Users module

### Added
- `IAuthProvider.createUser` and `generatePasswordResetLink` (Firebase Admin SDK) in `apps/api/src/lib/auth/firebase-auth.provider.ts`.
- `InvitationMailerService` (dev-path stub that logs the set-password link).
- `UsersManagementController` (`GET/POST /v1/users`, `PATCH /v1/users/:id/role`, `PATCH /v1/users/:id/active`) with rank-rule (`canManageRole`) enforcement and `user_invited`/`role_changed`/`user_deactivated` audit events.
- Shared schemas `CreateUserSchema`/`ChangeRoleSchema`/`SetActiveSchema`/`ManagedUserSchema` (four-role enum).
- Web set-password / first-login screen at `/establecer-contrasena`; `IAuthClient.verifyPasswordResetCode` + `confirmPasswordReset`.
- Web Users roster page at `/ajustes/usuarios`, gated by `useCan('users','manage')`.

### Changed
- `UsersRepository.provisionUser` no longer creates a tenant; it resolves an existing user by `externalUid` or rejects `USER_NOT_PROVISIONED`. Added roster methods (`listByTenant`, `createProvisionedUser`, `updateRole`, `setActive`).
- `AuthService.provision` / `AuthController.provision` drop the signup-profile path.

### Removed
- Public self-signup: the `/signup` route + `Signup` page, the `signUp` store/auth-client entry, and `SignUpSchema`.
```

- [ ] **Step 4: Commit**

Run: `git add -A && git commit -m "docs: changelog for provisioning rework and users module"`
