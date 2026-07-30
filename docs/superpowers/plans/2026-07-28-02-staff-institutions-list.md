# Staff Institutions List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platform staff can see all institutions (name, type, plan, user counts, created date) in a staff-console list; the create form hangs off it.

**Architecture:** One read-only `GET /v1/staff/institutions` on the existing `StaffController`/`StaffService` (grouped-count query, no N+1), one `Institutions.tsx` staff page mirroring the platform-users roster, route/nav repointing. Spec: `docs/superpowers/specs/2026-07-28-staff-institutions-list-design.md`.

**Tech Stack:** NestJS + Prisma + Zod shared schemas, React + TanStack Query, Vitest.

## Global Constraints

- English for all code/comments/tests and for staff-console UI copy (staff console is English; only institution-facing UI is Spanish).
- No TODO/FIXME comments. 2-space indent. Tokens-only Tailwind (no `w-[…]` arbitrary values).
- Read-only slice: NO edit/deactivate/detail features, no pagination, no audit entries for reads.
- Coverage gate 95% per file (`pnpm test:coverage`); pages/hooks are excluded by pre-existing project convention — service/controller/schema files are not.
- Each commit must keep the whole workspace typechecking (pre-commit hook runs lint + workspace typecheck). If lint hits `no-unsafe-*` on `@rezeta/shared` types, run `pnpm --filter @rezeta/shared build` (stale dist) and retry.
- Commit-message subjects must be lower-case (commitlint); append trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/shared/src/schemas/staff.ts` (modify) | `StaffInstitutionSchema` + DTO |
| `apps/api/src/modules/staff/staff.service.ts` (modify) | `listInstitutions()` |
| `apps/api/src/modules/staff/staff.controller.ts` (modify) | `GET /v1/staff/institutions` |
| `apps/api/src/modules/staff/__tests__/staff.service.int-spec.ts` (new) | Real-Postgres counts/ordering |
| `apps/web/src/pages/staff/strings.ts` (modify) | `institutionsStrings` + back-link string |
| `apps/web/src/hooks/staff/use-institutions.ts` (new) | `useStaffInstitutions()` |
| `apps/web/src/hooks/staff/use-create-institution.ts` (modify) | Invalidate list on create |
| `apps/web/src/pages/staff/Institutions.tsx` (new) | List page |
| `apps/web/src/pages/staff/NewInstitution.tsx` (modify) | Back-to-list link on success |
| `apps/web/src/components/layout/StaffLayout.tsx` (modify) | Nav → list, `end` matching |
| `apps/web/src/App.tsx` (modify) | Routes |

---

### Task 1: Shared schema + API (service, controller, unit specs)

**Files:**
- Modify: `packages/shared/src/schemas/staff.ts`
- Modify: `apps/api/src/modules/staff/staff.service.ts`
- Modify: `apps/api/src/modules/staff/staff.controller.ts`
- Test: extend `packages/shared/src/schemas/__tests__/staff.spec.ts`, `apps/api/src/modules/staff/__tests__/staff.service.spec.ts`, `apps/api/src/modules/staff/__tests__/staff.controller.spec.ts`

**Interfaces:**
- Produces: `StaffInstitutionSchema` / `type StaffInstitutionDto` in `@rezeta/shared`; `StaffService.listInstitutions(): Promise<StaffInstitutionDto[]>`; `GET /v1/staff/institutions`.

- [ ] **Step 1: Failing tests.** Append to the shared staff spec (mirror its existing style):

```ts
describe('StaffInstitutionSchema', () => {
  it('accepts a roster row', () => {
    const parsed = StaffInstitutionSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      name: 'Centro Vista Alegre',
      type: 'clinic',
      plan: 'clinic',
      createdAt: '2026-07-28T12:00:00.000Z',
      userCount: 5,
      activeUserCount: 4,
    })
    expect(parsed.userCount).toBe(5)
  })

  it('accepts a null name and rejects negative counts', () => {
    expect(
      StaffInstitutionSchema.parse({
        id: '11111111-2222-4333-8444-555555555555',
        name: null,
        type: 'solo',
        plan: 'free',
        createdAt: '2026-07-28T12:00:00.000Z',
        userCount: 0,
        activeUserCount: 0,
      }).name,
    ).toBeNull()
    expect(() =>
      StaffInstitutionSchema.parse({
        id: '11111111-2222-4333-8444-555555555555',
        name: null,
        type: 'solo',
        plan: 'free',
        createdAt: '2026-07-28T12:00:00.000Z',
        userCount: -1,
        activeUserCount: 0,
      }),
    ).toThrow()
  })
})
```

Append to `staff.service.spec.ts` (reuse its existing mock objects; add `tenant.findMany` and `user.groupBy` mocks to the prisma mock):

```ts
describe('listInstitutions', () => {
  it('maps tenants with grouped user counts, newest first, zero-defaults missing groups', async () => {
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([
      { id: 't2', name: 'B', type: 'clinic', plan: 'clinic', createdAt: new Date('2026-07-02T00:00:00Z') },
      { id: 't1', name: null, type: 'solo', plan: 'free', createdAt: new Date('2026-07-01T00:00:00Z') },
    ] as never)
    vi.mocked(prisma.user.groupBy)
      .mockResolvedValueOnce([{ tenantId: 't2', _count: { _all: 3 } }] as never) // all non-deleted
      .mockResolvedValueOnce([{ tenantId: 't2', _count: { _all: 2 } }] as never) // active subset
    const result = await makeService().listInstitutions()
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, type: true, plan: true, createdAt: true },
    })
    expect(result).toEqual([
      {
        id: 't2', name: 'B', type: 'clinic', plan: 'clinic',
        createdAt: '2026-07-02T00:00:00.000Z', userCount: 3, activeUserCount: 2,
      },
      {
        id: 't1', name: null, type: 'solo', plan: 'free',
        createdAt: '2026-07-01T00:00:00.000Z', userCount: 0, activeUserCount: 0,
      },
    ])
  })
})
```

Append to `staff.controller.spec.ts`:

```ts
it('listInstitutions delegates to the service', async () => {
  const service = { listInstitutions: vi.fn().mockResolvedValue([]) } as unknown as StaffService
  await new StaffController(service).listInstitutions()
  expect(service.listInstitutions).toHaveBeenCalledOnce()
})
```

- [ ] **Step 2:** `pnpm --filter @rezeta/shared test -- staff` and `pnpm --filter @rezeta/api test -- staff.service` → new tests FAIL (schema/method missing).

- [ ] **Step 3: Implement.** In `packages/shared/src/schemas/staff.ts` (values mirror `CreateInstitutionSchema`'s type/plan enums — reuse those enum definitions if they are standalone consts; otherwise repeat the literals exactly):

```ts
export const StaffInstitutionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  type: z.enum(['solo', 'practice', 'clinic', 'enterprise']),
  plan: z.enum(['free', 'solo', 'practice', 'clinic']),
  createdAt: z.string(),
  userCount: z.number().int().nonnegative(),
  activeUserCount: z.number().int().nonnegative(),
})

export type StaffInstitutionDto = z.infer<typeof StaffInstitutionSchema>
```

In `staff.service.ts` add:

```ts
  /**
   * Read-only roster for the staff console. Counts come from two grouped
   * queries (never per-tenant N+1). Reads are not audited.
   */
  async listInstitutions(): Promise<StaffInstitutionDto[]> {
    const [tenants, totals, actives] = await Promise.all([
      this.prisma.tenant.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, type: true, plan: true, createdAt: true },
      }),
      this.prisma.user.groupBy({
        by: ['tenantId'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ['tenantId'],
        where: { deletedAt: null, isActive: true },
        _count: { _all: true },
      }),
    ])
    const totalBy = new Map(totals.map((g) => [g.tenantId, g._count._all]))
    const activeBy = new Map(actives.map((g) => [g.tenantId, g._count._all]))
    return tenants.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as StaffInstitutionDto['type'],
      plan: t.plan as StaffInstitutionDto['plan'],
      createdAt: t.createdAt.toISOString(),
      userCount: totalBy.get(t.id) ?? 0,
      activeUserCount: activeBy.get(t.id) ?? 0,
    }))
  }
```

In `staff.controller.ts` add (import `StaffInstitutionDto` type):

```ts
  @Get('institutions')
  listInstitutions(): Promise<StaffInstitutionDto[]> {
    return this.svc.listInstitutions()
  }
```

- [ ] **Step 4:** Focused suites pass; `pnpm --filter @rezeta/api test` full green; `pnpm lint` clean.
- [ ] **Step 5: Commit** `feat(api): staff institutions list endpoint`.

---

### Task 2: Real-Postgres integration spec

**Files:**
- Test: `apps/api/src/modules/staff/__tests__/staff.service.int-spec.ts` (new)

**Interfaces:** Consumes `hasTestDb/getTestPrisma-equivalent` pattern — copy construction from `apps/api/src/modules/platform-users/__tests__/platform-users.service.int-spec.ts` (PrismaService instantiation, truncateAll, fixture builders `createTestTenant`, `createTestUser` from `apps/api/src/test/db-test-utils.ts`; check their exact signatures before use). `StaffService` constructed with real prisma; its other deps (`TenantSeedingService`, `UsersService`, `AuditLogService`) may be faked with `vi.fn()` objects since `listInstitutions` doesn't touch them.

- [ ] **Step 1:** Write the spec:

```ts
describe.skipIf(!hasTestDb())('StaffService.listInstitutions (integration)', () => {
  // prisma + service construction copied from platform-users.service.int-spec.ts
  it('returns tenants newest-first with active/total counts', async () => {
    const t1 = await createTestTenant(prisma /* older */)
    const t2 = await createTestTenant(prisma /* newer */)
    await createTestUser(prisma, t2.id /* active */)
    await createTestUser(prisma, t2.id /* active */)
    // deactivate one t2 user directly: prisma.user.update -> { isActive: false, deletedAt: null }
    const rows = await makeService().listInstitutions()
    const ids = rows.map((r) => r.id)
    expect(ids.indexOf(t2.id)).toBeLessThan(ids.indexOf(t1.id))
    const r2 = rows.find((r) => r.id === t2.id)!
    expect(r2.userCount).toBe(2)
    expect(r2.activeUserCount).toBe(1)
    expect(rows.find((r) => r.id === t1.id)).toMatchObject({ userCount: 0, activeUserCount: 0 })
  })
})
```

Adapt fixture-builder calls to their real signatures; ensure the two tenants get distinct `createdAt` (update the older one explicitly if the builder doesn't accept a date).

- [ ] **Step 2:** `pnpm --filter @rezeta/api test:integration -- staff.service` → RAN and passing (TEST_DATABASE_URL is configured on this machine; postgres runs in the `rezeta-postgres` Docker container — if it is down, `docker start rezeta-postgres`).
- [ ] **Step 3: Commit** `test(api): integration coverage for staff institutions list`.

---

### Task 3: Web — strings, hooks, list page, routes

**Files:**
- Modify: `apps/web/src/pages/staff/strings.ts`
- Create: `apps/web/src/hooks/staff/use-institutions.ts`
- Modify: `apps/web/src/hooks/staff/use-create-institution.ts`
- Create: `apps/web/src/pages/staff/Institutions.tsx`
- Modify: `apps/web/src/pages/staff/NewInstitution.tsx`, `apps/web/src/components/layout/StaffLayout.tsx`, `apps/web/src/App.tsx`
- Test: `apps/web/src/pages/staff/__tests__/Institutions.test.tsx` (new)

**Interfaces:** Consumes `StaffInstitutionDto` from `@rezeta/shared`, `GET /v1/staff/institutions` (Task 1). Produces route `/staff/institutions`.

- [ ] **Step 1: Failing page test** (mirror `PlatformUsers.test.tsx` mocking style — `vi.hoisted` + `vi.mock`; wrap render in `MemoryRouter` since the page contains `Link`s):

```tsx
const rows = [
  { id: 't1', name: 'Centro Vista Alegre', type: 'clinic', plan: 'clinic', createdAt: '2026-07-28T12:00:00.000Z', userCount: 5, activeUserCount: 4 },
  { id: 't2', name: null, type: 'solo', plan: 'free', createdAt: '2026-07-01T12:00:00.000Z', userCount: 0, activeUserCount: 0 },
]
```

Cases: (1) renders heading "Institutions", both rows, "4 of 5" users text for t1, the unnamed tenant rendered with the `unnamed` fallback string; (2) "New institution" link points at `/staff/institutions/new`; (3) empty state when `data: []`; (4) danger callout when `isError`.

- [ ] **Step 2:** Run focused test → RED.

- [ ] **Step 3: Implement.** Strings — add to `staffStrings`: `successBackToList: 'Back to institutions'`. New export:

```ts
export const institutionsStrings = {
  pageTitle: 'Institutions',
  pageSubtitle: 'All institutions on the platform.',
  newButton: 'New institution',
  tableInstitution: 'Institution',
  tablePlan: 'Plan',
  tableUsers: 'Users',
  tableCreated: 'Created',
  usersCell: (active: number, total: number) => `${active} of ${total}`,
  unnamed: 'Unnamed institution',
  loadError: 'Could not load institutions.',
  emptyTitle: 'No institutions yet',
  emptyBody: 'Create the first institution to get started.',
} as const
```

Hook `use-institutions.ts` (mirror `use-platform-users.ts`):

```ts
const QK = 'staff-institutions'
export function useStaffInstitutions(): UseQueryResult<StaffInstitutionDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<StaffInstitutionDto[]>('/v1/staff/institutions'),
  })
}
export const STAFF_INSTITUTIONS_QK = QK
```

`use-create-institution.ts`: add `onSuccess: () => void qc.invalidateQueries({ queryKey: [STAFF_INSTITUTIONS_QK] })` (import `useQueryClient`).

`Institutions.tsx` — mirror `PlatformUsers.tsx` layout exactly (heading row + primary action + bordered table + `EmptyState`/`Spinner`/`Callout` states). The primary action is a `Link` to `/staff/institutions/new` styled as a button (check how the codebase renders link-as-button — `Button asChild` if supported, else a `Link` wrapped Button per existing usage; mirror an existing instance). Columns: Institution (name or `unnamed` fallback, with `type` as mono sub-text), Plan (`font-mono text-xs uppercase text-n-500`), Users (`usersCell(activeUserCount, userCount)`), Created (`new Date(createdAt).toLocaleDateString()`).

`NewInstitution.tsx`: inside the success `Callout` block, add `<Link to="/staff/institutions" className="text-p-700 underline">{staffStrings.successBackToList}</Link>`.

`StaffLayout.tsx`: institutions NavLink → `to="/staff/institutions"` with `end` matching added to `StaffNavLink` (`<NavLink end={end} …>`, `end?: boolean` prop) so it isn't active on `/new`.

`App.tsx`: `staff` index redirect → `/staff/institutions`; add `{ path: 'staff/institutions', element: <Institutions /> }` before the `/new` route; import the page.

- [ ] **Step 4:** Focused test GREEN; full `pnpm --filter @rezeta/web test`; `pnpm --filter @rezeta/web typecheck`; `pnpm lint` — all green.
- [ ] **Step 5: Commit** `feat(web): staff institutions list page`.

---

### Task 4: Gates + changelog

- [ ] **Step 1:** From repo root: `pnpm lint`, `pnpm test`, `pnpm test:coverage` — all pass.
- [ ] **Step 2:** Prepend `CHANGELOG.md` entry `## [2026-07-28] Staff institutions list` (### Added: endpoint, page, nav/redirect changes; name files). English.
- [ ] **Step 3: Commit** `docs: changelog for staff institutions list`.

## Out of scope

Editing/deactivating institutions, detail pages, pagination/search, security metrics (identity slice 5).
