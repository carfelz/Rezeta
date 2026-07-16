# Permission Catalog + RolePermission + Capability Resolution — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a code-defined permission catalog and a per-tenant editable `RolePermission` table, seed its defaults on tenant creation, and surface the resolved capability map on every authenticated request and on `GET /v1/auth/me`.

**Architecture:** A static catalog in `packages/shared` defines `section → module` structure and each module's default access level per role. A new `RolePermission` Prisma table stores per-tenant overrides. A backend `PermissionsService.resolveCapabilities` merges catalog defaults with stored rows (stored wins; missing → default) and `PermissionsService.seedDefaults` writes the full default matrix inside the existing tenant-seeding transaction. `AuthGuard` attaches the resolved `capabilities` map to `request.user`; `/auth/me` returns it. All platform-admin identity is owned by Slice 7 (separate `PlatformUser` control-plane table) and is out of scope here.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), NestJS + Prisma (`@rezeta/db`), Zod (`@rezeta/shared`), PostgreSQL, Vitest.

## Global Constraints

- Monorepo, pnpm workspaces: `apps/api` (NestJS + Prisma), `apps/web`, `packages/shared` (Zod + types + `ErrorCode`), `packages/db` (Prisma schema + generated client, imported as `@rezeta/db`).
- Prisma PKs are `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`. DB columns are `snake_case` via `@map`; TS fields are `camelCase`. Soft-delete via `deletedAt`.
- Roles (from Slice 1, already merged): `UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'`, defined in `packages/shared/src/types/auth.ts`. `owner` no longer exists.
- Shared types barrel re-exports from `packages/shared/src/index.ts`. Import in app code as `@rezeta/shared`.
- `RolePermission` columns are `String` (no Prisma enums — matches the existing `User.role String` convention); values are validated in code.
- Global guards in `apps/api/src/app.module.ts` (order matters): `AuthGuard` then `TenantGuard`. Do not reorder.
- Tests live in `__tests__/` beside source. `packages/shared`, `apps/api` use `*.spec.ts` (Vitest, `globals: true` — `describe/it/expect/vi` available without import, but existing files import them explicitly; match the sibling file). Match the framework/imports of the nearest sibling test file.
- Coverage gate: `pnpm test:coverage` enforces 95% per-file. Every new non-barrel, non-`types/` file needs tests. Shared coverage excludes `src/types/**` and `src/**/index.ts`.
- Language rule: ALL code/comments/docs/tests/commits in English. ONLY user-facing UI strings are Spanish.
- No `TODO/FIXME/HACK/XXX` comments (ESLint fails CI). Run `pnpm lint` and `pnpm test` before considering a task done.
- Changelog rule: prepend a dated entry to `CHANGELOG.md` (English) when the slice is complete.

---

### Task 1: Prisma schema — `RolePermission` model + migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (Tenant model ~line 18, add new `RolePermission` model)
- Create: `packages/db/prisma/migrations/20260715010000_add_role_permissions/migration.sql`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: Prisma model `RolePermission` (fields `id`, `tenantId`, `role`, `moduleKey`, `accessLevel`, `createdAt`, `updatedAt`). Generated client exposes `prisma.rolePermission` and `tx.rolePermission.createMany`/`findMany`. (Platform-admin identity is NOT part of this slice — Slice 7 owns the separate `PlatformUser` control-plane table.)

- [ ] **Step 1: Add the `RolePermission` model and the `Tenant` relation**

Add the `rolePermissions` relation to `model Tenant` (inside the relations block, after `attachments`):

```prisma
  auditLogs           AuditLog[]
  attachments         Attachment[]
  rolePermissions     RolePermission[]
```

Then add a new model. Place it immediately after `model User { … }` (after its closing `}` around line 91):

```prisma
model RolePermission {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  role        String   @db.VarChar(50)
  moduleKey   String   @map("module_key") @db.VarChar(50)
  accessLevel String   @map("access_level") @db.VarChar(20)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, role, moduleKey])
  @@index([tenantId])
  @@map("role_permissions")
}
```

- [ ] **Step 2: Verify the schema is valid**

Run: `pnpm --filter @rezeta/db exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Write the migration SQL**

> **Ordering:** this migration's timestamp (`20260715010000`) must sort **after**
> Slice 1's `20260715000000_role_owner_to_super_admin`, since the default matrix
> and seeding assume the four-role vocabulary is already live. Keep the `010000`
> suffix (or later) if Slice 1's timestamp changes.

Create `packages/db/prisma/migrations/20260715010000_add_role_permissions/migration.sql`:

```sql
-- Add the per-tenant, editable role -> module permission table. Columns are plain
-- VARCHAR (no DB enums), matching the existing users.role convention; values are
-- validated in application code against the shared permission catalog.

CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "module_key" VARCHAR(50) NOT NULL,
    "access_level" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_tenant_id_role_module_key_key" ON "role_permissions"("tenant_id", "role", "module_key");

CREATE INDEX "role_permissions_tenant_id_idx" ON "role_permissions"("tenant_id");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 4: Regenerate the Prisma client and apply the migration**

Run: `pnpm --filter @rezeta/db generate`
Expected: `Generated Prisma Client` — no errors. This makes `prisma.rolePermission` available to TypeScript.

Then, against a running dev database:

Run: `pnpm --filter @rezeta/db migrate:deploy`
Expected: `1 migration found` / `Applying migration 20260715010000_add_role_permissions` / `All migrations have been successfully applied.` (If no DB is reachable in this environment, generate alone unblocks the typechecked tasks; apply the migration before merging.)

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260715010000_add_role_permissions
git commit -m "feat(db): add RolePermission model"
```

---

### Task 2: Shared permission catalog

**Files:**
- Create: `packages/shared/src/permissions/catalog.ts`
- Test: `packages/shared/src/permissions/__tests__/catalog.spec.ts`

**Interfaces:**
- Consumes: `UserRole` from `packages/shared/src/types/auth.js` (Slice 1) — `'assistant' | 'doctor' | 'admin' | 'super_admin'`.
- Produces:
  - `type AccessLevel = 'none' | 'view' | 'manage'`
  - `const ACCESS_LEVEL_RANK: Record<AccessLevel, number>` = `{ none: 0, view: 1, manage: 2 }`
  - `type SectionKey = 'clinical' | 'admin'`
  - `type ModuleKey` (13 string literals in display order)
  - `interface PermissionModule { key: ModuleKey; section: SectionKey; defaults: Record<UserRole, AccessLevel> }`
  - `const PERMISSION_CATALOG: Record<ModuleKey, PermissionModule>`
  - `const MODULE_KEYS: ModuleKey[]` (all keys in display order)

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/permissions/__tests__/catalog.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { UserRole } from '../../types/auth.js'
import {
  ACCESS_LEVEL_RANK,
  MODULE_KEYS,
  PERMISSION_CATALOG,
  type AccessLevel,
  type ModuleKey,
} from '../catalog.js'

const ROLES: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']

// The authoritative default matrix from the shared contract (spec §4.3).
const EXPECTED: Record<ModuleKey, [AccessLevel, AccessLevel, AccessLevel, AccessLevel]> = {
  // [assistant, doctor, admin, super_admin]
  patients: ['view', 'manage', 'manage', 'manage'],
  consultations: ['view', 'manage', 'manage', 'manage'],
  protocols: ['none', 'manage', 'manage', 'manage'],
  appointments: ['manage', 'manage', 'manage', 'manage'],
  orders: ['manage', 'manage', 'manage', 'manage'],
  billing: ['manage', 'manage', 'manage', 'manage'],
  locations: ['none', 'manage', 'manage', 'manage'],
  templates: ['none', 'manage', 'manage', 'manage'],
  categories: ['none', 'manage', 'manage', 'manage'],
  schedules_config: ['none', 'manage', 'manage', 'manage'],
  audit_log: ['none', 'manage', 'manage', 'manage'],
  users: ['none', 'none', 'manage', 'manage'],
  permissions: ['none', 'none', 'manage', 'manage'],
}

const SECTIONS: Record<ModuleKey, 'clinical' | 'admin'> = {
  patients: 'clinical',
  consultations: 'clinical',
  protocols: 'clinical',
  appointments: 'clinical',
  orders: 'clinical',
  billing: 'clinical',
  locations: 'admin',
  templates: 'admin',
  categories: 'admin',
  schedules_config: 'admin',
  audit_log: 'admin',
  users: 'admin',
  permissions: 'admin',
}

describe('permission catalog', () => {
  it('ranks access levels none < view < manage', () => {
    expect(ACCESS_LEVEL_RANK).toEqual({ none: 0, view: 1, manage: 2 })
  })

  it('lists all 13 modules in display order', () => {
    expect(MODULE_KEYS).toEqual([
      'patients',
      'consultations',
      'protocols',
      'appointments',
      'orders',
      'billing',
      'locations',
      'templates',
      'categories',
      'schedules_config',
      'audit_log',
      'users',
      'permissions',
    ])
  })

  it('has one catalog entry per module key, keyed by itself', () => {
    for (const key of MODULE_KEYS) {
      expect(PERMISSION_CATALOG[key].key).toBe(key)
    }
    expect(Object.keys(PERMISSION_CATALOG).sort()).toEqual([...MODULE_KEYS].sort())
  })

  it('assigns the correct section to each module', () => {
    for (const key of MODULE_KEYS) {
      expect(PERMISSION_CATALOG[key].section).toBe(SECTIONS[key])
    }
  })

  it('matches the default matrix from the contract for every module and role', () => {
    for (const key of MODULE_KEYS) {
      const expectedRow = EXPECTED[key]
      ROLES.forEach((role, i) => {
        expect(PERMISSION_CATALOG[key].defaults[role]).toBe(expectedRow[i])
      })
    }
  })

  it('defines a default for all four roles on every module', () => {
    for (const key of MODULE_KEYS) {
      expect(Object.keys(PERMISSION_CATALOG[key].defaults).sort()).toEqual([...ROLES].sort())
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions/__tests__/catalog.spec.ts`
Expected: FAIL — `Failed to resolve import "../catalog.js"` (the module does not exist yet).

- [ ] **Step 3: Write the catalog implementation**

Create `packages/shared/src/permissions/catalog.ts`:

```ts
import type { UserRole } from '../types/auth.js'

/** Ordered access levels. `none` (0) < `view` (1) < `manage` (2). */
export type AccessLevel = 'none' | 'view' | 'manage'

export const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  manage: 2,
}

/** Sections group modules for the bulk-apply UI control; they are not stored. */
export type SectionKey = 'clinical' | 'admin'

/** Stable module keys guarded by the permission system, in display order. */
export type ModuleKey =
  | 'patients'
  | 'consultations'
  | 'protocols'
  | 'appointments'
  | 'orders'
  | 'billing'
  | 'locations'
  | 'templates'
  | 'categories'
  | 'schedules_config'
  | 'audit_log'
  | 'users'
  | 'permissions'

export interface PermissionModule {
  key: ModuleKey
  section: SectionKey
  defaults: Record<UserRole, AccessLevel>
}

/**
 * Code-defined source of structure: each module's section and its default access
 * level per role. Seeded into a tenant's `RolePermission` rows on creation, and
 * used as the fallback when a module has no stored row (see resolveCapabilities).
 * Default matrix per the shared contract / design spec §4.3.
 */
export const PERMISSION_CATALOG: Record<ModuleKey, PermissionModule> = {
  patients: {
    key: 'patients',
    section: 'clinical',
    defaults: { assistant: 'view', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  consultations: {
    key: 'consultations',
    section: 'clinical',
    defaults: { assistant: 'view', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  protocols: {
    key: 'protocols',
    section: 'clinical',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  appointments: {
    key: 'appointments',
    section: 'clinical',
    defaults: { assistant: 'manage', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  orders: {
    key: 'orders',
    section: 'clinical',
    defaults: { assistant: 'manage', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  billing: {
    key: 'billing',
    section: 'clinical',
    defaults: { assistant: 'manage', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  locations: {
    key: 'locations',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  templates: {
    key: 'templates',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  categories: {
    key: 'categories',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  schedules_config: {
    key: 'schedules_config',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  audit_log: {
    key: 'audit_log',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  users: {
    key: 'users',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'none', admin: 'manage', super_admin: 'manage' },
  },
  permissions: {
    key: 'permissions',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'none', admin: 'manage', super_admin: 'manage' },
  },
}

/** All module keys in display order. */
export const MODULE_KEYS: ModuleKey[] = [
  'patients',
  'consultations',
  'protocols',
  'appointments',
  'orders',
  'billing',
  'locations',
  'templates',
  'categories',
  'schedules_config',
  'audit_log',
  'users',
  'permissions',
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions/__tests__/catalog.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/permissions/catalog.ts packages/shared/src/permissions/__tests__/catalog.spec.ts
git commit -m "feat(shared): add permission catalog with default access matrix"
```

---

### Task 3: Shared capabilities helpers + barrel export

**Files:**
- Create: `packages/shared/src/permissions/capabilities.ts`
- Modify: `packages/shared/src/index.ts` (add two exports)
- Test: `packages/shared/src/permissions/__tests__/capabilities.spec.ts`

**Interfaces:**
- Consumes: `AccessLevel`, `ModuleKey`, `ACCESS_LEVEL_RANK`, `MODULE_KEYS`, `PERMISSION_CATALOG` from `./catalog.js`; `UserRole` from `../types/auth.js`.
- Produces:
  - `type CapabilityMap = Record<ModuleKey, AccessLevel>`
  - `function hasCapability(caps: CapabilityMap, module: ModuleKey, required: AccessLevel): boolean`
  - `function defaultCapabilitiesFor(role: UserRole): CapabilityMap`
  - Re-exported from `@rezeta/shared`.

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/permissions/__tests__/capabilities.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MODULE_KEYS } from '../catalog.js'
import { defaultCapabilitiesFor, hasCapability, type CapabilityMap } from '../capabilities.js'

describe('hasCapability', () => {
  const caps: CapabilityMap = defaultCapabilitiesFor('assistant')

  it('grants when the held level equals the required level', () => {
    expect(hasCapability(caps, 'patients', 'view')).toBe(true) // assistant patients = view
  })

  it('grants when the held level outranks the required level', () => {
    expect(hasCapability(caps, 'appointments', 'view')).toBe(true) // assistant appointments = manage
  })

  it('denies when the held level is below the required level', () => {
    expect(hasCapability(caps, 'patients', 'manage')).toBe(false) // view < manage
  })

  it('denies a `none` module against any positive requirement', () => {
    expect(hasCapability(caps, 'protocols', 'view')).toBe(false) // assistant protocols = none
  })

  it('treats a missing module entry as `none`', () => {
    const partial = {} as CapabilityMap
    expect(hasCapability(partial, 'patients', 'view')).toBe(false)
    expect(hasCapability(partial, 'patients', 'none')).toBe(true)
  })
})

describe('defaultCapabilitiesFor', () => {
  it('returns an entry for every module key', () => {
    const caps = defaultCapabilitiesFor('doctor')
    expect(Object.keys(caps).sort()).toEqual([...MODULE_KEYS].sort())
  })

  it('builds the assistant map from the catalog defaults', () => {
    expect(defaultCapabilitiesFor('assistant')).toEqual({
      patients: 'view',
      consultations: 'view',
      protocols: 'none',
      appointments: 'manage',
      orders: 'manage',
      billing: 'manage',
      locations: 'none',
      templates: 'none',
      categories: 'none',
      schedules_config: 'none',
      audit_log: 'none',
      users: 'none',
      permissions: 'none',
    })
  })

  it('grants super_admin manage on users and permissions', () => {
    const caps = defaultCapabilitiesFor('super_admin')
    expect(caps.users).toBe('manage')
    expect(caps.permissions).toBe('manage')
  })

  it('denies doctor on users and permissions (admin-only features)', () => {
    const caps = defaultCapabilitiesFor('doctor')
    expect(caps.users).toBe('none')
    expect(caps.permissions).toBe('none')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions/__tests__/capabilities.spec.ts`
Expected: FAIL — `Failed to resolve import "../capabilities.js"`.

- [ ] **Step 3: Write the capabilities implementation**

Create `packages/shared/src/permissions/capabilities.ts`:

```ts
import type { UserRole } from '../types/auth.js'
import {
  ACCESS_LEVEL_RANK,
  MODULE_KEYS,
  PERMISSION_CATALOG,
  type AccessLevel,
  type ModuleKey,
} from './catalog.js'

/** A user's effective access level per module. */
export type CapabilityMap = Record<ModuleKey, AccessLevel>

/**
 * True when the capability map grants at least `required` on `module`. A module
 * absent from the map is treated as `none`.
 */
export function hasCapability(
  caps: CapabilityMap,
  module: ModuleKey,
  required: AccessLevel,
): boolean {
  return ACCESS_LEVEL_RANK[caps[module] ?? 'none'] >= ACCESS_LEVEL_RANK[required]
}

/** Build the full capability map for a role straight from the catalog defaults. */
export function defaultCapabilitiesFor(role: UserRole): CapabilityMap {
  const caps = {} as CapabilityMap
  for (const key of MODULE_KEYS) {
    caps[key] = PERMISSION_CATALOG[key].defaults[role]
  }
  return caps
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions/__tests__/capabilities.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Export the new modules from the shared barrel**

In `packages/shared/src/index.ts`, add two lines after the existing `export * from './record/generate-record-sections.js'` line:

```ts
export * from './record/generate-record-sections.js'
export * from './permissions/catalog.js'
export * from './permissions/capabilities.js'
```

(Slice 1 already exports `./permissions/roles.js`; leave that line as-is if present.)

- [ ] **Step 6: Verify the barrel re-exports resolve**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions`
Expected: PASS (all catalog + capabilities tests).

Run: `pnpm --filter @rezeta/shared typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/permissions/capabilities.ts packages/shared/src/permissions/__tests__/capabilities.spec.ts packages/shared/src/index.ts
git commit -m "feat(shared): add capability map helpers and export permissions barrel"
```

---

### Task 4: Extend `AuthUser` type and `UserApiSchema`

**Files:**
- Modify: `packages/shared/src/types/auth.ts` (add fields to `AuthUser`)
- Modify: `packages/shared/src/schemas/auth.ts` (add fields to `UserApiSchema`)
- Test: `packages/shared/src/schemas/__tests__/auth.spec.ts` (create)

**Interfaces:**
- Consumes: `CapabilityMap` from `../permissions/capabilities.js`; `UserRole` (already in `types/auth.ts` from Slice 1).
- Produces: `AuthUser` gains `capabilities: CapabilityMap` (required). `UserApiSchema` gains `capabilities` (record of module → access level). `UserApiDto` inferred type updated accordingly.

- [ ] **Step 1: Write the failing schema test**

Create `packages/shared/src/schemas/__tests__/auth.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  SignInSchema,
  SignUpSchema,
  TenantApiSchema,
  UpdateProfileSchema,
  UserApiSchema,
} from '../auth.js'

const validUser = {
  id: '018e3f2a-0000-7000-8000-000000000001',
  externalUid: 'fb-uid',
  tenantId: '018e3f2a-0000-7000-8000-000000000002',
  email: 'doc@test.com',
  fullName: 'Dr. Test',
  role: 'doctor',
  specialty: 'Cardiología',
  licenseNumber: 'MED-001',
  isActive: true,
  capabilities: { patients: 'manage', users: 'none' },
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('UserApiSchema', () => {
  it('accepts a user with capabilities', () => {
    const parsed = UserApiSchema.parse(validUser)
    expect(parsed.capabilities.patients).toBe('manage')
  })

  it('rejects a missing capabilities', () => {
    const { capabilities: _omit, ...rest } = validUser
    expect(UserApiSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an invalid capability level', () => {
    const bad = { ...validUser, capabilities: { patients: 'god_mode' } }
    expect(UserApiSchema.safeParse(bad).success).toBe(false)
  })
})

describe('TenantApiSchema', () => {
  it('accepts a valid tenant', () => {
    const parsed = TenantApiSchema.parse({
      id: '018e3f2a-0000-7000-8000-000000000002',
      name: 'Clínica Central',
      type: 'clinic',
      plan: 'free',
      country: 'DO',
      language: 'es',
      timezone: 'America/Santo_Domingo',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(parsed.name).toBe('Clínica Central')
  })
})

describe('SignUpSchema', () => {
  const base = {
    fullName: 'Dr. Test',
    email: 'doc@test.com',
    password: 'Abcdef12',
    confirmPassword: 'Abcdef12',
  }

  it('accepts matching strong passwords', () => {
    expect(SignUpSchema.safeParse(base).success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    expect(SignUpSchema.safeParse({ ...base, confirmPassword: 'Abcdef13' }).success).toBe(false)
  })

  it('rejects a weak password (no uppercase/number)', () => {
    expect(
      SignUpSchema.safeParse({ ...base, password: 'abcdefgh', confirmPassword: 'abcdefgh' })
        .success,
    ).toBe(false)
  })
})

describe('SignInSchema', () => {
  it('accepts valid credentials', () => {
    expect(SignInSchema.safeParse({ email: 'doc@test.com', password: 'x' }).success).toBe(true)
  })

  it('rejects an invalid email', () => {
    expect(SignInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })
})

describe('UpdateProfileSchema', () => {
  it('accepts a valid profile update', () => {
    expect(
      UpdateProfileSchema.safeParse({
        fullName: 'Dr. Test',
        specialty: null,
        licenseNumber: null,
      }).success,
    ).toBe(true)
  })

  it('rejects a too-short name', () => {
    expect(
      UpdateProfileSchema.safeParse({ fullName: 'A', specialty: null, licenseNumber: null })
        .success,
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared exec vitest run src/schemas/__tests__/auth.spec.ts`
Expected: FAIL — the `UserApiSchema` tests fail because `capabilities` is not yet in the schema (the "rejects a missing capabilities" case passes for the wrong reason; the "accepts a user with capabilities" case fails on `parsed.capabilities` being `undefined`).

- [ ] **Step 3: Add the field to `AuthUser`**

In `packages/shared/src/types/auth.ts`, add the `CapabilityMap` import at the top (after the existing `UserPreferences` import) and one field to `AuthUser`:

```ts
import type { UserPreferences } from '../schemas/user-preferences.js'
import type { CapabilityMap } from '../permissions/capabilities.js'
```

Add the field at the end of the `AuthUser` interface (after `preferences`):

```ts
  tenantPlan?: string
  preferences: UserPreferences
  capabilities: CapabilityMap
}
```

(Do not touch the `UserRole` type — Slice 1 already widened it to the four roles.)

- [ ] **Step 4: Add the field to `UserApiSchema`**

In `packages/shared/src/schemas/auth.ts`, add one field to `UserApiSchema` (after `isActive`, before `createdAt`):

```ts
export const UserApiSchema = z.object({
  id: z.string().uuid(),
  externalUid: z.string(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['assistant', 'doctor', 'admin', 'super_admin']),
  specialty: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  isActive: z.boolean(),
  capabilities: z.record(z.enum(['none', 'view', 'manage'])),
  createdAt: z.string(),
})
```

(The `role` enum was already widened to the four roles by Slice 1; it is shown here for completeness — leave it as Slice 1 set it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared exec vitest run src/schemas/__tests__/auth.spec.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck the shared package**

Run: `pnpm --filter @rezeta/shared typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types/auth.ts packages/shared/src/schemas/auth.ts packages/shared/src/schemas/__tests__/auth.spec.ts
git commit -m "feat(shared): add capabilities to AuthUser and UserApiSchema"
```

---

### Task 5: Permissions backend module — repository + service

**Files:**
- Create: `apps/api/src/modules/permissions/permissions.repository.ts`
- Create: `apps/api/src/modules/permissions/permissions.service.ts`
- Create: `apps/api/src/modules/permissions/permissions.module.ts`
- Create: `apps/api/src/modules/permissions/index.ts`
- Test: `apps/api/src/modules/permissions/__tests__/permissions.repository.spec.ts`
- Test: `apps/api/src/modules/permissions/__tests__/permissions.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` from `../../lib/prisma.service.js`; `Prisma` (for `Prisma.TransactionClient`) from `@rezeta/db`; `MODULE_KEYS`, `PERMISSION_CATALOG`, `defaultCapabilitiesFor`, `AccessLevel`, `CapabilityMap`, `ModuleKey`, `UserRole` from `@rezeta/shared`; Prisma model `RolePermission` (Task 1).
- Produces:
  - `interface StoredRolePermission { role: string; moduleKey: string; accessLevel: string }`
  - `class PermissionsRepository` with `findByTenantAndRole(tenantId: string, role: string): Promise<StoredRolePermission[]>`
  - `class PermissionsService` with `resolveCapabilities(tenantId: string, role: UserRole): Promise<CapabilityMap>` and `seedDefaults(tx: Prisma.TransactionClient, tenantId: string): Promise<void>`
  - `class PermissionsModule` exporting `PermissionsService`.
  - (`getMatrix`/`updateModule` are Slice 6 and are NOT implemented here.)

- [ ] **Step 1: Write the failing repository test**

Create `apps/api/src/modules/permissions/__tests__/permissions.repository.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PermissionsRepository } from '../permissions.repository.js'

const mockPrisma = {
  rolePermission: { findMany: vi.fn() },
}

describe('PermissionsRepository', () => {
  let repo: PermissionsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new PermissionsRepository(mockPrisma as never)
  })

  it('queries stored rows scoped to tenant and role', async () => {
    mockPrisma.rolePermission.findMany.mockResolvedValue([
      { role: 'assistant', moduleKey: 'patients', accessLevel: 'manage' },
    ])
    const rows = await repo.findByTenantAndRole('t1', 'assistant')
    expect(mockPrisma.rolePermission.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', role: 'assistant' },
      select: { role: true, moduleKey: true, accessLevel: true },
    })
    expect(rows).toEqual([{ role: 'assistant', moduleKey: 'patients', accessLevel: 'manage' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/permissions/__tests__/permissions.repository.spec.ts`
Expected: FAIL — `Failed to resolve import "../permissions.repository.js"`.

- [ ] **Step 3: Write the repository**

Create `apps/api/src/modules/permissions/permissions.repository.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

export interface StoredRolePermission {
  role: string
  moduleKey: string
  accessLevel: string
}

@Injectable()
export class PermissionsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /** All stored permission overrides for one tenant + role. */
  async findByTenantAndRole(tenantId: string, role: string): Promise<StoredRolePermission[]> {
    return this.prisma.rolePermission.findMany({
      where: { tenantId, role },
      select: { role: true, moduleKey: true, accessLevel: true },
    })
  }
}
```

- [ ] **Step 4: Run repository test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/permissions/__tests__/permissions.repository.spec.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Write the failing service test**

Create `apps/api/src/modules/permissions/__tests__/permissions.service.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { PermissionsService } from '../permissions.service.js'

const mockRepo = { findByTenantAndRole: vi.fn() }

describe('PermissionsService', () => {
  let service: PermissionsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PermissionsService(mockRepo as never)
  })

  describe('resolveCapabilities', () => {
    it('returns catalog defaults when there are no stored rows', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([])
      const caps = await service.resolveCapabilities('t1', 'assistant')
      expect(caps).toEqual(defaultCapabilitiesFor('assistant'))
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledWith('t1', 'assistant')
    })

    it('lets a stored row override the catalog default (stored wins)', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'assistant', moduleKey: 'protocols', accessLevel: 'manage' },
      ])
      const caps = await service.resolveCapabilities('t1', 'assistant')
      expect(caps.protocols).toBe('manage') // default is 'none'
      expect(caps.patients).toBe('view') // untouched default
    })

    it('ignores a stored row whose module key is not in the catalog', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'doctor', moduleKey: 'legacy_module', accessLevel: 'manage' },
      ])
      const caps = await service.resolveCapabilities('t1', 'doctor')
      expect(caps).toEqual(defaultCapabilitiesFor('doctor'))
      expect((caps as Record<string, unknown>).legacy_module).toBeUndefined()
    })

    it('ignores a stored row whose access level is invalid', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'doctor', moduleKey: 'patients', accessLevel: 'god_mode' },
      ])
      const caps = await service.resolveCapabilities('t1', 'doctor')
      expect(caps.patients).toBe('manage') // falls back to the catalog default
    })
  })

  describe('seedDefaults', () => {
    it('inserts one row per module per role (13 x 4 = 52)', async () => {
      const tx = { rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 52 }) } }
      await service.seedDefaults(tx as never, 't1')
      expect(tx.rolePermission.createMany).toHaveBeenCalledTimes(1)
      const arg = tx.rolePermission.createMany.mock.calls[0]![0] as {
        data: { tenantId: string; role: string; moduleKey: string; accessLevel: string }[]
      }
      expect(arg.data).toHaveLength(52)
    })

    it('stamps the tenant id and uses catalog default levels', async () => {
      const tx = { rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 52 }) } }
      await service.seedDefaults(tx as never, 't1')
      const arg = tx.rolePermission.createMany.mock.calls[0]![0] as {
        data: { tenantId: string; role: string; moduleKey: string; accessLevel: string }[]
      }
      expect(arg.data.every((r) => r.tenantId === 't1')).toBe(true)
      expect(arg.data).toContainEqual({
        tenantId: 't1',
        role: 'assistant',
        moduleKey: 'protocols',
        accessLevel: 'none',
      })
      expect(arg.data).toContainEqual({
        tenantId: 't1',
        role: 'doctor',
        moduleKey: 'users',
        accessLevel: 'none',
      })
      expect(arg.data).toContainEqual({
        tenantId: 't1',
        role: 'super_admin',
        moduleKey: 'permissions',
        accessLevel: 'manage',
      })
    })
  })
})
```

- [ ] **Step 6: Run service test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/permissions/__tests__/permissions.service.spec.ts`
Expected: FAIL — `Failed to resolve import "../permissions.service.js"`.

- [ ] **Step 7: Write the service**

Create `apps/api/src/modules/permissions/permissions.service.ts`:

```ts
import { Injectable, Inject } from '@nestjs/common'
import type { Prisma } from '@rezeta/db'
import {
  MODULE_KEYS,
  PERMISSION_CATALOG,
  defaultCapabilitiesFor,
  type AccessLevel,
  type CapabilityMap,
  type ModuleKey,
  type UserRole,
} from '@rezeta/shared'
import { PermissionsRepository } from './permissions.repository.js'

const MODULE_KEY_SET = new Set<string>(MODULE_KEYS)

function isModuleKey(value: string): value is ModuleKey {
  return MODULE_KEY_SET.has(value)
}

function isAccessLevel(value: string): value is AccessLevel {
  return value === 'none' || value === 'view' || value === 'manage'
}

@Injectable()
export class PermissionsService {
  constructor(@Inject(PermissionsRepository) private repo: PermissionsRepository) {}

  /**
   * Resolve a role's effective capabilities for a tenant: start from the code
   * catalog defaults, then overlay stored `RolePermission` rows (stored wins). A
   * module with no stored row keeps its catalog default, so tenants seeded before
   * a module existed still resolve it. Rows whose key or level are unrecognized
   * (e.g. a module removed from the catalog) are ignored.
   */
  async resolveCapabilities(tenantId: string, role: UserRole): Promise<CapabilityMap> {
    const caps = defaultCapabilitiesFor(role)
    const stored = await this.repo.findByTenantAndRole(tenantId, role)
    for (const row of stored) {
      if (isModuleKey(row.moduleKey) && isAccessLevel(row.accessLevel)) {
        caps[row.moduleKey] = row.accessLevel
      }
    }
    return caps
  }

  /**
   * Insert the full default role x module matrix for a freshly created tenant.
   * Runs inside the caller's seeding transaction so it commits atomically with the
   * rest of the tenant bootstrap.
   */
  async seedDefaults(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const data = MODULE_KEYS.flatMap((moduleKey) => {
      const defaults = PERMISSION_CATALOG[moduleKey].defaults
      return (Object.keys(defaults) as UserRole[]).map((role) => ({
        tenantId,
        role,
        moduleKey,
        accessLevel: defaults[role],
      }))
    })
    await tx.rolePermission.createMany({ data })
  }
}
```

- [ ] **Step 8: Run service test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/permissions/__tests__/permissions.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 9: Write the module and barrel**

Create `apps/api/src/modules/permissions/permissions.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { PermissionsService } from './permissions.service.js'
import { PermissionsRepository } from './permissions.repository.js'

@Module({
  providers: [PermissionsService, PermissionsRepository],
  exports: [PermissionsService],
})
export class PermissionsModule {}
```

Create `apps/api/src/modules/permissions/index.ts`:

```ts
export { PermissionsModule } from './permissions.module.js'
export { PermissionsService } from './permissions.service.js'
export { PermissionsRepository } from './permissions.repository.js'
```

- [ ] **Step 10: Typecheck the API package**

Run: `pnpm --filter @rezeta/api typecheck`
Expected: no errors.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/modules/permissions
git commit -m "feat(api): add permissions module with capability resolution and default seeding"
```

---

### Task 6: Seed `RolePermission` defaults from tenant-seeding

**Files:**
- Modify: `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts` (constructor + both transactions)
- Modify: `apps/api/src/modules/tenant-seeding/tenant-seeding.module.ts` (import `PermissionsModule`)
- Modify: `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.service.unit.spec.ts`
- Modify: `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.spec.ts`
- Modify: `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.concurrency.spec.ts`

**Interfaces:**
- Consumes: `PermissionsService.seedDefaults(tx, tenantId)` (Task 5); `PermissionsModule` (Task 5).
- Produces: `TenantSeedingService` constructor now takes `(prisma: PrismaService, permissions: PermissionsService)`. Both `seedDefault` and `seedCustom` call `permissions.seedDefaults(tx, tenantId)` inside their transactions.

- [ ] **Step 1: Update the unit spec to expect seeding (failing test)**

In `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.service.unit.spec.ts`, add a `rolePermission` mock to `mockTx`, a `mockPermissions` object, update the constructor call, and add two assertions.

Add to the `mockTx` object (after `protocolCategory`):

```ts
  protocolCategory: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  rolePermission: { createMany: vi.fn() },
}

const mockPermissions = { seedDefaults: vi.fn().mockResolvedValue(undefined) }
```

Update the constructor line in `beforeEach`:

```ts
    service = new TenantSeedingService(mockPrisma as never, mockPermissions as never)
```

Add a `mockPermissions.seedDefaults.mockResolvedValue(undefined)` reset is unnecessary (`vi.clearAllMocks()` keeps the implementation for `mockResolvedValue` set at definition; re-assert as needed). Add these two tests — one in the `seedDefault` `describe`, one in the `seedCustom` `describe`:

```ts
    it('seeds RolePermission defaults inside the transaction', async () => {
      await service.seedDefault('t1')
      expect(mockPermissions.seedDefaults).toHaveBeenCalledWith(mockTx, 't1')
    })
```

```ts
    it('seeds RolePermission defaults inside the transaction', async () => {
      await service.seedCustom('t1', templates, types)
      expect(mockPermissions.seedDefaults).toHaveBeenCalledWith(mockTx, 't1')
    })
```

- [ ] **Step 2: Run the unit spec to verify the new tests fail**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/tenant-seeding/__tests__/tenant-seeding.service.unit.spec.ts`
Expected: FAIL — the constructor now receives a second arg the service ignores, so `mockPermissions.seedDefaults` is never called; both new tests fail with "expected to have been called with".

- [ ] **Step 3: Inject `PermissionsService` and call `seedDefaults` in the service**

In `apps/api/src/modules/tenant-seeding/tenant-seeding.service.ts`, add the import (after the `ErrorCode` import):

```ts
import { ErrorCode } from '@rezeta/shared'
import { PermissionsService } from '../permissions/permissions.service.js'
```

Update the constructor:

```ts
@Injectable()
export class TenantSeedingService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PermissionsService) private permissions: PermissionsService,
  ) {}
```

In `seedDefault`, inside the `$transaction` callback, add the seed call right after the inner already-seeded re-check (before the "Seed protocol categories first" block):

```ts
        if (locked?.seededAt !== null) {
          throw alreadySeeded()
        }

        await this.permissions.seedDefaults(tx, tenantId)

        // Seed protocol categories first so templates can link to them.
```

In `seedCustom`, inside its `$transaction` callback, add the same call right after its inner re-check (before "Create a default category"):

```ts
        if (locked?.seededAt !== null) {
          throw alreadySeeded()
        }

        await this.permissions.seedDefaults(tx, tenantId)

        // Create a default category so every custom template has a valid categoryId.
```

- [ ] **Step 4: Run the unit spec to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/tenant-seeding/__tests__/tenant-seeding.service.unit.spec.ts`
Expected: PASS (including the two new tests).

- [ ] **Step 5: Fix the other two tenant-seeding specs' constructors**

In BOTH `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.spec.ts` and `apps/api/src/modules/tenant-seeding/__tests__/tenant-seeding.concurrency.spec.ts`:

Add a `rolePermission` mock to their `mockTx` objects (after `protocolCategory`):

```ts
  protocolCategory: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  rolePermission: { createMany: vi.fn() },
}
```

Add a permissions mock near the other module-level mocks:

```ts
const mockPermissions = { seedDefaults: vi.fn().mockResolvedValue(undefined) }
```

Update each `new TenantSeedingService(mockPrisma as never)` call to:

```ts
    service = new TenantSeedingService(mockPrisma as never, mockPermissions as never)
```

- [ ] **Step 6: Wire `PermissionsModule` into `TenantSeedingModule`**

Replace the contents of `apps/api/src/modules/tenant-seeding/tenant-seeding.module.ts`:

```ts
import { Module } from '@nestjs/common'
import { TenantSeedingService } from './tenant-seeding.service.js'
import { PermissionsModule } from '../permissions/index.js'

@Module({
  imports: [PermissionsModule],
  providers: [TenantSeedingService],
  exports: [TenantSeedingService],
})
export class TenantSeedingModule {}
```

- [ ] **Step 7: Run all tenant-seeding specs to verify they pass**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/tenant-seeding`
Expected: PASS (unit, locale-names, and concurrency specs all green).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/tenant-seeding
git commit -m "feat(api): seed RolePermission defaults during tenant seeding"
```

---

### Task 7: Attach capabilities in `AuthGuard`

**Files:**
- Modify: `apps/api/src/common/guards/auth.guard.ts` (constructor + `request.user` build)
- Modify: `apps/api/src/app.module.ts` (import `PermissionsModule`)
- Modify: `apps/api/src/common/guards/__tests__/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `PermissionsService.resolveCapabilities(tenantId, role)` (Task 5); `AuthUser` now requires `capabilities` (Task 4).
- Produces: `request.user.capabilities: CapabilityMap` on every authenticated (non-public, non-provision) request.

- [ ] **Step 1: Update the guard spec to expect capabilities (failing test)**

In `apps/api/src/common/guards/__tests__/auth.guard.spec.ts`:

Add a permissions mock next to the others:

```ts
const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }
const mockPermissions = {
  resolveCapabilities: vi.fn().mockResolvedValue({ patients: 'view', users: 'none' }),
}
```

Update the guard construction in `beforeEach` (add the 5th arg) and re-set the resolver default:

```ts
  beforeEach(() => {
    vi.clearAllMocks()
    mockPermissions.resolveCapabilities.mockResolvedValue({ patients: 'view', users: 'none' })
    guard = new AuthGuard(
      mockReflector as unknown as Reflector,
      mockAuthProvider as never,
      mockUsers as never,
      mockAuditLog as never,
      mockPermissions as never,
    )
  })
```

Add two assertions inside the existing "populates req.user and returns true for valid authenticated request" test (after the existing expects):

```ts
    expect(mockPermissions.resolveCapabilities).toHaveBeenCalledWith('tenant-1', 'owner')
    expect((req.user as Record<string, unknown>).capabilities).toEqual({
      patients: 'view',
      users: 'none',
    })
```

> Note: `validUser.role` is `'owner'` in the current fixture. Slice 1 migrated these fixtures to a four-role value; if `role` is already `'super_admin'` in the working tree, change the `resolveCapabilities` assertion argument to match the fixture's role (`'super_admin'`). The guard passes `user.role` through unchanged.

- [ ] **Step 2: Run the guard spec to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/auth.guard.spec.ts`
Expected: FAIL — the guard constructor takes 4 args, so the 5th is ignored and `resolveCapabilities` is never called; `req.user.capabilities` is `undefined`.

- [ ] **Step 3: Inject `PermissionsService` and populate the new fields**

In `apps/api/src/common/guards/auth.guard.ts`, add the import (after the `provision-route.decorator.js` import):

```ts
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'
import { PermissionsService } from '../../modules/permissions/permissions.service.js'
```

Add the constructor injection (after `auditLog`):

```ts
  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(UsersRepository) private users: UsersRepository,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(PermissionsService) private permissions: PermissionsService,
  ) {}
```

Replace the `request.user = { … }` assignment block with one that resolves capabilities first:

```ts
    const role = user.role as AuthUser['role']
    const capabilities = await this.permissions.resolveCapabilities(user.tenantId, role)

    request.user = {
      id: user.id,
      externalUid: user.externalUid,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role,
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
      tenantSeededAt: user.tenant.seededAt?.toISOString() ?? null,
      tenantPlan: user.tenant.plan,
      preferences: parseUserPreferences(user.preferences),
      capabilities,
    }

    return true
```

- [ ] **Step 4: Register `PermissionsModule` in `AppModule`**

In `apps/api/src/app.module.ts`, add the import (after the `UsersModule` import):

```ts
import { UsersModule } from './modules/users/index.js'
import { PermissionsModule } from './modules/permissions/index.js'
```

Add it to the `imports` array (after `UsersModule`):

```ts
    AuthFeatureModule,
    UsersModule,
    PermissionsModule,
    PatientsModule,
```

- [ ] **Step 5: Run the guard spec to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/common/guards/__tests__/auth.guard.spec.ts`
Expected: PASS (including the new capabilities assertion).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/guards/auth.guard.ts apps/api/src/common/guards/__tests__/auth.guard.spec.ts apps/api/src/app.module.ts
git commit -m "feat(api): attach capabilities to authenticated requests"
```

---

### Task 8: Expose capabilities on `/auth/me`, `toAuthUser`, and Swagger

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts` (`toAuthUser`)
- Modify: `apps/api/src/modules/auth/auth.controller.ts` (`/me` Swagger example)
- Modify: `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`
- Modify: `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`

**Interfaces:**
- Consumes: `defaultCapabilitiesFor(role)` (Task 3); `AuthUser` requires `capabilities` (Task 4).
- Produces: `AuthService.toAuthUser` returns an `AuthUser` including `capabilities` (from catalog defaults — the provision path targets a freshly created tenant with no stored overrides). `GET /v1/auth/me` returns it (the guard already attached it). Swagger example documents it.

- [ ] **Step 1: Update the service spec (failing test)**

In `apps/api/src/modules/auth/__tests__/auth.service.spec.ts`, update `baseUser` to a valid four-role value:

```ts
const baseUser = {
  id: 'u1',
  externalUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'doctor',
  specialty: 'cardiology',
  licenseNumber: 'MED-001',
  tenant: { seededAt: new Date('2026-01-01') },
}
```

Update the "maps user fields correctly" test's `toMatchObject` `role` to `'doctor'` and add capability assertions after it:

```ts
    it('maps user fields correctly', () => {
      const auth = service.toAuthUser(baseUser as never)
      expect(auth).toMatchObject({
        id: 'u1',
        externalUid: 'fb1',
        tenantId: 't1',
        email: 'dr@test.com',
        fullName: 'Dr. Test',
        role: 'doctor',
        specialty: 'cardiology',
        licenseNumber: 'MED-001',
        tenantSeededAt: '2026-01-01T00:00:00.000Z',
      })
      expect(auth.capabilities.patients).toBe('manage') // doctor default
      expect(auth.capabilities.users).toBe('none') // doctor default
    })
```

- [ ] **Step 2: Run the service spec to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/auth/__tests__/auth.service.spec.ts`
Expected: FAIL — `auth.capabilities` is `undefined` (toAuthUser does not set it yet).

- [ ] **Step 3: Populate the new fields in `toAuthUser`**

In `apps/api/src/modules/auth/auth.service.ts`, add `defaultCapabilitiesFor` to the shared import:

```ts
import { UserPreferencesSchema, ErrorCode, defaultCapabilitiesFor } from '@rezeta/shared'
```

Add the field to the object returned by `toAuthUser` (after `preferences`):

```ts
      tenantSeededAt: user.tenant.seededAt?.toISOString() ?? null,
      tenantPlan: user.tenant.plan,
      preferences: parsePreferences(user.preferences),
      capabilities: defaultCapabilitiesFor(user.role as AuthUser['role']),
    }
```

- [ ] **Step 4: Run the service spec to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/auth/__tests__/auth.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Update the controller `authUser` fixture and Swagger example**

In `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`, add the field to the `authUser` fixture (after `preferences: {}`), and align `role` with the four-role set:

```ts
const authUser = {
  id: 'u1',
  externalUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'doctor' as const,
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: '2026-01-01T00:00:00.000Z',
  preferences: {},
  capabilities: { patients: 'manage' },
}
```

(The existing `me` test `expect(result).toBe(authUser)` still holds — `me()` returns the injected user unchanged.)

In `apps/api/src/modules/auth/auth.controller.ts`, update the `/me` `@ApiResponse` schema `properties`: fix the `role` enum to the four roles and add `capabilities` (after `tenantSeededAt`):

```ts
        role: {
          type: 'string',
          enum: ['assistant', 'doctor', 'admin', 'super_admin'],
          example: 'super_admin',
        },
        specialty: { type: 'string', nullable: true, example: 'Cardiología' },
        licenseNumber: { type: 'string', nullable: true, example: '12345-DR' },
        tenantSeededAt: { type: 'string', format: 'date-time', nullable: true },
        capabilities: {
          type: 'object',
          additionalProperties: { type: 'string', enum: ['none', 'view', 'manage'] },
          example: { patients: 'manage', users: 'none' },
        },
```

- [ ] **Step 6: Run the controller spec to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/auth/__tests__/auth.controller.spec.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck the API package**

Run: `pnpm --filter @rezeta/api typecheck`
Expected: no errors (every `AuthUser` construction now sets `capabilities`).

- [ ] **Step 8: Update the changelog**

Prepend to `CHANGELOG.md` (below the top heading), in English:

```markdown
## [2026-07-15] Permission catalog + RolePermission + capability resolution

### Added

- Shared permission catalog (`packages/shared/src/permissions/catalog.ts`) with `AccessLevel`, `SectionKey`, `ModuleKey`, `MODULE_KEYS`, and `PERMISSION_CATALOG` default matrix; capability helpers (`capabilities.ts`) `hasCapability` and `defaultCapabilitiesFor`.
- `RolePermission` Prisma model (`role_permissions` table), with migration `20260715010000_add_role_permissions`.
- `PermissionsModule` (`apps/api/src/modules/permissions/`) with `resolveCapabilities` (catalog defaults merged with stored rows) and `seedDefaults`, hooked into `TenantSeedingService`.

### Changed

- `AuthUser` and `UserApiSchema` now carry `capabilities`.
- `AuthGuard` resolves and attaches `capabilities` to `request.user`; `AuthService.toAuthUser` and `GET /v1/auth/me` (with its Swagger example) return it.
```

- [ ] **Step 9: Full verification**

Run: `pnpm --filter @rezeta/db generate` (ensure the client reflects the schema)
Run: `pnpm lint`
Expected: no errors.

Run: `pnpm test`
Expected: all packages green.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/auth CHANGELOG.md
git commit -m "feat(api): return capabilities from /auth/me"
```

---

## Self-Review

**1. Spec coverage (against the shared contract + design spec):**

- Catalog (`AccessLevel`, `ACCESS_LEVEL_RANK`, `SectionKey`, `ModuleKey`, `MODULE_KEYS`, `PERMISSION_CATALOG` with the exact §4.3 matrix) → Task 2. ✅
- `CapabilityMap`, `hasCapability`, `defaultCapabilitiesFor` + barrel export → Task 3. ✅
- `RolePermission` model verbatim + `Tenant.rolePermissions` relation + migration (only `role_permissions`, no `users` column) → Task 1. ✅
- `PermissionsService.resolveCapabilities` (merge, stored wins, missing → default) + `seedDefaults` (all role×module rows); `getMatrix`/`updateModule` deferred to Slice 6 (not implemented) → Task 5. ✅
- `seedDefaults` hooked into tenant-seeding inside the locked transaction → Task 6. ✅
- `AuthGuard` injects `PermissionsService`, sets `capabilities` → Task 7. ✅
- `AuthUser` + `UserApiSchema` gain `capabilities` → Task 4. ✅
- `/auth/me` + Swagger example → Task 8. ✅
- Tests: catalog/capabilities unit (defaults per role, ordering, merge/override) → Tasks 2–3; `seedDefaults` test → Task 5; AuthGuard test asserts capabilities attached → Task 7. ✅

**2. Placeholder scan:** No `TBD`/`TODO`/"add error handling"/"similar to Task N". Every code step shows full code; every run step shows an exact command and expected result. ✅

**3. Type consistency:** `resolveCapabilities(tenantId, role: UserRole)`, `seedDefaults(tx: Prisma.TransactionClient, tenantId)`, `findByTenantAndRole(tenantId, role): StoredRolePermission[]`, `CapabilityMap = Record<ModuleKey, AccessLevel>`, `hasCapability(caps, module, required)`, `defaultCapabilitiesFor(role)` are used identically across Tasks 3, 5, 6, 7, 8. `PermissionsService` is exported from the module (Task 5) and injected in Tasks 6–7. `AuthUser` carries `capabilities` only (no platform field) across Tasks 4, 7, 8 — all platform-admin identity is owned by Slice 7 (separate `PlatformUser` control-plane table) and is out of scope here. ✅

**Note on Slice 1 coupling:** several test fixtures currently use the pre-Slice-1 `role: 'owner'`. Slice 1 migrates those to four-role values. Where a fixture's role matters for capability resolution (Tasks 7, 8), this plan sets a valid four-role value (`'doctor'`/`'super_admin'`) and flags the reconciliation inline. `defaultCapabilitiesFor` requires a valid `UserRole`; an out-of-range role would yield undefined map values, so the fixture role must be one of the four.
