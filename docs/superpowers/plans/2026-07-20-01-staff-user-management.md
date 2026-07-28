# Staff-User Management Implementation Plan (Identity slice 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platform staff can list, create, deactivate/reactivate, and resend set-password links for `PlatformUser` accounts from a staff-console page, replacing the `bootstrap:platform` CLI for day-to-day use.

**Architecture:** New `/v1/staff/identity/users` endpoints (controller + service in the existing `platform-users` module, gated by `@PlatformRoute()`), reusing the institution invite flow's provider calls (`IAuthProvider.createUser` + `generatePasswordResetLink`) and compensation pattern. A new staff-console page mirrors the institution roster (`settings/Users.tsx`) with English copy. `PlatformUser` gains `lastLoginAt` (stamped by `AuthGuard`, mirroring institution users) to derive the `invited`/`active` status.

**Tech Stack:** NestJS + Prisma + Zod (shared schemas), React + TanStack Query + Radix/CVA components, Vitest (+ real-Postgres integration harness).

**Spec:** `docs/superpowers/specs/2026-07-19-identity-module-design.md` (§5 staff-user management, §6 screen 6, §6a).

## Global Constraints

- All code, comments, tests, changelog in **English**. Institution UI strings are Spanish, but the **staff console is English** (established in `apps/web/src/pages/staff/strings.ts`; matches permissions design §7). The design mockup's screen 6 shows Spanish labels — the plan's English strings override the mockup text; layout/structure still follows the mockup.
- No arbitrary Tailwind values (`w-[440px]`-style) — tokens only. No new fonts/sizes.
- No `TODO`/`FIXME` comments (ESLint `no-warning-comments` fails CI).
- UUIDs for PKs; `snake_case` DB columns via `@map`; soft deletes (`deletedAt`).
- Audit convention for control-plane actors: `actorType: 'system'`, acting staff id in `metadata.platformUserId` (see `StaffService.createInstitution`). `AuditLog.tenantId` is nullable — platform-user CRUD audits omit it.
- Coverage gate: **95% per file** (`pnpm test:coverage`). Every new file ships with tests in the same task.
- Each commit must keep the whole workspace typechecking (pre-commit hook runs `pnpm lint` + workspace `typecheck`).
- Run commands from the repo root unless the step says otherwise.

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/schemas/platform-users.ts` (new) | Zod schemas + DTOs for the staff roster API |
| `packages/db/prisma/schema.prisma` (modify) | `PlatformUser.lastLoginAt` column |
| `apps/api/src/modules/platform-users/platform-users.repository.ts` (modify) | `list` / `findById` / `setActive` / `markSignedIn` |
| `apps/api/src/modules/platform-users/platform-users.service.ts` (new) | Roster business logic: create (with compensation), setActive (self-guard), resend, audit |
| `apps/api/src/modules/platform-users/staff-platform-users.controller.ts` (new) | `/v1/staff/identity/users` routes |
| `apps/api/src/modules/platform-users/platform-users.module.ts` (modify) | Wire controller/service; import `UsersModule` for the mailer |
| `apps/api/src/modules/users/users.module.ts` (modify) | Export `InvitationMailerService` |
| `apps/api/src/common/guards/auth.guard.ts` (modify) | Stamp platform `lastLoginAt` on first sign-in |
| `apps/web/src/pages/staff/strings.ts` (modify) | English strings for nav + new page |
| `apps/web/src/hooks/staff/use-platform-users.ts` (new) | TanStack Query hooks |
| `apps/web/src/pages/staff/PlatformUsers.tsx` (new) | Roster page (table + create modal) |
| `apps/web/src/components/layout/StaffLayout.tsx` (modify) | Staff-console nav |
| `apps/web/src/App.tsx` (modify) | `/staff/platform-users` route |

---

### Task 1: Shared schemas for platform-user DTOs

**Files:**
- Create: `packages/shared/src/schemas/platform-users.ts`
- Modify: `packages/shared/src/schemas/index.ts` (add one export line)
- Test: `packages/shared/src/schemas/__tests__/platform-users.spec.ts`

**Interfaces:**
- Consumes: nothing new (zod only). `SetActiveSchema`/`SetActiveDto` already exist in `packages/shared/src/schemas/user-management.ts` and are reused as-is by later tasks (do NOT redefine them).
- Produces: `CreatePlatformUserSchema`, `PlatformUserApiSchema`, `type CreatePlatformUserDto`, `type PlatformUserApiDto` — used by Tasks 4, 5, 8.

- [ ] **Step 1: Write the failing test**

`packages/shared/src/schemas/__tests__/platform-users.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { CreatePlatformUserSchema, PlatformUserApiSchema } from '../platform-users.js'

describe('CreatePlatformUserSchema', () => {
  it('accepts a valid payload', () => {
    const parsed = CreatePlatformUserSchema.parse({
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(parsed).toEqual({ email: 'laura@rezeta.do', fullName: 'Laura Medina' })
  })

  it('rejects an invalid email', () => {
    expect(() =>
      CreatePlatformUserSchema.parse({ email: 'not-an-email', fullName: 'Laura Medina' }),
    ).toThrow()
  })

  it('rejects a too-short full name', () => {
    expect(() =>
      CreatePlatformUserSchema.parse({ email: 'laura@rezeta.do', fullName: 'L' }),
    ).toThrow()
  })
})

describe('PlatformUserApiSchema', () => {
  const base = {
    id: '11111111-2222-4333-8444-555555555555',
    email: 'laura@rezeta.do',
    fullName: 'Laura Medina',
    isActive: true,
    createdAt: '2026-07-20T12:00:00.000Z',
    lastLoginAt: null,
    status: 'invited',
  }

  it('accepts a roster row with null lastLoginAt (invited)', () => {
    expect(PlatformUserApiSchema.parse(base).status).toBe('invited')
  })

  it('accepts an active row', () => {
    const parsed = PlatformUserApiSchema.parse({
      ...base,
      lastLoginAt: '2026-07-20T13:00:00.000Z',
      status: 'active',
    })
    expect(parsed.status).toBe('active')
  })

  it('rejects an unknown status', () => {
    expect(() => PlatformUserApiSchema.parse({ ...base, status: 'blocked' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared test -- platform-users`
Expected: FAIL — cannot resolve `../platform-users.js`.

- [ ] **Step 3: Write the implementation**

`packages/shared/src/schemas/platform-users.ts`:

```ts
import { z } from 'zod'

/**
 * Control-plane staff roster DTOs (`/v1/staff/identity/users`). Mirrors the
 * institution shapes in user-management.ts, minus role/tenant — a PlatformUser
 * has neither. Validation messages are English: the staff console is
 * English-copy (see identity design §6a and apps/web/src/pages/staff/strings.ts).
 * Reuses `SetActiveSchema` from user-management.ts for the active toggle.
 */
export const CreatePlatformUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name cannot exceed 200 characters'),
})

export const PlatformUserApiSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  /** ISO timestamp of the first successful sign-in; null until they accept the invite. */
  lastLoginAt: z.string().nullable(),
  /** Derived roster status: 'invited' until first sign-in, then 'active'. */
  status: z.enum(['invited', 'active']),
})

export type CreatePlatformUserDto = z.infer<typeof CreatePlatformUserSchema>
export type PlatformUserApiDto = z.infer<typeof PlatformUserApiSchema>
```

In `packages/shared/src/schemas/index.ts`, add (alphabetically near the `./staff.js` export):

```ts
export * from './platform-users.js'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared test -- platform-users`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/platform-users.ts packages/shared/src/schemas/index.ts packages/shared/src/schemas/__tests__/platform-users.spec.ts
git commit -m "feat(shared): platform-user roster schemas for staff identity endpoints"
```

---

### Task 2: `PlatformUser.lastLoginAt` column + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (the `model PlatformUser` block, ~line 803)
- Create: `packages/db/prisma/migrations/<timestamp>_platform_user_last_login_at/` (generated)

**Interfaces:**
- Produces: `PlatformUser.lastLoginAt: Date | null` on the Prisma client — used by Tasks 3, 4, 5.

- [ ] **Step 1: Edit the schema**

In `model PlatformUser`, after the `isActive` line, add:

```prisma
  lastLoginAt DateTime? @map("last_login_at")
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @rezeta/db migrate:dev -- --name platform_user_last_login_at`
Expected: a new folder under `packages/db/prisma/migrations/` containing `ALTER TABLE "platform_users" ADD COLUMN "last_login_at" TIMESTAMP(3);` and a regenerated Prisma client. (Requires the local dev database from `.env` to be up.)

- [ ] **Step 3: Verify the workspace still typechecks**

Run: `pnpm -r typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add last_login_at to platform_users"
```

---

### Task 3: Repository methods — list / findById / setActive / markSignedIn

**Files:**
- Modify: `apps/api/src/modules/platform-users/platform-users.repository.ts`
- Test: `apps/api/src/modules/platform-users/__tests__/platform-users.repository.spec.ts` (new)

**Interfaces:**
- Consumes: `PrismaService` (already injected), `PlatformUser` type from `@rezeta/db`.
- Produces (used by Tasks 4, 5):
  - `list(): Promise<PlatformUser[]>` — ALL rows including deactivated (roster shows them), ordered by `createdAt` asc.
  - `findById(id: string): Promise<PlatformUser | null>` — includes soft-deleted rows (needed for reactivate).
  - `setActive(id: string, isActive: boolean): Promise<PlatformUser>` — mirrors institution semantics: deactivate sets `{ isActive: false, deletedAt: new Date() }`, reactivate sets `{ isActive: true, deletedAt: null }`.
  - `markSignedIn(id: string): Promise<void>` — sets `lastLoginAt: new Date()`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/platform-users/__tests__/platform-users.repository.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsersRepository } from '../platform-users.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const prisma = {
  platformUser: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService

function makeRepo(): PlatformUsersRepository {
  return new PlatformUsersRepository(prisma)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlatformUsersRepository', () => {
  it('list returns all rows (including deactivated) ordered by createdAt', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    vi.mocked(prisma.platformUser.findMany).mockResolvedValue(rows as never)
    await expect(makeRepo().list()).resolves.toBe(rows)
    expect(prisma.platformUser.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'asc' },
    })
  })

  it('findById looks up by primary key without a deletedAt filter', async () => {
    vi.mocked(prisma.platformUser.findUnique).mockResolvedValue(null)
    await expect(makeRepo().findById('id-1')).resolves.toBeNull()
    expect(prisma.platformUser.findUnique).toHaveBeenCalledWith({ where: { id: 'id-1' } })
  })

  it('setActive(false) soft-deletes; setActive(true) restores', async () => {
    vi.mocked(prisma.platformUser.update).mockResolvedValue({ id: 'id-1' } as never)
    const repo = makeRepo()

    await repo.setActive('id-1', false)
    expect(prisma.platformUser.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { isActive: false, deletedAt: expect.any(Date) },
    })

    await repo.setActive('id-1', true)
    expect(prisma.platformUser.update).toHaveBeenLastCalledWith({
      where: { id: 'id-1' },
      data: { isActive: true, deletedAt: null },
    })
  })

  it('markSignedIn stamps lastLoginAt', async () => {
    vi.mocked(prisma.platformUser.update).mockResolvedValue({ id: 'id-1' } as never)
    await makeRepo().markSignedIn('id-1')
    expect(prisma.platformUser.update).toHaveBeenCalledWith({
      where: { id: 'id-1' },
      data: { lastLoginAt: expect.any(Date) },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- platform-users.repository`
Expected: FAIL — `list is not a function` (etc.).

- [ ] **Step 3: Implement the methods**

Append inside the `PlatformUsersRepository` class (keep the two existing methods untouched):

```ts
  /**
   * Full roster, INCLUDING deactivated (soft-deleted) rows — the staff console
   * shows them with a Reactivate action. Contrast findByExternalUid, which
   * excludes them because it authenticates.
   */
  async list(): Promise<PlatformUser[]> {
    return this.prisma.platformUser.findMany({ orderBy: { createdAt: 'asc' } })
  }

  /** By primary key, including soft-deleted rows (needed to reactivate). */
  async findById(id: string): Promise<PlatformUser | null> {
    return this.prisma.platformUser.findUnique({ where: { id } })
  }

  /** Mirrors institution semantics: deactivation is a soft delete. */
  async setActive(id: string, isActive: boolean): Promise<PlatformUser> {
    return this.prisma.platformUser.update({
      where: { id },
      data: isActive
        ? { isActive: true, deletedAt: null }
        : { isActive: false, deletedAt: new Date() },
    })
  }

  /** First-sign-in stamp; called fire-and-forget from AuthGuard. */
  async markSignedIn(id: string): Promise<void> {
    await this.prisma.platformUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    })
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test -- platform-users.repository`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/platform-users/platform-users.repository.ts apps/api/src/modules/platform-users/__tests__/platform-users.repository.spec.ts
git commit -m "feat(api): platform-users repository roster methods"
```

---

### Task 4: AuthGuard stamps platform `lastLoginAt` on first sign-in

**Files:**
- Modify: `apps/api/src/common/guards/auth.guard.ts` (platform branch, ~lines 91–106)
- Test: `apps/api/src/common/guards/__tests__/auth.guard.spec.ts` (add cases; add `markSignedIn` to the existing platform-users mock object)

**Interfaces:**
- Consumes: `PlatformUsersRepository.markSignedIn(id)` from Task 3.
- Produces: `lastLoginAt` gets populated, which Task 5's `status` derivation and the UI's "Last access" column rely on.

- [ ] **Step 1: Write the failing tests**

In `auth.guard.spec.ts`, find the existing platform-route describe block (the one that resolves `request.platformUser`). Add `markSignedIn: vi.fn().mockResolvedValue(undefined)` to the mocked platform-users repository object used there (the mock that already has `findByExternalUid`). Then add:

```ts
  it('stamps lastLoginAt on a platform user’s first sign-in', async () => {
    vi.mocked(platformUsers.findByExternalUid).mockResolvedValue({
      id: 'platform-1',
      externalUid: 'ext-1',
      email: 'staff@rezeta.do',
      fullName: 'Staff One',
      isActive: true,
      lastLoginAt: null,
    } as never)

    await guard.canActivate(platformContext())

    expect(platformUsers.markSignedIn).toHaveBeenCalledWith('platform-1')
  })

  it('does not re-stamp lastLoginAt on later sign-ins', async () => {
    vi.mocked(platformUsers.findByExternalUid).mockResolvedValue({
      id: 'platform-1',
      externalUid: 'ext-1',
      email: 'staff@rezeta.do',
      fullName: 'Staff One',
      isActive: true,
      lastLoginAt: new Date('2026-07-01T00:00:00Z'),
    } as never)

    await guard.canActivate(platformContext())

    expect(platformUsers.markSignedIn).not.toHaveBeenCalled()
  })
```

(Use the spec's existing helper for building a platform-route `ExecutionContext` — reuse whatever the current platform-route test calls; the name above is illustrative, match the file's existing helper.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- auth.guard`
Expected: the two new tests FAIL (`markSignedIn` never called / not a function).

- [ ] **Step 3: Implement the stamp**

In `auth.guard.ts`, inside the `if (isPlatformRoute)` branch, immediately before `return true` (after `request.platformUser = {...}`), add — mirroring the institution stamp at lines 124–130:

```ts
      if (platformUser.lastLoginAt === null) {
        void this.platformUsers.markSignedIn(platformUser.id).catch((err: unknown) => {
          this.logger.warn(
            `Failed to stamp lastLoginAt for platform user id=${platformUser.id}: ${(err as Error).message}`,
          )
        })
      }
```

- [ ] **Step 4: Run the guard suite**

Run: `pnpm --filter @rezeta/api test -- auth.guard`
Expected: PASS, including all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/guards/auth.guard.ts apps/api/src/common/guards/__tests__/auth.guard.spec.ts
git commit -m "feat(api): stamp platform-user lastLoginAt on first sign-in"
```

---

### Task 5: `PlatformUsersService` — roster business logic

**Files:**
- Create: `apps/api/src/modules/platform-users/platform-users.service.ts`
- Modify: `apps/api/src/modules/users/users.module.ts` (add `InvitationMailerService` to `exports`)
- Test: `apps/api/src/modules/platform-users/__tests__/platform-users.service.spec.ts`

**Interfaces:**
- Consumes: `PlatformUsersRepository` (Task 3), `AUTH_PROVIDER`/`IAuthProvider` (`createUser`, `generatePasswordResetLink`, `deleteUser`), `AuditLogService.record`, `InvitationMailerService.sendSetPasswordEmail(email, link)`, DTOs from Task 1, `SetActiveDto` from shared.
- Produces (used by Task 6):
  - `listUsers(): Promise<PlatformUserApiDto[]>`
  - `createUser(actorPlatformUserId: string, dto: CreatePlatformUserDto): Promise<PlatformUserApiDto>`
  - `setActive(actorPlatformUserId: string, targetId: string, dto: SetActiveDto): Promise<PlatformUserApiDto>`
  - `resendInvite(actorPlatformUserId: string, targetId: string): Promise<PlatformUserApiDto>`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/platform-users/__tests__/platform-users.service.spec.ts` (mirror the mock style of `apps/api/src/modules/users/__tests__/users.service.spec.ts` — plain mock objects + `as unknown as` casts, `vi.clearAllMocks()` in `beforeEach`):

```ts
import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ErrorCode } from '@rezeta/shared'
import { PlatformUsersService } from '../platform-users.service.js'
import type { PlatformUsersRepository } from '../platform-users.repository.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { InvitationMailerService } from '../../users/invitation-mailer.service.js'

const row = {
  id: 'pu-1',
  externalUid: 'ext-1',
  email: 'laura@rezeta.do',
  fullName: 'Laura Medina',
  isActive: true,
  createdAt: new Date('2026-07-20T12:00:00Z'),
  updatedAt: new Date('2026-07-20T12:00:00Z'),
  deletedAt: null,
  lastLoginAt: null,
}

const mockRepo = {
  list: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  setActive: vi.fn(),
}
const mockProvider = {
  createUser: vi.fn(),
  generatePasswordResetLink: vi.fn(),
  deleteUser: vi.fn(),
}
const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }
const mockMailer = { sendSetPasswordEmail: vi.fn() }

function makeService(): PlatformUsersService {
  return new PlatformUsersService(
    mockRepo as unknown as PlatformUsersRepository,
    mockProvider as unknown as IAuthProvider,
    mockAudit as unknown as AuditLogService,
    mockMailer as unknown as InvitationMailerService,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listUsers', () => {
  it('maps rows to DTOs with derived status', async () => {
    mockRepo.list.mockResolvedValue([
      row,
      { ...row, id: 'pu-2', lastLoginAt: new Date('2026-07-20T13:00:00Z') },
    ])
    const result = await makeService().listUsers()
    expect(result[0]).toMatchObject({ id: 'pu-1', status: 'invited', lastLoginAt: null })
    expect(result[1]).toMatchObject({ id: 'pu-2', status: 'active' })
    expect(result[1]!.lastLoginAt).toBe('2026-07-20T13:00:00.000Z')
  })
})

describe('createUser', () => {
  beforeEach(() => {
    mockProvider.createUser.mockResolvedValue({ externalUid: 'ext-1' })
    mockProvider.generatePasswordResetLink.mockResolvedValue('https://link')
    mockMailer.sendSetPasswordEmail.mockResolvedValue(undefined)
    mockRepo.create.mockResolvedValue(row)
  })

  it('creates identity, row, sends the set-password link, audits', async () => {
    const result = await makeService().createUser('actor-1', {
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(mockProvider.createUser).toHaveBeenCalledWith('laura@rezeta.do')
    expect(mockRepo.create).toHaveBeenCalledWith({
      externalUid: 'ext-1',
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(mockMailer.sendSetPasswordEmail).toHaveBeenCalledWith('laura@rezeta.do', 'https://link')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',
        category: 'auth',
        action: 'user_invited',
        entityType: 'PlatformUser',
        entityId: 'pu-1',
        metadata: { platformUserId: 'actor-1' },
        status: 'success',
      }),
    )
    expect(result.status).toBe('invited')
  })

  it('deletes the orphaned identity and rethrows when the DB write fails', async () => {
    const dbErr = new Error('db down')
    mockRepo.create.mockRejectedValue(dbErr)
    mockProvider.deleteUser.mockResolvedValue(undefined)
    await expect(
      makeService().createUser('actor-1', { email: 'laura@rezeta.do', fullName: 'Laura Medina' }),
    ).rejects.toBe(dbErr)
    expect(mockProvider.deleteUser).toHaveBeenCalledWith('ext-1')
  })

  it('maps a unique violation to USER_ALREADY_EXISTS', async () => {
    mockRepo.create.mockRejectedValue({ code: 'P2002' })
    mockProvider.deleteUser.mockResolvedValue(undefined)
    await expect(
      makeService().createUser('actor-1', { email: 'laura@rezeta.do', fullName: 'Laura Medina' }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('still returns the user when the set-password email step fails', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    mockProvider.generatePasswordResetLink.mockRejectedValue(new Error('smtp down'))
    const result = await makeService().createUser('actor-1', {
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(result.id).toBe('pu-1')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('setActive', () => {
  it('rejects self-deactivation and touches nothing', async () => {
    await expect(
      makeService().setActive('pu-1', 'pu-1', { isActive: false }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(mockRepo.setActive).not.toHaveBeenCalled()
  })

  it('allows self-reactivation guard to pass through for other targets', async () => {
    mockRepo.findById.mockResolvedValue({ ...row, id: 'pu-2' })
    mockRepo.setActive.mockResolvedValue({ ...row, id: 'pu-2', isActive: false, deletedAt: new Date() })
    const result = await makeService().setActive('pu-1', 'pu-2', { isActive: false })
    expect(mockRepo.setActive).toHaveBeenCalledWith('pu-2', false)
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_deactivated', entityId: 'pu-2' }),
    )
    expect(result.isActive).toBe(false)
  })

  it('audits reactivation as user_reactivated', async () => {
    mockRepo.findById.mockResolvedValue({ ...row, id: 'pu-2', isActive: false })
    mockRepo.setActive.mockResolvedValue({ ...row, id: 'pu-2', isActive: true })
    await makeService().setActive('pu-1', 'pu-2', { isActive: true })
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_reactivated' }),
    )
  })

  it('404s on an unknown target', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(
      makeService().setActive('pu-1', 'missing', { isActive: false }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('resendInvite', () => {
  it('regenerates the link, emails it, audits with resend flag', async () => {
    mockRepo.findById.mockResolvedValue({ ...row, id: 'pu-2' })
    mockProvider.generatePasswordResetLink.mockResolvedValue('https://link2')
    mockMailer.sendSetPasswordEmail.mockResolvedValue(undefined)
    await makeService().resendInvite('pu-1', 'pu-2')
    expect(mockMailer.sendSetPasswordEmail).toHaveBeenCalledWith('laura@rezeta.do', 'https://link2')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_invited',
        metadata: { platformUserId: 'pu-1', resend: true },
      }),
    )
  })

  it('404s on an unknown target', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(makeService().resendInvite('pu-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
```

Note the `ErrorCode` import is used by the implementation; if the spec file ends up not referencing it directly, drop the import to keep lint clean.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- platform-users.service`
Expected: FAIL — cannot resolve `../platform-users.service.js`.

- [ ] **Step 3: Implement the service**

`apps/api/src/modules/platform-users/platform-users.service.ts`:

```ts
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { CreatePlatformUserDto, PlatformUserApiDto, SetActiveDto } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import type { PlatformUser } from '@rezeta/db'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { InvitationMailerService } from '../users/invitation-mailer.service.js'
import { PlatformUsersRepository } from './platform-users.repository.js'

/**
 * Control-plane staff roster (`/v1/staff/identity/users`). The actor is always
 * a PlatformUser, so audits use actorType 'system' with the acting staff id in
 * metadata.platformUserId (same convention as StaffService.createInstitution).
 * Audits are tenantless — AuditLog.tenantId is nullable and platform users
 * have no tenant.
 */
@Injectable()
export class PlatformUsersService {
  private readonly logger = new Logger(PlatformUsersService.name)

  constructor(
    @Inject(PlatformUsersRepository) private repository: PlatformUsersRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(InvitationMailerService) private mailer: InvitationMailerService,
  ) {}

  async listUsers(): Promise<PlatformUserApiDto[]> {
    const rows = await this.repository.list()
    return rows.map((r) => this.toApiDto(r))
  }

  async createUser(
    actorPlatformUserId: string,
    dto: CreatePlatformUserDto,
  ): Promise<PlatformUserApiDto> {
    const { externalUid } = await this.authProvider.createUser(dto.email)

    let created: PlatformUser
    try {
      created = await this.repository.create({
        externalUid,
        email: dto.email,
        fullName: dto.fullName,
      })
    } catch (err) {
      // Compensate: don't leave an orphaned identity in the auth provider.
      try {
        await this.authProvider.deleteUser(externalUid)
      } catch (cleanupErr) {
        this.logger.warn(
          `Failed to clean up auth identity ${externalUid} after DB error: ${(cleanupErr as Error).message}`,
        )
      }
      if (this.isUniqueViolation(err)) {
        throw new ConflictException({
          code: ErrorCode.USER_ALREADY_EXISTS,
          message: 'A platform user with this email already exists',
        })
      }
      throw err
    }

    // Non-fatal: recovery path is POST /v1/staff/identity/users/:id/resend-invite.
    try {
      const link = await this.authProvider.generatePasswordResetLink(dto.email)
      await this.mailer.sendSetPasswordEmail(dto.email, link)
    } catch (err) {
      this.logger.warn(
        `Set-password link step failed for ${dto.email}: ${(err as Error).message}`,
      )
    }

    void this.auditLog.record({
      actorType: 'system',
      category: 'auth',
      action: 'user_invited',
      entityType: 'PlatformUser',
      entityId: created.id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toApiDto(created)
  }

  async setActive(
    actorPlatformUserId: string,
    targetId: string,
    dto: SetActiveDto,
  ): Promise<PlatformUserApiDto> {
    if (targetId === actorPlatformUserId && !dto.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'You cannot deactivate your own account',
      })
    }
    const target = await this.requireUser(targetId)
    const updated = await this.repository.setActive(target.id, dto.isActive)

    void this.auditLog.record({
      actorType: 'system',
      category: 'auth',
      action: dto.isActive ? 'user_reactivated' : 'user_deactivated',
      entityType: 'PlatformUser',
      entityId: target.id,
      metadata: { platformUserId: actorPlatformUserId },
      status: 'success',
    })

    return this.toApiDto(updated)
  }

  async resendInvite(
    actorPlatformUserId: string,
    targetId: string,
  ): Promise<PlatformUserApiDto> {
    const target = await this.requireUser(targetId)
    const link = await this.authProvider.generatePasswordResetLink(target.email)
    await this.mailer.sendSetPasswordEmail(target.email, link)

    void this.auditLog.record({
      actorType: 'system',
      category: 'auth',
      action: 'user_invited',
      entityType: 'PlatformUser',
      entityId: target.id,
      metadata: { platformUserId: actorPlatformUserId, resend: true },
      status: 'success',
    })

    return this.toApiDto(target)
  }

  private async requireUser(id: string): Promise<PlatformUser> {
    const user = await this.repository.findById(id)
    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.USER_NOT_FOUND,
        message: 'Platform user not found',
      })
    }
    return user
  }

  private isUniqueViolation(err: unknown): err is { code: string } {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    )
  }

  private toApiDto(row: PlatformUser): PlatformUserApiDto {
    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      status: row.lastLoginAt ? 'active' : 'invited',
    }
  }
}
```

In `apps/api/src/modules/users/users.module.ts`, change the exports line to:

```ts
  exports: [UsersService, UsersRepository, InvitationMailerService],
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/api test -- platform-users.service`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/platform-users/platform-users.service.ts apps/api/src/modules/platform-users/__tests__/platform-users.service.spec.ts apps/api/src/modules/users/users.module.ts
git commit -m "feat(api): platform-users service with invite-flow compensation and audits"
```

---

### Task 6: Controller `/v1/staff/identity/users` + module wiring

**Files:**
- Create: `apps/api/src/modules/platform-users/staff-platform-users.controller.ts`
- Modify: `apps/api/src/modules/platform-users/platform-users.module.ts`
- Modify: `apps/api/src/modules/platform-users/index.ts` (barrel exports)
- Test: `apps/api/src/modules/platform-users/__tests__/staff-platform-users.controller.spec.ts`

**Interfaces:**
- Consumes: `PlatformUsersService` (Task 5), `@PlatformRoute()`, `@CurrentPlatformUser()`, `ZodValidationPipe`, schemas from Task 1 + `SetActiveSchema`.
- Produces: HTTP routes `GET /v1/staff/identity/users`, `POST /v1/staff/identity/users`, `PATCH /v1/staff/identity/users/:id/active`, `POST /v1/staff/identity/users/:id/resend-invite` — consumed by Task 8's hooks.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/modules/platform-users/__tests__/staff-platform-users.controller.spec.ts` (mirror `apps/api/src/modules/staff/__tests__/staff.controller.spec.ts`):

```ts
import { describe, expect, it, vi } from 'vitest'
import type { PlatformPrincipal } from '@rezeta/shared'
import { StaffPlatformUsersController } from '../staff-platform-users.controller.js'
import type { PlatformUsersService } from '../platform-users.service.js'

function principal(): PlatformPrincipal {
  return { id: 'platform-1', externalUid: 'ext-1', email: 'staff@rezeta.do', fullName: 'Staff One' }
}

describe('StaffPlatformUsersController', () => {
  it('list delegates to the service', async () => {
    const service = { listUsers: vi.fn().mockResolvedValue([]) } as unknown as PlatformUsersService
    await new StaffPlatformUsersController(service).list()
    expect(service.listUsers).toHaveBeenCalledOnce()
  })

  it('create passes the acting principal id and dto', async () => {
    const service = { createUser: vi.fn().mockResolvedValue({}) } as unknown as PlatformUsersService
    const dto = { email: 'laura@rezeta.do', fullName: 'Laura Medina' }
    await new StaffPlatformUsersController(service).create(principal(), dto)
    expect(service.createUser).toHaveBeenCalledWith('platform-1', dto)
  })

  it('setActive passes actor, target id and dto', async () => {
    const service = { setActive: vi.fn().mockResolvedValue({}) } as unknown as PlatformUsersService
    await new StaffPlatformUsersController(service).setActive(principal(), 'pu-2', { isActive: false })
    expect(service.setActive).toHaveBeenCalledWith('platform-1', 'pu-2', { isActive: false })
  })

  it('resendInvite passes actor and target id', async () => {
    const service = { resendInvite: vi.fn().mockResolvedValue({}) } as unknown as PlatformUsersService
    await new StaffPlatformUsersController(service).resendInvite(principal(), 'pu-2')
    expect(service.resendInvite).toHaveBeenCalledWith('platform-1', 'pu-2')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- staff-platform-users.controller`
Expected: FAIL — cannot resolve the controller module.

- [ ] **Step 3: Implement controller and wiring**

`apps/api/src/modules/platform-users/staff-platform-users.controller.ts` — copy the decorator stack from `apps/api/src/modules/staff/staff.controller.ts` (same imports for `ApiTags`/`ApiBearerAuth`/`ApiSecurity`/`AUTH_BEARER_SCHEME`/`AUTH_OAUTH2_SCHEME`/`ZodValidationPipe`; `@Param('id') id: string` with no pipe, matching `users-management.controller.ts`):

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger'
import {
  CreatePlatformUserSchema,
  SetActiveSchema,
  type CreatePlatformUserDto,
  type PlatformPrincipal,
  type PlatformUserApiDto,
  type SetActiveDto,
} from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../config/swagger.constants.js'
import { CurrentPlatformUser } from '../../common/decorators/current-platform-user.decorator.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js'
import { PlatformUsersService } from './platform-users.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff/identity/users')
export class StaffPlatformUsersController {
  constructor(@Inject(PlatformUsersService) private svc: PlatformUsersService) {}

  @Get()
  list(): Promise<PlatformUserApiDto[]> {
    return this.svc.listUsers()
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Body(new ZodValidationPipe(CreatePlatformUserSchema)) dto: CreatePlatformUserDto,
  ): Promise<PlatformUserApiDto> {
    return this.svc.createUser(actor.id, dto)
  }

  @Patch(':id/active')
  setActive(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SetActiveSchema)) dto: SetActiveDto,
  ): Promise<PlatformUserApiDto> {
    return this.svc.setActive(actor.id, id, dto)
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  resendInvite(
    @CurrentPlatformUser() actor: PlatformPrincipal,
    @Param('id') id: string,
  ): Promise<PlatformUserApiDto> {
    return this.svc.resendInvite(actor.id, id)
  }
}
```

Before running, verify the two import paths against `staff.controller.ts` (`AUTH_BEARER_SCHEME` and `ZodValidationPipe` locations) and adjust to match exactly what that file imports.

`apps/api/src/modules/platform-users/platform-users.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { UsersModule } from '../users/users.module.js'
import { PlatformUsersRepository } from './platform-users.repository.js'
import { PlatformUsersService } from './platform-users.service.js'
import { StaffPlatformUsersController } from './staff-platform-users.controller.js'

@Module({
  imports: [UsersModule],
  controllers: [StaffPlatformUsersController],
  providers: [PlatformUsersRepository, PlatformUsersService],
  exports: [PlatformUsersRepository, PlatformUsersService],
})
export class PlatformUsersModule {}
```

Add to `apps/api/src/modules/platform-users/index.ts`:

```ts
export { PlatformUsersService } from './platform-users.service.js'
export { StaffPlatformUsersController } from './staff-platform-users.controller.js'
```

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @rezeta/api test -- staff-platform-users.controller` → PASS (4 tests).
Run: `pnpm --filter @rezeta/api typecheck` → PASS.
Also boot check: `pnpm --filter @rezeta/api test` → full API unit suite PASS (catches DI wiring errors surfaced by other module specs).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/platform-users
git commit -m "feat(api): /v1/staff/identity/users endpoints for staff-user management"
```

---

### Task 7: Real-Postgres integration spec

**Files:**
- Test: `apps/api/src/modules/platform-users/__tests__/platform-users.service.int-spec.ts`

**Interfaces:**
- Consumes: `hasTestDb`, `getTestPrisma`, `truncateAll`, `waitForAuditLog`, `createTestPlatformUser` from `apps/api/src/test/db-test-utils.ts`; real `PlatformUsersRepository` + `AuditLogService` wired to the test Prisma; `IAuthProvider` and `InvitationMailerService` faked with `vi.fn()`.
- Produces: end-to-end confidence in the create/deactivate/audit path against real Postgres (`AUDIT_STRICT=1` in this suite makes audit failures throw).

- [ ] **Step 1: Write the integration spec**

Mirror the construction style of `apps/api/src/modules/permissions/__tests__/permissions.service.int-spec.ts` (read it first for exactly how `AuditLogService` is instantiated there and copy that construction). The spec:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsersService } from '../platform-users.service.js'
import { PlatformUsersRepository } from '../platform-users.repository.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { InvitationMailerService } from '../../users/invitation-mailer.service.js'
import {
  createTestPlatformUser,
  getTestPrisma,
  hasTestDb,
  truncateAll,
  waitForAuditLog,
} from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('PlatformUsersService (integration)', () => {
  const prisma = getTestPrisma()
  // Build AuditLogService exactly as permissions.service.int-spec.ts does.
  const provider = {
    createUser: vi.fn(),
    generatePasswordResetLink: vi.fn().mockResolvedValue('https://link'),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as IAuthProvider
  const mailer = {
    sendSetPasswordEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as InvitationMailerService

  function makeService(): PlatformUsersService {
    const repo = new PlatformUsersRepository(prisma)
    return new PlatformUsersService(repo, provider, auditLog, mailer)
  }

  beforeEach(async () => {
    await truncateAll(prisma)
    vi.mocked(provider.createUser).mockResolvedValue({ externalUid: `ext-${Date.now()}` })
  })

  it('createUser persists a row and writes a user_invited audit', async () => {
    const actor = await createTestPlatformUser(prisma, { email: 'actor@rezeta.do' })
    const created = await makeService().createUser(actor.id, {
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })

    const row = await prisma.platformUser.findUnique({ where: { id: created.id } })
    expect(row?.email).toBe('laura@rezeta.do')
    expect(row?.isActive).toBe(true)

    const audit = await waitForAuditLog(prisma, {
      action: 'user_invited',
      entityId: created.id,
    })
    expect(audit.metadata).toMatchObject({ platformUserId: actor.id })
    expect(audit.tenantId).toBeNull()
  })

  it('deactivate soft-deletes, blocks auth-path lookup, and reactivate restores', async () => {
    const actor = await createTestPlatformUser(prisma, { email: 'actor@rezeta.do' })
    const target = await createTestPlatformUser(prisma, { email: 'target@rezeta.do' })
    const service = makeService()
    const repo = new PlatformUsersRepository(prisma)

    const deactivated = await service.setActive(actor.id, target.id, { isActive: false })
    expect(deactivated.isActive).toBe(false)
    await expect(repo.findByExternalUid(target.externalUid)).resolves.toBeNull()
    await waitForAuditLog(prisma, { action: 'user_deactivated', entityId: target.id })

    const reactivated = await service.setActive(actor.id, target.id, { isActive: true })
    expect(reactivated.isActive).toBe(true)
    await expect(repo.findByExternalUid(target.externalUid)).resolves.not.toBeNull()
  })

  it('self-deactivation is rejected and leaves the row untouched', async () => {
    const actor = await createTestPlatformUser(prisma, { email: 'actor@rezeta.do' })
    await expect(
      makeService().setActive(actor.id, actor.id, { isActive: false }),
    ).rejects.toMatchObject({ status: 403 })
    const row = await prisma.platformUser.findUnique({ where: { id: actor.id } })
    expect(row?.isActive).toBe(true)
  })
})
```

The `auditLog` construction line is deliberately shown as a placeholder-free instruction: copy the exact instantiation from `permissions.service.int-spec.ts` (it builds the real `AuditLogService` over the test Prisma client) and declare `auditLog` alongside `provider`/`mailer`.

- [ ] **Step 2: Run the integration suite**

Run: `pnpm --filter @rezeta/api test:integration -- platform-users`
Expected: PASS if `TEST_DATABASE_URL` is configured; SKIPPED otherwise (both acceptable — CI runs it with the DB).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/platform-users/__tests__/platform-users.service.int-spec.ts
git commit -m "test(api): real-postgres integration coverage for platform-users service"
```

---

### Task 8: Web — English strings + TanStack Query hooks

**Files:**
- Modify: `apps/web/src/pages/staff/strings.ts`
- Create: `apps/web/src/hooks/staff/use-platform-users.ts`

**Interfaces:**
- Consumes: `apiClient` from `apps/web/src/lib/api-client.ts`; DTOs from Task 1; routes from Task 6.
- Produces (used by Task 9):
  - `useStaffPlatformUsers(): UseQueryResult<PlatformUserApiDto[], Error>`
  - `useCreatePlatformUser(): UseMutationResult<PlatformUserApiDto, Error, CreatePlatformUserDto>`
  - `useSetPlatformUserActive(id: string): UseMutationResult<PlatformUserApiDto, Error, SetActiveDto>`
  - `useResendPlatformUserInvite(id: string): UseMutationResult<PlatformUserApiDto, Error, void>`
  - `platformUsersStrings` and two new `staffStrings` members: `navInstitutions`, `navPlatformUsers`.

No dedicated hook test file — hooks in this repo are exercised through page tests (precedent: `use-create-institution.ts` has none); Task 10's coverage run verifies the gate holds.

- [ ] **Step 1: Add strings**

In `apps/web/src/pages/staff/strings.ts`, add to the existing `staffStrings` object:

```ts
  navInstitutions: 'Institutions',
  navPlatformUsers: 'Platform users',
```

Then add a new export at the bottom of the file:

```ts
export const platformUsersStrings = {
  pageTitle: 'Platform users',
  pageSubtitle: 'Internal Rezeta staff accounts with access to this console.',
  newUserButton: 'New user',
  tableUser: 'User',
  tableStatus: 'Status',
  tableLastAccess: 'Last access',
  statusActive: 'Active',
  statusInvited: 'Invite pending',
  statusDeactivated: 'Deactivated',
  youChip: 'You',
  resendButton: 'Resend link',
  deactivateButton: 'Deactivate',
  reactivateButton: 'Reactivate',
  neverAccessed: '—',
  formTitle: 'Create platform user',
  nameLabel: 'Full name',
  namePlaceholder: 'Laura Medina',
  emailLabel: 'Email',
  emailPlaceholder: 'laura@rezeta.do',
  linkNote: 'No password is set here — the person receives a set-password link by email.',
  cancelButton: 'Cancel',
  createButton: 'Create user',
  creatingButton: 'Creating…',
  createError: 'Could not create the user. Check the email and try again.',
  actionError: 'The action failed. Try again.',
  loadError: 'Could not load platform users.',
  emptyTitle: 'No platform users yet',
  emptyBody: 'Create the first staff account to get started.',
} as const
```

- [ ] **Step 2: Create the hooks**

`apps/web/src/hooks/staff/use-platform-users.ts` (mirror `apps/web/src/hooks/users/use-users.ts` structure):

```ts
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  CreatePlatformUserDto,
  PlatformUserApiDto,
  SetActiveDto,
} from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'staff-platform-users'
const BASE = '/v1/staff/identity/users'

export function useStaffPlatformUsers(): UseQueryResult<PlatformUserApiDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<PlatformUserApiDto[]>(BASE),
  })
}

export function useCreatePlatformUser(): UseMutationResult<
  PlatformUserApiDto,
  Error,
  CreatePlatformUserDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePlatformUserDto) => apiClient.post<PlatformUserApiDto>(BASE, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useSetPlatformUserActive(
  id: string,
): UseMutationResult<PlatformUserApiDto, Error, SetActiveDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: SetActiveDto) =>
      apiClient.patch<PlatformUserApiDto>(`${BASE}/${id}/active`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useResendPlatformUserInvite(
  id: string,
): UseMutationResult<PlatformUserApiDto, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<PlatformUserApiDto>(`${BASE}/${id}/resend-invite`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
```

Check `apiClient.post`'s signature for a no-body call (`use-users.ts`'s `useResendInvite` is the exact precedent — copy how it calls `post` without a payload).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @rezeta/web typecheck` (use the actual web package name from `apps/web/package.json` if different)
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/staff/strings.ts apps/web/src/hooks/staff/use-platform-users.ts
git commit -m "feat(web): staff platform-users strings and query hooks"
```

---

### Task 9: Web — StaffLayout nav, route, and PlatformUsers page

**Files:**
- Modify: `apps/web/src/components/layout/StaffLayout.tsx`
- Modify: `apps/web/src/App.tsx` (staff route block, ~lines 271–289; import near line 35)
- Create: `apps/web/src/pages/staff/PlatformUsers.tsx`
- Test: `apps/web/src/pages/staff/__tests__/PlatformUsers.test.tsx`

**Interfaces:**
- Consumes: hooks + strings from Task 8; `useStaffMe` from `apps/web/src/hooks/staff/use-staff-me.ts` (for the "You" row); UI components from `@/components/ui` (`Badge`, `Button`, `Callout`, `EmptyState`, `Field`, `Input`, `Modal*`, `Spinner`, `Avatar`); `logger` (same import as `settings/Users.tsx`).
- Produces: `/staff/platform-users` route.

- [ ] **Step 1: Write the failing page test**

`apps/web/src/pages/staff/__tests__/PlatformUsers.test.tsx` (mirror the mocking style of `apps/web/src/pages/staff/__tests__/NewInstitution.test.tsx` — `vi.hoisted` + `vi.mock`):

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsers } from '../PlatformUsers'

const h = vi.hoisted(() => ({
  useStaffPlatformUsers: vi.fn(),
  useCreatePlatformUser: vi.fn(),
  useSetPlatformUserActive: vi.fn(),
  useResendPlatformUserInvite: vi.fn(),
  useStaffMe: vi.fn(),
}))

vi.mock('@/hooks/staff/use-platform-users', () => ({
  useStaffPlatformUsers: h.useStaffPlatformUsers,
  useCreatePlatformUser: h.useCreatePlatformUser,
  useSetPlatformUserActive: h.useSetPlatformUserActive,
  useResendPlatformUserInvite: h.useResendPlatformUserInvite,
}))
vi.mock('@/hooks/staff/use-staff-me', () => ({ useStaffMe: h.useStaffMe }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const me = { id: 'pu-1', externalUid: 'ext-1', email: 'carlos@rezeta.do', fullName: 'Carlos Féliz' }
const rows = [
  {
    id: 'pu-1',
    email: 'carlos@rezeta.do',
    fullName: 'Carlos Féliz',
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    lastLoginAt: '2026-07-20T09:00:00.000Z',
    status: 'active' as const,
  },
  {
    id: 'pu-2',
    email: 'laura@rezeta.do',
    fullName: 'Laura Medina',
    isActive: true,
    createdAt: '2026-07-18T00:00:00.000Z',
    lastLoginAt: null,
    status: 'invited' as const,
  },
]

const createMutation = { mutateAsync: vi.fn(), isPending: false }
const resendMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
const setActiveMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }

beforeEach(() => {
  vi.clearAllMocks()
  h.useStaffMe.mockReturnValue({ data: me })
  h.useStaffPlatformUsers.mockReturnValue({ data: rows, isLoading: false, isError: false })
  h.useCreatePlatformUser.mockReturnValue(createMutation)
  h.useSetPlatformUserActive.mockReturnValue(setActiveMutation)
  h.useResendPlatformUserInvite.mockReturnValue(resendMutation)
})

describe('PlatformUsers', () => {
  it('renders the roster with derived status and the You chip on own row', () => {
    render(<PlatformUsers />)
    expect(screen.getByText('Platform users')).toBeInTheDocument()
    expect(screen.getByText('Carlos Féliz')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Invite pending')).toBeInTheDocument()
  })

  it('does not offer Deactivate on the acting user’s own row', () => {
    render(<PlatformUsers />)
    const ownRow = screen.getByText('Carlos Féliz').closest('tr')!
    expect(ownRow.textContent).not.toContain('Deactivate')
    const otherRow = screen.getByText('Laura Medina').closest('tr')!
    expect(otherRow.textContent).toContain('Deactivate')
  })

  it('shows Resend link only for invited users and calls the mutation', async () => {
    render(<PlatformUsers />)
    const resend = screen.getByRole('button', { name: 'Resend link' })
    fireEvent.click(resend)
    await waitFor(() => expect(resendMutation.mutateAsync).toHaveBeenCalled())
  })

  it('submits the create form with the typed payload', async () => {
    createMutation.mutateAsync.mockResolvedValue(rows[1])
    render(<PlatformUsers />)
    fireEvent.click(screen.getByRole('button', { name: 'New user' }))
    fireEvent.change(screen.getByPlaceholderText('Laura Medina'), {
      target: { value: 'Nueva Persona' },
    })
    fireEvent.change(screen.getByPlaceholderText('laura@rezeta.do'), {
      target: { value: 'nueva@rezeta.do' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }))
    await waitFor(() =>
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({
        fullName: 'Nueva Persona',
        email: 'nueva@rezeta.do',
      }),
    )
  })

  it('renders the empty state when there are no users', () => {
    h.useStaffPlatformUsers.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<PlatformUsers />)
    expect(screen.getByText('No platform users yet')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/web test -- PlatformUsers`
Expected: FAIL — module `../PlatformUsers` not found.

- [ ] **Step 3: Build the page**

`apps/web/src/pages/staff/PlatformUsers.tsx` — structure copied from `apps/web/src/pages/settings/Users.tsx` (raw `<table>` + `Modal` + plain `useState`), English strings, no `useCan` (platform gating is `RequirePlatform` at the route level):

```tsx
import { useState } from 'react'
import type { CreatePlatformUserDto, PlatformUserApiDto } from '@rezeta/shared'
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  Field,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from '@/components/ui'
import { logger } from '@/lib/logger'
import { useStaffMe } from '@/hooks/staff/use-staff-me'
import {
  useCreatePlatformUser,
  useResendPlatformUserInvite,
  useSetPlatformUserActive,
  useStaffPlatformUsers,
} from '@/hooks/staff/use-platform-users'
import { platformUsersStrings as s } from './strings'

function CreateUserModal({ onClose }: { onClose: () => void }): JSX.Element {
  const createMutation = useCreatePlatformUser()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState(false)
  const canSubmit = fullName.trim().length >= 2 && email.includes('@')

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setError(false)
    try {
      await createMutation.mutateAsync({ fullName: fullName.trim(), email: email.trim() })
      onClose()
    } catch (err) {
      logger.error('Failed to create platform user', err)
      setError(true)
    }
  }

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose() }}>
      <ModalContent>
        <ModalHeader title={s.formTitle} showClose={false} />
        <form onSubmit={(e) => { void handleSubmit(e) }}>
          <ModalBody className="flex flex-col gap-4">
            <Field label={s.nameLabel} required>
              <Input
                type="text"
                placeholder={s.namePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoFocus
              />
            </Field>
            <Field label={s.emailLabel} required>
              <Input
                type="email"
                placeholder={s.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <p className="text-xs text-n-500">{s.linkNote}</p>
            {error && <Callout variant="danger" compact>{s.createError}</Callout>}
          </ModalBody>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {s.cancelButton}
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit || createMutation.isPending}>
              {createMutation.isPending ? s.creatingButton : s.createButton}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  )
}

function UserRow({ user, isSelf }: { user: PlatformUserApiDto; isSelf: boolean }): JSX.Element {
  const setActive = useSetPlatformUserActive(user.id)
  const resend = useResendPlatformUserInvite(user.id)
  const [actionError, setActionError] = useState(false)

  function run(promise: Promise<unknown>): void {
    setActionError(false)
    promise.catch((err: unknown) => {
      logger.error('Platform user action failed', err)
      setActionError(true)
    })
  }

  const statusLabel = !user.isActive
    ? s.statusDeactivated
    : user.status === 'invited'
      ? s.statusInvited
      : s.statusActive
  const statusVariant = !user.isActive ? 'archived' : user.status === 'invited' ? 'review' : 'active'

  return (
    <tr className="border-t border-n-100">
      <td className="px-4 py-3">
        <span className="font-medium text-n-800">{user.fullName ?? user.email}</span>
        <span className="block text-xs text-n-500">{user.email}</span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={statusVariant}>{statusLabel}</Badge>
      </td>
      <td className="px-4 py-3 text-sm text-n-600">
        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : s.neverAccessed}
      </td>
      <td className="px-4 py-3 text-right">
        {isSelf ? (
          <Badge variant="active">{s.youChip}</Badge>
        ) : (
          <span className="inline-flex gap-2">
            {user.isActive && user.status === 'invited' && (
              <Button
                variant="secondary"
                size="sm"
                disabled={resend.isPending}
                onClick={() => run(resend.mutateAsync())}
              >
                {s.resendButton}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              disabled={setActive.isPending}
              onClick={() => run(setActive.mutateAsync({ isActive: !user.isActive }))}
            >
              {user.isActive ? s.deactivateButton : s.reactivateButton}
            </Button>
          </span>
        )}
        {actionError && (
          <span className="block text-xs text-danger-text">{s.actionError}</span>
        )}
      </td>
    </tr>
  )
}

export function PlatformUsers(): JSX.Element {
  const { data: me } = useStaffMe()
  const { data: users, isLoading, isError } = useStaffPlatformUsers()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 font-serif font-medium text-n-900">{s.pageTitle}</h1>
          <p className="text-sm text-n-500">{s.pageSubtitle}</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          {s.newUserButton}
        </Button>
      </div>

      {isLoading && <Spinner />}
      {isError && <Callout variant="danger">{s.loadError}</Callout>}

      {users && users.length === 0 && <EmptyState title={s.emptyTitle} body={s.emptyBody} />}

      {users && users.length > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableUser}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableStatus}
                </th>
                <th className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left">
                  {s.tableLastAccess}
                </th>
                <th className="bg-n-50 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} isSelf={u.id === me?.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
```

Before running: check `EmptyState`'s actual prop names (`title`/`body` vs `description`) and `Badge`'s variant names against their source in `apps/web/src/components/ui/` and against usages in `settings/Users.tsx`; adjust to the real API. Same for `text-danger-text` — use whatever danger-text utility `Users.tsx` uses for inline errors.

- [ ] **Step 4: Add nav to StaffLayout**

In `apps/web/src/components/layout/StaffLayout.tsx`, add `NavLink` to the `react-router-dom` import and insert a nav bar between `</header>` and `<main>`:

```tsx
      <nav className="flex gap-1 border-b border-n-200 bg-n-0 px-6">
        <StaffNavLink to="/staff/institutions/new" label={staffStrings.navInstitutions} />
        <StaffNavLink to="/staff/platform-users" label={staffStrings.navPlatformUsers} />
      </nav>
```

with this small component in the same file:

```tsx
function StaffNavLink({ to, label }: { to: string; label: string }): JSX.Element {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? 'border-b-2 border-p-500 px-3 py-2 text-sm font-medium text-p-700'
          : 'border-b-2 border-transparent px-3 py-2 text-sm text-n-500'
      }
    >
      {label}
    </NavLink>
  )
}
```

- [ ] **Step 5: Register the route**

In `apps/web/src/App.tsx`: add `import { PlatformUsers } from '@/pages/staff/PlatformUsers'` next to the `NewInstitution` import (~line 35), and inside the staff children array (after the `staff/institutions/new` entry, ~line 287) add:

```tsx
      { path: 'staff/platform-users', element: <PlatformUsers /> },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @rezeta/web test -- PlatformUsers` → PASS (5 tests).
Run: `pnpm --filter @rezeta/web test` → full web suite PASS (catches StaffLayout/App regressions).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/staff/PlatformUsers.tsx apps/web/src/pages/staff/__tests__/PlatformUsers.test.tsx apps/web/src/components/layout/StaffLayout.tsx apps/web/src/App.tsx
git commit -m "feat(web): staff platform-users roster page with create modal and nav"
```

---

### Task 10: Full verification + changelog

**Files:**
- Modify: `CHANGELOG.md` (prepend entry)

- [ ] **Step 1: Full workspace verification**

Run from repo root, all must pass:

```bash
pnpm lint
pnpm test
pnpm test:coverage
```

Expected: zero lint errors, zero failing tests, coverage ≥95% per file on every new/modified file. If a new file misses the gate, add the missing test cases in that file's own `__tests__` before proceeding.

- [ ] **Step 2: End-to-end smoke (manual, dev env)**

With the dev servers running (`pnpm dev`), sign in as an existing platform user, open `/staff/platform-users`, create a test user, confirm the set-password link appears in the API logs (`InvitationMailerService` logs it — no email provider is wired), resend, deactivate, reactivate. Delete the test user's row + auth identity afterwards (or leave deactivated).

- [ ] **Step 3: Changelog entry (English), prepend to `CHANGELOG.md`**

```markdown
## [<today's date>] Staff-user management (identity slice 1)

### Added

- `/v1/staff/identity/users` endpoints (list, create, deactivate/reactivate,
  resend set-password link) with `PlatformUsersService` — invite-flow
  compensation, self-deactivation guard, and tenantless control-plane audits
  (`actorType: 'system'` + `metadata.platformUserId`).
- Staff console page `/staff/platform-users` (`PlatformUsers.tsx`) with roster
  table, create modal, and per-row actions; staff-console nav in
  `StaffLayout.tsx`.
- `platform_users.last_login_at` column, stamped by `AuthGuard` on first
  platform sign-in; drives the `invited`/`active` roster status.
- Shared schemas `CreatePlatformUserSchema` / `PlatformUserApiSchema`
  (`packages/shared/src/schemas/platform-users.ts`).

### Changed

- `bootstrap:platform` CLI is now needed only for the first staff account on a
  fresh deployment; day-to-day staff-user management moves to the staff console.
- `UsersModule` exports `InvitationMailerService` for reuse by
  `PlatformUsersModule`.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for staff-user management slice"
```

---

## Out of scope (later slices — do NOT build here)

Identity Platform upgrade, Google login, `LoginEvent`/`UserDevice` tables, MFA, SSO, security dashboards, and any transactional-email provider. `InvitationMailerService` stays log-only.
