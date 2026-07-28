# Staff Cross-Institution Security Dashboard Implementation Plan (Identity slice 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platform staff get a cross-institution security dashboard (`GET
/v1/staff/identity/security/overview`) — four platform-wide tiles, a
per-institution activity table with a 14-day login sparkline and dormant/
pending-invite signal chips — plus a "new device" email notification the
first time an institution user's device fingerprint is seen.

**Architecture:** Extends the `apps/api/src/modules/identity/` module from
identity slice 3 (`LoginEvent`/`UserDevice` tables, `IdentityRepository`,
`LoginTelemetryService`). Two new pieces inside the same module: a
`StaffSecurityService`/`StaffSecurityController` pair (control-plane read
path, `@PlatformRoute()`-gated, mirrors `StaffController`/`StaffService`'s
cross-tenant `groupBy`-then-join-in-memory pattern from the staff
institutions list) and a `LoginTelemetryService.upsertDevice` change that
detects device creation (vs. a bump) and fires
`InvitationMailerService.sendNewDeviceEmail` fire-and-forget. Web: a new
`apps/web/src/pages/staff/Security.tsx` staff-console page, added to
`StaffLayout`'s nav.

**Tech Stack:** NestJS + Prisma + Zod (shared schemas), React + TanStack
Query + Radix/CVA components, Vitest (+ real-Postgres integration harness).

**Spec:** `docs/superpowers/specs/2026-07-19-identity-module-design.md` (§6
screen 4 "Staff platform → Seguridad", §7 "New-device email" +
"Platform metrics", §8 slice 5). Mockup reference:
`docs/superpowers/specs/2026-07-19-identity-module-mockups.html` screen 4
(bars sparkline, señales chips) — its Spanish copy is **superseded**; the
staff console is English throughout, per
`apps/web/src/pages/staff/strings.ts` (`staffStrings`/`institutionsStrings`/
`platformUsersStrings` are all English — "internal Rezeta staff tooling, not
the patient-facing product," per that file's header comment).

Builds on identity slice 3 (`docs/superpowers/plans/2026-07-28-03-login-telemetry-security-panel.md`,
merged — `LoginEvent`/`UserDevice` tables, `IdentityRepository`,
`LoginTelemetryService`, `IdentityService`/`IdentityController`) and the
staff institutions list (`docs/superpowers/plans/2026-07-28-02-staff-institutions-list.md`,
merged — `StaffController`/`StaffService`, the cross-tenant grouped-query
pattern this plan's repository methods follow).

## Global Constraints

- All code, comments, tests, changelog in **English**. The staff console
  (`apps/web/src/pages/staff/Security.tsx`, its strings, its nav entry) is
  **English** — it is internal Rezeta-staff tooling, not the patient-facing
  product (see `apps/web/src/pages/staff/strings.ts`'s header comment and
  every existing staff string export). This is the opposite of the
  institution-facing Ajustes → Seguridad page from identity slice 3, which is
  Spanish — do not copy that page's strings.
- No arbitrary Tailwind values (`w-[440px]`-style) — tokens only. The
  sparkline bars' `style={{ height: '${pct}%' }}` is a runtime value binding
  on the `style` prop, not a Tailwind class, so it is not subject to (and
  does not need an exemption from) the `no-restricted-syntax` arbitrary-class
  guardrail. Bar width comes from the existing `w-180`/`h-8` tokens in
  `apps/web/tailwind.config.ts` (`theme.extend.width`/`height`) — do not add
  a new token; nothing here needs a value outside the existing scale.
- No `TODO`/`FIXME` comments (ESLint `no-warning-comments` fails CI).
- **No schema change this slice.** `LoginEvent`, `UserDevice`, `User`, and
  `Tenant` already exist (identity slice 3 and earlier) — every query this
  plan adds reads existing tables. `LoginEvent.outcome` is a closed
  `'success' | 'blocked'` enum (identity slice 3 — Identity Platform/Firebase
  client auth means a wrong password never reaches the API, so there is no
  server-side "failed login" event); every login-count aggregate in this
  plan filters `outcome: 'success'`.
- Coverage gate: **95% per file** (`pnpm test:coverage`). Pages/hooks are
  excluded by pre-existing project convention (see
  `docs/superpowers/plans/2026-07-28-02-staff-institutions-list.md` Global
  Constraints) — service/repository/controller/schema files are not.
- Each commit must keep the whole workspace typechecking (pre-commit hook
  runs `pnpm lint` + workspace `typecheck`). If lint hits `no-unsafe-*` on
  `@rezeta/shared` types after a shared-package change, run
  `pnpm --filter @rezeta/shared build` (stale dist) and retry.
- Commit-message subjects must be lower-case (commitlint); append trailer
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Integration tests: `pnpm --filter @rezeta/api test:integration -- <pattern>`.
  `TEST_DATABASE_URL` is configured on this machine; Postgres runs in the
  `rezeta-postgres` Docker container — if it is down, `docker start
  rezeta-postgres`. Every `*.int-spec.ts` file guards its top-level
  `describe` with `describe.skipIf(!hasTestDb())`.
- Run commands from the repo root unless the step says otherwise.
- `tsconfig.base.json` sets `noUncheckedIndexedAccess: true` — every array
  index read in this plan's new code (bucket arrays, `Map` lookups) is
  written to type-check under that flag without a non-null assertion (`??`
  defaults, or an `.find()`/`.get()` optional-chained read).

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/schemas/identity.ts` (modify) | + `StaffSecurityTilesSchema`, `StaffSecurityInstitutionSchema`, `StaffSecurityOverviewSchema` + DTOs |
| `packages/shared/src/schemas/__tests__/identity.spec.ts` (modify) | + schema tests |
| `apps/api/src/modules/identity/identity.repository.ts` (modify) | + `listAllTenants`/`listSuccessfulLoginsSince`/`listActiveUsersForDormancy` (Task 1); `upsertDevice` returns the row (Task 2) |
| `apps/api/src/modules/identity/__tests__/identity.repository.spec.ts` (modify) | + staff-aggregate tests (Task 1); `upsertDevice`-return test (Task 2) |
| `apps/api/src/modules/identity/staff-security.service.ts` (new) | `StaffSecurityService.overview()` — the bucketing/dormancy math |
| `apps/api/src/modules/identity/__tests__/staff-security.service.spec.ts` (new) | |
| `apps/api/src/modules/identity/staff-security.controller.ts` (new) | `GET /v1/staff/identity/security/overview` |
| `apps/api/src/modules/identity/__tests__/staff-security.controller.spec.ts` (new) | |
| `apps/api/src/modules/identity/identity.module.ts` (modify) | + `StaffSecurityService`/`StaffSecurityController` (Task 1); imports `UsersModule` (Task 2) |
| `apps/api/src/modules/identity/index.ts` (modify) | + barrel exports |
| `apps/api/src/modules/users/invitation-mailer.service.ts` (modify) | + `sendNewDeviceEmail` |
| `apps/api/src/modules/users/__tests__/invitation-mailer.service.spec.ts` (modify) | |
| `apps/api/src/modules/identity/login-telemetry.service.ts` (modify) | `upsertDevice` detects creation and fires the new-device email |
| `apps/api/src/modules/identity/__tests__/login-telemetry.service.spec.ts` (modify) | |
| `apps/api/src/modules/auth/auth.service.ts` (modify) | passes `user.email` into `upsertDevice` |
| `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (modify) | |
| `apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts` (modify) | `LoginTelemetryService` gets a mailer fake (Task 2); + `StaffSecurityService` describe block (Task 3) |
| `apps/web/src/hooks/staff/use-staff-security.ts` (new) | `useStaffSecurityOverview()` |
| `apps/web/src/pages/staff/strings.ts` (modify) | + `staffSecurityStrings`, `staffStrings.navSecurity` |
| `apps/web/src/pages/staff/Security.tsx` (new) | Staff platform → Seguridad page |
| `apps/web/src/pages/staff/__tests__/Security.test.tsx` (new) | |
| `apps/web/src/components/layout/StaffLayout.tsx` (modify) | + "Security" nav link |
| `apps/web/src/App.tsx` (modify) | `/staff/security` route |
| `CHANGELOG.md` (modify) | consolidated entry |

---

### Task 1: Shared DTO + `IdentityRepository` staff aggregates + `StaffSecurityService`/`StaffSecurityController` + unit specs

**Files:**
- Modify: `packages/shared/src/schemas/identity.ts`
- Modify: `packages/shared/src/schemas/__tests__/identity.spec.ts`
- Modify: `apps/api/src/modules/identity/identity.repository.ts`
- Modify: `apps/api/src/modules/identity/__tests__/identity.repository.spec.ts`
- Create: `apps/api/src/modules/identity/staff-security.service.ts`
- Create: `apps/api/src/modules/identity/__tests__/staff-security.service.spec.ts`
- Create: `apps/api/src/modules/identity/staff-security.controller.ts`
- Create: `apps/api/src/modules/identity/__tests__/staff-security.controller.spec.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts`
- Modify: `apps/api/src/modules/identity/index.ts`

**Interfaces:**
- Produces: `StaffSecurityOverviewDto`/`StaffSecurityTilesDto`/`StaffSecurityInstitutionDto` in `@rezeta/shared`; `GET /v1/staff/identity/security/overview` — consumed by Task 4's hook.

- [ ] **Step 1: Failing shared-schema tests.**

Append to `packages/shared/src/schemas/__tests__/identity.spec.ts` (after the existing `describe('UserDeviceItemSchema', ...)` block; add the import to the existing `import { ... } from '../identity.js'` line):

```ts
import {
  LoginEventItemSchema,
  SecuritySummarySchema,
  UserDeviceItemSchema,
  StaffSecurityOverviewSchema,
} from '../identity.js'
```

```ts
describe('StaffSecurityOverviewSchema', () => {
  it('accepts a full overview payload', () => {
    const parsed = StaffSecurityOverviewSchema.parse({
      tiles: { activeInstitutions: 3, activeUsers30d: 42, logins7d: 120, dormantAccounts60d: 5 },
      institutions: [
        {
          tenantId: '11111111-2222-4333-8444-555555555555',
          name: 'Centro Médico Vista Alegre',
          plan: 'clinic',
          mau30d: 26,
          logins14d: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
          dormant30d: 0,
          pendingInvites: 1,
        },
      ],
    })
    expect(parsed.institutions[0]?.logins14d).toHaveLength(14)
  })

  it('accepts a null institution name', () => {
    const parsed = StaffSecurityOverviewSchema.parse({
      tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0 },
      institutions: [
        {
          tenantId: '11111111-2222-4333-8444-555555555555',
          name: null,
          plan: 'free',
          mau30d: 0,
          logins14d: new Array(14).fill(0),
          dormant30d: 0,
          pendingInvites: 0,
        },
      ],
    })
    expect(parsed.institutions[0]?.name).toBeNull()
  })

  it('rejects a logins14d array with the wrong length', () => {
    expect(() =>
      StaffSecurityOverviewSchema.parse({
        tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0 },
        institutions: [
          {
            tenantId: '11111111-2222-4333-8444-555555555555',
            name: null,
            plan: 'free',
            mau30d: 0,
            logins14d: [0, 1, 2],
            dormant30d: 0,
            pendingInvites: 0,
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects an unknown plan', () => {
    expect(() =>
      StaffSecurityOverviewSchema.parse({
        tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0 },
        institutions: [
          {
            tenantId: '11111111-2222-4333-8444-555555555555',
            name: null,
            plan: 'enterprise',
            mau30d: 0,
            logins14d: new Array(14).fill(0),
            dormant30d: 0,
            pendingInvites: 0,
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects negative tile counts', () => {
    expect(() =>
      StaffSecurityOverviewSchema.parse({
        tiles: { activeInstitutions: -1, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0 },
        institutions: [],
      }),
    ).toThrow()
  })
})
```

- [ ] **Step 2:** `pnpm --filter @rezeta/shared test -- identity` → FAIL (`StaffSecurityOverviewSchema` is not exported).

- [ ] **Step 3: Implement the shared schemas.**

Append to `packages/shared/src/schemas/identity.ts` (after `UserDeviceItemDto`):

```ts
/**
 * Staff cross-institution security dashboard (`GET
 * /v1/staff/identity/security/overview`) — identity slice 5 (design §6
 * screen 4, §8). Aggregates counts, dates, and institution names only —
 * never clinical data (control-plane isolation invariant, identity design
 * §2 decision 5). `plan` mirrors `StaffInstitutionSchema`'s enum
 * (`packages/shared/src/schemas/staff.ts`) — `Tenant.plan` never takes
 * `'enterprise'` (that's a `Tenant.type` value).
 */
export const StaffSecurityTilesSchema = z.object({
  activeInstitutions: z.number().int().nonnegative(),
  activeUsers30d: z.number().int().nonnegative(),
  logins7d: z.number().int().nonnegative(),
  dormantAccounts60d: z.number().int().nonnegative(),
})
export type StaffSecurityTilesDto = z.infer<typeof StaffSecurityTilesSchema>

export const StaffSecurityInstitutionSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().nullable(),
  plan: z.enum(['free', 'solo', 'practice', 'clinic']),
  mau30d: z.number().int().nonnegative(),
  /** Daily successful-login counts for the last 14 days, oldest first, today last. */
  logins14d: z.array(z.number().int().nonnegative()).length(14),
  dormant30d: z.number().int().nonnegative(),
  pendingInvites: z.number().int().nonnegative(),
})
export type StaffSecurityInstitutionDto = z.infer<typeof StaffSecurityInstitutionSchema>

export const StaffSecurityOverviewSchema = z.object({
  tiles: StaffSecurityTilesSchema,
  institutions: z.array(StaffSecurityInstitutionSchema),
})
export type StaffSecurityOverviewDto = z.infer<typeof StaffSecurityOverviewSchema>
```

- [ ] **Step 4:** `pnpm --filter @rezeta/shared test -- identity` → PASS (10 tests). Then `pnpm --filter @rezeta/shared build` (stale-dist workaround — the API package resolves the new export from dist).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas/identity.ts packages/shared/src/schemas/__tests__/identity.spec.ts
git commit -m "feat(shared): staff cross-institution security dashboard dtos"
```

- [ ] **Step 6: Failing repository tests.**

In `apps/api/src/modules/identity/__tests__/identity.repository.spec.ts`, add `tenant: { findMany: vi.fn() }` to the top-level `prisma` mock object:

```ts
const prisma = {
  loginEvent: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  userDevice: { upsert: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn(), findMany: vi.fn() },
  tenant: { findMany: vi.fn() },
} as unknown as PrismaService
```

Append a new `describe` block at the end of the file:

```ts
describe('IdentityRepository (staff security aggregates)', () => {
  it('listAllTenants selects id/name/plan ordered by createdAt desc', async () => {
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([] as never)
    await makeRepo().listAllTenants()
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, plan: true },
    })
  })

  it('listSuccessfulLoginsSince filters by outcome success and the since cutoff', async () => {
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValue([] as never)
    const since = new Date('2026-06-28T00:00:00Z')
    await makeRepo().listSuccessfulLoginsSince(since)
    expect(prisma.loginEvent.findMany).toHaveBeenCalledWith({
      where: { outcome: 'success', createdAt: { gte: since } },
      select: { tenantId: true, userId: true, createdAt: true },
    })
  })

  it('listActiveUsersForDormancy filters by isActive/deletedAt only', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
    await makeRepo().listActiveUsersForDormancy()
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, isActive: true },
      select: { tenantId: true, lastLoginAt: true, createdAt: true },
    })
  })
})
```

- [ ] **Step 7:** `pnpm --filter @rezeta/api test -- identity.repository` → FAIL (methods don't exist).

- [ ] **Step 8: Implement the repository methods.**

In `apps/api/src/modules/identity/identity.repository.ts`, add three interfaces after `SecuritySummaryRow`:

```ts
export interface StaffSecurityTenantRow {
  id: string
  name: string | null
  plan: string
}

export interface StaffSecurityLoginRow {
  tenantId: string | null
  userId: string | null
  createdAt: Date
}

export interface StaffSecurityUserRow {
  tenantId: string
  lastLoginAt: Date | null
  createdAt: Date
}
```

Add three methods to the `IdentityRepository` class, after `securitySummary`:

```ts
  /**
   * Every tenant on the platform — backs the staff security dashboard's
   * institution roster (identity design §6 screen 4). Mirrors
   * `StaffService.listInstitutions`'s tenant query
   * (`apps/api/src/modules/staff/staff.service.ts`); unlike that method this
   * repository does not compute per-tenant counts itself —
   * `StaffSecurityService` joins this against `listSuccessfulLoginsSince`/
   * `listActiveUsersForDormancy` in memory (three total queries back the
   * whole dashboard — no N+1 across tenants).
   */
  async listAllTenants(): Promise<StaffSecurityTenantRow[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, plan: true },
    })
  }

  /**
   * Successful LoginEvent rows since `since`, across every tenant. Selects
   * only the three columns StaffSecurityService needs (tenantId/userId/
   * createdAt) — no IP/user-agent, no clinical data (control-plane isolation
   * invariant, identity design §2 decision 5). Callers pass a 30-day
   * `since` so a single query backs the 7-day, 14-day, and 30-day staff
   * metrics — see `StaffSecurityService.overview` for the in-memory
   * bucketing.
   */
  async listSuccessfulLoginsSince(since: Date): Promise<StaffSecurityLoginRow[]> {
    return this.prisma.loginEvent.findMany({
      where: { outcome: 'success', createdAt: { gte: since } },
      select: { tenantId: true, userId: true, createdAt: true },
    })
  }

  /**
   * Every active, non-deleted institution user across every tenant, with
   * just enough columns (tenantId/lastLoginAt/createdAt) to compute the
   * global dormant-accounts tile and the per-tenant dormant/pending-invite
   * counts in memory — one query, not one per tenant.
   */
  async listActiveUsersForDormancy(): Promise<StaffSecurityUserRow[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: { tenantId: true, lastLoginAt: true, createdAt: true },
    })
  }
```

- [ ] **Step 9:** `pnpm --filter @rezeta/api test -- identity.repository` → PASS (9 tests).

- [ ] **Step 10: Failing `StaffSecurityService` tests.**

`apps/api/src/modules/identity/__tests__/staff-security.service.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffSecurityService } from '../staff-security.service.js'
import type { IdentityRepository } from '../identity.repository.js'

const mockRepo = {
  listAllTenants: vi.fn(),
  listSuccessfulLoginsSince: vi.fn(),
  listActiveUsersForDormancy: vi.fn(),
}

function makeService(): StaffSecurityService {
  return new StaffSecurityService(mockRepo as unknown as IdentityRepository)
}

const NOW = new Date('2026-07-28T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  mockRepo.listAllTenants.mockResolvedValue([])
  mockRepo.listSuccessfulLoginsSince.mockResolvedValue([])
  mockRepo.listActiveUsersForDormancy.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('overview', () => {
  it('returns zeroed tiles and an empty institution list with no data', async () => {
    const result = await makeService().overview()
    expect(result).toEqual({
      tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0 },
      institutions: [],
    })
  })

  it('includes every tenant, even one with zero logins and zero dormant/pending users', async () => {
    mockRepo.listAllTenants.mockResolvedValue([
      { id: 't1', name: 'Consultorio Dr. Gómez', plan: 'solo' },
    ])
    const result = await makeService().overview()
    expect(result.institutions).toEqual([
      {
        tenantId: 't1',
        name: 'Consultorio Dr. Gómez',
        plan: 'solo',
        mau30d: 0,
        logins14d: new Array(14).fill(0),
        dormant30d: 0,
        pendingInvites: 0,
      },
    ])
  })

  it('computes activeInstitutions/activeUsers30d/logins7d/mau30d from the 30-day login dataset', async () => {
    mockRepo.listAllTenants.mockResolvedValue([
      { id: 't1', name: 'Tenant One', plan: 'clinic' },
      { id: 't2', name: 'Tenant Two', plan: 'free' },
    ])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      { tenantId: 't1', userId: 'u1', createdAt: daysAgo(1) }, // within 7d
      { tenantId: 't1', userId: 'u1', createdAt: daysAgo(2) }, // within 7d, same user
      { tenantId: 't1', userId: 'u2', createdAt: daysAgo(20) }, // outside 7d, within 30d
      { tenantId: 't2', userId: 'u3', createdAt: daysAgo(29) }, // outside 7d
    ])
    const result = await makeService().overview()
    expect(result.tiles.activeInstitutions).toBe(2)
    expect(result.tiles.activeUsers30d).toBe(3) // u1, u2, u3
    expect(result.tiles.logins7d).toBe(2) // the two daysAgo(1)/daysAgo(2) rows
    const t1 = result.institutions.find((i) => i.tenantId === 't1')
    const t2 = result.institutions.find((i) => i.tenantId === 't2')
    expect(t1?.mau30d).toBe(2) // u1, u2
    expect(t2?.mau30d).toBe(1) // u3
  })

  it('buckets logins14d oldest to newest with the most recent day last, dropping rows older than 14 days', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      { tenantId: 't1', userId: 'u1', createdAt: daysAgo(0) }, // today -> last bucket
      { tenantId: 't1', userId: 'u2', createdAt: daysAgo(0) }, // today, second login
      { tenantId: 't1', userId: 'u3', createdAt: daysAgo(13) }, // 13 days ago -> first bucket
      { tenantId: 't1', userId: 'u4', createdAt: daysAgo(20) }, // older than 14d -> dropped
    ])
    const result = await makeService().overview()
    const buckets = result.institutions[0]?.logins14d
    expect(buckets).toHaveLength(14)
    expect(buckets?.[0]).toBe(1) // 13 days ago
    expect(buckets?.[13]).toBe(2) // today
    expect(buckets?.slice(1, 13)).toEqual(new Array(12).fill(0))
  })

  it('excludes a freshly created account from dormant30d/dormantAccounts60d even with no logins', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: null, createdAt: daysAgo(5) }, // fresh invite
    ])
    const result = await makeService().overview()
    expect(result.tiles.dormantAccounts60d).toBe(0)
    expect(result.institutions[0]?.dormant30d).toBe(0)
    expect(result.institutions[0]?.pendingInvites).toBe(1) // pending has no freshness exclusion
  })

  it('counts a stale, never-logged-in account as dormant at both the 30d and 60d windows', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: null, createdAt: daysAgo(90) },
    ])
    const result = await makeService().overview()
    expect(result.tiles.dormantAccounts60d).toBe(1)
    expect(result.institutions[0]?.dormant30d).toBe(1)
    expect(result.institutions[0]?.pendingInvites).toBe(1)
  })

  it('counts an old account with a stale-but-not-ancient last login as dormant at 30d but not 60d', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: daysAgo(45), createdAt: daysAgo(200) },
    ])
    const result = await makeService().overview()
    expect(result.tiles.dormantAccounts60d).toBe(0)
    expect(result.institutions[0]?.dormant30d).toBe(1)
    expect(result.institutions[0]?.pendingInvites).toBe(0)
  })
})
```

- [ ] **Step 11:** `pnpm --filter @rezeta/api test -- staff-security.service` → FAIL (module not found).

- [ ] **Step 12: Implement `StaffSecurityService`.**

`apps/api/src/modules/identity/staff-security.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { StaffSecurityInstitutionDto, StaffSecurityOverviewDto } from '@rezeta/shared'
import {
  IdentityRepository,
  type StaffSecurityLoginRow,
  type StaffSecurityUserRow,
} from './identity.repository.js'

const DAY_MS = 24 * 60 * 60 * 1000
const LOGIN_WINDOW_DAYS = 30
const SPARKLINE_DAYS = 14
const RECENT_WINDOW_DAYS = 7
const TENANT_DORMANT_DAYS = 30
const GLOBAL_DORMANT_DAYS = 60

interface LoginAggregates {
  activeInstitutions: number
  activeUsers30d: number
  logins7d: number
  perTenant: Map<string, { mau30d: number; logins14d: number[] }>
}

interface DormancyAggregates {
  dormantAccounts60d: number
  perTenant: Map<string, { dormant30d: number; pendingInvites: number }>
}

/**
 * Staff cross-institution security dashboard (identity design §6 screen 4,
 * §8 slice 5). Reads only counts, dates, and institution names — never
 * clinical data (control-plane isolation invariant, identity design §2
 * decision 5). Every aggregate is built from exactly one repository query
 * per data source (tenants / login events / users), joined in memory here —
 * no N+1 across tenants.
 */
@Injectable()
export class StaffSecurityService {
  constructor(@Inject(IdentityRepository) private repository: IdentityRepository) {}

  async overview(): Promise<StaffSecurityOverviewDto> {
    const now = new Date()
    const since30d = new Date(now.getTime() - LOGIN_WINDOW_DAYS * DAY_MS)

    const [tenants, loginRows, userRows] = await Promise.all([
      this.repository.listAllTenants(),
      this.repository.listSuccessfulLoginsSince(since30d),
      this.repository.listActiveUsersForDormancy(),
    ])

    const loginAgg = aggregateLogins(loginRows, now)
    const dormancyAgg = aggregateDormancy(userRows, now)

    const institutions: StaffSecurityInstitutionDto[] = tenants.map((tenant) => {
      const login = loginAgg.perTenant.get(tenant.id)
      const dormancy = dormancyAgg.perTenant.get(tenant.id)
      return {
        tenantId: tenant.id,
        name: tenant.name,
        plan: tenant.plan as StaffSecurityInstitutionDto['plan'],
        mau30d: login?.mau30d ?? 0,
        logins14d: login?.logins14d ?? new Array<number>(SPARKLINE_DAYS).fill(0),
        dormant30d: dormancy?.dormant30d ?? 0,
        pendingInvites: dormancy?.pendingInvites ?? 0,
      }
    })

    return {
      tiles: {
        activeInstitutions: loginAgg.activeInstitutions,
        activeUsers30d: loginAgg.activeUsers30d,
        logins7d: loginAgg.logins7d,
        dormantAccounts60d: dormancyAgg.dormantAccounts60d,
      },
      institutions,
    }
  }
}

/**
 * `rows` are every successful login in the last 30 days across the
 * platform. The 7-day and 14-day windows are subsets of that same
 * in-memory dataset, so this is the only pass over LoginEvent data the
 * dashboard needs.
 */
function aggregateLogins(rows: StaffSecurityLoginRow[], now: Date): LoginAggregates {
  const since7d = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS)
  const perTenantRows = new Map<string, StaffSecurityLoginRow[]>()
  const perTenantUsers = new Map<string, Set<string>>()
  const allUsers = new Set<string>()
  let logins7d = 0

  for (const row of rows) {
    if (row.createdAt >= since7d) logins7d += 1
    if (row.userId) allUsers.add(row.userId)
    if (!row.tenantId) continue

    const tenantRows = perTenantRows.get(row.tenantId) ?? []
    tenantRows.push(row)
    perTenantRows.set(row.tenantId, tenantRows)

    if (row.userId) {
      const tenantUsers = perTenantUsers.get(row.tenantId) ?? new Set<string>()
      tenantUsers.add(row.userId)
      perTenantUsers.set(row.tenantId, tenantUsers)
    }
  }

  const perTenant = new Map<string, { mau30d: number; logins14d: number[] }>()
  for (const [tenantId, tenantRows] of perTenantRows) {
    perTenant.set(tenantId, {
      mau30d: perTenantUsers.get(tenantId)?.size ?? 0,
      logins14d: bucketLogins14d(tenantRows, now),
    })
  }

  return { activeInstitutions: perTenantRows.size, activeUsers30d: allUsers.size, logins7d, perTenant }
}

/**
 * Buckets `rows` into 14 daily counts, oldest first, newest (today) last —
 * the mockup's sparkline highlights the last bar as today (identity design
 * §6 screen 4 note 1). Age is measured in whole days back from `now`;
 * anything 14 days old or older (or, defensively, in the future) is
 * dropped — `rows` is already the last-30-days dataset, so in practice
 * only the most recent 14 days ever populate a bucket.
 */
function bucketLogins14d(rows: { createdAt: Date }[], now: Date): number[] {
  const buckets = new Array<number>(SPARKLINE_DAYS).fill(0)
  for (const row of rows) {
    const ageDays = Math.floor((now.getTime() - row.createdAt.getTime()) / DAY_MS)
    if (ageDays < 0 || ageDays >= SPARKLINE_DAYS) continue
    const index = SPARKLINE_DAYS - 1 - ageDays
    buckets[index] = (buckets[index] ?? 0) + 1
  }
  return buckets
}

/**
 * `rows` are every active, non-deleted institution user across the
 * platform. A user is "dormant" at a given window when they have never
 * logged in, or their last login predates the window's cutoff — but only
 * once the account itself is older than that cutoff, so a user invited
 * yesterday is never miscounted as dormant. "Pending invite" has no
 * freshness exclusion: an active user who has never logged in is pending
 * from the moment they're created.
 */
function aggregateDormancy(rows: StaffSecurityUserRow[], now: Date): DormancyAggregates {
  const cutoffTenant = new Date(now.getTime() - TENANT_DORMANT_DAYS * DAY_MS)
  const cutoffGlobal = new Date(now.getTime() - GLOBAL_DORMANT_DAYS * DAY_MS)
  const perTenant = new Map<string, { dormant30d: number; pendingInvites: number }>()
  let dormantAccounts60d = 0

  for (const row of rows) {
    if (isDormantAt(row, cutoffGlobal)) dormantAccounts60d += 1

    const entry = perTenant.get(row.tenantId) ?? { dormant30d: 0, pendingInvites: 0 }
    if (isDormantAt(row, cutoffTenant)) entry.dormant30d += 1
    if (row.lastLoginAt === null) entry.pendingInvites += 1
    perTenant.set(row.tenantId, entry)
  }

  return { dormantAccounts60d, perTenant }
}

/**
 * A row is dormant against `cutoff` when the account itself predates the
 * cutoff (so a freshly invited user is never flagged) AND the user has
 * either never logged in or their last login predates the cutoff too.
 */
function isDormantAt(row: StaffSecurityUserRow, cutoff: Date): boolean {
  if (row.createdAt >= cutoff) return false
  return row.lastLoginAt === null || row.lastLoginAt < cutoff
}
```

- [ ] **Step 13:** `pnpm --filter @rezeta/api test -- staff-security.service` → PASS (7 tests).

- [ ] **Step 14: Failing `StaffSecurityController` test.**

`apps/api/src/modules/identity/__tests__/staff-security.controller.spec.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { StaffSecurityController } from '../staff-security.controller.js'
import type { StaffSecurityService } from '../staff-security.service.js'

describe('StaffSecurityController', () => {
  it('overview delegates to the service', async () => {
    const overview = {
      tiles: { activeInstitutions: 1, activeUsers30d: 1, logins7d: 1, dormantAccounts60d: 0 },
      institutions: [],
    }
    const service = { overview: vi.fn().mockResolvedValue(overview) } as unknown as StaffSecurityService
    const result = await new StaffSecurityController(service).overview()
    expect(service.overview).toHaveBeenCalledWith()
    expect(result).toBe(overview)
  })
})
```

- [ ] **Step 15:** `pnpm --filter @rezeta/api test -- staff-security.controller` → FAIL (module not found).

- [ ] **Step 16: Implement `StaffSecurityController`.**

`apps/api/src/modules/identity/staff-security.controller.ts`:

```ts
import { Controller, Get, Inject } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger'
import type { StaffSecurityOverviewDto } from '@rezeta/shared'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import { PlatformRoute } from '../../common/decorators/platform-route.decorator.js'
import { StaffSecurityService } from './staff-security.service.js'

@ApiTags('Staff')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@PlatformRoute()
@Controller('v1/staff/identity/security')
export class StaffSecurityController {
  constructor(@Inject(StaffSecurityService) private svc: StaffSecurityService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Cross-institution security metrics for the staff console' })
  @ApiResponse({ status: 200 })
  overview(): Promise<StaffSecurityOverviewDto> {
    return this.svc.overview()
  }
}
```

- [ ] **Step 17: Wire the module + barrel.**

`apps/api/src/modules/identity/identity.module.ts` (replace the slice-3 version):

```ts
import { Module } from '@nestjs/common'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'
import { IdentityService } from './identity.service.js'
import { IdentityController } from './identity.controller.js'
import { StaffSecurityService } from './staff-security.service.js'
import { StaffSecurityController } from './staff-security.controller.js'

@Module({
  controllers: [IdentityController, StaffSecurityController],
  providers: [IdentityRepository, LoginTelemetryService, IdentityService, StaffSecurityService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
```

`apps/api/src/modules/identity/index.ts` — add two lines:

```ts
export { StaffSecurityService } from './staff-security.service.js'
export { StaffSecurityController } from './staff-security.controller.js'
```

No `app.module.ts` change is needed — `IdentityModule` is already in `AppModule`'s `imports` (identity slice 3); the new controller rides along automatically.

- [ ] **Step 18:** `pnpm --filter @rezeta/api test -- staff-security.controller` → PASS (1 test). Then `pnpm --filter @rezeta/api test` (full suite — catches DI wiring errors) and `pnpm -r typecheck` → PASS.

- [ ] **Step 19: Commit**

```bash
git add packages/shared/src/schemas/identity.ts packages/shared/src/schemas/__tests__/identity.spec.ts apps/api/src/modules/identity
git commit -m "feat(api): staff cross-institution security dashboard endpoint"
```

---

### Task 2: New-device email

**Files:**
- Modify: `apps/api/src/modules/users/invitation-mailer.service.ts`
- Modify: `apps/api/src/modules/users/__tests__/invitation-mailer.service.spec.ts`
- Modify: `apps/api/src/modules/identity/identity.repository.ts` (`upsertDevice` return type)
- Modify: `apps/api/src/modules/identity/__tests__/identity.repository.spec.ts`
- Modify: `apps/api/src/modules/identity/login-telemetry.service.ts`
- Modify: `apps/api/src/modules/identity/__tests__/login-telemetry.service.spec.ts`
- Modify: `apps/api/src/modules/identity/identity.module.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Modify: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`
- Modify: `apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts` (constructor signature only — full test extension is Task 3)

**Interfaces:**
- Produces: `InvitationMailerService.sendNewDeviceEmail(email, deviceLabel)`; `LoginTelemetryService.upsertDevice` now returns `{ created: boolean }` and fires the email internally.

- [ ] **Step 1: Failing mailer test.**

Append to `apps/api/src/modules/users/__tests__/invitation-mailer.service.spec.ts`, inside the existing `describe('InvitationMailerService', ...)` block:

```ts
  it('logs the new-device notification (dev path)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const mailer = new InvitationMailerService()
    await mailer.sendNewDeviceEmail('dr@clinic.do', 'Mozilla/5.0 (Macintosh)')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('dr@clinic.do'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Mozilla/5.0 (Macintosh)'))
    spy.mockRestore()
  })
```

- [ ] **Step 2:** `pnpm --filter @rezeta/api test -- invitation-mailer` → FAIL (`sendNewDeviceEmail` is not a function).

- [ ] **Step 3: Implement `sendNewDeviceEmail`.**

`apps/api/src/modules/users/invitation-mailer.service.ts` (add the method to the existing class, same log-only pattern as `sendSetPasswordEmail`):

```ts
  /**
   * Notifies a user the first time a login is seen from a new device
   * fingerprint (identity design §7 "New-device email"). Same log-only dev
   * path as `sendSetPasswordEmail` — replace the body when a real
   * transactional-email provider lands; the call site
   * (`LoginTelemetryService.upsertDevice`) does not change.
   */
  async sendNewDeviceEmail(email: string, deviceLabel: string): Promise<void> {
    this.logger.log(`New-device email for ${email}: ${deviceLabel}`)
    return Promise.resolve()
  }
```

- [ ] **Step 4:** `pnpm --filter @rezeta/api test -- invitation-mailer` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/users/invitation-mailer.service.ts apps/api/src/modules/users/__tests__/invitation-mailer.service.spec.ts
git commit -m "feat(api): new-device email notification"
```

- [ ] **Step 6: Update the repository's `upsertDevice` test to expect the returned row.**

In `apps/api/src/modules/identity/__tests__/identity.repository.spec.ts`, add a new test right after the existing `'upsertDevice keys on the [userId, fingerprint] compound unique and bumps lastSeenAt'` test:

```ts
  it('upsertDevice returns the upserted row', async () => {
    const row = {
      id: 'd1',
      fingerprint: 'fp1',
      userAgent: 'UA',
      firstSeenAt: new Date('2026-07-28T00:00:00Z'),
      lastSeenAt: new Date('2026-07-28T00:00:00Z'),
    }
    vi.mocked(prisma.userDevice.upsert).mockResolvedValue(row as never)
    const result = await makeRepo().upsertDevice({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: 'fp1',
      userAgent: 'UA',
    })
    expect(result).toBe(row)
  })
```

- [ ] **Step 7:** `pnpm --filter @rezeta/api test -- identity.repository` → FAIL at runtime, not just typecheck — the current `upsertDevice` `await`s the upsert as a bare statement without a `return`, so it resolves to `undefined`; `expect(result).toBe(row)` fails because `result` is `undefined`.

- [ ] **Step 8: Change `upsertDevice`'s return type.**

In `apps/api/src/modules/identity/identity.repository.ts`, replace the `upsertDevice` method:

```ts
  /**
   * Keys on the [userId, fingerprint] compound unique. Every current caller
   * supplies a non-null userId (device tracking only runs for a successfully
   * authenticated institution user); the schema still allows a null userId
   * for future platform-staff device tracking (out of scope this slice).
   * Returns the upserted row — `LoginTelemetryService.upsertDevice` compares
   * `firstSeenAt`/`lastSeenAt` on it to tell a brand-new device from a
   * bumped one (identity slice 5 new-device email).
   */
  async upsertDevice(input: UpsertDeviceInput): Promise<UserDeviceRow> {
    const now = new Date()
    return this.prisma.userDevice.upsert({
      where: {
        userId_fingerprint: { userId: input.userId as string, fingerprint: input.fingerprint },
      },
      create: { ...input, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now, userAgent: input.userAgent },
    })
  }
```

- [ ] **Step 9:** `pnpm --filter @rezeta/api test -- identity.repository` → PASS (10 tests). `pnpm --filter @rezeta/api typecheck` → PASS.

- [ ] **Step 10: Failing `LoginTelemetryService` tests.**

Replace `apps/api/src/modules/identity/__tests__/login-telemetry.service.spec.ts` in full:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { LoginTelemetryService, fingerprintFor, mapFirebaseSignInMethod } from '../login-telemetry.service.js'
import type { IdentityRepository } from '../identity.repository.js'
import type { InvitationMailerService } from '../../users/index.js'

const mockRepo = { insertLoginEvent: vi.fn(), upsertDevice: vi.fn() }
const mockMailer = { sendNewDeviceEmail: vi.fn().mockResolvedValue(undefined) }

function makeService(): LoginTelemetryService {
  return new LoginTelemetryService(
    mockRepo as unknown as IdentityRepository,
    mockMailer as unknown as InvitationMailerService,
  )
}

const NOW = new Date('2026-07-28T12:00:00.000Z')
const OLD = new Date('2026-07-01T00:00:00.000Z')

function deviceRow(firstSeenAt: Date, lastSeenAt: Date) {
  return { id: 'd1', fingerprint: 'fp1', userAgent: 'UA', firstSeenAt, lastSeenAt }
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

  it('passes through platformUserId/ipAddress/userAgent when supplied', async () => {
    mockRepo.insertLoginEvent.mockResolvedValue(undefined)
    await makeService().recordLogin({
      platformUserId: 'p1',
      outcome: 'success',
      method: 'sso',
      ipAddress: '2.2.2.2',
      userAgent: 'UA-x',
    })
    expect(mockRepo.insertLoginEvent).toHaveBeenCalledWith({
      tenantId: null,
      userId: null,
      platformUserId: 'p1',
      outcome: 'success',
      method: 'sso',
      ipAddress: '2.2.2.2',
      userAgent: 'UA-x',
    })
  })
})

describe('upsertDevice', () => {
  it('computes a deterministic sha256 fingerprint and upserts', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ tenantId: 't1', userId: 'u1', userAgent: 'Mozilla/5.0', ipAddress: '10.0.0.1' })
    const expected = createHash('sha256').update('Mozilla/5.0|10.0.0.1').digest('hex')
    expect(mockRepo.upsertDevice).toHaveBeenCalledWith({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: expected,
      userAgent: 'Mozilla/5.0',
    })
  })

  it('normalizes missing tenantId/userId/userAgent and passes through a supplied platformUserId', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ platformUserId: 'p1' })
    expect(mockRepo.upsertDevice).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: null, userId: null, platformUserId: 'p1', userAgent: null }),
    )
  })

  it('returns created: true when firstSeenAt equals lastSeenAt (a brand-new device row)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    const result = await makeService().upsertDevice({ userId: 'u1' })
    expect(result).toEqual({ created: true })
  })

  it('returns created: false when lastSeenAt is bumped past firstSeenAt (an existing device)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(OLD, NOW))
    const result = await makeService().upsertDevice({ userId: 'u1' })
    expect(result).toEqual({ created: false })
  })

  it('sends the new-device email when the device is new, an institution user, and an email is supplied', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ userId: 'u1', userAgent: 'Mozilla/5.0', email: 'dr@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).toHaveBeenCalledWith('dr@rezeta.do', 'Mozilla/5.0')
  })

  it('falls back to a generic device label when userAgent is absent', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ userId: 'u1', email: 'dr@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).toHaveBeenCalledWith('dr@rezeta.do', 'Unknown device')
  })

  it('does not send the new-device email when the device already existed', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(OLD, NOW))
    await makeService().upsertDevice({ userId: 'u1', email: 'dr@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).not.toHaveBeenCalled()
  })

  it('does not send the new-device email when no email is supplied', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ userId: 'u1' })
    expect(mockMailer.sendNewDeviceEmail).not.toHaveBeenCalled()
  })

  it('does not send the new-device email when userId is absent (no institution user to notify)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ platformUserId: 'p1', email: 'staff@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).not.toHaveBeenCalled()
  })

  it('a new-device email failure does not reject upsertDevice (fire-and-forget)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    mockMailer.sendNewDeviceEmail.mockRejectedValueOnce(new Error('smtp down'))
    await expect(makeService().upsertDevice({ userId: 'u1', email: 'dr@rezeta.do' })).resolves.toEqual({
      created: true,
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

- [ ] **Step 11:** `pnpm --filter @rezeta/api test -- login-telemetry` → FAIL — the current `upsertDevice` never `return`s the awaited row (resolves `undefined`) and never touches a `mailer`, so every new `created`/email-related assertion fails at runtime (the extra constructor argument itself is silently ignored by JS, not a crash — the failures come from the missing behavior).

- [ ] **Step 12: Implement the change in `LoginTelemetryService`.**

Replace `apps/api/src/modules/identity/login-telemetry.service.ts` in full:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { InvitationMailerService } from '../users/index.js'
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
  /**
   * Institution user's email — used only to send the new-device
   * notification when this call creates a brand-new device row. Optional
   * because the platform-staff device-tracking path (out of scope this
   * slice, see `UpsertDeviceInput.userId`'s doc) has no email to send to.
   */
  email?: string | null
}

export interface UpsertDeviceResult {
  created: boolean
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
 * `recordLogin` doesn't catch its own errors — matching the codebase's
 * existing fire-and-forget convention (see AuthGuard.markSignedIn): callers
 * invoke these with `void ...().catch((err) => logger.warn(...))` so a
 * telemetry outage never blocks a login. See AuthService.provision and
 * AuthGuard below. `upsertDevice` additionally fires the new-device email
 * (identity design §7 "New-device email") on its own internal
 * fire-and-forget path — a mailer failure never rejects `upsertDevice`
 * itself, so a caller's `.catch` can't mistake it for a telemetry-write
 * failure.
 */
@Injectable()
export class LoginTelemetryService {
  private readonly logger = new Logger(LoginTelemetryService.name)

  constructor(
    @Inject(IdentityRepository) private repository: IdentityRepository,
    @Inject(InvitationMailerService) private mailer: InvitationMailerService,
  ) {}

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

  async upsertDevice(input: UpsertDeviceInput): Promise<UpsertDeviceResult> {
    const row = await this.repository.upsertDevice({
      tenantId: input.tenantId ?? null,
      userId: input.userId ?? null,
      platformUserId: input.platformUserId ?? null,
      fingerprint: fingerprintFor(input.userAgent, input.ipAddress),
      userAgent: input.userAgent ?? null,
    })
    const created = row.firstSeenAt.getTime() === row.lastSeenAt.getTime()

    if (created && input.userId && input.email) {
      const deviceLabel = input.userAgent ?? 'Unknown device'
      void this.mailer.sendNewDeviceEmail(input.email, deviceLabel).catch((err: unknown) => {
        this.logger.warn(
          `Failed to send new-device email for user id=${input.userId}: ${(err as Error).message}`,
        )
      })
    }

    return { created }
  }
}
```

- [ ] **Step 13:** `pnpm --filter @rezeta/api test -- login-telemetry` → PASS (16 tests).

- [ ] **Step 14: Import `UsersModule` into `IdentityModule`.**

`apps/api/src/modules/identity/identity.module.ts` (replace the Task 1 version):

```ts
import { Module } from '@nestjs/common'
import { UsersModule } from '../users/index.js'
import { IdentityRepository } from './identity.repository.js'
import { LoginTelemetryService } from './login-telemetry.service.js'
import { IdentityService } from './identity.service.js'
import { IdentityController } from './identity.controller.js'
import { StaffSecurityService } from './staff-security.service.js'
import { StaffSecurityController } from './staff-security.controller.js'

@Module({
  imports: [UsersModule],
  controllers: [IdentityController, StaffSecurityController],
  providers: [IdentityRepository, LoginTelemetryService, IdentityService, StaffSecurityService],
  exports: [LoginTelemetryService, IdentityRepository],
})
export class IdentityModule {}
```

`UsersModule` does not import `IdentityModule` (or `AuthModule`), so this is not circular — it's the same diamond `AuthFeatureModule` already forms (it imports both `UsersModule` and `IdentityModule` directly); Nest resolves diamonds fine as long as there's no cycle.

- [ ] **Step 15: Pass `user.email` into `upsertDevice` from `AuthService.provision`.**

In `apps/api/src/modules/auth/auth.service.ts`, change the `upsertDevice` call inside `provision`:

```ts
    void Promise.all([
      this.loginTelemetry.recordLogin({
        tenantId: user.tenantId,
        userId: user.id,
        outcome: 'success',
        method,
        ...telemetryMeta,
      }),
      this.loginTelemetry.upsertDevice({
        tenantId: user.tenantId,
        userId: user.id,
        email: user.email,
        ...telemetryMeta,
      }),
    ]).catch((err: unknown) => {
      this.logger.warn(
        `Failed to record login telemetry for user id=${user.id}: ${(err as Error).message}`,
      )
    })
```

- [ ] **Step 16: Extend `auth.service.spec.ts`.**

Add a test inside the `describe('provision', ...)` block, after the existing `'records login telemetry (mapped method) and upserts a device after provision'` test:

```ts
    it('passes the user email through to upsertDevice for the new-device email path', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never
      await service.provision(verified)
      expect(mockLoginTelemetry.upsertDevice).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'dr@test.com' }),
      )
    })
```

- [ ] **Step 17:** `pnpm --filter @rezeta/api test -- auth.service` → PASS.

- [ ] **Step 18: Fix `identity.service.int-spec.ts`'s `LoginTelemetryService` construction (so the whole workspace still compiles/runs — the full test extension is Task 3).**

In `apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts`, add the import:

```ts
import type { InvitationMailerService } from '../../users/index.js'
```

Add a fake mailer alongside the existing `authProvider` const:

```ts
  const mailer = {
    sendNewDeviceEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as InvitationMailerService
```

Change the `telemetry = new LoginTelemetryService(repo)` line inside `beforeAll`:

```ts
    telemetry = new LoginTelemetryService(repo, mailer)
```

- [ ] **Step 19:** `pnpm --filter @rezeta/api test` (full unit suite) and `pnpm -r typecheck` → PASS. `pnpm lint` → clean.

- [ ] **Step 20: Commit**

```bash
git add apps/api/src/modules/identity apps/api/src/modules/auth
git commit -m "feat(api): new-device email fires on the first sighting of a device"
```

---

### Task 3: Real-Postgres integration coverage for `StaffSecurityService`

**Files:**
- Modify: `apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts`

**Interfaces:** Consumes `hasTestDb`, `createTestTenant`, `createTestUser`, `truncateAll` from `apps/api/src/test/db-test-utils.ts` (already imported in this file). Real `StaffSecurityService` wired to the same test-Prisma `IdentityRepository` instance the file already constructs.

- [ ] **Step 1: Add the import and a new describe block.**

In `apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts`, add the import:

```ts
import { StaffSecurityService } from '../staff-security.service.js'
```

Append a new top-level `describe` block, after the existing `describe('signOutAllSessions', ...)` block but still inside the outer `describe.skipIf(!hasTestDb())(...)`:

```ts
  describe('StaffSecurityService (integration)', () => {
    it('aggregates tiles and per-institution buckets/dormant/pending across 2 tenants and 3 days of logins', async () => {
      const tenantA = await createTestTenant(prisma, { name: 'Tenant A', plan: 'clinic' })
      const tenantB = await createTestTenant(prisma, { name: 'Tenant B', plan: 'free' })
      const userA1 = await createTestUser(prisma, tenantA.id)
      const userA2 = await createTestUser(prisma, tenantA.id)
      const userB1 = await createTestUser(prisma, tenantB.id)

      // Logins across 2 tenants / 3 days.
      await prisma.loginEvent.create({
        data: { tenantId: tenantA.id, userId: userA1.id, outcome: 'success', method: 'password', createdAt: new Date() },
      })
      await prisma.loginEvent.create({
        data: {
          tenantId: tenantA.id,
          userId: userA2.id,
          outcome: 'success',
          method: 'password',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      })
      await prisma.loginEvent.create({
        data: {
          tenantId: tenantB.id,
          userId: userB1.id,
          outcome: 'success',
          method: 'password',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      })

      // userA1: logged in and recently -> not dormant, not pending.
      await prisma.user.update({ where: { id: userA1.id }, data: { lastLoginAt: new Date() } })
      // userA2: never logged in, but the account itself is fresh -> pending, not dormant.
      // (createdAt stays at `createTestUser`'s default of "now" — no update needed.)
      // userB1: never logged in AND the account is old -> dormant at both 30d and 60d, and pending.
      await prisma.user.update({
        where: { id: userB1.id },
        data: { createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), lastLoginAt: null },
      })

      const staffSecurity = new StaffSecurityService(repo)
      const result = await staffSecurity.overview()

      expect(result.tiles.activeInstitutions).toBe(2)
      expect(result.tiles.activeUsers30d).toBe(3)
      expect(result.tiles.logins7d).toBe(3)
      expect(result.tiles.dormantAccounts60d).toBe(1) // userB1

      const a = result.institutions.find((i) => i.tenantId === tenantA.id)
      const b = result.institutions.find((i) => i.tenantId === tenantB.id)
      expect(a?.mau30d).toBe(2)
      expect(a?.logins14d.reduce((sum, n) => sum + n, 0)).toBe(2)
      expect(a?.pendingInvites).toBe(1) // userA2
      expect(a?.dormant30d).toBe(0)
      expect(b?.mau30d).toBe(1)
      expect(b?.dormant30d).toBe(1)
      expect(b?.pendingInvites).toBe(1)
    })

    it('excludes deactivated users from dormant/pending counts', async () => {
      const tenant = await createTestTenant(prisma)
      const inactive = await createTestUser(prisma, tenant.id)
      await prisma.user.update({
        where: { id: inactive.id },
        data: { isActive: false, createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      })

      const staffSecurity = new StaffSecurityService(repo)
      const result = await staffSecurity.overview()
      const t = result.institutions.find((i) => i.tenantId === tenant.id)
      expect(t?.dormant30d).toBe(0)
      expect(t?.pendingInvites).toBe(0)
      expect(result.tiles.dormantAccounts60d).toBe(0)
    })
  })
```

- [ ] **Step 2:** `pnpm --filter @rezeta/api test:integration -- identity` → RAN and passing (Postgres must be up — `docker start rezeta-postgres` if needed).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/identity/__tests__/identity.service.int-spec.ts
git commit -m "test(api): real-postgres integration coverage for the staff security dashboard"
```

---

### Task 4: Web — hook, strings, staff Security page, nav, route, tests

**Files:**
- Create: `apps/web/src/hooks/staff/use-staff-security.ts`
- Modify: `apps/web/src/pages/staff/strings.ts`
- Create: `apps/web/src/pages/staff/Security.tsx`
- Create: `apps/web/src/pages/staff/__tests__/Security.test.tsx`
- Modify: `apps/web/src/components/layout/StaffLayout.tsx`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `StaffSecurityOverviewDto`/`StaffSecurityInstitutionDto` from `@rezeta/shared`; `GET /v1/staff/identity/security/overview` (Task 1); `apiClient` from `apps/web/src/lib/api-client.ts`; `Badge`/`Callout`/`EmptyState`/`Spinner` from `@/components/ui`.
- Produces: route `/staff/security`, nav entry, `useStaffSecurityOverview()`.

- [ ] **Step 1: Add strings.**

In `apps/web/src/pages/staff/strings.ts`, add `navSecurity` to `staffStrings` (right after `navInstitutions`):

```ts
  navInstitutions: 'Institutions',
  navSecurity: 'Security',
  navPlatformUsers: 'Platform users',
```

Append a new export at the end of the file:

```ts
export const staffSecurityStrings = {
  pageTitle: 'Security',
  pageSubtitle: 'Cross-institution login activity and account health.',
  tileActiveInstitutions: 'Active institutions',
  tileActiveUsers: 'Active users · 30d',
  tileLogins7d: 'Logins · 7d',
  tileDormant: 'Dormant accounts · 60d',
  dormantCallout: (count: number): string => `${count} accounts with no access in 60 days`,
  tableInstitution: 'Institution',
  tablePlan: 'Plan',
  tableMau: 'MAU',
  tableLogins: 'Logins · 14d',
  tableSignals: 'Signals',
  unnamed: 'Unnamed institution',
  signalDormant: (count: number): string => `${count} dormant`,
  signalPending: (count: number): string => `${count} pending invites`,
  loadError: 'Could not load the security overview.',
  emptyTitle: 'No institutions yet',
  emptyBody: 'Institution activity will appear here once accounts start signing in.',
} as const
```

- [ ] **Step 2: Hook.**

`apps/web/src/hooks/staff/use-staff-security.ts`:

```ts
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { StaffSecurityOverviewDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'staff-security-overview'

export function useStaffSecurityOverview(): UseQueryResult<StaffSecurityOverviewDto, Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<StaffSecurityOverviewDto>('/v1/staff/identity/security/overview'),
  })
}
```

- [ ] **Step 3: Failing `Security.tsx` test.**

`apps/web/src/pages/staff/__tests__/Security.test.tsx` (mirror `Institutions.test.tsx`'s `vi.hoisted` style):

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StaffSecurityOverviewDto } from '@rezeta/shared'

const h = vi.hoisted(() => ({
  useStaffSecurityOverview: vi.fn(),
}))

vi.mock('@/hooks/staff/use-staff-security', () => ({
  useStaffSecurityOverview: h.useStaffSecurityOverview,
}))

import { Security } from '../Security'

const overview: StaffSecurityOverviewDto = {
  tiles: { activeInstitutions: 2, activeUsers30d: 42, logins7d: 120, dormantAccounts60d: 3 },
  institutions: [
    {
      tenantId: 't1',
      name: 'Centro Médico Vista Alegre',
      plan: 'clinic',
      mau30d: 26,
      logins14d: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      dormant30d: 0,
      pendingInvites: 0,
    },
    {
      tenantId: 't2',
      name: null,
      plan: 'solo',
      mau30d: 2,
      logins14d: new Array(14).fill(0),
      dormant30d: 2,
      pendingInvites: 1,
    },
  ],
}

describe('Security (staff)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page title and stat tiles', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
  })

  it('renders one sparkline bar per logins14d entry, per institution row', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    const { container } = render(<Security />)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.querySelectorAll('[data-testid="sparkline-bar"]')).toHaveLength(14)
  })

  it('shows the unnamed-institution fallback and signal chips', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('Unnamed institution')).toBeInTheDocument()
    expect(screen.getByText('2 dormant')).toBeInTheDocument()
    expect(screen.getByText('1 pending invites')).toBeInTheDocument()
  })

  it('shows the dormant callout when dormantAccounts60d is greater than zero', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: overview, isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('3 accounts with no access in 60 days')).toBeInTheDocument()
  })

  it('hides the dormant callout when dormantAccounts60d is zero', () => {
    h.useStaffSecurityOverview.mockReturnValue({
      data: { ...overview, tiles: { ...overview.tiles, dormantAccounts60d: 0 } },
      isLoading: false,
      isError: false,
    })
    render(<Security />)
    expect(screen.queryByText(/accounts with no access/)).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no institutions', () => {
    h.useStaffSecurityOverview.mockReturnValue({
      data: { ...overview, institutions: [] },
      isLoading: false,
      isError: false,
    })
    render(<Security />)
    expect(screen.getByText('No institutions yet')).toBeInTheDocument()
  })

  it('shows a spinner while loading', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<Security />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows a danger callout on load error', () => {
    h.useStaffSecurityOverview.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Security />)
    expect(screen.getByText('Could not load the security overview.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4:** `pnpm --filter @rezeta/web test -- Security` → FAIL (module not found — there are now two files named `Security.tsx`; this test targets `../Security` relative to `apps/web/src/pages/staff/__tests__/`, i.e. `apps/web/src/pages/staff/Security.tsx`, so it does not collide with `apps/web/src/pages/settings/Security.tsx`'s own test).

- [ ] **Step 5: Build `Security.tsx`.** Page shell (title/subtitle, `Spinner`/`Callout`/`EmptyState`) mirrors `apps/web/src/pages/staff/Institutions.tsx`; stat tiles mirror `apps/web/src/pages/settings/Security.tsx`'s `StatTiles`; plan cell mirrors `Institutions.tsx`'s `InstitutionRow` (`font-mono text-xs uppercase text-n-500`, no `Badge`).

`apps/web/src/pages/staff/Security.tsx`:

```tsx
import type { StaffSecurityInstitutionDto } from '@rezeta/shared'
import { Badge, Callout, EmptyState, Spinner } from '@/components/ui'
import { useStaffSecurityOverview } from '@/hooks/staff/use-staff-security'
import { staffSecurityStrings as s } from './strings'

function StatTile({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="border border-n-200 rounded-md bg-n-0 p-4">
      <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">{label}</div>
      <div className="text-h3 font-serif font-medium text-n-900 mt-1">{value}</div>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }): JSX.Element {
  const max = Math.max(...values, 0)
  return (
    <div className="flex items-end gap-0.5 h-8 w-180">
      {values.map((value, index) => {
        const height = max > 0 ? Math.max(4, (value / max) * 100) : 4
        const isLast = index === values.length - 1
        return (
          <div
            key={index}
            data-testid="sparkline-bar"
            className={isLast ? 'flex-1 rounded-sm bg-p-500' : 'flex-1 rounded-sm bg-p-100'}
            style={{ height: `${height}%` }}
          />
        )
      })}
    </div>
  )
}

function SignalsChips({ institution }: { institution: StaffSecurityInstitutionDto }): JSX.Element {
  if (institution.dormant30d === 0 && institution.pendingInvites === 0) {
    return <span className="text-xs text-n-400">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {institution.dormant30d > 0 && (
        <Badge variant="review">{s.signalDormant(institution.dormant30d)}</Badge>
      )}
      {institution.pendingInvites > 0 && (
        <Badge variant="review">{s.signalPending(institution.pendingInvites)}</Badge>
      )}
    </div>
  )
}

function InstitutionRow({ institution }: { institution: StaffSecurityInstitutionDto }): JSX.Element {
  return (
    <tr className="border-t border-n-100">
      <td className="px-4 py-3">
        <span className="font-medium text-n-800">{institution.name ?? s.unnamed}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-mono text-xs uppercase text-n-500">{institution.plan}</span>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-n-600">{institution.mau30d}</td>
      <td className="px-4 py-3">
        <Sparkline values={institution.logins14d} />
      </td>
      <td className="px-4 py-3">
        <SignalsChips institution={institution} />
      </td>
    </tr>
  )
}

export function Security(): JSX.Element {
  const { data, isLoading, isError } = useStaffSecurityOverview()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 font-serif font-medium text-n-900">{s.pageTitle}</h1>
        <p className="text-sm text-n-500">{s.pageSubtitle}</p>
      </div>

      {isLoading && <Spinner />}
      {isError && <Callout variant="danger">{s.loadError}</Callout>}

      {data && (
        <>
          <div className="grid grid-cols-4 gap-3">
            <StatTile label={s.tileActiveInstitutions} value={data.tiles.activeInstitutions} />
            <StatTile label={s.tileActiveUsers} value={data.tiles.activeUsers30d} />
            <StatTile label={s.tileLogins7d} value={data.tiles.logins7d} />
            <StatTile label={s.tileDormant} value={data.tiles.dormantAccounts60d} />
          </div>

          {data.tiles.dormantAccounts60d > 0 && (
            <Callout variant="warning" icon={<i className="ph ph-warning" />}>
              {s.dormantCallout(data.tiles.dormantAccounts60d)}
            </Callout>
          )}

          {data.institutions.length === 0 && (
            <EmptyState
              icon={<i className="ph ph-shield-check" />}
              title={s.emptyTitle}
              description={s.emptyBody}
            />
          )}

          {data.institutions.length > 0 && (
            <div className="border border-n-200 rounded-md overflow-hidden">
              <table className="w-full border-collapse bg-n-0">
                <thead>
                  <tr>
                    {[s.tableInstitution, s.tablePlan, s.tableMau, s.tableLogins, s.tableSignals].map((col) => (
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
                  {data.institutions.map((institution) => (
                    <InstitutionRow key={institution.tenantId} institution={institution} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

Note: `w-180`/`h-8`/`gap-0.5` are existing tokens (`apps/web/tailwind.config.ts` — `theme.extend.width['180']`, `theme.extend.height['36']`... — actually `h-8` and `gap-0.5` come from the base `spacing` scale (`8` → `var(--space-8)` = 32px, `0.5` → 2px), and `w-180` from `theme.extend.width['180']` = 180px); none of this is arbitrary-value syntax.

- [ ] **Step 6:** `pnpm --filter @rezeta/web test -- Security` → PASS (8 tests) — this runs both `pages/staff/__tests__/Security.test.tsx` and the pre-existing `pages/settings/__tests__/Security.test.tsx`; both must pass.

- [ ] **Step 7: Wire `StaffLayout.tsx`.**

In `apps/web/src/components/layout/StaffLayout.tsx`, add the nav link between Institutions and Platform users:

```tsx
      <nav className="flex gap-1 border-b border-n-200 bg-n-0 px-6">
        <StaffNavLink to="/staff/institutions" label={staffStrings.navInstitutions} end />
        <StaffNavLink to="/staff/security" label={staffStrings.navSecurity} />
        <StaffNavLink to="/staff/platform-users" label={staffStrings.navPlatformUsers} />
      </nav>
```

- [ ] **Step 8: Register the route.**

In `apps/web/src/App.tsx`, add the import next to the other staff page imports — aliased, since `Security` is already imported from `@/pages/settings/Security` for the institution-facing page:

```tsx
import { Security as StaffSecurity } from '@/pages/staff/Security'
```

Add the route entry inside the staff-console route group, between `staff/institutions/new` and `staff/platform-users`:

```tsx
      { path: 'staff', element: <Navigate to="/staff/institutions" replace /> },
      { path: 'staff/institutions', element: <Institutions /> },
      { path: 'staff/institutions/new', element: <NewInstitution /> },
      { path: 'staff/security', element: <StaffSecurity /> },
      { path: 'staff/platform-users', element: <PlatformUsers /> },
```

- [ ] **Step 9:** Run `pnpm --filter @rezeta/web test` (full web suite) and `pnpm --filter @rezeta/web typecheck` → PASS. Run `pnpm lint` → clean.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/hooks/staff/use-staff-security.ts apps/web/src/pages/staff/strings.ts apps/web/src/pages/staff/Security.tsx apps/web/src/pages/staff/__tests__/Security.test.tsx apps/web/src/components/layout/StaffLayout.tsx apps/web/src/App.tsx
git commit -m "feat(web): staff cross-institution security dashboard page"
```

---

### Task 5: Full verification + changelog

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Full workspace verification.**

Run from repo root, all must pass:

```bash
pnpm lint
pnpm test
pnpm test:coverage
```

Expected: zero lint errors, zero failing tests, coverage ≥95% per file on every new/modified service/repository/controller/schema file (pages/hooks exempt per convention). If a file misses the gate, add the missing test cases in that file's own `__tests__` before proceeding — likely candidates: `aggregateDormancy`'s branches in `staff-security.service.ts` (fresh-account exclusion at each window) and `LoginTelemetryService.upsertDevice`'s four created/email-eligibility branches.

- [ ] **Step 2: End-to-end smoke (manual, dev env).**

With `pnpm dev` running: sign in as a platform staff user, go to `/staff/security`, confirm the four tiles, the dormant callout (only if any test data has a 60-day-dormant account), and the institution table with sparklines and signal chips render. Sign in as an institution user from a browser/profile that has never signed in before and confirm a log line `New-device email for <email>: <user-agent>` appears in the API logs (dev-mode mailer); sign in again from the same browser and confirm no second log line appears.

- [ ] **Step 3: Changelog entry (English), prepend to `CHANGELOG.md`.**

```markdown
## [2026-07-28] Staff cross-institution security dashboard (identity slice 5)

### Added

- `GET /v1/staff/identity/security/overview` (`StaffSecurityController`,
  `apps/api/src/modules/identity/staff-security.controller.ts`) — platform
  tiles (active institutions, active users · 30d, logins · 7d, dormant
  accounts · 60d) and a per-institution roster (MAU · 30d, a 14-day login
  sparkline, dormant/pending-invite counts), all built from three
  cross-tenant queries joined in memory (`StaffSecurityService`,
  `IdentityRepository.listAllTenants`/`listSuccessfulLoginsSince`/
  `listActiveUsersForDormancy`).
- Shared DTOs `StaffSecurityOverviewSchema` / `StaffSecurityTilesSchema` /
  `StaffSecurityInstitutionSchema` (`packages/shared/src/schemas/identity.ts`).
- Staff platform → Security page (`apps/web/src/pages/staff/Security.tsx`,
  route `/staff/security`) — stat tiles, dormant-accounts callout,
  institution activity table with a CSS-bar sparkline and warning-chip
  signals; nav entry in `StaffLayout`.
- `InvitationMailerService.sendNewDeviceEmail` — fires (log-only dev path)
  from `LoginTelemetryService.upsertDevice` the first time a device
  fingerprint is seen for an institution user, detected by comparing the
  upserted `UserDevice` row's `firstSeenAt`/`lastSeenAt`.

### Changed

- `IdentityRepository.upsertDevice` now returns the upserted `UserDevice`
  row instead of `void`, so `LoginTelemetryService` can detect creation.
- `LoginTelemetryService.upsertDevice` now returns `{ created: boolean }`
  and takes an optional `email`; `AuthService.provision` passes
  `user.email` through.
- `IdentityModule` imports `UsersModule` (for `InvitationMailerService`).
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for staff security dashboard slice"
```

## Out of scope

MFA adoption (`MfaEnrollment`, identity slice 4 — not yet built when this
slice lands; no MFA tile or column). Enterprise SSO connections
(`SsoConnection`, identity slice 6). Failed-attempt spikes as a signal
(identity design §6 screen 4 note 2 mentions it; `LoginEvent.outcome` is
closed to `'success' | 'blocked'` with no per-tenant "spike" definition
specified anywhere in the design — only dormant accounts and pending
invites are implemented as signals this slice). Per-institution drill-down
from the staff dashboard into that institution's own Ajustes → Seguridad
data (identity design has no cross-boundary staff-to-tenant read; staff
sees aggregates only, per the control-plane isolation invariant). The
12-month `LoginEvent`/`UserDevice` purge job (identity design §4 — a future
scheduled-job slice). A real transactional-email provider for
`sendNewDeviceEmail` (stays log-only, matching `sendSetPasswordEmail`,
until email infrastructure lands).
