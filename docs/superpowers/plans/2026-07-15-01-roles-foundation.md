# Roles Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the institution role vocabulary from `owner | doctor` to the four ordered roles `assistant | doctor | admin | super_admin`, add a shared rank helper, and migrate existing `owner` rows to `super_admin` — with no behavior change beyond the role vocabulary.

**Architecture:** This is Slice 1 of the Permissions & Multi-User milestone (design: `docs/superpowers/specs/2026-07-15-permissions-multi-user-design.md`; contracts: the shared-contracts note). It touches only the role *vocabulary*: the shared `UserRole` union, the `UserApiSchema` Zod enum, a new `packages/shared/src/permissions/roles.ts` (`ROLE_RANK` + `canManageRole`), the Prisma `User.role` default, a data migration, and every code/test reference to the retired `owner` literal. No permission enforcement, no capability map, no new endpoints — those arrive in Slices 2+.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Zod, Prisma (PostgreSQL, no Prisma enums — role stored as `VarChar`), NestJS (API), vitest (both `packages/shared` and `apps/api`).

## Global Constraints

- **English only.** All code, comments, tests, commit messages, and the `CHANGELOG.md` entry are in English. The only Spanish permitted in the repo is user-facing UI strings — none are touched in this slice.
- **Coverage gate: 95% per-file** via `pnpm test:coverage`. Every new source file (`roles.ts`) needs tests that hit 95%+ statements/branches/functions/lines. `packages/shared` coverage excludes `src/types/**`, `src/**/index.ts`, and `src/errors.ts`, so `types/auth.ts` and the barrel need no tests; `permissions/roles.ts` does.
- **Run `pnpm lint` and `pnpm test` before considering the slice done.** Zero lint errors, zero failing tests.
- **No `TODO`/`FIXME`/`HACK`/`XXX` comments** — ESLint `no-warning-comments` fails CI.
- **2-space indentation.** `snake_case` for DB columns/tables, `camelCase` for TypeScript.
- **No Prisma enums for role** — keep `User.role String`; role values are validated in Zod, not the DB.

**Commit strategy (read before starting — this slice commits ONCE):** The pre-commit hook (`.husky/pre-commit`) runs `pnpm lint` then `pnpm run typecheck`, and `typecheck` is `pnpm -r typecheck` — a **whole-workspace** typecheck. `apps/api` and `apps/web` resolve `@rezeta/shared` from its built `dist/`, and both include their `*.spec.ts`/`*.test.tsx` fixtures in typecheck. Widening `UserRole` **removes** the `'owner'` literal, so every fixture and source reference to `'owner'` becomes a type error the instant the union changes. Therefore the role-vocabulary change and all its consumers must land in a **single atomic commit** (this is the repo's documented "shared-type changes ship in a vertical slice with all consumers" rule). Tasks 1–5 each end with per-package vitest verification but **do not** call `git commit`. The one commit happens in Task 6, after `pnpm --filter @rezeta/shared build` makes the new types visible and the whole-workspace typecheck is green.

---

### Task 1: Widen `UserRole` and add the `ROLE_RANK` / `canManageRole` helper

**Files:**
- Modify: `packages/shared/src/types/auth.ts:3` (the `UserRole` union)
- Create: `packages/shared/src/permissions/roles.ts`
- Modify: `packages/shared/src/index.ts:3` (barrel — add the new export after `schemas/index.js`)
- Test: `packages/shared/src/permissions/__tests__/roles.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (later tasks and slices rely on these exact names/types):
  - `type UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'` (from `@rezeta/shared`)
  - `const ROLE_RANK: Record<UserRole, number>` = `{ assistant: 1, doctor: 2, admin: 3, super_admin: 4 }`
  - `function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean` — returns `ROLE_RANK[targetRole] < ROLE_RANK[actorRole]`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/permissions/__tests__/roles.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { UserRole } from '../../types/auth.js'
import { ROLE_RANK, canManageRole } from '../roles.js'

const ROLES: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']

describe('ROLE_RANK', () => {
  it('ranks the four roles strictly ascending by privilege', () => {
    expect(ROLE_RANK).toEqual({ assistant: 1, doctor: 2, admin: 3, super_admin: 4 })
  })

  it('has a distinct rank for every role', () => {
    const ranks = ROLES.map((r) => ROLE_RANK[r])
    expect(new Set(ranks).size).toBe(ROLES.length)
  })
})

describe('canManageRole', () => {
  // Full 4x4 truth table: canManageRole(actor, target) === rank[target] < rank[actor].
  const cases: Array<[UserRole, UserRole, boolean]> = [
    ['assistant', 'assistant', false],
    ['assistant', 'doctor', false],
    ['assistant', 'admin', false],
    ['assistant', 'super_admin', false],
    ['doctor', 'assistant', true],
    ['doctor', 'doctor', false],
    ['doctor', 'admin', false],
    ['doctor', 'super_admin', false],
    ['admin', 'assistant', true],
    ['admin', 'doctor', true],
    ['admin', 'admin', false],
    ['admin', 'super_admin', false],
    ['super_admin', 'assistant', true],
    ['super_admin', 'doctor', true],
    ['super_admin', 'admin', true],
    ['super_admin', 'super_admin', false],
  ]

  it.each(cases)('actor=%s target=%s -> %s', (actor, target, expected) => {
    expect(canManageRole(actor, target)).toBe(expected)
  })

  it('never lets a role manage its own rank', () => {
    for (const role of ROLES) {
      expect(canManageRole(role, role)).toBe(false)
    }
  })

  it('never lets a role manage a strictly higher rank', () => {
    expect(canManageRole('assistant', 'super_admin')).toBe(false)
    expect(canManageRole('admin', 'super_admin')).toBe(false)
    expect(canManageRole('doctor', 'admin')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions/__tests__/roles.test.ts`
Expected: FAIL — vitest cannot resolve `../roles.js` (file does not exist yet), reported as a transform/resolve error.

- [ ] **Step 3: Widen the `UserRole` union**

In `packages/shared/src/types/auth.ts`, replace line 3:

```ts
export type UserRole = 'owner' | 'doctor'
```

with:

```ts
export type UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'
```

(Leave the rest of `auth.ts` unchanged — `AuthUser.role: UserRole` now widens automatically.)

- [ ] **Step 4: Create the roles helper**

Create `packages/shared/src/permissions/roles.ts`:

```ts
import type { UserRole } from '../types/auth.js'

/**
 * Privilege rank for each institution role. Higher number means more privilege.
 * A user may only act on roles strictly below their own rank (see canManageRole).
 */
export const ROLE_RANK: Record<UserRole, number> = {
  assistant: 1,
  doctor: 2,
  admin: 3,
  super_admin: 4,
}

/**
 * Returns true when actorRole may manage targetRole — i.e. the target's rank is
 * strictly below the actor's. A user can never manage their own rank or a higher
 * one. Enforced in the service layer, not only the UI.
 */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole]
}
```

- [ ] **Step 5: Export the helper from the shared barrel**

In `packages/shared/src/index.ts`, add a new line immediately after `export * from './schemas/index.js'` (line 3):

```ts
export * from './permissions/roles.js'
```

The file becomes:

```ts
export * from './errors.js'
export * from './types/index.js'
export * from './schemas/index.js'
export * from './permissions/roles.js'
export * from './protocol/content-builder.js'
export * from './protocol/conditional-rule-evaluator.js'
export * from './protocol/sign-validation.js'
export * from './protocol/checked-state.js'
export * from './record/generate-record-sections.js'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared exec vitest run src/permissions/__tests__/roles.test.ts`
Expected: PASS — all `ROLE_RANK` and `canManageRole` cases green (2 + 16 + 2 + 1 assertions).

- [ ] **Step 7: Do NOT commit yet**

Per the Commit strategy note, the workspace typecheck is now red (fixtures still reference `'owner'`). Continue to Task 2; the single commit happens in Task 6.

---

### Task 2: Widen `UserApiSchema.role` and update the shared schema test

**Files:**
- Modify: `packages/shared/src/schemas/auth.ts:61` (the `role` enum)
- Test: `packages/shared/__tests__/schemas/auth.test.ts:158-199` (the `UserApiSchema` describe block)

**Interfaces:**
- Consumes: `UserRole` widening from Task 1 (the enum's string members must match the union members).
- Produces: `UserApiSchema.role` validates exactly `'assistant' | 'doctor' | 'admin' | 'super_admin'`; `UserApiDto.role: UserRole`.

- [ ] **Step 1: Update the failing test first**

In `packages/shared/__tests__/schemas/auth.test.ts`, the `UserApiSchema` block currently uses `role: 'owner' as const`, asserts `toBe('owner')`, and asserts `role: 'admin'` is rejected — all now wrong. Replace the whole `describe('UserApiSchema', ...)` block (lines 158–199) with:

```ts
describe('UserApiSchema', () => {
  const valid = {
    id: '00000000-0000-0000-0000-000000000001',
    externalUid: 'firebase-uid-abc',
    tenantId: '00000000-0000-0000-0000-000000000002',
    email: 'doctor@rezeta.app',
    fullName: 'Dr. Juan García',
    role: 'super_admin' as const,
    specialty: 'Cardiología',
    licenseNumber: 'CMP-12345',
    isActive: true,
    createdAt: '2026-04-01T00:00:00.000Z',
  }

  it('accepts valid user API response', () => {
    const result = UserApiSchema.parse(valid)
    expect(result.role).toBe('super_admin')
  })

  it('accepts null optional fields', () => {
    const result = UserApiSchema.parse({
      ...valid,
      fullName: null,
      specialty: null,
      licenseNumber: null,
    })
    expect(result.fullName).toBeNull()
  })

  it('accepts every institution role', () => {
    for (const role of ['assistant', 'doctor', 'admin', 'super_admin'] as const) {
      const result = UserApiSchema.parse({ ...valid, role })
      expect(result.role).toBe(role)
    }
  })

  it('rejects the retired owner role', () => {
    expect(() => UserApiSchema.parse({ ...valid, role: 'owner' })).toThrow()
  })

  it('rejects an unknown role', () => {
    expect(() => UserApiSchema.parse({ ...valid, role: 'superuser' })).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() => UserApiSchema.parse({ ...valid, email: 'bademail' })).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared exec vitest run __tests__/schemas/auth.test.ts`
Expected: FAIL — `accepts valid user API response` and `accepts every institution role` fail because `UserApiSchema` still only allows `'owner' | 'doctor'`, so parsing `role: 'super_admin'` / `'assistant'` / `'admin'` throws.

- [ ] **Step 3: Widen the enum**

In `packages/shared/src/schemas/auth.ts`, replace line 61:

```ts
  role: z.enum(['owner', 'doctor']),
```

with:

```ts
  role: z.enum(['assistant', 'doctor', 'admin', 'super_admin']),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/shared exec vitest run __tests__/schemas/auth.test.ts`
Expected: PASS — all `UserApiSchema` cases green; the retired-role and unknown-role cases still throw.

- [ ] **Step 5: Run the full shared suite**

Run: `pnpm --filter @rezeta/shared test`
Expected: PASS — the whole `packages/shared` vitest suite is green (Task 1 + Task 2). Do NOT commit yet.

---

### Task 3: Update API source references to the retired `owner` role

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts:174` (Swagger `role` enum + example)
- Modify: `apps/api/src/modules/users/users.repository.ts:122` (`provisionUser` created role)
- Test: `apps/api/src/modules/users/__tests__/users.repository.spec.ts:178` (the `provisionUser` creation assertion)
- Verify-only (no edit): `apps/api/src/common/guards/auth.guard.ts:103` and `apps/api/src/modules/auth/auth.service.ts:84`

**Interfaces:**
- Consumes: `UserRole` widening (Task 1). `AuthUser['role']` now resolves to the four-role union, so the existing casts `user.role as AuthUser['role']` in `auth.guard.ts:103` and `auth.service.ts:84` stay valid **without change** — they never referenced the `'owner'` literal.
- Produces: `provisionUser` now creates a `super_admin` (the migrated equivalent of the old `owner`). This provisioning path is replaced wholesale in Slice 5; keeping it as `super_admin` preserves today's "first user owns the tenant" behavior in the interim.

- [ ] **Step 1: Update the `provisionUser` test assertion first**

In `apps/api/src/modules/users/__tests__/users.repository.spec.ts`, the `provisionUser` creation test asserts the created role is `'owner'` (line ~178). Change that assertion so it expects the new role. Replace:

```ts
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalUid: 'fb1',
            email: 'dr@test.com',
            role: 'owner',
          }),
        }),
      )
```

with:

```ts
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalUid: 'fb1',
            email: 'dr@test.com',
            role: 'super_admin',
          }),
        }),
      )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/users/__tests__/users.repository.spec.ts -t "provision"`
Expected: FAIL — `provisionUser` still calls `tx.user.create` with `role: 'owner'`, so the `super_admin` expectation does not match.

- [ ] **Step 3: Update `provisionUser` to create `super_admin`**

In `apps/api/src/modules/users/users.repository.ts`, inside the `tx.user.create` call (line ~122), replace:

```ts
            role: 'owner',
```

with:

```ts
            role: 'super_admin',
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @rezeta/api exec vitest run src/modules/users/__tests__/users.repository.spec.ts`
Expected: PASS — the full `users.repository` suite is green.

- [ ] **Step 5: Update the Swagger role enum**

In `apps/api/src/modules/auth/auth.controller.ts`, replace line 174:

```ts
        role: { type: 'string', enum: ['owner', 'doctor'], example: 'owner' },
```

with:

```ts
        role: {
          type: 'string',
          enum: ['assistant', 'doctor', 'admin', 'super_admin'],
          example: 'super_admin',
        },
```

- [ ] **Step 6: Confirm the guard/service casts need no change**

Read `apps/api/src/common/guards/auth.guard.ts:103` and `apps/api/src/modules/auth/auth.service.ts:84`. Both are `role: user.role as AuthUser['role']`. Because `AuthUser['role']` is now the widened `UserRole`, the cast is still correct and compiles once shared is rebuilt (Task 6). No edit is required here — this step is verification only. Do not change these lines.

- [ ] **Step 7: Do NOT commit yet**

Fixtures across the API and web test suites still reference `'owner'` and will fail the workspace typecheck. Continue to Task 4.

---

### Task 4: Sweep the remaining `owner` test fixtures (API + web)

Every remaining `role: 'owner'` (and `role: 'owner' as const`) in test fixtures is a stale `AuthUser`/actor literal that no longer type-checks. Replace each with `role: 'super_admin'` (the migrated equivalent — preserves each fixture's "tenant owner" intent) and update the one web assertion that reads the value back. None of these are behavioral assertions about the role vocabulary; they are actor/user fixtures.

**Files (Modify — exact locations):**
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts:19`
- `apps/api/src/common/pipes/__tests__/zod-validation.pipe.spec.ts:87`
- `apps/api/src/common/audit-log/__tests__/audit-log.controller.spec.ts:29`
- `apps/api/src/common/audit-log/__tests__/audit-log.service.spec.ts:31`
- `apps/api/src/common/guards/__tests__/auth.guard.spec.ts:45`
- `apps/api/src/modules/patients/__tests__/patients.controller.spec.ts:18`
- `apps/api/src/modules/consultation-records/__tests__/consultation-records.controller.spec.ts:30`
- `apps/api/src/modules/invoices/__tests__/invoices.controller.spec.ts:22`
- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts:17` and `:29`
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts:33` and `:119`
- `apps/api/src/modules/appointments/__tests__/appointments.controller.spec.ts:24`
- `apps/api/src/modules/protocol-templates/__tests__/protocol-templates.controller.spec.ts:22`
- `apps/api/src/modules/schedules/__tests__/schedules.controller.spec.ts:30`
- `apps/api/src/modules/locations/__tests__/locations.controller.spec.ts:13`
- `apps/api/src/modules/users/__tests__/users.controller.spec.ts:17`
- `apps/api/src/modules/protocol-improvements/__tests__/protocol-improvements.controller.spec.ts:13`
- `apps/api/src/modules/consultations/__tests__/consultations.controller.spec.ts:21`
- `apps/api/src/modules/protocols/__tests__/protocols.controller.spec.ts:25`
- `apps/api/src/modules/orders/__tests__/orders.controller.spec.ts:22`
- `apps/api/src/modules/onboarding/__tests__/onboarding.controller.spec.ts:16`
- `apps/api/src/modules/onboarding/__tests__/onboarding.spec.ts:29` and `:41`
- `apps/api/src/modules/onboarding/__tests__/onboarding.service.spec.ts:25` and `:37`
- `apps/web/src/providers/__tests__/providers.test.tsx:87`, `:121`, `:160`
- `apps/web/src/hooks/__tests__/use-auth.test.ts:12`
- `apps/web/src/hooks/__tests__/use-onboarding.test.ts:42`
- `apps/web/src/pages/settings/__tests__/AuditLog.test.tsx:46`
- `apps/web/src/pages/Dashboard/__tests__/helpers.test.ts:32`
- `apps/web/src/store/__tests__/auth.store.test.ts:30`, `:38`, `:50`, `:98`, `:124`

- [ ] **Step 1: Replace every `role: 'owner'` fixture literal**

For each file/line above, change `role: 'owner'` to `role: 'super_admin'` and `role: 'owner' as const` to `role: 'super_admin' as const`. Do this precisely (these strings recur; edit the enumerated occurrences only — do not touch `ownerUserId`/`owner_user_id` patient-owner fields, which are unrelated).

Fast enumeration to confirm you have found them all (and nothing extra):

Run: `grep -rn "role: 'owner'" apps/api/src apps/web/src`
Expected before edits: the exact set of lines listed above. After edits: no matches.

- [ ] **Step 2: Fix the one web assertion that reads the role back**

In `apps/web/src/store/__tests__/auth.store.test.ts`, besides the fixture literals, line ~38 asserts the stored role. Change:

```ts
    expect(result.current.user?.role).toBe('owner')
```

to:

```ts
    expect(result.current.user?.role).toBe('super_admin')
```

- [ ] **Step 3: Verify no `owner` role literal remains anywhere**

Run: `grep -rn "'owner'" apps packages --include="*.ts" --include="*.tsx" --include="*.prisma" | grep -iv "owneruser\|owner_user\|owneruserid"`
Expected: no output (the Prisma schema comment and default are handled in Task 5; at this point they still say `owner` — that is the only remaining hit, addressed next). If any `.spec.ts`/`.test.tsx`/`.controller.ts` hit remains, fix it before proceeding.

- [ ] **Step 4: Run the API and web suites**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS — all API specs green with the updated fixtures.

Run: `pnpm --filter @rezeta/web test`
Expected: PASS — all web tests green with the updated fixtures.

- [ ] **Step 5: Do NOT commit yet**

Continue to Task 5 (Prisma default + migration), then commit everything atomically in Task 6.

---

### Task 5: Change the Prisma default and add the `owner → super_admin` data migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma:58` (the `User.role` default + trailing comment)
- Create: `packages/db/prisma/migrations/20260715000000_role_owner_to_super_admin/migration.sql`

**Interfaces:**
- Consumes: nothing from earlier tasks (SQL/schema change; independent of the TS build).
- Produces: existing `owner` rows become `super_admin`; the column default for new rows becomes `assistant`. The design notes every creation path sets the role explicitly, so the `assistant` default is a safe floor, not a behavioral default (Slice 5 replaces the only current creation path).

- [ ] **Step 1: Change the schema default and comment**

In `packages/db/prisma/schema.prisma`, replace line 58:

```prisma
  role          String    @default("owner") @db.VarChar(50) // owner | doctor
```

with:

```prisma
  role          String    @default("assistant") @db.VarChar(50) // assistant | doctor | admin | super_admin
```

- [ ] **Step 2: Validate the schema still parses**

Run: `pnpm --filter @rezeta/db exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid` (this is schema-only and needs no database connection).

- [ ] **Step 3: Scaffold the migration folder via the repo workflow**

The repo tracks hand-reviewable SQL migrations under `packages/db/prisma/migrations/<timestamp>_<name>/migration.sql` (see `migration_lock.toml`, provider `postgresql`). Prefer Prisma's create-only workflow when a dev database is available:

Run: `pnpm --filter @rezeta/db exec prisma migrate dev --name role_owner_to_super_admin --create-only`
Expected: Prisma creates `packages/db/prisma/migrations/<new-timestamp>_role_owner_to_super_admin/migration.sql` containing the default-change `ALTER TABLE` and does **not** apply it.

If no dev database is reachable, create the folder and file by hand at the fixed path `packages/db/prisma/migrations/20260715000000_role_owner_to_super_admin/migration.sql` (this timestamp sorts after the latest existing migration `20260712010000_...`).

- [ ] **Step 4: Write the migration SQL (data migration + default change)**

Set the contents of the new `migration.sql` (whichever path Step 3 produced) to exactly:

```sql
-- Widen the role vocabulary. The legacy `owner` role is renamed to `super_admin`,
-- and the column default for newly provisioned rows changes from `owner` to `assistant`.
-- `doctor` rows are unaffected. Role values remain free-form VarChar (no Prisma enum);
-- validation lives in the shared Zod schema.

-- Data migration: promote existing owners to super_admin.
UPDATE "users" SET "role" = 'super_admin' WHERE "role" = 'owner';

-- Schema: new default role for provisioned rows.
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'assistant';
```

- [ ] **Step 5: Verify the migration is well-formed and complete**

Run: `grep -c "role = 'super_admin'" packages/db/prisma/migrations/*_role_owner_to_super_admin/migration.sql`
Expected: `1` — the data migration line is present.

Run: `grep -c "SET DEFAULT 'assistant'" packages/db/prisma/migrations/*_role_owner_to_super_admin/migration.sql`
Expected: `1` — the default-change line is present.

- [ ] **Step 6: Regenerate the Prisma client**

Run: `pnpm --filter @rezeta/db generate`
Expected: `Generated Prisma Client` — confirms the edited schema compiles into the client used by `apps/api`.

- [ ] **Step 7: Do NOT commit yet**

Proceed to Task 6 for the changelog entry, the atomic commit, and full-suite verification.

---

### Task 6: Changelog, atomic commit, and full-suite verification

**Files:**
- Modify: `CHANGELOG.md` (prepend a new dated entry)

**Interfaces:**
- Consumes: all edits from Tasks 1–5.
- Produces: a single commit containing the entire role-vocabulary slice, with a green whole-workspace typecheck, lint, tests, and coverage.

- [ ] **Step 1: Rebuild the shared package so consumers see the new types**

Run: `pnpm --filter @rezeta/shared build`
Expected: `tsc` completes with no errors — `dist/` now exports the widened `UserRole`, `ROLE_RANK`, and `canManageRole`, which `apps/api` and `apps/web` resolve.

- [ ] **Step 2: Run the whole-workspace typecheck (the pre-commit gate)**

Run: `pnpm typecheck`
Expected: PASS for `@rezeta/shared`, `@rezeta/db`, `@rezeta/api`, and `@rezeta/web` — no lingering `'owner'` type errors. If any fixture still errors, fix it (it was missed in Task 4) before continuing.

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: zero errors (no `no-warning-comments`, no unused imports from the edits).

- [ ] **Step 4: Run the full test suite with coverage**

Run: `pnpm test:coverage`
Expected: all packages PASS; `packages/shared/src/permissions/roles.ts` reports 100% (every line of `ROLE_RANK` and `canManageRole` is exercised by Task 1's tests), and the 95% per-file gate holds across the workspace.

- [ ] **Step 5: Prepend the changelog entry**

Prepend to `CHANGELOG.md` (in English, factual, naming the affected surfaces):

```markdown
## [2026-07-15] Roles foundation (permissions slice 1)

### Added
- `packages/shared/src/permissions/roles.ts` — `ROLE_RANK` and `canManageRole(actorRole, targetRole)` (returns true only when the target's rank is strictly below the actor's), exported from the shared barrel.
- Prisma migration `20260715000000_role_owner_to_super_admin` — promotes existing `owner` rows to `super_admin` and sets the `users.role` column default to `assistant`.

### Changed
- Widened `UserRole` (`packages/shared/src/types/auth.ts`) and `UserApiSchema.role` (`packages/shared/src/schemas/auth.ts`) from `owner | doctor` to `assistant | doctor | admin | super_admin`.
- `User.role` Prisma default changed from `owner` to `assistant` (`packages/db/prisma/schema.prisma`).
- `UsersRepository.provisionUser` now creates the initial user as `super_admin` (interim; the provisioning path is replaced in permissions slice 5).
- Updated the `GET /v1/auth/me` Swagger `role` enum/example (`apps/api/src/modules/auth/auth.controller.ts`) and every `role: 'owner'` test fixture across `apps/api` and `apps/web` to the new vocabulary.
```

Adjust the exact heading style if the top of `CHANGELOG.md` uses a different existing convention (match the newest entry's format).

- [ ] **Step 6: Stage everything and commit once**

```bash
git add \
  packages/shared/src/types/auth.ts \
  packages/shared/src/schemas/auth.ts \
  packages/shared/src/permissions/roles.ts \
  packages/shared/src/permissions/__tests__/roles.test.ts \
  packages/shared/src/index.ts \
  packages/shared/__tests__/schemas/auth.test.ts \
  packages/db/prisma/schema.prisma \
  packages/db/prisma/migrations \
  apps/api/src/modules/auth/auth.controller.ts \
  apps/api/src/modules/users/users.repository.ts \
  apps/api/src \
  apps/web/src \
  CHANGELOG.md
git commit -m "feat: widen role vocabulary to assistant/doctor/admin/super_admin

Slice 1 of the permissions milestone. Adds ROLE_RANK + canManageRole to
packages/shared, widens UserRole and UserApiSchema, changes the User.role
default to assistant, and migrates existing owner rows to super_admin. No
behavior change beyond the role vocabulary.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

The pre-commit hook re-runs `pnpm lint` and `pnpm run typecheck`; both must pass (they did in Steps 2–3). Expected: the commit succeeds.

---

## Slice boundary

What later slices consume from this one:

- **Slice 2 (permission catalog + `RolePermission`)** imports `UserRole` and builds `defaults: Record<UserRole, AccessLevel>` keyed by the four roles defined here; it also reuses `packages/shared/src/permissions/` as the home for `catalog.ts` and `capabilities.ts` alongside `roles.ts`.
- **Slices 3, 5, 6** consume `canManageRole` / `ROLE_RANK` for the rank rule (permission edits, user role changes, activate/deactivate) and rely on the widened `UserApiSchema` / `AuthUser['role']`.
- This slice deliberately leaves `UsersRepository.provisionUser` intact (creating a `super_admin`); **Slice 5** replaces the tenant-self-creation provisioning path with internal, staff-driven user creation. The `assistant` column default becomes the meaningful floor once explicit-role creation lands.
- No `AuthUser.capabilities` field, no `PermissionGuard`, and no `INSUFFICIENT_PERMISSION` error code are added here — those are Slices 2 and 3. Platform-staff identity (`PlatformUser`) is owned entirely by Slice 7.
