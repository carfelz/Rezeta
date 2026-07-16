# Permissions Module (Matrix UI + Edit Endpoints) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an institution's `admin`/`super_admin` a matrix UI (roles × modules, grouped by section) at `/ajustes/permisos` to view and edit the tenant's per-role permissions, backed by two endpoints (`GET /v1/permissions`, `PATCH /v1/permissions`) that read/write `RolePermission` rows under the rank rule and emit `permission_granted`/`permission_revoked` audit events. Editing is enabled only for roles strictly below the current user's rank; the section header offers a **bulk-apply convenience** that stamps every module in a section (one PATCH per module — the backend has no section concept) and shows **"Mixto"** when the section's modules disagree.

**Architecture:** This slice depends on Slices 1–4 being merged: the shared role enum + `canManageRole` (Slice 1), the permission catalog + `RolePermission` model + `PermissionsService.resolveCapabilities`/`seedDefaults` + `PermissionsRepository` + `PermissionsModule` (Slice 2), `PermissionGuard` + `@RequirePermission` decorator + `ErrorCode.INSUFFICIENT_PERMISSION` (Slice 3), and `useCan` + the route-guard wrapper on the web (Slice 4). Slice 6 adds: `getMatrix`/`updateModule` to the existing `PermissionsService` (+ a `upsertModule` repository method), a new `PermissionsController` wired into the existing `PermissionsModule`, an `UpdatePermissionSchema` + `PermissionMatrixResponse` type in `packages/shared`, a TanStack Query hook, and the `/ajustes/permisos` page (matrix + section bulk-apply) with its route and Settings menu link. Backend enforcement stays strictly per-module; the section control is a **frontend-only** affordance that issues N per-module PATCHes and never reaches the API as its own concept.

**Design decisions (locked):**
1. **Section bulk-apply is frontend-only.** `PATCH /v1/permissions` accepts exactly one `{ role, moduleKey, accessLevel }`. The section header control loops over the section's modules client-side and issues one PATCH per module. The API has no `section` parameter and stores nothing at the section level. State this in code comments where the loop lives.
2. **"Mixto" is derived, never stored.** A section header cell for a given role shows the shared level if every module in that section resolves to the same level for that role, else the literal `Mixto`. It recomputes from the live matrix after each PATCH invalidation.
3. **Editing gate is two-layered.** A column (role) is editable only when `canManage` (`useCan('permissions','manage')`) AND `canManageRole(currentUser.role, columnRole)`. Own-rank and higher-rank columns are always disabled (read-only), matching the service-layer rank rule so the UI never offers an action the API would reject.
4. **`GET /v1/permissions` is self-describing.** It returns `{ matrix, modules }` — the resolved `Record<UserRole, CapabilityMap>` plus the catalog structure (`{ key, section, defaults }[]` in display order) so the page renders rows/sections without a second source of truth. The page groups `modules` by `section`, preserving catalog order.
5. **Audit action reflects the level.** `updateModule` records `permission_revoked` when the new level is `none`, otherwise `permission_granted`. Actor attribution flows through the request-scoped audit context exactly as neighboring services do (see `consultations.service.ts` `this.auditLog.record(...)`).

**Tech Stack:** NestJS + Prisma (API), Zod (shared), React 18 + TanStack Query + Zustand + Tailwind (web), Vitest + Testing Library.

**Branch:** `feat/permissions-module` (stacked on the Slice 1–4 branches; start from the latest branch that contains them).

## Global Constraints

- Token classes only; Spanish strings colocated in `strings.ts`; 2-space indent; no TODO/FIXME/HACK/XXX comments; lower-case commit subjects; ESM `.js` import specifiers in `packages/shared` and `apps/api`.
- **No arbitrary Tailwind `prop-[value]` classes.** Every size, spacing, color, radius, shadow must map to a token in `apps/web/tailwind.config.ts`. Access-level tints use existing semantic tokens: `none` → `bg-n-50 text-n-500`, `view` → `bg-warning-bg text-warning-text`, `manage` → `bg-success-bg text-success-text`. The section header's active marker is the 2px teal rule via `before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-p-500 before:rounded-sm` (same pattern as `Sidebar.tsx`). Font sizes are tokens only (`text-sm` = 13px base, `text-xs` = 12px). If a needed value has no token, add it to `tailwind.config.ts` (and register the name in `cn`'s tailwind-merge per the CLAUDE.md coupling note) rather than reaching for `-[…]`.
- Reuse existing UI primitives from `apps/web/src/components/ui/` (`Button`, `Card`, `Callout`, `EmptyState`, `Badge`) before writing new markup. Check `specs/design-system/components.md` first.
- `pnpm lint` + the touched package's tests green per task; the final task runs `pnpm test:coverage` (95% per-file). Coverage-exempt paths on web: `src/hooks/**/use-*.ts` and `src/pages/**`. **Shared code and API services/controllers are NOT exempt** — every new shared schema, service method, and controller needs tests.
- After editing `packages/shared`: `pnpm --filter @rezeta/shared build` before the workspace typecheck (`pnpm -r typecheck`) and before web/api pick up the new exports.
- **Verify Slice 1–4 export names before coding.** This plan references `canManageRole`, `ROLE_RANK`, `MODULE_KEYS`, `PERMISSION_CATALOG`, `AccessLevel`, `ModuleKey`, `SectionKey`, `CapabilityMap`, `UserRole`, `resolveCapabilities`, `seedDefaults`, `@RequirePermission`, `PERMISSION_KEY`, `useCan`, and the route-guard wrapper (`RequireCan`). Open the files that Slices 1–4 created and confirm the exact export identifiers and import paths; if any differ, adjust the snippets below to match — do not invent new names.

---

### Task 1: Shared `UpdatePermissionSchema` + `PermissionMatrixResponse`

**Files:**
- Create: `packages/shared/src/schemas/permissions.ts`
- Modify: `packages/shared/src/schemas/index.ts` (add `export * from './permissions.js'`)
- Test: `packages/shared/src/schemas/__tests__/permissions.test.ts` (create; mirror the harness of a neighboring schema spec in that dir)

**Interfaces:**

```typescript
// packages/shared/src/schemas/permissions.ts
import { z } from 'zod'
// NOTE: confirm these live in ../permissions/catalog.js (Slice 2). If AccessLevel /
// CapabilityMap are exported from a sibling capabilities.js, import them from there.
import { MODULE_KEYS } from '../permissions/catalog.js'
import type { ModuleKey, SectionKey, AccessLevel, CapabilityMap } from '../permissions/catalog.js'
import type { UserRole } from '../types/auth.js'

const ROLE_VALUES = ['assistant', 'doctor', 'admin', 'super_admin'] as const
const ACCESS_LEVEL_VALUES = ['none', 'view', 'manage'] as const

export const UpdatePermissionSchema = z.object({
  role: z.enum(ROLE_VALUES),
  // MODULE_KEYS is a ModuleKey[] (not a literal tuple), so refine instead of z.enum.
  moduleKey: z
    .string()
    .refine((k): k is ModuleKey => (MODULE_KEYS as readonly string[]).includes(k), {
      message: 'Unknown module key',
    }),
  accessLevel: z.enum(ACCESS_LEVEL_VALUES),
})

export type UpdatePermissionDto = z.infer<typeof UpdatePermissionSchema>

export interface PermissionCatalogEntry {
  key: ModuleKey
  section: SectionKey
  defaults: Record<UserRole, AccessLevel>
}

export interface PermissionMatrixResponse {
  matrix: Record<UserRole, CapabilityMap>
  modules: PermissionCatalogEntry[]
}
```

- [ ] **Step 1: Write failing tests** — in `permissions.test.ts`: (a) `UpdatePermissionSchema.parse` accepts a valid payload `{ role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' }`; (b) rejects an unknown `moduleKey` (`{ …, moduleKey: 'nope' }` → `.safeParse` `success === false`); (c) rejects an out-of-set `accessLevel` (`'admin'`) and an out-of-set `role`; (d) accepts every `moduleKey` in `MODULE_KEYS` and every `accessLevel` in `['none','view','manage']` via a loop. Import from `../permissions.js`.
- [ ] **Step 2: Verify failure** — `pnpm --filter @rezeta/shared test -- permissions` (expect: cannot find module `../permissions.js`).
- [ ] **Step 3: Implement** `permissions.ts` exactly per Interfaces, add the barrel line to `schemas/index.ts`. Confirm the `import type` paths against what Slice 2 actually exported (catalog vs. capabilities file); fix if needed.
- [ ] **Step 4: Verify** — `pnpm --filter @rezeta/shared test -- permissions` green; then `pnpm --filter @rezeta/shared build && pnpm -r typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `feat(shared): permission update schema and matrix response type`

---

### Task 2: Backend `PermissionsService.getMatrix` + `updateModule` (+ repository upsert)

**Files:**
- Modify: `apps/api/src/modules/permissions/permissions.repository.ts` (add `upsertModule` if Slice 2 did not already expose one)
- Modify: `apps/api/src/modules/permissions/permissions.service.ts` (add `getMatrix`, `updateModule`; inject `AuditLogService`)
- Test: `apps/api/src/modules/permissions/__tests__/permissions.service.spec.ts` (extend if it exists from Slice 2, else create; mirror `locations.service.spec.ts` — construct the service with mock repo + mock audit log, `vi.clearAllMocks()` in `beforeEach`)

**Interfaces:**

```typescript
// permissions.repository.ts — add (compound unique is [tenantId, role, moduleKey])
async upsertModule(
  tenantId: string,
  role: UserRole,
  moduleKey: ModuleKey,
  accessLevel: AccessLevel,
): Promise<void> {
  await this.prisma.rolePermission.upsert({
    where: { tenantId_role_moduleKey: { tenantId, role, moduleKey } },
    update: { accessLevel },
    create: { tenantId, role, moduleKey, accessLevel },
  })
}

// permissions.service.ts — add
async getMatrix(tenantId: string): Promise<Record<UserRole, CapabilityMap>> {
  const roles: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']
  const entries = await Promise.all(
    roles.map(async (role) => [role, await this.resolveCapabilities(tenantId, role)] as const),
  )
  return Object.fromEntries(entries) as Record<UserRole, CapabilityMap>
}

async updateModule(
  tenantId: string,
  actorRole: UserRole,
  targetRole: UserRole,
  moduleKey: ModuleKey,
  level: AccessLevel,
): Promise<CapabilityMap> {
  if (!canManageRole(actorRole, targetRole)) {
    throw new ForbiddenException({
      code: ErrorCode.FORBIDDEN,
      message: 'Cannot edit permissions for a role at or above your own',
    })
  }
  await this.repo.upsertModule(tenantId, targetRole, moduleKey, level)
  void this.auditLog.record({
    tenantId,
    actorType: 'user',
    category: 'auth',
    action: level === 'none' ? 'permission_revoked' : 'permission_granted',
    entityType: 'role_permission',
    entityId: `${targetRole}:${moduleKey}`,
    metadata: { role: targetRole, moduleKey, accessLevel: level },
  })
  return this.resolveCapabilities(tenantId, targetRole)
}
```

Injection: add `@Inject(AuditLogService) private auditLog: AuditLogService` to the constructor. `AuditLogModule` is `@Global()`, so no module import is needed. Import `canManageRole` from `@rezeta/shared`, `ForbiddenException` from `@nestjs/common`, `ErrorCode` + types from `@rezeta/shared`, `AuditLogService` from `../../common/audit-log/audit-log.service.js` (match `consultations.service.ts`).

- [ ] **Step 1: Write failing tests** in `permissions.service.spec.ts`:
  - `getMatrix` — mock `resolveCapabilities` (spy on the service method or mock the repo it reads) to return a per-role map; assert the result has all four role keys and each maps to the expected `CapabilityMap`.
  - `updateModule` happy path — `super_admin` editing `doctor`'s `patients` to `manage`: asserts `repo.upsertModule` called with `(tenantId, 'doctor', 'patients', 'manage')`, and `auditLog.record` called once with `action: 'permission_granted'` and `metadata: { role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' }`.
  - `updateModule` revoke — level `none` → `auditLog.record` called with `action: 'permission_revoked'`.
  - **Rank-rule denial** — `admin` (rank 3) editing `admin` (own rank) and editing `super_admin` (higher) both reject with `ForbiddenException`; assert `repo.upsertModule` and `auditLog.record` are NOT called in either case.
- [ ] **Step 2: Verify failure** — `pnpm --filter @rezeta/api test -- permissions.service`.
- [ ] **Step 3: Implement** the repository and service methods per Interfaces. If Slice 2's `resolveCapabilities` is private, keep it as-is and have the test drive `getMatrix` through the repo mock instead of spying the method.
- [ ] **Step 4: Verify** — `pnpm --filter @rezeta/api test -- permissions.service` green; `pnpm lint`.
- [ ] **Step 5: Commit** — `feat(api): permissions service matrix read and per-module update`

---

### Task 3: Backend `PermissionsController` (GET/PATCH) + module wiring

**Files:**
- Create: `apps/api/src/modules/permissions/permissions.controller.ts`
- Modify: `apps/api/src/modules/permissions/permissions.module.ts` (register the controller)
- Test: `apps/api/src/modules/permissions/__tests__/permissions.controller.spec.ts` (create; mirror `audit-log.controller.spec.ts` — instantiate the controller with a mock service)

**Interfaces:**

```typescript
// permissions.controller.ts
import { Body, Controller, Get, Inject, Patch } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiResponse, ApiTags } from '@nestjs/swagger'
import { AUTH_BEARER_SCHEME, AUTH_OAUTH2_SCHEME } from '../../lib/auth/index.js'
import {
  UpdatePermissionSchema,
  type UpdatePermissionDto,
  type PermissionMatrixResponse,
  type CapabilityMap,
  MODULE_KEYS,
  PERMISSION_CATALOG,
} from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { RequirePermission } from '../../common/decorators/require-permission.decorator.js'
import { CurrentUser } from '../../common/decorators/current-user.decorator.js'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js' // confirm path from patients.controller
import { PermissionsService } from './permissions.service.js'

@ApiTags('Permissions')
@ApiBearerAuth(AUTH_BEARER_SCHEME)
@ApiSecurity(AUTH_OAUTH2_SCHEME)
@Controller('v1/permissions')
export class PermissionsController {
  constructor(@Inject(PermissionsService) private readonly svc: PermissionsService) {}

  @Get()
  @RequirePermission('permissions', 'view')
  @ApiOperation({ summary: 'Get the tenant permission matrix + catalog structure' })
  @ApiResponse({ status: 200 })
  async getMatrix(@TenantId() tenantId: string): Promise<PermissionMatrixResponse> {
    const matrix = await this.svc.getMatrix(tenantId)
    const modules = MODULE_KEYS.map((key) => PERMISSION_CATALOG[key])
    return { matrix, modules }
  }

  @Patch()
  @RequirePermission('permissions', 'manage')
  @ApiOperation({ summary: 'Update one role/module access level (rank-rule enforced)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  update(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdatePermissionSchema)) dto: UpdatePermissionDto,
  ): Promise<CapabilityMap> {
    return this.svc.updateModule(tenantId, user.role, dto.role, dto.moduleKey, dto.accessLevel)
  }
}
```

`permissions.module.ts` — add `PermissionsController` to `controllers: []`. Confirm the exact shape of `PERMISSION_CATALOG` (Slice 2): the snippet assumes it is keyed by `ModuleKey` giving `{ key, section, defaults }`. If it is instead an array, replace `MODULE_KEYS.map((key) => PERMISSION_CATALOG[key])` with the correct accessor.

- [ ] **Step 1: Write failing tests** in `permissions.controller.spec.ts`:
  - `getMatrix` delegates: mock `svc.getMatrix` → a matrix; assert the controller returns `{ matrix, modules }` where `modules` has `MODULE_KEYS.length` entries in catalog order (assert `modules[0].key === MODULE_KEYS[0]`).
  - `update` delegates: assert `svc.updateModule` called with `(tenantId, user.role, dto.role, dto.moduleKey, dto.accessLevel)` and returns its result.
  - **Gating metadata (403 for under-privileged is enforced by `PermissionGuard` via this metadata):** assert `Reflect.getMetadata(PERMISSION_KEY, PermissionsController.prototype.getMatrix)` equals `{ module: 'permissions', level: 'view' }` and `…update` equals `{ module: 'permissions', level: 'manage' }`. Import `PERMISSION_KEY` from the decorator module (Slice 3). This pins that a caller lacking `permissions:view`/`manage` is rejected by the guard without booting the full app.
- [ ] **Step 2: Verify failure** — `pnpm --filter @rezeta/api test -- permissions.controller`.
- [ ] **Step 3: Implement** the controller + module wiring. Confirm `ZodValidationPipe`, `CurrentUser`, `RequirePermission`, `PERMISSION_KEY` import paths against `patients.controller.ts` and Slice 3's decorator file.
- [ ] **Step 4: Verify** — `pnpm --filter @rezeta/api test -- permissions` green (service + controller); `pnpm -r typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `feat(api): permissions controller for matrix read and update`

---

### Task 4: Frontend data hook

**Files:**
- Create: `apps/web/src/hooks/permissions/use-permissions.ts`
- (Coverage-exempt path `src/hooks/**/use-*.ts`; the page test in Task 5 mocks this hook, so no separate hook test is required.)

**Interfaces:**

```typescript
// use-permissions.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type {
  CapabilityMap,
  PermissionMatrixResponse,
  UpdatePermissionDto,
} from '@rezeta/shared'

const QK = 'permissions'

export function usePermissionMatrix(): UseQueryResult<PermissionMatrixResponse, Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<PermissionMatrixResponse>('/v1/permissions'),
  })
}

export function useUpdatePermission(): UseMutationResult<CapabilityMap, Error, UpdatePermissionDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdatePermissionDto) =>
      apiClient.patch<CapabilityMap>('/v1/permissions', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
    onError: () => {
      toast.error(toastStrings.errorPermissionUpdate)
    },
  })
}
```

- [ ] **Step 1: Implement** the hook. Add a `errorPermissionUpdate` entry to `apps/web/src/lib/toasts.ts` (`toastStrings`) in Spanish, e.g. `'No se pudo actualizar el permiso. Intenta de nuevo.'`. Match the neighboring `use-locations.ts` structure exactly.
- [ ] **Step 2: Verify** — `pnpm --filter @rezeta/web test` (no new failures) and `pnpm -r typecheck && pnpm lint`.
- [ ] **Step 3: Commit** — `feat(web): permission matrix query and update mutation hooks`

---

### Task 5: `/ajustes/permisos` page (matrix + section bulk-apply) + route + nav

**Files:**
- Create: `apps/web/src/pages/settings/Permissions.tsx`
- Modify: `apps/web/src/pages/settings/strings.ts` (add `permissionsStrings`)
- Modify: `apps/web/src/App.tsx` (add the route, guarded like the other `/ajustes/*` pages per Slice 4)
- Modify: `apps/web/src/pages/Settings.tsx` (add a menu `Link` to `/ajustes/permisos`, shown only when `useCan('permissions','view')`)
- Test: `apps/web/src/pages/settings/__tests__/Permissions.test.tsx` (create; mirror `Types.test.tsx` — `vi.hoisted` mocks for the hooks, `@/lib/api-client` + `@/lib/logger` mocked)

**Strings (Spanish, colocated):**

```typescript
export const permissionsStrings = {
  pageTitle: 'Permisos',
  menuTitle: 'Permisos',
  menuDescription: 'Define qué puede ver y gestionar cada rol',
  loading: 'Cargando permisos...',
  loadError: 'No se pudieron cargar los permisos. Intenta recargar la página.',
  colModule: 'Módulo',
  // Role column headers (super_admin replaces the old "owner")
  roleAssistant: 'Asistente',
  roleDoctor: 'Doctor',
  roleAdmin: 'Administrador',
  roleSuperAdmin: 'Propietario',
  // Access levels
  levelNone: 'Sin acceso',
  levelView: 'Ver',
  levelManage: 'Gestionar',
  levelMixed: 'Mixto',
  // Sections
  sectionClinical: 'Trabajo clínico',
  sectionAdmin: 'Administración',
  sectionApplyAll: 'Aplicar a toda la sección',
  readOnlyNotice: 'Solo puedes editar los permisos de roles por debajo del tuyo.',
} as const
```

**Component contract (`Permissions.tsx`):**

```typescript
import { usePermissionMatrix, useUpdatePermission } from '@/hooks/permissions/use-permissions'
import { useCan } from '@/hooks/use-can'
import { useAuth } from '@/hooks/use-auth'
import { canManageRole } from '@rezeta/shared'
import type { AccessLevel, ModuleKey, SectionKey, UserRole } from '@rezeta/shared'

const ROLE_COLUMNS: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']
const ACCESS_LEVELS: AccessLevel[] = ['none', 'view', 'manage']
const SECTION_ORDER: SectionKey[] = ['clinical', 'admin']
```

Structure:
- `const canManage = useCan('permissions', 'manage')`, `const { user } = useAuth()`, `const { data, isLoading, isError } = usePermissionMatrix()`, `const update = useUpdatePermission()`.
- Loading → `permissionsStrings.loading`; error → `Callout variant="danger"` with `loadError`. Mirror `Locations.tsx`.
- Build the table from `data.modules`: group by `section`, preserving the order in `data.modules` (which is catalog order). Render one `<table>` with a header row (`colModule` + the four role labels).
- **Per column editability:** `const columnEditable = (columnRole) => canManage && user != null && canManageRole(user.role, columnRole)`. Disabled columns render read-only cells (`disabled` selects, `bg-n-25 text-n-300` tint).
- **Module cell:** a native `<select>` (accessible, testable) with the three `ACCESS_LEVELS` options, current value = `data.matrix[columnRole][moduleKey]`, tint class per `levelTint(value)` (`none`→`bg-n-50 text-n-500`, `view`→`bg-warning-bg text-warning-text`, `manage`→`bg-success-bg text-success-text`), `disabled={!columnEditable(columnRole)}`. `onChange` → `update.mutate({ role: columnRole, moduleKey, accessLevel: e.target.value as AccessLevel })`. Give each select an accessible name via `aria-label={\`${moduleLabel} — ${roleLabel}\`}` so tests can target exact cells.
- **Section header row:** first cell = section title with the **2px teal rule** (`relative pl-4 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-p-500 before:rounded-sm`). Each role cell = a bulk `<select>` whose value is `sectionSharedLevel(section, columnRole)` — the common level if all the section's modules match for that role, else the sentinel `'mixed'`. Options are the three `ACCESS_LEVELS` plus a disabled `mixed`→`levelMixed` option that only appears when the section is mixed. `disabled={!columnEditable(columnRole)}`. `aria-label={\`${sectionLabel} — ${roleLabel} — ${sectionApplyAll}\`}`.
- **Bulk apply (frontend-only, one PATCH per module):**

```typescript
// The API has NO section concept: applying a section stamps every module in it
// via one PATCH each. Backend enforcement stays strictly per-module.
async function applySection(section: SectionKey, role: UserRole, level: AccessLevel): Promise<void> {
  const modules = data!.modules.filter((m) => m.section === section)
  await Promise.all(
    modules.map((m) => update.mutateAsync({ role, moduleKey: m.key, accessLevel: level })),
  )
}
```

  Wire the section select's `onChange` to `void applySection(section, columnRole, value)` (ignore a change to the `mixed` sentinel).
- `sectionSharedLevel(section, role)`: reduce the section's module levels; return the shared level or `'mixed'`.

**Route (`App.tsx`):** add under the protected `/ajustes` children, guarded exactly like Slice 4 guards the other settings routes. If Slice 4 introduced a `RequireCan` wrapper:

```tsx
import { Permissions } from '@/pages/settings/Permissions'
// …
{
  path: 'ajustes/permisos',
  element: (
    <RequireCan module="permissions" level="view">
      <Permissions />
    </RequireCan>
  ),
},
```

If Slice 4 guards `/ajustes/*` differently, match that convention instead. The page must ALSO defensively no-op edits when `!canManage` (controls disabled), so a `view`-only user sees a read-only matrix.

**Settings menu link (`Settings.tsx`):** add a `Link` (only when `useCan('permissions','view')`) after the "registros" link, matching the existing link markup:

```tsx
{useCan('permissions', 'view') && (
  <Link to="/ajustes/permisos" className="flex items-center gap-3 px-5 py-4 no-underline text-n-800 border-b border-n-100 hover:bg-n-25 transition-colors duration-fast">
    <i className="ph ph-shield-check text-h3 text-p-500" />
    <div>
      <div className="text-sm font-semibold">{permissionsStrings.menuTitle}</div>
      <div className="text-xs text-n-500">{permissionsStrings.menuDescription}</div>
    </div>
    <i className="ph ph-caret-right ml-auto text-n-400" />
  </Link>
)}
```

Import `permissionsStrings` and `useCan` in `Settings.tsx`. (The existing last link's `border-b` stays consistent since a new link follows it.)

- [ ] **Step 1: Write failing tests** in `Permissions.test.tsx`. Mock `@/hooks/permissions/use-permissions`, `@/hooks/use-can`, `@/hooks/use-auth` via `vi.hoisted` + `vi.mock` (mirror `Types.test.tsx`). Provide a matrix fixture and a `modules` fixture (at least two clinical modules with DIFFERING levels for one role to exercise "Mixto", plus one admin module). Set `useAuth` to return `{ user: { role: 'admin' } }` and `useCan` → true. Assertions:
  - **Renders defaults** — each module select shows its matrix value (query by `aria-label`, assert `.value`).
  - **Changing a cell issues a PATCH** — `fireEvent.change` on a `doctor` clinical cell to `'view'`; `await waitFor` that `mutate` was called once with `{ role: 'doctor', moduleKey: <that module>, accessLevel: 'view' }`.
  - **Section bulk-apply issues N PATCHes** — change the clinical section header select for `doctor` to `'manage'`; assert `mutateAsync` called exactly once per clinical module, each with the matching `moduleKey` and `accessLevel: 'manage'`.
  - **"Mixto" shown for a mixed section** — with the differing-levels fixture, the clinical section header cell for that role shows the `Mixto` option selected (`getByLabelText(...).value === 'mixed'` and `screen.getByText('Mixto')` present).
  - **Disabled for own/higher columns** — with `user.role === 'admin'`, every `admin`-column and `super_admin`-column select is `disabled`, while `doctor`/`assistant` selects are enabled. Assert via `aria-label` lookups.
  - **Read-only when lacking manage** — set `useCan` → false; all selects `disabled`.
- [ ] **Step 2: Verify failure** — `pnpm --filter @rezeta/web test -- Permissions`.
- [ ] **Step 3: Implement** `Permissions.tsx`, `permissionsStrings`, the route, and the Settings link. Use only token classes (see Global Constraints tint mapping). Confirm `useCan` / `RequireCan` / `canManageRole` export names against Slices 1 & 4.
- [ ] **Step 4: Verify** — `pnpm --filter @rezeta/web test -- Permissions` green; `pnpm -r typecheck && pnpm lint`. Manually confirm the section header shows the teal rule and access-level tints (`pnpm dev`, navigate to `/ajustes/permisos` as a `super_admin`).
- [ ] **Step 5: Commit** — `feat(web): permissions matrix page with section bulk-apply`

---

### Task 6: Changelog + full gates

- [ ] **Step 1:** Prepend a `CHANGELOG.md` entry (English) — `## [2026-07-15] Permissions module (matrix UI + edit endpoints)` with `### Added`: `GET /v1/permissions` (matrix + catalog) and `PATCH /v1/permissions` (`{ role, moduleKey, accessLevel }`, rank-rule enforced, `permission_granted`/`permission_revoked` audit); `UpdatePermissionSchema` + `PermissionMatrixResponse` in `@rezeta/shared`; `PermissionsService.getMatrix`/`updateModule` + `PermissionsRepository.upsertModule`; `usePermissionMatrix`/`useUpdatePermission` hooks; `/ajustes/permisos` matrix page with per-module selectors and a frontend-only section bulk-apply (one PATCH per module) that shows "Mixto" for mixed sections and disables own/higher-rank columns.
- [ ] **Step 2:** Run the full gates — `pnpm --filter @rezeta/shared build && pnpm -r typecheck && pnpm lint && pnpm test && pnpm test:coverage` — all green (re-run any flaky web timeouts once in isolation before judging). Confirm 95% per-file on the NON-exempt new files: `packages/shared/src/schemas/permissions.ts`, `apps/api/.../permissions.service.ts`, `apps/api/.../permissions.controller.ts`.
- [ ] **Step 3:** Commit — `docs: changelog for permissions module`
