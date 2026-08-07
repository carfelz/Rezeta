# Identity ID Rename Implementation Plan (self-hosted auth, slice 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `external_uid` to `identity_id` everywhere — database column, Prisma field, shared types, repositories, guard, services, CLI, and tests — with no behavior change.

**Architecture:** The rename lands in two commits, exploiting Prisma's ability to name a field differently from its column. Commit 1 renames only the **column**, keeping the Prisma field `externalUid` via `@map("identity_id")`, so no TypeScript changes and the workspace typecheck stays green. Commit 2 renames the **field** and every TypeScript consumer at once. This is the only split that keeps `main` compiling at every step: the pre-commit hook typechecks all four workspace projects, so a shared-type rename cannot be spread across commits.

**Tech Stack:** PostgreSQL, Prisma 6, NestJS, React, TypeScript, Vitest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-07-self-hosted-auth-design.md` (slice 1 of 5).

## Global Constraints

- **Node 22 is required.** The shell may default to v18, which makes every `pnpm` command fail with "This version of pnpm requires at least Node.js v22.13". Start every session with: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.16.0`
- **This slice changes no behavior.** The column type stays `VARCHAR(128)` — Firebase UIDs are 28-character strings, not UUIDs (see `packages/db/src/seed.ts:289`). Retyping to `uuid` happens in slice 2.
- **Never edit an existing migration** in `packages/db/prisma/migrations/`. They are applied history. The two files containing `external_uid` (`20260507000000_init`, `20260716201440_platform_users`) stay exactly as they are.
- **Do not touch Firebase.** `firebase-auth.provider.ts` and `auth-provider.interface.ts` are renamed like any other consumer; their logic is untouched.
- English everywhere except user-facing UI strings (which this slice does not touch).
- 2-space indentation; `snake_case` for DB columns, `camelCase` for TypeScript.
- Zero lint errors (`pnpm lint`), zero failing tests (`pnpm test`), 95% per-file coverage (`pnpm test:coverage`).
- Move `apps/web/.env` aside before running coverage — it flips a fallback branch in `logger.ts` and fails the web coverage gate. Move it back afterward.
- No `TODO`, `FIXME`, `HACK`, or `XXX` comments — ESLint `no-warning-comments` fails CI.
- Conventional commits, **subject entirely lower-case** (commitlint rejects capitals), with trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## A note on TDD

This slice is a pure rename with no new behavior, so there is no failing test to write first. The existing suite **is** the safety net: roughly 200 occurrences across 68 files, including 15 in `auth.guard.spec.ts` and 7 in `users.repository.spec.ts`. The test cycle for every task is therefore: **green before → change → green after.** Do not invent new tests to satisfy the TDD habit; a test asserting that a field is called `identityId` tests the compiler, not the system.

## File Structure

| File | Change |
| --- | --- |
| `packages/db/prisma/schema.prisma` | `@map` in Task 1; field name + `@@index` in Task 2 |
| `packages/db/prisma/migrations/<ts>_rename_external_uid_to_identity_id/migration.sql` | Created in Task 1, hand-written |
| `packages/db/src/seed.ts` | Field keys renamed (Task 2); the Firebase UID **values** stay |
| `packages/shared/src/types/auth.ts` | `AuthUser.externalUid`, `PlatformPrincipal.externalUid` |
| `packages/shared/src/schemas/auth.ts` | Zod field |
| `apps/api/src/common/guards/auth.guard.ts` | Both lookup paths |
| `apps/api/src/common/audit-log/redact.ts` | Redaction key string |
| `apps/api/src/modules/users/users.repository.ts` | `findByExternalUid` → `findByIdentityId` |
| `apps/api/src/modules/platform-users/platform-users.repository.ts` | same |
| `apps/api/src/modules/{users,platform-users,identity,onboarding,auth}/*.ts` | Consumers |
| `apps/api/src/scripts/create-institution.ts` | Bootstrap CLI |
| `apps/api/src/test/db-test-utils.ts` | Fixture builders |
| `apps/web/src/**` | Type consumers and test fixtures only |
| `CHANGELOG.md` | Entry in Task 3 |

---

### Task 1: Rename the database column only

The Prisma field keeps its name, so **no TypeScript changes** and the whole workspace still compiles. This isolates the risky part (a schema migration) into a commit that can be reviewed and reverted on its own.

**Files:**
- Modify: `packages/db/prisma/schema.prisma:58`, `packages/db/prisma/schema.prisma:808`
- Create: `packages/db/prisma/migrations/20260807120000_rename_external_uid_to_identity_id/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: DB columns `users.identity_id` and `platform_users.identity_id`. The Prisma client is byte-for-byte unchanged — `prisma.user.findUnique({ where: { externalUid } })` still works.

- [ ] **Step 1: Confirm the suite is green before touching anything**

```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 22.16.0
pnpm test
```

Expected: PASS. If anything is already failing, stop and report — do not start a rename on a red suite.

- [ ] **Step 2: Point the Prisma fields at the new column name**

In `packages/db/prisma/schema.prisma`, change **only the string inside `@map`** on both models — from `"external_uid"` to `"identity_id"`. The field name stays `externalUid` in this task; it is renamed in Task 2.

Line 58 (`model User`) becomes exactly:

```prisma
  externalUid   String    @unique @map("identity_id") @db.VarChar(128)
```

Line 808 (`model PlatformUser`) becomes exactly:

```prisma
  externalUid String    @unique @map("identity_id") @db.VarChar(128)
```

Leave `@@index([externalUid])` on lines 93 and 817 untouched — it references the Prisma field, which has not changed.

- [ ] **Step 3: Hand-write the migration**

Prisma does **not** detect column renames. Running `prisma migrate dev` here would generate `DROP COLUMN` + `ADD COLUMN`, destroying every identity and then failing on the `NOT NULL UNIQUE` constraint. Write the migration by hand instead.

Create `packages/db/prisma/migrations/20260807120000_rename_external_uid_to_identity_id/migration.sql`:

```sql
-- Rename the identity join column now that Rezeta will mint the value itself
-- (self-hosted auth design, slice 1). Column type is deliberately unchanged:
-- Firebase still issues 28-character UIDs, so the retype to uuid waits for
-- slice 2.
ALTER TABLE "users" RENAME COLUMN "external_uid" TO "identity_id";
ALTER TABLE "platform_users" RENAME COLUMN "external_uid" TO "identity_id";

ALTER INDEX "users_external_uid_key" RENAME TO "users_identity_id_key";
ALTER INDEX "users_external_uid_idx" RENAME TO "users_identity_id_idx";
ALTER INDEX "platform_users_external_uid_key" RENAME TO "platform_users_identity_id_key";
ALTER INDEX "platform_users_external_uid_idx" RENAME TO "platform_users_identity_id_idx";
```

The index names are the ones Postgres actually holds — verified in `20260507000000_init/migration.sql:484,490` and `20260716201440_platform_users/migration.sql:16,19`. Renaming them keeps Prisma's drift detection quiet, since Prisma derives expected index names from the column name.

- [ ] **Step 4: Apply the migration and regenerate the client**

```bash
pnpm --filter @rezeta/db migrate:deploy
pnpm --filter @rezeta/db generate
```

Use `migrate:deploy`, not `migrate:dev` — deploy applies pending migrations as written, without a shadow database and without trying to regenerate SQL from a schema diff.

- [ ] **Step 5: Verify the rename landed and nothing else moved**

```bash
pnpm --filter @rezeta/db exec prisma migrate status
pnpm -r typecheck
```

Expected: migrate status reports no pending migrations and no drift, and the typecheck **passes across all four projects**. The typecheck is the real proof here: `packages/db/generated` is gitignored, so a `git diff` against it would be empty no matter what and prove nothing. If typecheck fails with `Property 'externalUid' does not exist`, the field name was renamed by accident in Step 2 — revert to `externalUid` and change only the `@map` string.

- [ ] **Step 6: Run the full suite, including integration tests**

```bash
pnpm test
pnpm --filter @rezeta/api test:integration
```

Expected: PASS. The integration tests write and read `User` and `PlatformUser` rows against real Postgres, so they are what actually proves the column rename worked.

- [ ] **Step 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "refactor(db): rename external_uid column to identity_id

Renames the column only. The Prisma field stays externalUid via @map, so
the generated client and every TypeScript consumer are unchanged and the
workspace typecheck is unaffected; the field rename follows separately.

Written by hand because Prisma does not detect column renames and would
have generated a destructive DROP/ADD pair. Column type stays VARCHAR(128)
until slice 2, since Firebase UIDs are not uuids.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Rename the Prisma field and every TypeScript consumer

One commit, by necessity: the pre-commit hook runs `pnpm -r typecheck` across all four workspace projects, so renaming `AuthUser.externalUid` in `packages/shared` without simultaneously updating `apps/api` and `apps/web` fails the hook.

**Files:**
- Modify: `packages/db/prisma/schema.prisma:58,93,808,817`
- Modify: ~65 TypeScript files across `apps/api`, `apps/web`, `packages/shared`, `packages/db/src/seed.ts`
- Modify (manually, after the codemod): `apps/api/src/modules/auth/auth.controller.ts:160`, `apps/api/src/test/db-test-utils.ts`, `apps/web/src/test/auth-helpers.ts`

**Interfaces:**
- Consumes: the renamed columns from Task 1.
- Produces:
  - `AuthUser.identityId: string` and `PlatformPrincipal.identityId: string` (`packages/shared/src/types/auth.ts`)
  - `UsersRepository.findByIdentityId(identityId: string): Promise<UserWithTenant | null>`
  - `PlatformUsersRepository.findByIdentityId(identityId: string): Promise<PlatformUser | null>`
  - `VerifiedToken.identityId: string` (`apps/api/src/lib/auth/auth-provider.interface.ts`)
  - `OnboardingService.seedDefault(identityId, locale?)` and `seedCustom(identityId, input)`

- [ ] **Step 1: Rename the Prisma field**

In `packages/db/prisma/schema.prisma`, line 58:

```prisma
  identityId    String    @unique @map("identity_id") @db.VarChar(128)
```

Line 93:

```prisma
  @@index([identityId])
```

Line 808:

```prisma
  identityId  String    @unique @map("identity_id") @db.VarChar(128)
```

Line 817:

```prisma
  @@index([identityId])
```

- [ ] **Step 2: Regenerate the Prisma client**

```bash
pnpm --filter @rezeta/db generate
```

- [ ] **Step 3: Confirm the codebase is now broken**

```bash
pnpm -r typecheck
```

Expected: FAIL, with many `Property 'externalUid' does not exist` errors across `apps/api`. This is the rename's stand-in for a failing test — it enumerates precisely the call sites that must change. Note the error count; Step 5 expects it to reach zero.

- [ ] **Step 4: Run the codemod**

`externalUid` is a distinctive identifier that appears in no other context, so a word-boundary replace is safe. Use `perl` rather than `sed` — BSD `sed` on macOS does not support `\b`.

```bash
grep -rl 'externalUid' apps packages --include='*.ts' --include='*.tsx' \
  | grep -v node_modules | grep -v '/dist/' | grep -v '/generated/' \
  | xargs perl -pi -e 's/\bexternalUid\b/identityId/g'
```

The exclusions matter: `/generated/` is the Prisma client (regenerated, never hand-edited) and `/dist/` is build output. Migrations are excluded automatically — the `--include` filters admit only `.ts` and `.tsx`, so no `.sql` file can be touched.

This also correctly renames method names (`findByExternalUid` → `findByIdentityId`), the redaction key string in `redact.ts:2`, and prose inside comments.

- [ ] **Step 5: Verify the typecheck is clean**

```bash
pnpm --filter @rezeta/db generate && pnpm -r typecheck
```

Expected: PASS, all four projects.

- [ ] **Step 6: Fix the three occurrences the codemod cannot see**

These use different casing or embed the old name in a string value, so the word-boundary match skips them.

`apps/api/src/modules/auth/auth.controller.ts:160` — the Swagger example still reads `abc123externaluid`:

```ts
        identityId: { type: 'string', example: 'a3f1c2d4-5b6e-4a7f-8c9d-0e1f2a3b4c5d' },
```

`apps/api/src/test/db-test-utils.ts:110,127` — fixture values prefixed `ext-`:

```ts
      identityId: `identity-${uid}`,
```

```ts
      identityId: `platform-identity-${uid}`,
```

`apps/web/src/test/auth-helpers.ts:12` — the value `'fb-uid'` names Firebase, which is exactly the association this slice removes:

```ts
    identityId: 'test-identity-id',
```

- [ ] **Step 7: Run lint and the full suite**

```bash
pnpm lint
pnpm test
pnpm --filter @rezeta/api test:integration
```

Expected: all PASS. If a test fails on an assertion about a *value* (for example a fixture string), fix the assertion. If one fails on behavior, stop — a pure rename cannot change behavior, so it means the codemod hit something it should not have.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: rename externalUid field to identityId

Renames the Prisma field and every TypeScript consumer: shared AuthUser and
PlatformPrincipal types, the zod schema, both repositories' findByExternalUid
methods, AuthGuard's two lookup paths, the identity and onboarding services,
the bootstrap CLI, the audit-log redaction key, and all fixtures.

Lands as one commit because the pre-commit hook typechecks the whole
workspace; splitting a shared-type rename across packages breaks the build
mid-sequence.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Verification sweep and changelog

**Files:**
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: everything from Tasks 1 and 2.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Prove no stray references survive**

```bash
grep -rn "externalUid" apps packages --include='*.ts' --include='*.tsx' --include='*.prisma' \
  | grep -v node_modules | grep -v '/dist/' | grep -v '/generated/'
```

Expected: **no output.**

```bash
grep -rn "external_uid" apps packages --include='*.ts' --include='*.tsx' --include='*.prisma' \
  | grep -v node_modules | grep -v '/dist/' | grep -v '/generated/'
```

Expected: **no output.** (Historical migration `.sql` files still contain `external_uid` and must — they are excluded by the `--include` filters.)

- [ ] **Step 2: Run the coverage gate**

```bash
mv apps/web/.env /tmp/web.env.bak
pnpm test:coverage
mv /tmp/web.env.bak apps/web/.env
```

Expected: PASS at the 95% per-file threshold. Coverage should be unchanged from before the slice — renaming an identifier moves no branches. A drop means a test was accidentally deleted or skipped.

- [ ] **Step 3: Prepend the changelog entry**

Add to the top of `CHANGELOG.md`, directly under the format preamble:

```markdown
## [2026-08-07] Rename external_uid to identity_id (self-hosted auth, slice 1)

### Changed

- Renamed the identity join column on `users` and `platform_users` from
  `external_uid` to `identity_id`, with a hand-written migration
  (`20260807120000_rename_external_uid_to_identity_id`) that renames the
  columns and their four indexes rather than dropping and recreating them.
  The column type stays `VARCHAR(128)`; the retype to `uuid` follows in
  slice 2, once Rezeta mints the values instead of Firebase.
- Renamed the Prisma field and every TypeScript consumer to `identityId`:
  `AuthUser` and `PlatformPrincipal` in `packages/shared/src/types/auth.ts`,
  the zod schema in `packages/shared/src/schemas/auth.ts`,
  `UsersRepository.findByIdentityId`,
  `PlatformUsersRepository.findByIdentityId`, both lookup paths in
  `apps/api/src/common/guards/auth.guard.ts`, the identity and onboarding
  services, `apps/api/src/scripts/create-institution.ts`, and the audit-log
  redaction key in `apps/api/src/common/audit-log/redact.ts`.
- No behavior change: the value is still issued by Firebase and still
  resolves a verified token to a `User` or `PlatformUser` row.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for the identity_id rename

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Verification

- `pnpm lint`, `pnpm test`, `pnpm --filter @rezeta/api test:integration`, and `pnpm test:coverage` all clean.
- Both `grep` sweeps in Task 3 Step 1 return nothing.
- `prisma migrate status` reports no drift.
- Manual smoke on dev after deploy, since no unit test exercises a real Firebase token end to end:
  1. Sign in as an institution user on `app-dev.rezeta.co` → `/dashboard`.
  2. Sign in as `staff@rezeta.co` on `staff-dev.rezeta.co` → `/staff/institutions`.
  3. Create an institution user in Ajustes → Usuarios and confirm the row gets an `identity_id`.

## Out of scope

- Retyping `identity_id` to `uuid` — slice 2, once we mint the values.
- Any new table, endpoint, or Passport strategy — slices 2 through 4.
- Removing Firebase — slice 5.
- `OnboardingService` taking an identity string rather than a `User.id`. It is an existing oddity, unrelated to this rename, and changing it would hide a behavioral edit inside a mechanical commit.

## Dependencies

Slice 1 assumes `refactor/auth-identity-resolution` has merged to `main`. That branch is currently unpushed and still needs its manual dev verification. Starting this slice on top of an unmerged branch guarantees a `CHANGELOG.md` conflict later.
