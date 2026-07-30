# Login Telemetry + Institution Security Panel Implementation Plan (Identity slice 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every successful and blocked institution login is recorded (`LoginEvent`) and the device seen is upserted (`UserDevice`); institution admins get Ajustes → Seguridad (stat tiles, filterable login-activity table, CSV export) and any authenticated user gets a self-service device list + "Cerrar todas las sesiones" on their profile.

**Architecture:** Two new provider-agnostic telemetry tables (no FKs — see identity design §4, §10 plan-B exit). A new `apps/api/src/modules/identity/` module owns them: `LoginTelemetryService` (write path, called fire-and-forget from `AuthService.provision` and `AuthGuard`'s deactivated-user rejection) and `IdentityService`/`IdentityController` (read path — tenant-scoped security summary/logins/CSV, plus self-service devices + sign-out-all, which calls the existing `IAuthProvider.revokeUserSessions`). Web: Ajustes → Seguridad page mirroring `AuditLog.tsx`'s filter/export pattern, and a small `ProfileDevices` card added to `Settings.tsx`.

**Tech Stack:** NestJS + Prisma + Zod (shared schemas), React + TanStack Query + Radix/CVA components, Vitest (+ real-Postgres integration harness).

**Spec:** `docs/superpowers/specs/2026-07-19-identity-module-design.md` (§3 architecture, §4 data model, §6 screens 2–3, §7 reports). Builds on identity slice 1 (`docs/superpowers/plans/2026-07-20-01-staff-user-management.md`, merged).

## Global Constraints

- All code, comments, tests, changelog in **English**. Institution-facing UI strings (Ajustes → Seguridad, the profile devices card) are **Spanish**, colocated in `apps/web/src/pages/settings/strings.ts` per the existing `settingsStrings`/`usersStrings`/`auditLogStrings` pattern.
- No arbitrary Tailwind values (`w-[440px]`-style) — tokens only.
- No `TODO`/`FIXME` comments (ESLint `no-warning-comments` fails CI).
- UUIDs for PKs; `snake_case` DB columns via `@map`. `LoginEvent`/`UserDevice` are **append-only telemetry with no FKs** (provider-agnostic by design — identity design §4/§10) and no soft-delete column; they are not part of the immutable `AuditLog` legal trail.
- Coverage gate: **95% per file** (`pnpm test:coverage`). Pages/hooks are excluded by pre-existing project convention (see `docs/superpowers/plans/2026-07-28-02-staff-institutions-list.md` Global Constraints) — service/repository/controller/schema files are not.
- Each commit must keep the whole workspace typechecking (pre-commit hook runs `pnpm lint` + workspace `typecheck`). If lint hits `no-unsafe-*` on `@rezeta/shared` types after a shared-package change, run `pnpm --filter @rezeta/shared build` (stale dist) and retry.
- Commit-message subjects must be lower-case (commitlint); append trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Migration command form: `pnpm --filter @rezeta/db exec prisma migrate dev --schema=prisma/schema.prisma --name <name>` (requires the local dev database from `.env` to be up).
- Integration tests: `pnpm --filter @rezeta/api test:integration -- <pattern>`. `TEST_DATABASE_URL` is configured on this machine; Postgres runs in the `rezeta-postgres` Docker container — if it is down, `docker start rezeta-postgres`. Every `*.int-spec.ts` file guards its top-level `describe` with `describe.skipIf(!hasTestDb())`.
- Run commands from the repo root unless the step says otherwise.
- **No failed-password telemetry.** Firebase/Identity Platform client auth means a wrong password never reaches the API — the client SDK rejects it locally, so there is no server-side "failed password" event to capture in this milestone. `LoginEvent.outcome` only ever takes `'success'` (successful provision) or `'blocked'` (a verified token whose institution user is deactivated). See identity design §2 decision 1 and Out of scope below.

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/schemas/identity.ts` (new) | `LoginEventItemSchema`, `SecuritySummarySchema`, `UserDeviceItemSchema` + DTOs |
| `packages/shared/src/schemas/index.ts` (modify) | Export the new schema module |
| `packages/db/prisma/schema.prisma` (modify) | `LoginEvent`, `UserDevice` models |
| `packages/db/prisma/migrations/<ts>_login_events_user_devices/` (generated) | Migration |
| `apps/api/src/modules/identity/identity.repository.ts` (new) | Prisma access for both tables + summary aggregates |
| `apps/api/src/modules/identity/login-telemetry.service.ts` (new) | `recordLogin`, `upsertDevice`, `mapFirebaseSignInMethod`, `fingerprintFor` |
| `apps/api/src/modules/identity/identity.service.ts` (new) | Tenant security reads + self-service devices/sign-out-all |
| `apps/api/src/modules/identity/identity.controller.ts` (new) | `/v1/identity/*` routes |
| `apps/api/src/modules/identity/identity.module.ts` (new) | Wires the above |
| `apps/api/src/modules/identity/index.ts` (new) | Barrel exports |
| `apps/api/src/modules/auth/auth.service.ts` (modify) | `provision` calls `recordLogin` + `upsertDevice` |
| `apps/api/src/modules/auth/auth.module.ts` (modify) | Import `IdentityModule` |
| `apps/api/src/common/guards/auth.guard.ts` (modify) | Deactivated-institution-user rejection records a blocked `LoginEvent` |
| `apps/api/src/app.module.ts` (modify) | Import `IdentityModule` (needed for the global `AuthGuard`'s DI) |
| `apps/web/src/hooks/identity/use-security.ts` (new) | `useSecuritySummary`, `useSecurityLogins`, `downloadSecurityLoginsCsv` |
| `apps/web/src/hooks/identity/use-my-devices.ts` (new) | `useMyDevices`, `useSignOutAllSessions` |
| `apps/web/src/pages/settings/strings.ts` (modify) | `securityStrings`, `profileDevicesStrings` + hub link strings |
| `apps/web/src/pages/settings/Security.tsx` (new) | Ajustes → Seguridad page |
| `apps/web/src/pages/settings/ProfileDevices.tsx` (new) | Self-service devices card |
| `apps/web/src/pages/Settings.tsx` (modify) | Renders `ProfileDevices` + Seguridad hub link |
| `apps/web/src/App.tsx` (modify) | `/ajustes/seguridad` route |

---

### Task 1: `LoginEvent` + `UserDevice` schema and migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append after `model PlatformUser`, the last model in the file)

**Interfaces:**
- Produces: `LoginEvent`/`UserDevice` Prisma models — used by Tasks 2–4.

- [ ] **Step 1: Append the models.** In `packages/db/prisma/schema.prisma`, after the closing `}` of `model PlatformUser` (end of file):

```prisma

/// Provider-agnostic auth telemetry purpose-built for the security dashboards
/// (identity module design §4, §6 screens 2-3). NOT part of the immutable
/// AuditLog legal trail, and intentionally has NO foreign keys — that keeps it
/// valid across a future auth-provider migration (see the plan-B exit runbook,
/// identity design §10) and lets it survive a User/PlatformUser row being
/// hard-deleted. Exactly one of userId/platformUserId is set per row (or
/// neither, for a blocked attempt against an identity with no matching row);
/// the service/guard layer enforces that, not a DB constraint. Retained for
/// 12 months, then purged by a scheduled job (out of scope this slice).
model LoginEvent {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String?  @map("tenant_id") @db.Uuid
  userId         String?  @map("user_id") @db.Uuid
  platformUserId String?  @map("platform_user_id") @db.Uuid
  outcome        String   @db.VarChar(20) // success | blocked
  method         String   @db.VarChar(20) // password | google | sso | unknown
  ipAddress      String?  @map("ip_address") @db.VarChar(64)
  userAgent      String?  @map("user_agent") @db.VarChar(512)
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([tenantId, createdAt])
  @@index([userId, createdAt])
  @@map("login_events")
}

/// Devices seen per user — powers "new device" chips (future slice) and the
/// self-service device list (identity design §6 screen 2). Fingerprint =
/// sha256(`${userAgent}|${ip}`), computed server-side by LoginTelemetryService.
/// Same no-FK, provider-agnostic rationale as LoginEvent.
model UserDevice {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String?  @map("tenant_id") @db.Uuid
  userId         String?  @map("user_id") @db.Uuid
  platformUserId String?  @map("platform_user_id") @db.Uuid
  fingerprint    String   @db.VarChar(128)
  userAgent      String?  @map("user_agent") @db.VarChar(512)
  firstSeenAt    DateTime @default(now()) @map("first_seen_at")
  lastSeenAt     DateTime @default(now()) @map("last_seen_at")

  @@unique([userId, fingerprint])
  @@index([userId])
  @@map("user_devices")
}
```

- [ ] **Step 2: Generate the migration.**

Run: `pnpm --filter @rezeta/db exec prisma migrate dev --schema=prisma/schema.prisma --name login_events_user_devices`
Expected: a new folder under `packages/db/prisma/migrations/` creating `login_events` and `user_devices` tables, and a regenerated Prisma client.

- [ ] **Step 3: Verify the workspace still typechecks.**

Run: `pnpm -r typecheck` → PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add login_events and user_devices tables"
```

---

### Task 2: Shared DTOs + `LoginTelemetryService`/`IdentityRepository` write path + `AuthService`/`AuthGuard` wiring

**Files:**
- Create: `packages/shared/src/schemas/identity.ts`
- Modify: `packages/shared/src/schemas/index.ts`
- Create: `apps/api/src/modules/identity/identity.repository.ts`
- Create: `apps/api/src/modules/identity/login-telemetry.service.ts`
- Create: `apps/api/src/modules/identity/identity.module.ts` (write-path providers only; Task 3 adds the controller/service)
- Create: `apps/api/src/modules/identity/index.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/common/guards/auth.guard.ts`
- Modify: `apps/api/src/app.module.ts` (import `IdentityModule` — required now because `AuthGuard`, a global `APP_GUARD`, resolves `LoginTelemetryService` from the app-level DI graph)
- Test: `packages/shared/src/schemas/__tests__/identity.spec.ts` (new), `apps/api/src/modules/identity/__tests__/identity.repository.spec.ts` (new), `apps/api/src/modules/identity/__tests__/login-telemetry.service.spec.ts` (new), `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (extend), `apps/api/src/common/guards/__tests__/auth.guard.spec.ts` (extend)

**Interfaces:**
- Produces: `LoginEventItemDto`/`SecuritySummaryDto`/`UserDeviceItemDto` in `@rezeta/shared`; `LoginTelemetryService.recordLogin(input)`/`.upsertDevice(input)`; `IdentityRepository` write + read methods — read methods (`listLoginsForTenant`, `findUserNames`, `securitySummary`, `listDevicesForUser`) are built now so Task 3 only has to add the controller/service layer on top.

- [ ] **Step 1: Failing shared-schema test.**

`packages/shared/src/schemas/__tests__/identity.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LoginEventItemSchema, SecuritySummarySchema, UserDeviceItemSchema } from '../identity.js'

describe('LoginEventItemSchema', () => {
  it('accepts a successful login row', () => {
    const parsed = LoginEventItemSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      userId: '22222222-2222-4333-8444-555555555555',
      userName: 'Dra. Ana García',
      outcome: 'success',
      method: 'password',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      createdAt: '2026-07-28T12:00:00.000Z',
    })
    expect(parsed.outcome).toBe('success')
  })

  it('accepts a blocked row with null userId/userName', () => {
    const parsed = LoginEventItemSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      userId: null,
      userName: null,
      outcome: 'blocked',
      method: 'unknown',
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-07-28T12:00:00.000Z',
    })
    expect(parsed.userId).toBeNull()
  })

  it('rejects an unknown outcome or method', () => {
    const base = {
      id: '11111111-2222-4333-8444-555555555555',
      userId: null,
      userName: null,
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-07-28T12:00:00.000Z',
    }
    expect(() => LoginEventItemSchema.parse({ ...base, outcome: 'pending', method: 'password' })).toThrow()
    expect(() => LoginEventItemSchema.parse({ ...base, outcome: 'success', method: 'oauth' })).toThrow()
  })
})

describe('SecuritySummarySchema', () => {
  it('accepts a summary payload', () => {
    const parsed = SecuritySummarySchema.parse({
      logins: 42,
      distinctUsers: 5,
      blocked: 1,
      dormantUsers30d: 2,
    })
    expect(parsed.logins).toBe(42)
  })

  it('rejects negative counts', () => {
    expect(() =>
      SecuritySummarySchema.parse({ logins: -1, distinctUsers: 0, blocked: 0, dormantUsers30d: 0 }),
    ).toThrow()
  })
})

describe('UserDeviceItemSchema', () => {
  it('accepts a device row', () => {
    const parsed = UserDeviceItemSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      fingerprint: 'a'.repeat(64),
      userAgent: 'Mozilla/5.0',
      firstSeenAt: '2026-07-01T00:00:00.000Z',
      lastSeenAt: '2026-07-28T00:00:00.000Z',
    })
    expect(parsed.fingerprint).toHaveLength(64)
  })
})
```

- [ ] **Step 2:** `pnpm --filter @rezeta/shared test -- identity` → FAIL (module not found).

- [ ] **Step 3: Implement the shared schemas.**

`packages/shared/src/schemas/identity.ts`:

```ts
import { z } from 'zod'

/**
 * Identity module DTOs (`/v1/identity/*`) — login telemetry + device registry.
 * Slice 3 of the identity module design (§4, §5, §6 screens 2-3). LoginEvent/
 * UserDevice are provider-agnostic telemetry tables, not part of the AuditLog
 * legal trail (see schema.prisma model comments).
 */

export const LoginOutcomeSchema = z.enum(['success', 'blocked'])
export const LoginMethodSchema = z.enum(['password', 'google', 'sso', 'unknown'])

export const LoginEventItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  userName: z.string().nullable(),
  outcome: LoginOutcomeSchema,
  method: LoginMethodSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string(),
})
export type LoginEventItemDto = z.infer<typeof LoginEventItemSchema>

export const SecuritySummarySchema = z.object({
  logins: z.number().int().nonnegative(),
  distinctUsers: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  dormantUsers30d: z.number().int().nonnegative(),
})
export type SecuritySummaryDto = z.infer<typeof SecuritySummarySchema>

export const UserDeviceItemSchema = z.object({
  id: z.string().uuid(),
  fingerprint: z.string(),
  userAgent: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
})
export type UserDeviceItemDto = z.infer<typeof UserDeviceItemSchema>
```

In `packages/shared/src/schemas/index.ts`, add after `export * from './consultation-record.js'` and before `export * from './invoice.js'`:

```ts
export * from './identity.js'
```

- [ ] **Step 4:** `pnpm --filter @rezeta/shared test -- identity` → PASS (6 tests). Then `pnpm --filter @rezeta/shared build` (so the API package resolves the new export from dist, per the stale-dist workaround).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/identity.ts packages/shared/src/schemas/index.ts packages/shared/src/schemas/__tests__/identity.spec.ts
git commit -m "feat(shared): login telemetry and device registry DTOs"
```

- [ ] **Step 6: Failing repository tests.**

`apps/api/src/modules/identity/__tests__/identity.repository.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityRepository } from '../identity.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const prisma = {
  loginEvent: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  userDevice: { upsert: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn(), findMany: vi.fn() },
} as unknown as PrismaService

function makeRepo(): IdentityRepository {
  return new IdentityRepository(prisma)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IdentityRepository', () => {
  it('insertLoginEvent creates a row with the given fields', async () => {
    vi.mocked(prisma.loginEvent.create).mockResolvedValue({} as never)
    const input = {
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      outcome: 'success',
      method: 'password',
      ipAddress: '1.1.1.1',
      userAgent: 'UA',
    }
    await makeRepo().insertLoginEvent(input)
    expect(prisma.loginEvent.create).toHaveBeenCalledWith({ data: input })
  })

  it('upsertDevice keys on the [userId, fingerprint] compound unique and bumps lastSeenAt', async () => {
    vi.mocked(prisma.userDevice.upsert).mockResolvedValue({} as never)
    await makeRepo().upsertDevice({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: 'fp1',
      userAgent: 'UA',
    })
    expect(prisma.userDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_fingerprint: { userId: 'u1', fingerprint: 'fp1' } },
        create: expect.objectContaining({
          fingerprint: 'fp1',
          firstSeenAt: expect.any(Date),
          lastSeenAt: expect.any(Date),
        }),
        update: expect.objectContaining({ lastSeenAt: expect.any(Date), userAgent: 'UA' }),
      }),
    )
  })

  it('listDevicesForUser orders by lastSeenAt desc', async () => {
    vi.mocked(prisma.userDevice.findMany).mockResolvedValue([] as never)
    await makeRepo().listDevicesForUser('u1')
    expect(prisma.userDevice.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { lastSeenAt: 'desc' },
    })
  })

  it('listLoginsForTenant filters by tenant/since/optional userId and takes the limit', async () => {
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValue([] as never)
    const since = new Date('2026-07-21T00:00:00Z')
    await makeRepo().listLoginsForTenant('t1', { since, userId: 'u1', limit: 50 })
    expect(prisma.loginEvent.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', createdAt: { gte: since }, userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('findUserNames maps ids to fullName-or-email', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', fullName: 'Ana', email: 'ana@rezeta.do' },
      { id: 'u2', fullName: null, email: 'bo@rezeta.do' },
    ] as never)
    const map = await makeRepo().findUserNames(['u1', 'u2'])
    expect(map.get('u1')).toBe('Ana')
    expect(map.get('u2')).toBe('bo@rezeta.do')
  })

  it('securitySummary aggregates logins/blocked/distinctUsers/dormantUsers30d', async () => {
    vi.mocked(prisma.loginEvent.count).mockResolvedValueOnce(10).mockResolvedValueOnce(2)
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValueOnce([
      { userId: 'u1' },
      { userId: 'u2' },
    ] as never)
    vi.mocked(prisma.user.count).mockResolvedValue(3)
    const since = new Date('2026-07-21T00:00:00Z')
    const result = await makeRepo().securitySummary('t1', since)
    expect(result).toEqual({ logins: 10, blocked: 2, distinctUsers: 2, dormantUsers30d: 3 })
  })
})
```

- [ ] **Step 7:** `pnpm --filter @rezeta/api test -- identity.repository` → FAIL (module not found).

- [ ] **Step 8: Implement `IdentityRepository`.**

`apps/api/src/modules/identity/identity.repository.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

export interface InsertLoginEventInput {
  tenantId: string | null
  userId: string | null
  platformUserId: string | null
  outcome: string
  method: string
  ipAddress: string | null
  userAgent: string | null
}

export interface UpsertDeviceInput {
  tenantId: string | null
  userId: string | null
  platformUserId: string | null
  fingerprint: string
  userAgent: string | null
}

export interface UserDeviceRow {
  id: string
  fingerprint: string
  userAgent: string | null
  firstSeenAt: Date
  lastSeenAt: Date
}

export interface LoginEventRow {
  id: string
  userId: string | null
  outcome: string
  method: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface SecuritySummaryRow {
  logins: number
  distinctUsers: number
  blocked: number
  dormantUsers30d: number
}

/**
 * Prisma access for LoginEvent (write-heavy, from LoginTelemetryService) and
 * UserDevice + the tenant security reads (IdentityService, Task 3). Both
 * tables are intentionally FK-less telemetry (see schema.prisma model
 * comments) — no tenant filter is baked in here; every write/read caller
 * passes tenantId explicitly.
 */
@Injectable()
export class IdentityRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async insertLoginEvent(input: InsertLoginEventInput): Promise<void> {
    await this.prisma.loginEvent.create({ data: input })
  }

  /**
   * Keys on the [userId, fingerprint] compound unique. Every current caller
   * supplies a non-null userId (device tracking only runs for a successfully
   * authenticated institution user); the schema still allows a null userId
   * for future platform-staff device tracking (out of scope this slice).
   */
  async upsertDevice(input: UpsertDeviceInput): Promise<void> {
    const now = new Date()
    await this.prisma.userDevice.upsert({
      where: {
        userId_fingerprint: { userId: input.userId as string, fingerprint: input.fingerprint },
      },
      create: { ...input, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now, userAgent: input.userAgent },
    })
  }

  async listDevicesForUser(userId: string): Promise<UserDeviceRow[]> {
    return this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    })
  }

  async listLoginsForTenant(
    tenantId: string,
    filters: { since: Date; userId?: string; limit: number },
  ): Promise<LoginEventRow[]> {
    return this.prisma.loginEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: filters.since },
        ...(filters.userId ? { userId: filters.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    })
  }

  /** Batch name resolution — one query for every distinct userId on a page of login events. */
  async findUserNames(ids: string[]): Promise<Map<string, string | null>> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, email: true },
    })
    return new Map(rows.map((r) => [r.id, r.fullName ?? r.email]))
  }

  /**
   * dormantUsers30d reads User.lastLoginAt (already stamped by AuthGuard)
   * rather than LoginEvent — LoginEvent is purged after 12 months (identity
   * design §4) but dormancy needs a stable no-login signal independent of
   * that retention window. Fixed 30-day window regardless of the `since`
   * argument used for the other three counts (identity design §6 screen 3
   * shows "Sin acceso 30d" as a fixed tile, not filtered by the days range).
   */
  async securitySummary(tenantId: string, since: Date): Promise<SecuritySummaryRow> {
    const dormantCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [logins, blocked, distinctUserRows, dormantUsers30d] = await Promise.all([
      this.prisma.loginEvent.count({
        where: { tenantId, createdAt: { gte: since }, outcome: 'success' },
      }),
      this.prisma.loginEvent.count({
        where: { tenantId, createdAt: { gte: since }, outcome: 'blocked' },
      }),
      this.prisma.loginEvent.findMany({
        where: { tenantId, createdAt: { gte: since }, outcome: 'success', userId: { not: null } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.user.count({
        where: {
          tenantId,
          deletedAt: null,
          isActive: true,
          OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: dormantCutoff } }],
        },
      }),
    ])
    return { logins, blocked, distinctUsers: distinctUserRows.length, dormantUsers30d }
  }
}
```

- [ ] **Step 9:** `pnpm --filter @rezeta/api test -- identity.repository` → PASS (6 tests).

- [ ] **Step 10: Failing `LoginTelemetryService` tests.**

`apps/api/src/modules/identity/__tests__/login-telemetry.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { LoginTelemetryService, fingerprintFor, mapFirebaseSignInMethod } from '../login-telemetry.service.js'
import type { IdentityRepository } from '../identity.repository.js'

const mockRepo = { insertLoginEvent: vi.fn(), upsertDevice: vi.fn() }

function makeService(): LoginTelemetryService {
  return new LoginTelemetryService(mockRepo as unknown as IdentityRepository)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordLogin', () => {
  it('inserts a login event, normalizing missing fields to null', async () => {
    mockRepo.insertLoginEvent.mockResolvedValue(undefined)
    await makeService().recordLogin({ tenantId: 't1', userId: 'u1', outcome: 'success', method: 'password' })
    expect(mockRepo.insertLoginEvent).toHaveBeenCalledWith({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      outcome: 'success',
      method: 'password',
      ipAddress: null,
      userAgent: null,
    })
  })

  it('propagates repository failures — callers are responsible for their own .catch (see AuthGuard/AuthService)', async () => {
    const err = new Error('db down')
    mockRepo.insertLoginEvent.mockRejectedValue(err)
    await expect(makeService().recordLogin({ outcome: 'blocked', method: 'unknown' })).rejects.toBe(err)
  })
})

describe('upsertDevice', () => {
  it('computes a deterministic sha256 fingerprint and upserts', async () => {
    mockRepo.upsertDevice.mockResolvedValue(undefined)
    await makeService().upsertDevice({
      tenantId: 't1',
      userId: 'u1',
      userAgent: 'Mozilla/5.0',
      ipAddress: '10.0.0.1',
    })
    const expected = createHash('sha256').update('Mozilla/5.0|10.0.0.1').digest('hex')
    expect(mockRepo.upsertDevice).toHaveBeenCalledWith({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: expected,
      userAgent: 'Mozilla/5.0',
    })
  })
})

describe('fingerprintFor', () => {
  it('is deterministic for the same inputs and differs for different inputs', () => {
    const a = fingerprintFor('UA-1', '1.1.1.1')
    const b = fingerprintFor('UA-1', '1.1.1.1')
    const c = fingerprintFor('UA-2', '1.1.1.1')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toHaveLength(64)
  })

  it('handles missing userAgent/ip without throwing', () => {
    expect(fingerprintFor(null, undefined)).toHaveLength(64)
  })
})

describe('mapFirebaseSignInMethod', () => {
  it('maps the password provider', () => {
    expect(mapFirebaseSignInMethod({ firebase: { sign_in_provider: 'password' } })).toBe('password')
  })
  it('maps google.com to google', () => {
    expect(mapFirebaseSignInMethod({ firebase: { sign_in_provider: 'google.com' } })).toBe('google')
  })
  it('maps anything else, or missing claims, to unknown', () => {
    expect(mapFirebaseSignInMethod({ firebase: { sign_in_provider: 'saml.example.com' } })).toBe('unknown')
    expect(mapFirebaseSignInMethod({})).toBe('unknown')
  })
})
```

- [ ] **Step 11:** `pnpm --filter @rezeta/api test -- login-telemetry` → FAIL (module not found).

- [ ] **Step 12: Implement `LoginTelemetryService`.**

`apps/api/src/modules/identity/login-telemetry.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { IdentityRepository } from './identity.repository.js'

export type LoginOutcome = 'success' | 'blocked'
export type LoginMethod = 'password' | 'google' | 'sso' | 'unknown'

export interface RecordLoginInput {
  tenantId?: string | null
  userId?: string | null
  platformUserId?: string | null
  outcome: LoginOutcome
  method: LoginMethod
  ipAddress?: string | null
  userAgent?: string | null
}

export interface UpsertDeviceInput {
  tenantId?: string | null
  userId?: string | null
  platformUserId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** sha256(`${userAgent}|${ip}`) — deterministic, stores no more PII than the raw UA/IP already carry. */
export function fingerprintFor(
  userAgent: string | null | undefined,
  ipAddress: string | null | undefined,
): string {
  return createHash('sha256').update(`${userAgent ?? ''}|${ipAddress ?? ''}`).digest('hex')
}

/** Firebase `sign_in_provider` → our closed LoginMethod enum. Unrecognized/absent claims map to 'unknown'. */
export function mapFirebaseSignInMethod(rawClaims: Record<string, unknown>): LoginMethod {
  const firebase = rawClaims['firebase'] as { sign_in_provider?: string } | undefined
  if (firebase?.sign_in_provider === 'password') return 'password'
  if (firebase?.sign_in_provider === 'google.com') return 'google'
  return 'unknown'
}

/**
 * Login telemetry (LoginEvent) + device registry (UserDevice) writes.
 * Neither method catches its own errors — matching the codebase's existing
 * fire-and-forget convention (see AuthGuard.markSignedIn): callers invoke
 * these with `void ...().catch((err) => logger.warn(...))` so a telemetry
 * outage never blocks a login. See AuthService.provision and AuthGuard below.
 */
@Injectable()
export class LoginTelemetryService {
  constructor(@Inject(IdentityRepository) private repository: IdentityRepository) {}

  async recordLogin(input: RecordLoginInput): Promise<void> {
    await this.repository.insertLoginEvent({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      outcome: input.outcome,
      method: input.method,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
  }

  async upsertDevice(input: UpsertDeviceInput): Promise<void> {
    await this.repository.upsertDevice({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      fingerprint: fingerprintFor(input.userAgent, input.ipAddress),
      userAgent: input.userAgent ?? null,
    })
  }
}
```

- [ ] **Step 13:** `pnpm --filter @rezeta/api test -- login-telemetry` → PASS (9 tests).

- [ ] **Step 14: Module + barrel (write-path only for now).**

`apps/api/src/modules/identity/identity.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'

@Module({
  providers: [IdentityRepository, LoginTelemetryService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
```

`apps/api/src/modules/identity/index.ts`:

```ts
export { IdentityModule } from './identity.module.js'
export { IdentityRepository } from './identity.repository.js'
export {
  LoginTelemetryService,
  fingerprintFor,
  mapFirebaseSignInMethod,
  type LoginOutcome,
  type LoginMethod,
} from './login-telemetry.service.js'
```

- [ ] **Step 15: Wire `AuthGuard`.**

In `apps/api/src/common/guards/auth.guard.ts`, add the import (alongside the other module imports):

```ts
import { LoginTelemetryService } from '../../modules/identity/index.js'
```

Add a constructor param (last position):

```ts
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(UsersRepository) private users: UsersRepository,
    @Inject(PlatformUsersRepository) private platformUsers: PlatformUsersRepository,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(PermissionsService) private permissions: PermissionsService,
    @Inject(LoginTelemetryService) private loginTelemetry: LoginTelemetryService,
  ) {}
```

Replace the deactivated-institution-user check (currently `if (!user.isActive) { throw new UnauthorizedException(...) }`) with:

```ts
    if (!user.isActive) {
      void this.loginTelemetry
        .recordLogin({
          tenantId: user.tenantId,
          userId: user.id,
          outcome: 'blocked',
          method: 'unknown',
          ...(request.ip ? { ipAddress: request.ip } : {}),
          ...(typeof request.headers['user-agent'] === 'string'
            ? { userAgent: request.headers['user-agent'] }
            : {}),
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `Failed to record blocked login for user id=${user.id}: ${(err as Error).message}`,
          )
        })
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'User account is deactivated',
      })
    }
```

- [ ] **Step 16: Extend `auth.guard.spec.ts`.**

Add a mock alongside the existing `mockPermissions`:

```ts
const mockLoginTelemetry = { recordLogin: vi.fn().mockResolvedValue(undefined) }
```

Add it as the last argument in the `beforeEach`'s `guard = new AuthGuard(...)` call, and reset it in `beforeEach` alongside the other `vi.clearAllMocks()`/mock setup. Add two new tests right after the existing `'throws UnauthorizedException when user is inactive'` test:

```ts
  it('records a blocked login event when an inactive institution user is rejected', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    mockUsers.findByExternalUid.mockResolvedValue({ ...validUser, isActive: false })
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' }, ip: '10.0.0.1' })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
    expect(mockLoginTelemetry.recordLogin).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', userId: 'user-1', outcome: 'blocked' }),
    )
  })

  it('still rejects when the blocked-login telemetry write itself fails', async () => {
    mockAuthProvider.verifyToken.mockResolvedValue(verifiedToken)
    mockUsers.findByExternalUid.mockResolvedValue({ ...validUser, isActive: false })
    mockLoginTelemetry.recordLogin.mockRejectedValueOnce(new Error('db down'))
    const ctx = makeCtx({ headers: { authorization: 'Bearer valid-token' } })
    await expect(guard.canActivate(ctx as never)).rejects.toThrow(UnauthorizedException)
  })
```

- [ ] **Step 17:** `pnpm --filter @rezeta/api test -- auth.guard` → PASS, including all pre-existing tests.

- [ ] **Step 18: Wire `AuthService.provision`.**

In `apps/api/src/modules/auth/auth.service.ts`, add imports:

```ts
import { Injectable, Inject, ForbiddenException, Logger } from '@nestjs/common'
```

```ts
import { LoginTelemetryService, mapFirebaseSignInMethod } from '../identity/index.js'
```

Add a `logger` field and the constructor param (last position):

```ts
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    @Inject(UsersRepository) private repository: UsersRepository,
    @Inject(ConfigService) private config: ConfigService<AppConfig, true>,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(PermissionsService) private permissions: PermissionsService,
    @Inject(LoginTelemetryService) private loginTelemetry: LoginTelemetryService,
  ) {}
```

In `provision`, after the existing `void this.auditLog.record({...})` call and before `return user`:

```ts
    const method = mapFirebaseSignInMethod(verified.rawClaims)
    const telemetryMeta = {
      ...(meta?.ip ? { ipAddress: meta.ip } : {}),
      ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
    }
    void Promise.all([
      this.loginTelemetry.recordLogin({
        tenantId: user.tenantId,
        userId: user.id,
        outcome: 'success',
        method,
        ...telemetryMeta,
      }),
      this.loginTelemetry.upsertDevice({ tenantId: user.tenantId, userId: user.id, ...telemetryMeta }),
    ]).catch((err: unknown) => {
      this.logger.warn(
        `Failed to record login telemetry for user id=${user.id}: ${(err as Error).message}`,
      )
    })

    return user
```

**Design note (not in the locked decisions, resolved here):** the identity design only says "AuthService.provision calls LoginTelemetryService after successful provision." It names `recordLogin` explicitly but the self-service device list (§6 screen 2, wired in Task 5) has no other write path in this slice — so `upsertDevice` is called from the same `provision` call site as `recordLogin`, using the same `ip`/`userAgent` meta. Without this, `GET /v1/identity/me/devices` would always return an empty list.

- [ ] **Step 19: Extend `auth.service.spec.ts`.**

Add a mock:

```ts
const mockLoginTelemetry = { recordLogin: vi.fn().mockResolvedValue(undefined), upsertDevice: vi.fn().mockResolvedValue(undefined) }
```

Add it as the 6th argument to `makeService`'s `new AuthService(...)` call. Add tests inside the `describe('provision', ...)` block:

```ts
    it('records login telemetry (mapped method) and upserts a device after provision', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = {
        externalUid: 'fb1',
        email: 'dr@test.com',
        rawClaims: { firebase: { sign_in_provider: 'password' } },
      } as never
      await service.provision(verified, { ip: '192.168.1.1', userAgent: 'TestBrowser/1.0' })
      expect(mockLoginTelemetry.recordLogin).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          userId: 'u1',
          outcome: 'success',
          method: 'password',
          ipAddress: '192.168.1.1',
          userAgent: 'TestBrowser/1.0',
        }),
      )
      expect(mockLoginTelemetry.upsertDevice).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', userId: 'u1', ipAddress: '192.168.1.1' }),
      )
    })

    it('maps a google.com sign-in provider to method "google"', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = {
        externalUid: 'fb1',
        email: 'dr@test.com',
        rawClaims: { firebase: { sign_in_provider: 'google.com' } },
      } as never
      await service.provision(verified)
      expect(mockLoginTelemetry.recordLogin).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'google' }),
      )
    })

    it('maps missing/unrecognized sign-in claims to method "unknown"', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never
      await service.provision(verified)
      expect(mockLoginTelemetry.recordLogin).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'unknown' }),
      )
    })

    it('still resolves provision when login telemetry fails (fire-and-forget)', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      mockLoginTelemetry.recordLogin.mockRejectedValueOnce(new Error('db down'))
      const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never
      await expect(service.provision(verified)).resolves.toEqual(baseUser)
    })
```

- [ ] **Step 20:** `pnpm --filter @rezeta/api test -- auth.service` → PASS.

- [ ] **Step 21: Register `IdentityModule`.**

In `apps/api/src/modules/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { UsersModule } from '../users/index.js'
import { PermissionsModule } from '../permissions/index.js'
import { IdentityModule } from '../identity/index.js'

@Module({
  imports: [UsersModule, PermissionsModule, IdentityModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthFeatureModule {}
```

In `apps/api/src/app.module.ts`, add the import next to `PlatformUsersModule`:

```ts
import { IdentityModule } from './modules/identity/index.js'
```

and add `IdentityModule,` to the `imports` array immediately after `PlatformUsersModule,`.

- [ ] **Step 22: Full suite + typecheck.**

Run: `pnpm --filter @rezeta/api test` → full API unit suite PASS (catches DI wiring errors).
Run: `pnpm -r typecheck` → PASS.
Run: `pnpm lint` → clean.

- [ ] **Step 23: Commit**

```bash
git add packages/shared/src/schemas/identity.ts packages/shared/src/schemas/index.ts packages/shared/src/schemas/__tests__/identity.spec.ts apps/api/src/modules/identity apps/api/src/modules/auth apps/api/src/common/guards/auth.guard.ts apps/api/src/common/guards/__tests__/auth.guard.spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): login telemetry write path wired into provision and the deactivated-user guard"
```

---

### Task 3: Tenant security + self-service `/v1/identity/*` endpoints

**Files:**
- Create: `apps/api/src/modules/identity/identity.service.ts`
- Create: `apps/api/src/modules/identity/identity.controller.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts` (add controller + service)
- Modify: `apps/api/src/modules/identity/index.ts` (export the two)
- Test: `apps/api/src/modules/identity/__tests__/identity.service.spec.ts` (new), `apps/api/src/modules/identity/__tests__/identity.controller.spec.ts` (new)

**Interfaces:**
- Consumes: `IdentityRepository` (Task 2), `AUTH_PROVIDER`/`IAuthProvider.revokeUserSessions` (already exists — `apps/api/src/lib/auth/auth-provider.interface.ts`), `AuditLogService.record` with `action: 'session_revoked'` (already in the closed `AuditAction` union in `apps/api/src/common/audit-log/audit-log.types.ts` — no union edit needed), `parseLimit` from `apps/api/src/common/pagination/parse-limit.ts`.
- Produces: `GET /v1/identity/me/devices`, `POST /v1/identity/me/sign-out-all`, `GET /v1/identity/security/summary`, `GET /v1/identity/security/logins`, `GET /v1/identity/security/logins.csv` — consumed by Task 5's hooks.

- [ ] **Step 1: Failing `IdentityService` tests.**

`apps/api/src/modules/identity/__tests__/identity.service.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityService } from '../identity.service.js'
import type { IdentityRepository } from '../identity.repository.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'

const mockRepo = {
  securitySummary: vi.fn(),
  listLoginsForTenant: vi.fn(),
  findUserNames: vi.fn(),
  listDevicesForUser: vi.fn(),
}
const mockAuthProvider = { revokeUserSessions: vi.fn() }
const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }

function makeService(): IdentityService {
  return new IdentityService(
    mockRepo as unknown as IdentityRepository,
    mockAuthProvider as unknown as IAuthProvider,
    mockAuditLog as unknown as AuditLogService,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('securitySummary', () => {
  it('defaults to a 7-day window and delegates to the repository', async () => {
    mockRepo.securitySummary.mockResolvedValue({ logins: 1, distinctUsers: 1, blocked: 0, dormantUsers30d: 0 })
    await makeService().securitySummary('t1', undefined)
    const [tenantId, since] = mockRepo.securitySummary.mock.calls[0] as [string, Date]
    expect(tenantId).toBe('t1')
    const ageMs = Date.now() - since.getTime()
    expect(ageMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    expect(ageMs).toBeLessThan(8 * 24 * 60 * 60 * 1000)
  })

  it('honors an explicit days window', async () => {
    mockRepo.securitySummary.mockResolvedValue({ logins: 0, distinctUsers: 0, blocked: 0, dormantUsers30d: 0 })
    await makeService().securitySummary('t1', 30)
    const [, since] = mockRepo.securitySummary.mock.calls[0] as [string, Date]
    const ageMs = Date.now() - since.getTime()
    expect(ageMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
  })
})

describe('listLogins', () => {
  it('resolves user names with a single findUserNames call', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: null, createdAt: new Date('2026-07-28T00:00:00Z') },
      { id: 'e2', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: null, createdAt: new Date('2026-07-27T00:00:00Z') },
      { id: 'e3', userId: null, outcome: 'blocked', method: 'unknown', ipAddress: null, userAgent: null, createdAt: new Date('2026-07-26T00:00:00Z') },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'Ana García']]))
    const result = await makeService().listLogins('t1', { limit: 50 })
    expect(mockRepo.findUserNames).toHaveBeenCalledTimes(1)
    expect(mockRepo.findUserNames).toHaveBeenCalledWith(['u1'])
    expect(result[0]).toMatchObject({ userId: 'u1', userName: 'Ana García' })
    expect(result[2]).toMatchObject({ userId: null, userName: null })
  })

  it('skips findUserNames when every row has a null userId', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: null, outcome: 'blocked', method: 'unknown', ipAddress: null, userAgent: null, createdAt: new Date() },
    ])
    await makeService().listLogins('t1', { limit: 50 })
    expect(mockRepo.findUserNames).not.toHaveBeenCalled()
  })
})

describe('exportLoginsCsv', () => {
  it('renders a header row and quotes/escapes commas in text fields', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: '10.0.0.1', userAgent: 'UA, 1', createdAt: new Date('2026-07-28T00:00:00Z') },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'García, Ana']]))
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('created_at,user,outcome,method,ip_address,user_agent')
    expect(lines[1]).toContain('"García, Ana"')
    expect(lines[1]).toContain('"UA, 1"')
  })
})

describe('myDevices', () => {
  it('maps device rows to ISO timestamps', async () => {
    mockRepo.listDevicesForUser.mockResolvedValue([
      { id: 'd1', fingerprint: 'fp1', userAgent: 'UA', firstSeenAt: new Date('2026-07-01T00:00:00Z'), lastSeenAt: new Date('2026-07-28T00:00:00Z') },
    ])
    const result = await makeService().myDevices('u1')
    expect(result[0]).toMatchObject({ id: 'd1', fingerprint: 'fp1' })
    expect(result[0]!.firstSeenAt).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('signOutAllSessions', () => {
  it('revokes provider sessions and audits session_revoked', async () => {
    mockAuthProvider.revokeUserSessions.mockResolvedValue(undefined)
    await makeService().signOutAllSessions({ id: 'u1', externalUid: 'ext-1', tenantId: 't1' })
    expect(mockAuthProvider.revokeUserSessions).toHaveBeenCalledWith('ext-1')
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        actorUserId: 'u1',
        actorType: 'user',
        category: 'auth',
        action: 'session_revoked',
        entityType: 'User',
        entityId: 'u1',
        status: 'success',
      }),
    )
  })
})
```

- [ ] **Step 2:** `pnpm --filter @rezeta/api test -- identity.service` → FAIL (module not found).

- [ ] **Step 3: Implement `IdentityService`.**

`apps/api/src/modules/identity/identity.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { LoginEventItemDto, SecuritySummaryDto, UserDeviceItemDto } from '@rezeta/shared'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { IdentityRepository } from './identity.repository.js'

const DEFAULT_DAYS = 7

export interface ListLoginsFilters {
  days?: number
  userId?: string
  limit: number
}

/**
 * Tenant-scoped security reads (summary/logins/CSV) + self-service devices
 * and sign-out-all over IdentityRepository. Self-service endpoints
 * (myDevices, signOutAllSessions) require only an authenticated user — no
 * permission gate (identity design §5 "Self-service (any user)"); the
 * tenant-scoped reads are gated at the controller via
 * @RequirePermission('users', ...).
 */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(IdentityRepository) private repository: IdentityRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async securitySummary(tenantId: string, days: number | undefined): Promise<SecuritySummaryDto> {
    return this.repository.securitySummary(tenantId, sinceFor(days))
  }

  async listLogins(tenantId: string, filters: ListLoginsFilters): Promise<LoginEventItemDto[]> {
    const events = await this.repository.listLoginsForTenant(tenantId, {
      since: sinceFor(filters.days),
      ...(filters.userId ? { userId: filters.userId } : {}),
      limit: filters.limit,
    })
    const ids = [...new Set(events.map((e) => e.userId).filter((id): id is string => id !== null))]
    const names =
      ids.length > 0 ? await this.repository.findUserNames(ids) : new Map<string, string | null>()
    return events.map((e) => ({
      id: e.id,
      userId: e.userId,
      userName: e.userId ? (names.get(e.userId) ?? null) : null,
      outcome: e.outcome as LoginEventItemDto['outcome'],
      method: e.method as LoginEventItemDto['method'],
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    }))
  }

  async exportLoginsCsv(tenantId: string, filters: ListLoginsFilters): Promise<string> {
    const rows = await this.listLogins(tenantId, filters)
    const header = 'created_at,user,outcome,method,ip_address,user_agent'
    const lines = rows.map((r) =>
      [
        r.createdAt,
        csvEscape(r.userName ?? ''),
        r.outcome,
        r.method,
        r.ipAddress ?? '',
        csvEscape(r.userAgent ?? ''),
      ].join(','),
    )
    return [header, ...lines].join('\n')
  }

  async myDevices(userId: string): Promise<UserDeviceItemDto[]> {
    const rows = await this.repository.listDevicesForUser(userId)
    return rows.map((d) => ({
      id: d.id,
      fingerprint: d.fingerprint,
      userAgent: d.userAgent,
      firstSeenAt: d.firstSeenAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
    }))
  }

  async signOutAllSessions(user: { id: string; externalUid: string; tenantId: string }): Promise<void> {
    await this.authProvider.revokeUserSessions(user.externalUid)
    void this.auditLog.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      actorType: 'user',
      category: 'auth',
      action: 'session_revoked',
      entityType: 'User',
      entityId: user.id,
      status: 'success',
    })
  }
}

function sinceFor(days: number | undefined): Date {
  const n = days && days > 0 ? days : DEFAULT_DAYS
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
```

- [ ] **Step 4:** `pnpm --filter @rezeta/api test -- identity.service` → PASS.

- [ ] **Step 5: Failing `IdentityController` tests.**

`apps/api/src/modules/identity/__tests__/identity.controller.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@rezeta/shared'
import { IdentityController } from '../identity.controller.js'
import type { IdentityService } from '../identity.service.js'

function user(): AuthUser {
  return {
    id: 'u1',
    externalUid: 'ext-1',
    tenantId: 't1',
    email: 'dr@rezeta.do',
    fullName: 'Dr. Test',
    role: 'doctor',
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: null,
    tenantPlan: 'free',
    preferences: {},
    capabilities: {},
  } as AuthUser
}

describe('IdentityController', () => {
  it('myDevices delegates with the current user id', async () => {
    const service = { myDevices: vi.fn().mockResolvedValue([]) } as unknown as IdentityService
    await new IdentityController(service).myDevices(user())
    expect(service.myDevices).toHaveBeenCalledWith('u1')
  })

  it('signOutAll delegates with the current user', async () => {
    const service = { signOutAllSessions: vi.fn().mockResolvedValue(undefined) } as unknown as IdentityService
    await new IdentityController(service).signOutAll(user())
    expect(service.signOutAllSessions).toHaveBeenCalledWith(user())
  })

  it('summary parses days and delegates with tenantId', async () => {
    const service = { securitySummary: vi.fn().mockResolvedValue({}) } as unknown as IdentityService
    await new IdentityController(service).summary('t1', '30')
    expect(service.securitySummary).toHaveBeenCalledWith('t1', 30)
  })

  it('summary passes undefined days when the query param is omitted', async () => {
    const service = { securitySummary: vi.fn().mockResolvedValue({}) } as unknown as IdentityService
    await new IdentityController(service).summary('t1', undefined)
    expect(service.securitySummary).toHaveBeenCalledWith('t1', undefined)
  })

  it('logins passes parsed filters', async () => {
    const service = { listLogins: vi.fn().mockResolvedValue([]) } as unknown as IdentityService
    await new IdentityController(service).logins('t1', '30', 'u2', '10')
    expect(service.listLogins).toHaveBeenCalledWith('t1', { days: 30, userId: 'u2', limit: 10 })
  })

  it('logins defaults limit to 50 when omitted', async () => {
    const service = { listLogins: vi.fn().mockResolvedValue([]) } as unknown as IdentityService
    await new IdentityController(service).logins('t1', undefined, undefined, undefined)
    expect(service.listLogins).toHaveBeenCalledWith('t1', { limit: 50 })
  })

  it('exportCsv sets CSV headers and writes the body', async () => {
    const service = { exportLoginsCsv: vi.fn().mockResolvedValue('created_at,user\n') } as unknown as IdentityService
    const res = { set: vi.fn(), end: vi.fn() }
    await new IdentityController(service).exportCsv('t1', '7', undefined, res as never)
    expect(service.exportLoginsCsv).toHaveBeenCalledWith('t1', { days: 7, limit: 1000 })
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'text/csv; charset=utf-8' }),
    )
    expect(res.end).toHaveBeenCalledWith('created_at,user\n')
  })
})
```

- [ ] **Step 6:** `pnpm --filter @rezeta/api test -- identity.controller` → FAIL (module not found).

- [ ] **Step 7: Implement `IdentityController`.**

`apps/api/src/modules/identity/identity.controller.ts` (CSV route mirrors `apps/api/src/common/audit-log/audit-log.controller.ts`'s `exportCsv`):

```ts
import { Controller, Get, HttpCode, HttpStatus, Inject, Post, Query, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import type { AuthUser, LoginEventItemDto, SecuritySummaryDto, UserDeviceItemDto } from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { parseLimit } from '../../common/pagination/parse-limit.js'
import { IdentityService } from './identity.service.js'

@ApiTags('Identity')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/identity')
export class IdentityController {
  constructor(@Inject(IdentityService) private svc: IdentityService) {}

  @Get('me/devices')
  @ApiOperation({ summary: 'List devices seen for the current user' })
  @ApiResponse({ status: 200 })
  myDevices(@CurrentUser() user: AuthUser): Promise<UserDeviceItemDto[]> {
    return this.svc.myDevices(user.id)
  }

  @Post('me/sign-out-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke all active sessions for the current user' })
  @ApiResponse({ status: 204 })
  async signOutAll(@CurrentUser() user: AuthUser): Promise<void> {
    await this.svc.signOutAllSessions(user)
  }

  @Get('security/summary')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Tenant-scoped login telemetry summary' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiResponse({ status: 200 })
  summary(@TenantId() tenantId: string, @Query('days') days?: string): Promise<SecuritySummaryDto> {
    return this.svc.securitySummary(tenantId, days ? parseInt(days, 10) : undefined)
  }

  @Get('security/logins')
  @RequirePermission('users', 'view')
  @ApiOperation({ summary: 'Tenant login activity feed' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200 })
  logins(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
    @Query('userId') userId?: string,
    @Query('limit') limit?: string,
  ): Promise<LoginEventItemDto[]> {
    return this.svc.listLogins(tenantId, {
      ...(days ? { days: parseInt(days, 10) } : {}),
      ...(userId ? { userId } : {}),
      limit: parseLimit(limit, { fallback: 50, max: 100 }),
    })
  }

  @Get('security/logins.csv')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('users', 'manage')
  @ApiOperation({ summary: 'Export tenant login activity as CSV' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportCsv(
    @TenantId() tenantId: string,
    @Query('days') days?: string,
    @Query('userId') userId?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const csv = await this.svc.exportLoginsCsv(tenantId, {
      ...(days ? { days: parseInt(days, 10) } : {}),
      ...(userId ? { userId } : {}),
      limit: 1000,
    })
    const timestamp = new Date().toISOString().split('T')[0]
    res!.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="login-activity-${timestamp}.csv"`,
    })
    res!.end(csv)
  }
}
```

- [ ] **Step 8: Finish module wiring.**

`apps/api/src/modules/identity/identity.module.ts` (replace the Task 2 version):

```ts
import { Module } from '@nestjs/common'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'
import { IdentityService } from './identity.service.js'
import { IdentityController } from './identity.controller.js'

@Module({
  controllers: [IdentityController],
  providers: [IdentityRepository, LoginTelemetryService, IdentityService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
```

`apps/api/src/modules/identity/index.ts` — add two lines:

```ts
export { IdentityService } from './identity.service.js'
export { IdentityController } from './identity.controller.js'
```

No further `app.module.ts` change is needed — `IdentityModule` was already added to `AppModule`'s `imports` in Task 2 (for `AuthGuard`'s DI); its controller now rides along automatically.

- [ ] **Step 9:** `pnpm --filter @rezeta/api test -- identity.controller` → PASS (7 tests). Then `pnpm --filter @rezeta/api test` (full suite) and `pnpm --filter @rezeta/api typecheck` → PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/identity
git commit -m "feat(api): tenant security and self-service identity endpoints"
```

---

### Task 4: Real-Postgres integration spec

**Files:**
- Test: `apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts` (new)

**Interfaces:** Consumes `hasTestDb`, `getTestPrisma`, `truncateAll`, `createTestTenant`, `createTestUser`, `waitForAuditLog` from `apps/api/src/test/db-test-utils.ts`. Real `IdentityRepository`/`LoginTelemetryService`/`IdentityService` wired to the test Prisma; `IAuthProvider` faked with `vi.fn()`.

- [ ] **Step 1:** Write the spec:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginTelemetryService } from '../login-telemetry.service.js'
import { IdentityRepository } from '../identity.repository.js'
import { IdentityService } from '../identity.service.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { AuditLogRepository } from '../../../common/audit-log/audit-log.repository.js'
import {
  createTestTenant,
  createTestUser,
  getTestPrisma,
  hasTestDb,
  truncateAll,
  waitForAuditLog,
} from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('Identity module (integration)', () => {
  const prisma = getTestPrisma()
  const repo = new IdentityRepository(prisma)
  const telemetry = new LoginTelemetryService(repo)
  const authProvider = {
    revokeUserSessions: vi.fn().mockResolvedValue(undefined),
  } as unknown as IAuthProvider
  // Construction copied from apps/api/src/modules/permissions/__tests__/permissions.service.int-spec.ts
  const auditLog = new AuditLogService(new AuditLogRepository(prisma))
  const service = new IdentityService(repo, authProvider, auditLog)

  beforeEach(async () => {
    await truncateAll(prisma)
  })

  describe('recordLogin + upsertDevice', () => {
    it('inserts a LoginEvent row', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await telemetry.recordLogin({
        tenantId: tenant.id,
        userId: user.id,
        outcome: 'success',
        method: 'password',
        ipAddress: '10.0.0.1',
        userAgent: 'UA-1',
      })
      const rows = await prisma.loginEvent.findMany({ where: { userId: user.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.outcome).toBe('success')
    })

    it('dedupes a device on the same fingerprint and bumps lastSeenAt without changing firstSeenAt', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await telemetry.upsertDevice({
        tenantId: tenant.id,
        userId: user.id,
        userAgent: 'UA-1',
        ipAddress: '10.0.0.1',
      })
      const first = await prisma.userDevice.findMany({ where: { userId: user.id } })
      expect(first).toHaveLength(1)
      const firstSeen = first[0]!.firstSeenAt

      await new Promise((resolve) => setTimeout(resolve, 10))
      await telemetry.upsertDevice({
        tenantId: tenant.id,
        userId: user.id,
        userAgent: 'UA-1',
        ipAddress: '10.0.0.1',
      })
      const second = await prisma.userDevice.findMany({ where: { userId: user.id } })
      expect(second).toHaveLength(1)
      expect(second[0]!.firstSeenAt).toEqual(firstSeen)
      expect(second[0]!.lastSeenAt.getTime()).toBeGreaterThan(firstSeen.getTime())
    })

    it('creates a second row for a different fingerprint (different user agent)', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await telemetry.upsertDevice({ tenantId: tenant.id, userId: user.id, userAgent: 'UA-1', ipAddress: '10.0.0.1' })
      await telemetry.upsertDevice({ tenantId: tenant.id, userId: user.id, userAgent: 'UA-2', ipAddress: '10.0.0.1' })
      const rows = await prisma.userDevice.findMany({ where: { userId: user.id } })
      expect(rows).toHaveLength(2)
    })
  })

  describe('securitySummary', () => {
    it('counts logins/blocked/distinct users in-window and dormant users by lastLoginAt', async () => {
      const tenant = await createTestTenant(prisma)
      const activeRecent = await createTestUser(prisma, tenant.id)
      const activeDormant = await createTestUser(prisma, tenant.id)

      await prisma.user.update({ where: { id: activeRecent.id }, data: { lastLoginAt: new Date() } })
      await telemetry.recordLogin({ tenantId: tenant.id, userId: activeRecent.id, outcome: 'success', method: 'password' })
      await telemetry.recordLogin({ tenantId: tenant.id, userId: activeRecent.id, outcome: 'blocked', method: 'unknown' })
      // activeDormant never logs in — lastLoginAt stays null, so it counts as dormant.
      void activeDormant

      const summary = await service.securitySummary(tenant.id, 7)
      expect(summary.logins).toBe(1)
      expect(summary.blocked).toBe(1)
      expect(summary.distinctUsers).toBe(1)
      expect(summary.dormantUsers30d).toBe(1)
    })
  })

  describe('signOutAllSessions', () => {
    it('calls the provider and writes a session_revoked audit', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await service.signOutAllSessions({ id: user.id, externalUid: 'ext-1', tenantId: tenant.id })
      expect(authProvider.revokeUserSessions).toHaveBeenCalledWith('ext-1')
      const audit = await waitForAuditLog(prisma, { action: 'session_revoked', entityId: user.id })
      expect(audit['tenantId']).toBe(tenant.id)
    })
  })
})
```

Before running: confirm the `AuditLogService`/`AuditLogRepository` construction against `apps/api/src/modules/permissions/__tests__/permissions.service.int-spec.ts` (Task 3's controller test file lists the exact pattern already verified against that file — `new AuditLogService(new AuditLogRepository(prisma))`); adjust the constructor call if that file's signature differs.

- [ ] **Step 2:** `pnpm --filter @rezeta/api test:integration -- identity` → RAN and passing.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts
git commit -m "test(api): real-postgres integration coverage for login telemetry and security summary"
```

---

### Task 5: Web — hooks, strings, Ajustes → Seguridad page, profile devices card, routes

**Files:**
- Create: `apps/web/src/hooks/identity/use-security.ts`
- Create: `apps/web/src/hooks/identity/use-my-devices.ts`
- Modify: `apps/web/src/pages/settings/strings.ts`
- Create: `apps/web/src/pages/settings/Security.tsx`
- Create: `apps/web/src/pages/settings/ProfileDevices.tsx`
- Modify: `apps/web/src/pages/Settings.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/pages/settings/__tests__/Security.test.tsx` (new), `apps/web/src/pages/settings/__tests__/ProfileDevices.test.tsx` (new)

**Interfaces:**
- Consumes: `LoginEventItemDto`/`SecuritySummaryDto`/`UserDeviceItemDto` from `@rezeta/shared`; `/v1/identity/*` routes (Tasks 2–3); `apiClient`/`triggerDownload` from `apps/web/src/lib/api-client.ts`; `useCan` from `apps/web/src/hooks/use-can.ts`; `useAuthStore` from `apps/web/src/store/auth.store.ts`; `ConfirmDialog`/`Card`/`CardTitle`/`Badge`/`Button`/`Callout`/`EmptyState`/`NativeSelect` from `@/components/ui`.
- Produces: routes `/ajustes/seguridad` and the profile devices card on `/ajustes`.

- [ ] **Step 1: Add strings.**

In `apps/web/src/pages/settings/strings.ts`, add to the `// ── Menu links ──` section of `settingsStrings` (near `usersDescription`):

```ts
  securityTitle: 'Seguridad',
  securityDescription: 'Accesos, dispositivos y actividad de inicio de sesión',
```

Add two new exports at the bottom of the file:

```ts
export const securityStrings = {
  pageTitle: 'Seguridad',
  pageSubtitle: 'Actividad de acceso de tu institución.',
  statLogins: (days: number) => `Accesos ${days}d`,
  statDistinctUsers: (days: number) => `Usuarios distintos ${days}d`,
  statDormant: 'Sin acceso 30d',
  rangeLabel: 'Rango',
  range7: '7 días',
  range30: '30 días',
  exportButton: 'Exportar',
  exportingButton: 'Exportando...',
  exportError: 'No se pudo exportar el archivo CSV.',
  tableDate: 'Fecha',
  tableUser: 'Usuario',
  tableMethod: 'Método',
  tableIp: 'IP / dispositivo',
  tableOutcome: 'Resultado',
  methodPassword: 'Contraseña',
  methodGoogle: 'Google',
  methodSso: 'SSO',
  methodUnknown: 'Desconocido',
  outcomeSuccess: 'Exitoso',
  outcomeBlocked: 'Bloqueado',
  unknownUser: 'Usuario desconocido',
  loading: 'Cargando actividad...',
  loadError: 'No se pudo cargar la actividad de acceso.',
  emptyTitle: 'Sin actividad',
  emptyDescription: 'No hay accesos registrados en este rango.',
} as const

export const profileDevicesStrings = {
  sectionTitle: 'Dispositivos',
  sectionDescription: 'Dispositivos donde has iniciado sesión.',
  lastSeen: (date: string) => `Última vez: ${date}`,
  emptyText: 'Aún no se ha registrado ningún dispositivo.',
  signOutAllButton: 'Cerrar todas las sesiones',
  confirmTitle: 'Cerrar todas las sesiones',
  confirmDescription:
    'Se cerrará tu sesión en todos los dispositivos, incluido este. Deberás iniciar sesión de nuevo.',
  confirmButton: 'Cerrar sesiones',
  cancelButton: 'Cancelar',
  signOutError: 'No se pudieron cerrar las sesiones. Intenta de nuevo.',
  loading: 'Cargando dispositivos...',
} as const
```

- [ ] **Step 2: Hooks.**

`apps/web/src/hooks/identity/use-security.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LoginEventItemDto, SecuritySummaryDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const SUMMARY_QK = 'identity-security-summary'
const LOGINS_QK = 'identity-security-logins'

export function useSecuritySummary(days: number): UseQueryResult<SecuritySummaryDto, Error> {
  return useQuery({
    queryKey: [SUMMARY_QK, days],
    queryFn: () => apiClient.get<SecuritySummaryDto>(`/v1/identity/security/summary?days=${days}`),
  })
}

export interface SecurityLoginsParams {
  days: number
  userId?: string
  limit?: number
}

function buildQs(params: SecurityLoginsParams): string {
  const s = new URLSearchParams()
  s.set('days', String(params.days))
  if (params.userId) s.set('userId', params.userId)
  if (params.limit) s.set('limit', String(params.limit))
  return s.toString()
}

export function useSecurityLogins(
  params: SecurityLoginsParams,
): UseQueryResult<LoginEventItemDto[], Error> {
  return useQuery({
    queryKey: [LOGINS_QK, params],
    queryFn: () => apiClient.get<LoginEventItemDto[]>(`/v1/identity/security/logins?${buildQs(params)}`),
  })
}

export async function downloadSecurityLoginsCsv(
  params: Omit<SecurityLoginsParams, 'limit'>,
): Promise<Blob> {
  const s = new URLSearchParams()
  s.set('days', String(params.days))
  if (params.userId) s.set('userId', params.userId)
  return apiClient.download(`/v1/identity/security/logins.csv?${s.toString()}`)
}
```

`apps/web/src/hooks/identity/use-my-devices.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { UserDeviceItemDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'identity-my-devices'

export function useMyDevices(): UseQueryResult<UserDeviceItemDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<UserDeviceItemDto[]>('/v1/identity/me/devices'),
  })
}

export function useSignOutAllSessions(): UseMutationResult<void, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<void>('/v1/identity/me/sign-out-all', {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
```

- [ ] **Step 3: Failing `Security.tsx` test.**

`apps/web/src/pages/settings/__tests__/Security.test.tsx` (mirror `AuditLog.test.tsx`'s `vi.hoisted` + `vi.mock` style):

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LoginEventItemDto, SecuritySummaryDto } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useCan: vi.fn(),
  useSecuritySummary: vi.fn(),
  useSecurityLogins: vi.fn(),
  downloadSecurityLoginsCsv: vi.fn(),
  triggerDownload: vi.fn(),
}))

vi.mock('@/hooks/use-can', () => ({ useCan: mocks.useCan }))
vi.mock('@/hooks/identity/use-security', () => ({
  useSecuritySummary: mocks.useSecuritySummary,
  useSecurityLogins: mocks.useSecurityLogins,
  downloadSecurityLoginsCsv: mocks.downloadSecurityLoginsCsv,
}))
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), download: vi.fn() },
  triggerDownload: mocks.triggerDownload,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

import { Security } from '../Security'

const summary: SecuritySummaryDto = { logins: 12, distinctUsers: 4, blocked: 1, dormantUsers30d: 2 }
const logins: LoginEventItemDto[] = [
  {
    id: 'le-1',
    userId: 'u1',
    userName: 'Dra. Ana García',
    outcome: 'success',
    method: 'password',
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-07-28T12:00:00.000Z',
  },
  {
    id: 'le-2',
    userId: null,
    userName: null,
    outcome: 'blocked',
    method: 'unknown',
    ipAddress: '10.0.0.2',
    userAgent: null,
    createdAt: '2026-07-27T09:00:00.000Z',
  },
]

describe('Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useCan.mockReturnValue(true)
    mocks.useSecuritySummary.mockReturnValue({ data: summary, isLoading: false, isError: false })
    mocks.useSecurityLogins.mockReturnValue({ data: logins, isLoading: false, isError: false })
  })

  it('renders the page title and stat tiles', () => {
    render(<Security />)
    expect(screen.getByText('Seguridad')).toBeInTheDocument()
    expect(screen.getByText('Accesos 7d')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders the login-activity table with user, method and outcome', () => {
    render(<Security />)
    expect(screen.getByText('Dra. Ana García')).toBeInTheDocument()
    expect(screen.getByText('Exitoso')).toBeInTheDocument()
    expect(screen.getByText('Bloqueado')).toBeInTheDocument()
    expect(screen.getByText('Usuario desconocido')).toBeInTheDocument()
  })

  it('hides the export button without users:manage', () => {
    mocks.useCan.mockReturnValue(false)
    render(<Security />)
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
  })

  it('exports CSV via triggerDownload on click', async () => {
    mocks.downloadSecurityLoginsCsv.mockResolvedValue(new Blob(['csv']))
    render(<Security />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(mocks.triggerDownload).toHaveBeenCalled())
  })

  it('shows the empty state when there is no login activity', () => {
    mocks.useSecurityLogins.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('Sin actividad')).toBeInTheDocument()
  })

  it('shows a danger callout on load error', () => {
    mocks.useSecurityLogins.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Security />)
    expect(screen.getByText('No se pudo cargar la actividad de acceso.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4:** `pnpm --filter @rezeta/web test -- Security` → FAIL (module not found).

- [ ] **Step 5: Build `Security.tsx`.** Stat-tile block mirrors `apps/web/src/pages/Billing/SummaryCards.tsx`; filter/export/table structure mirrors `apps/web/src/pages/settings/AuditLog.tsx`.

`apps/web/src/pages/settings/Security.tsx`:

```tsx
import { useState } from 'react'
import type { LoginEventItemDto } from '@rezeta/shared'
import { useSecuritySummary, useSecurityLogins, downloadSecurityLoginsCsv } from '@/hooks/identity/use-security'
import { useCan } from '@/hooks/use-can'
import { triggerDownload } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import { Badge, Button, Callout, EmptyState, NativeSelect } from '@/components/ui'
import { securityStrings as s } from './strings'

const METHOD_LABELS: Record<string, string> = {
  password: s.methodPassword,
  google: s.methodGoogle,
  sso: s.methodSso,
  unknown: s.methodUnknown,
}

function formatTs(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate()
  const month = d.toLocaleString('es-DO', { month: 'short' })
  const year = d.getFullYear()
  const hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${day} ${month} ${year}, ${h12}:${minutes} ${ampm}`
}

function OutcomeBadge({ outcome }: { outcome: LoginEventItemDto['outcome'] }): JSX.Element {
  return outcome === 'success' ? (
    <Badge variant="active">{s.outcomeSuccess}</Badge>
  ) : (
    <Badge variant="overdue">{s.outcomeBlocked}</Badge>
  )
}

function StatTiles({
  days,
  logins,
  distinctUsers,
  dormantUsers30d,
}: {
  days: number
  logins: number
  distinctUsers: number
  dormantUsers30d: number
}): JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          {s.statLogins(days)}
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{logins}</div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          {s.statDistinctUsers(days)}
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{distinctUsers}</div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">{s.statDormant}</div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{dormantUsers30d}</div>
      </div>
    </div>
  )
}

export function Security(): JSX.Element {
  const [days, setDays] = useState<7 | 30>(7)
  const canExport = useCan('users', 'manage')
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const summaryQuery = useSecuritySummary(days)
  const loginsQuery = useSecurityLogins({ days, limit: 50 })

  async function handleExport(): Promise<void> {
    setExportError(null)
    setExporting(true)
    try {
      const blob = await downloadSecurityLoginsCsv({ days })
      const ts = new Date().toISOString().slice(0, 10)
      triggerDownload(blob, `login-activity-${ts}.csv`)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'Security.exportCsv' })
      setExportError(s.exportError)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1 m-0">{s.pageTitle}</h1>
          <p className="text-sm text-n-500 mt-1">{s.pageSubtitle}</p>
        </div>
        {canExport && (
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => {
              void handleExport()
            }}
          >
            <i className="ph ph-download-simple mr-1.5" />
            {exporting ? s.exportingButton : s.exportButton}
          </Button>
        )}
      </div>

      {exportError && (
        <div className="mb-4">
          <Callout variant="danger" icon={<i className="ph ph-warning" />}>
            {exportError}
          </Callout>
        </div>
      )}

      <StatTiles
        days={days}
        logins={summaryQuery.data?.logins ?? 0}
        distinctUsers={summaryQuery.data?.distinctUsers ?? 0}
        dormantUsers30d={summaryQuery.data?.dormantUsers30d ?? 0}
      />

      <div className="flex items-center gap-2 mb-5">
        <label className="text-overline font-medium text-n-600 shrink-0">{s.rangeLabel}</label>
        <NativeSelect value={String(days)} onChange={(e) => setDays(Number(e.target.value) as 7 | 30)}>
          <option value="7">{s.range7}</option>
          <option value="30">{s.range30}</option>
        </NativeSelect>
      </div>

      {loginsQuery.isLoading && <p className="text-body text-n-500">{s.loading}</p>}

      {loginsQuery.isError && (
        <Callout variant="danger" icon={<i className="ph ph-warning" />}>
          {s.loadError}
        </Callout>
      )}

      {!loginsQuery.isLoading && !loginsQuery.isError && (loginsQuery.data?.length ?? 0) === 0 && (
        <EmptyState icon={<i className="ph ph-shield-check" />} title={s.emptyTitle} description={s.emptyDescription} />
      )}

      {!loginsQuery.isLoading && !loginsQuery.isError && (loginsQuery.data?.length ?? 0) > 0 && (
        <div className="border border-n-200 rounded-md overflow-hidden">
          <table className="w-full border-collapse bg-n-0">
            <thead>
              <tr>
                {[s.tableDate, s.tableUser, s.tableMethod, s.tableIp, s.tableOutcome].map((col) => (
                  <th
                    key={col}
                    className="bg-n-50 text-overline font-semibold uppercase tracking-label text-n-600 px-4 py-3 text-left"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loginsQuery.data!.map((item) => (
                <tr key={item.id} className="border-t border-n-100">
                  <td className="px-4 py-3 font-mono text-xs text-n-600 whitespace-nowrap">
                    {formatTs(item.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-n-700">{item.userName ?? s.unknownUser}</td>
                  <td className="px-4 py-3 text-sm text-n-600">{METHOD_LABELS[item.method] ?? item.method}</td>
                  <td className="px-4 py-3 font-mono text-xs text-n-500">{item.ipAddress ?? '—'}</td>
                  <td className="px-4 py-3">
                    <OutcomeBadge outcome={item.outcome} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

Before running: confirm `NativeSelect`'s prop names against `apps/web/src/components/ui/NativeSelect.tsx` and against its usage in `AuditLog.tsx` (already read during planning — `value`/`onChange`/children `<option>`); adjust if it differs.

- [ ] **Step 6:** `pnpm --filter @rezeta/web test -- Security` → PASS (6 tests).

- [ ] **Step 7: Failing `ProfileDevices.tsx` test.**

`apps/web/src/pages/settings/__tests__/ProfileDevices.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UserDeviceItemDto } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useMyDevices: vi.fn(),
  useSignOutAllSessions: vi.fn(),
  useAuthStore: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/hooks/identity/use-my-devices', () => ({
  useMyDevices: mocks.useMyDevices,
  useSignOutAllSessions: mocks.useSignOutAllSessions,
}))
vi.mock('@/store/auth.store', () => ({ useAuthStore: mocks.useAuthStore }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mocks.navigate }
})

import { ProfileDevices } from '../ProfileDevices'

const devices: UserDeviceItemDto[] = [
  {
    id: 'd1',
    fingerprint: 'fp1',
    userAgent: 'Chrome on macOS',
    firstSeenAt: '2026-07-01T00:00:00.000Z',
    lastSeenAt: '2026-07-27T00:00:00.000Z',
  },
]

const signOutMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false }

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfileDevices />
    </MemoryRouter>,
  )
}

describe('ProfileDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useMyDevices.mockReturnValue({ data: devices, isLoading: false })
    mocks.useSignOutAllSessions.mockReturnValue(signOutMutation)
    mocks.useAuthStore.mockReturnValue({ signOut: vi.fn().mockResolvedValue(undefined) })
  })

  it('renders the device list', () => {
    renderPage()
    expect(screen.getByText('Dispositivos')).toBeInTheDocument()
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
  })

  it('shows the empty state with no devices', () => {
    mocks.useMyDevices.mockReturnValue({ data: [], isLoading: false })
    renderPage()
    expect(screen.getByText('Aún no se ha registrado ningún dispositivo.')).toBeInTheDocument()
  })

  it('opens a confirm dialog and signs out everywhere on confirm', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Cerrar todas las sesiones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesiones' }))
    await waitFor(() => expect(signOutMutation.mutateAsync).toHaveBeenCalled())
  })

  it('shows an error callout when sign-out-all fails', async () => {
    signOutMutation.mutateAsync.mockRejectedValueOnce(new Error('network'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Cerrar todas las sesiones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesiones' }))
    await waitFor(() =>
      expect(screen.getByText('No se pudieron cerrar las sesiones. Intenta de nuevo.')).toBeInTheDocument(),
    )
  })
})
```

- [ ] **Step 8:** `pnpm --filter @rezeta/web test -- ProfileDevices` → FAIL (module not found).

- [ ] **Step 9: Build `ProfileDevices.tsx`.**

`apps/web/src/pages/settings/ProfileDevices.tsx`:

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
import { useMyDevices, useSignOutAllSessions } from '@/hooks/identity/use-my-devices'
import { Card, CardTitle, Button, ConfirmDialog, Callout } from '@/components/ui'
import { profileDevicesStrings as s } from './strings'

export function ProfileDevices(): JSX.Element {
  const { data: devices, isLoading } = useMyDevices()
  const signOutAll = useSignOutAllSessions()
  const { signOut } = useAuthStore()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm(): Promise<void> {
    setError(null)
    try {
      await signOutAll.mutateAsync()
      setConfirming(false)
      await signOut()
      void navigate('/login', { replace: true })
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.error(error.message, { stack: error.stack, context: 'ProfileDevices.signOutAll' })
      setError(s.signOutError)
    }
  }

  return (
    <Card className="max-w-560 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <CardTitle>{s.sectionTitle}</CardTitle>
          <p className="text-xs text-n-500 mt-1">{s.sectionDescription}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
          <i className="ph ph-sign-out mr-1.5" />
          {s.signOutAllButton}
        </Button>
      </div>

      {error && (
        <Callout variant="danger" compact icon={<i className="ph ph-warning" />} className="mb-3">
          {error}
        </Callout>
      )}

      {isLoading && <p className="text-sm text-n-500">{s.loading}</p>}

      {!isLoading && (devices?.length ?? 0) === 0 && <p className="text-sm text-n-500">{s.emptyText}</p>}

      {!isLoading && (devices?.length ?? 0) > 0 && (
        <ul className="flex flex-col gap-2">
          {devices!.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between border-t border-n-100 pt-2 first:border-0 first:pt-0"
            >
              <span className="text-sm text-n-700 truncate">{d.userAgent ?? '—'}</span>
              <span className="text-xs font-mono text-n-400 shrink-0 ml-3">
                {s.lastSeen(new Date(d.lastSeenAt).toLocaleDateString('es-DO'))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming}
        onConfirm={() => {
          void handleConfirm()
        }}
        onCancel={() => setConfirming(false)}
        title={s.confirmTitle}
        description={s.confirmDescription}
        confirmLabel={s.confirmButton}
        cancelLabel={s.cancelButton}
        variant="danger"
        loading={signOutAll.isPending}
      />
    </Card>
  )
}
```

- [ ] **Step 10:** `pnpm --filter @rezeta/web test -- ProfileDevices` → PASS (4 tests).

- [ ] **Step 11: Wire `Settings.tsx`.**

Add the import next to the other settings imports:

```tsx
import { ProfileDevices } from './settings/ProfileDevices'
```

Render it right after the "Mi cuenta" `Card` closes (`</Card>` at the end of the `{user && (...)}` block) and before the menu-links `Card`:

```tsx
      )}

      <ProfileDevices />

      <Card className="max-w-560 mb-6 p-0">
```

Add the Seguridad hub link between the existing Usuarios and Permisos links, gated on the same `canViewUsers` (mirroring how Usuarios is gated). Replace:

```tsx
        {canViewUsers && (
          <Link
            to="/ajustes/usuarios"
            className={cn(
              'flex items-center gap-3 px-5 py-4 no-underline text-n-800 hover:bg-n-25 transition-colors duration-fast',
              canViewPermissions && 'border-b border-n-100',
            )}
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

with:

```tsx
        {canViewUsers && (
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
        {canViewUsers && (
          <Link
            to="/ajustes/seguridad"
            className={cn(
              'flex items-center gap-3 px-5 py-4 no-underline text-n-800 hover:bg-n-25 transition-colors duration-fast',
              canViewPermissions && 'border-b border-n-100',
            )}
          >
            <i className="ph ph-lock-key text-h3 text-p-500" />
            <div>
              <div className="text-sm font-semibold">{settingsStrings.securityTitle}</div>
              <div className="text-xs text-n-500">{settingsStrings.securityDescription}</div>
            </div>
            <i className="ph ph-caret-right ml-auto text-n-400" />
          </Link>
        )}
```

(`ph-shield-check` is already used by the Permisos link right below — `ph-lock-key` keeps the two visually distinct.)

- [ ] **Step 12: Register the route.**

In `apps/web/src/App.tsx`, add the import next to `AuditLog`:

```tsx
import { Security } from '@/pages/settings/Security'
```

Add the route entry right after `ajustes/usuarios` and before `ajustes/permisos`:

```tsx
      {
        path: 'ajustes/seguridad',
        element: (
          <RequireCan module="users">
            <Security />
          </RequireCan>
        ),
      },
```

- [ ] **Step 13:** Run `pnpm --filter @rezeta/web test` (full web suite) and `pnpm --filter @rezeta/web typecheck` → PASS. Run `pnpm lint` → clean.

- [ ] **Step 14: Commit**

```bash
git add apps/web/src/hooks/identity apps/web/src/pages/settings/strings.ts apps/web/src/pages/settings/Security.tsx apps/web/src/pages/settings/ProfileDevices.tsx apps/web/src/pages/settings/__tests__/Security.test.tsx apps/web/src/pages/settings/__tests__/ProfileDevices.test.tsx apps/web/src/pages/Settings.tsx apps/web/src/App.tsx
git commit -m "feat(web): institution security panel and self-service device list"
```

---

### Task 6: Full verification + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full workspace verification.**

Run from repo root, all must pass:

```bash
pnpm lint
pnpm test
pnpm test:coverage
```

Expected: zero lint errors, zero failing tests, coverage ≥95% per file on every new/modified service/repository/controller/schema file (pages/hooks exempt per convention). If a file misses the gate, add the missing test cases in that file's own `__tests__` before proceeding.

- [ ] **Step 2: End-to-end smoke (manual, dev env).**

With `pnpm dev` running: sign in as an institution user, confirm a `login_events` row and a `user_devices` row appear for that user (`psql` or a Prisma Studio check). Visit `/ajustes` → Seguridad (as a user with `users: view`), confirm the stat tiles and login-activity table render, switch the range to 30 days, export CSV (as a user with `users: manage`) and confirm the download. On the profile page (`/ajustes`), confirm the Dispositivos card lists the current device, click "Cerrar todas las sesiones," confirm the dialog, and confirm you're signed out and redirected to `/login`. Deactivate a test user and confirm their next request is rejected with a `blocked` row in `login_events`.

- [ ] **Step 3: Changelog entry (English), prepend to `CHANGELOG.md`.**

```markdown
## [2026-07-28] Login telemetry and institution security panel (identity slice 3)

### Added

- `login_events` / `user_devices` tables (provider-agnostic telemetry, no FKs)
  — `packages/db/prisma/schema.prisma`.
- `apps/api/src/modules/identity/` module: `LoginTelemetryService`
  (`recordLogin`, `upsertDevice`, sha256 device fingerprinting) and
  `IdentityService`/`IdentityController` serving `GET /v1/identity/me/devices`,
  `POST /v1/identity/me/sign-out-all`, `GET /v1/identity/security/summary`,
  `GET /v1/identity/security/logins`, and `GET /v1/identity/security/logins.csv`.
- `AuthService.provision` records a successful login and upserts the caller's
  device; `AuthGuard`'s deactivated-institution-user rejection records a
  `blocked` login event.
- Ajustes → Seguridad page (`apps/web/src/pages/settings/Security.tsx`) —
  stat tiles, 7/30-day filter, login-activity table, CSV export.
- Self-service devices card (`apps/web/src/pages/settings/ProfileDevices.tsx`)
  on the profile page — device list + "Cerrar todas las sesiones."
- Shared DTOs `LoginEventItemSchema` / `SecuritySummarySchema` /
  `UserDeviceItemSchema` (`packages/shared/src/schemas/identity.ts`).

### Changed

- `AuthFeatureModule` and `AppModule` import the new `IdentityModule`.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for login telemetry and security panel slice"
```

## Out of scope

`MfaEnrollment`, `SsoConnection`, `IdentityPolicy` tables and their UIs (identity slices 4 and 6). The staff cross-institution dashboard and 14-day sparklines (identity slice 5, screen 4). Per-device session revocation (registry stays observational — identity design §11). The 12-month `LoginEvent`/`UserDevice` purge job (identity design §4 — a future scheduled-job slice). Failed-password telemetry: Identity Platform/Firebase client auth means a wrong password never reaches the API, so `LoginEvent.outcome` never records a password failure in this milestone. Platform-staff login telemetry: the schema's `platformUserId` column exists for forward compatibility, but this slice does not wire `recordLogin`/`upsertDevice` into the platform-staff auth path (`AuthGuard`'s `@PlatformRoute()` branch) — that is deferred to whichever slice builds the staff cross-institution dashboard. New-device email notifications (identity design §7).
