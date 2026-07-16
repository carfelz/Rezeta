# Permissions & Multi-User — Design

> STATUS: DESIGN (approved 2026-07-15). Source of truth for the roles, permission
> matrix, multi-user provisioning, and staff-platform work. Implementation is
> sliced (see §12); each slice gets its own plan under `docs/superpowers/plans/`.

## 1. Summary

Today Rezeta is effectively single-user: every sign-up self-creates a `Tenant`
with one `owner`, and there is no role enforcement. This feature turns a tenant
into a multi-user **institution** with four ordered roles, an editable
per-institution permission matrix, internal (non-self-service) user creation, and
a cross-institution **platform** layer operated by Rezeta staff.

Nothing here changes the multi-tenancy invariant: every record still carries
`tenant_id` and every repository still filters by it. The one deliberate
exception is the platform admin (§8), which is isolated and audited.

## 2. Decisions (locked)

These were settled during brainstorming and are not open for re-litigation inside
the implementation plans:

1. **Institution = Tenant.** Reuse the existing `Tenant` model as the institution.
   No rename, no new parent entity.
2. **Institutions are staff-created.** There is no public self-service institution
   creation. Rezeta platform staff create an institution and its initial
   `super_admin` from the staff platform (§7).
3. **Four institution roles, one per user**, ordered by privilege rank:
   `assistant` (1) < `doctor` (2) < `admin` (3) < `super_admin` (4).
4. **Platform admin is a separate, cross-institution concept** (§8), not one of the
   four institution roles. Built in this milestone ("owner + full platform admin").
5. **Per-institution editable permissions.** Each institution stores and can edit
   its own role→permission mappings, seeded from a code-defined catalog.
6. **Section-level control is a bulk-apply convenience**, not a stored tier
   (§6). Storage stays flat per-module.
7. **No public signup.** Users are created internally with a role chosen at
   creation time; the self-signup route is removed (§5).

## 3. Roles

### 3.1 Institution roles

| Role | Rank | Meaning |
| --- | --- | --- |
| `assistant` | 1 | Support / receptionist. Restricted (see matrix). |
| `doctor` | 2 | Full clinical access. **Not** the new admin-only features. |
| `admin` | 3 | Everything, including user + permission management. |
| `super_admin` | 4 | Institution owner. Replaces today's `owner`. |

- Exactly one role per user (`User.role`).
- Migration: existing `owner` → `super_admin`; existing `doctor` stays `doctor`.
- The shared role enum (`packages/shared`), `AuthUser.role`, and `UserApiSchema`
  are widened from `owner | doctor` to the four roles above.

### 3.2 Rank rule (applies everywhere)

**A user may only act on ranks strictly below their own — never their own rank,
never higher.** This governs:

- Assigning / changing another user's role.
- Editing a role's permission mappings.
- Activating / deactivating a user.

So `admin` (3) manages `doctor` and `assistant`; `super_admin` (4) manages
`admin`, `doctor`, `assistant`; nobody edits their own level or above. Enforced in
the service layer, not only in the UI.

## 4. Permission model

### 4.1 Permission catalog (code-defined)

A static registry is the source of *structure*: `section → module`, plus each
module's default access level per role. Access levels are ordered:
`none` (0) < `view` (1) < `manage` (2). GET-style reads require `view`;
mutations require `manage`.

The catalog also defines, for each module, which API surface it guards (used by
the backend decorator) and which nav entry / route it maps to (used by the
frontend).

### 4.2 `RolePermission` table (per-tenant, editable)

```
RolePermission
  id           uuid pk
  tenant_id    uuid  -> tenants.id
  role         enum  (assistant | doctor | admin | super_admin)
  module_key   text  (stable key from the catalog, e.g. "patients")
  access_level enum  (none | view | manage)
  created_at, updated_at
  @@unique([tenant_id, role, module_key])
  @@index([tenant_id])
```

- Seeded from the catalog defaults when a tenant is created (tenant-seeding
  already exists; this hooks into it).
- Editable via the Permissions module (§6), subject to the rank rule.
- **Resolution merges code defaults with stored rows** (stored wins; a module with
  no stored row falls back to its catalog default). This keeps tenants seeded
  before a new module was added working — the new module resolves to its default
  rather than being missing/`none`.

### 4.3 Default matrix

Sections group modules for the bulk control (§6); they are not stored.

| Module | assistant | doctor | admin | super_admin |
| --- | --- | --- | --- | --- |
| **Clinical work** | | | | |
| patients | view | manage | manage | manage |
| consultations | view | manage | manage | manage |
| protocols | none | manage | manage | manage |
| appointments | manage | manage | manage | manage |
| orders | manage | manage | manage | manage |
| billing | manage | manage | manage | manage |
| **Admin** | | | | |
| locations | none | manage | manage | manage |
| templates | none | manage | manage | manage |
| categories | none | manage | manage | manage |
| schedules_config | none | manage | manage | manage |
| audit_log | none | manage | manage | manage |
| users | none | **none** | manage | manage |
| permissions | none | **none** | manage | manage |

Two deliberate calls:

- **`doctor` excludes `users` and `permissions`** — these are the new admin-only
  features; a plain doctor keeps everything that exists today but does not manage
  teammates or permissions.
- **`billing` lives under Clinical work** so `assistant` gets it via "everything
  else." It is operational rather than clinical; the section assignment is
  code-only and trivial to move later.

## 5. Users module & provisioning rework

### 5.1 No public signup

Remove the public self-signup path: the `/signup` route/UI and the
`SignUpSchema`-driven flow. Provisioning no longer auto-creates a tenant. The only
public auth screens are **Sign In** and a **set-password / first-login** screen.

### 5.2 Internal user creation

An `admin`/`super_admin` (or staff) creates a user inside their institution,
choosing the role at creation time. Mechanism:

1. Backend creates the Firebase account via the **Admin SDK**, receiving the
   `externalUid` immediately.
2. Backend writes a fully-provisioned `User` row (tenant, role, name, email,
   `externalUid`) — no pending/nullable `externalUid`, no separate invitation
   table, no email-matching at first login.
3. Backend sends a **set-password / first-login email** (a Firebase password-reset
   link). The user appears in the list immediately with a "invitation sent"
   status until they first sign in.

**Dependency:** this requires Firebase Admin SDK user creation and a
transactional email. In dev the email may be stubbed/logged; the set-password link
is still generated.

### 5.3 Endpoints & UI

- Endpoints (all under the rank rule): list users in tenant, create user,
  change role, activate/deactivate (soft-delete via `deleted_at` / `is_active`).
- UI under `/ajustes`: user list (name, email, role badge, status) + a create
  form with a role selector.

## 6. Permissions module

A matrix UI — roles (columns) × modules (rows), grouped by section — under
`/ajustes`.

- **Per-module cell:** `none | view | manage` selector.
- **Section header control (bulk-apply):** a per-role control that stamps the
  chosen level onto every module in that section in one action. It is **not**
  stored. It reflects the modules beneath it: the shared level if they all match,
  or **"Mixto"** if they differ. After a bulk-apply, individual modules remain
  editable.
- Editing (both per-module and section controls) is enabled only for roles
  strictly below the editor's rank.
- Backend enforcement is always per-module; the section control never reaches the
  API as its own concept.
- A module added to the catalog later falls back to its **code default**, not any
  section setting (the accepted tradeoff vs. an inherited section tier).
- Read/update endpoints operate on `RolePermission` rows and emit audit events.

## 7. Staff platform (institution creation)

Because there is no self-service signup, the staff platform is the only entry
point into the system and is therefore in scope for this milestone.

- **Create institution:** staff supply institution name, type, plan, and the
  initial `super_admin`'s name + email. This creates the `Tenant`, seeds its
  `RolePermission` rows and starter data, and creates the initial `super_admin`
  user via the §5.2 flow (Admin SDK + set-password email).
- For dev bootstrapping before the staff UI exists, a seed/CLI performs the same
  operation.

## 8. Platform admin (cross-institution)

A Rezeta-staff capability that operates across tenants — the one deliberate break
in tenant isolation.

- Modeled as `User.isPlatformAdmin` (boolean) plus a dedicated guard path that,
  for platform-admin requests, does not apply the tenant filter.
- Cross-tenant access is explicit (staff select the target institution) and
  **always audited** with the acting user and target tenant.
- This is the highest-risk slice; it is built last and kept isolated from the
  normal request path so the default "every query filters `tenant_id`" guarantee
  is never weakened for ordinary users.

## 9. Enforcement

### 9.1 Backend

- New `@RequirePermission(module, level)` decorator + `PermissionGuard` (the
  `RolesGuard` the technical-architecture spec always anticipated). The guard
  resolves the user's role → the tenant's `RolePermission` → effective level, and
  checks `effective >= required`.
- Every existing controller is annotated: GET routes require `view`, mutations
  require `manage`, against the module that owns them.
- New `ErrorCode.INSUFFICIENT_PERMISSION` (closed enum in
  `packages/shared/src/errors.ts`). Returns HTTP 403.
- Platform-admin requests bypass tenant + permission checks via the §8 path.

### 9.2 Frontend

- The resolved capability map (`{ module_key: access_level }`) is delivered on
  `/v1/auth/me` and stored in the auth store.
- A `useCan(module, level)` hook drives: nav filtering, route guards,
  action/button gating, and **read-only rendering** for `view`-only modules
  (e.g. an assistant sees patients and consultations but no create/edit controls).

## 10. Audit

Reuse the reserved audit actions and add the missing ones:

- Existing: `permission_granted`, `permission_revoked`.
- Add: `role_changed`, `user_invited`, `user_deactivated`.
- Platform-admin cross-tenant access is always recorded (actor + target tenant).

## 11. Pricing (out of scope, model-ready)

Future pricing is expected to key off doctors + assistants + protocols per
institution. Those counts are already derivable from `User.role` and existing
protocol rows. **No enforcement or metering is built in this milestone**; the
model simply does not obstruct it later.

## 12. Slices

One design doc, implemented in ordered slices — each its own plan/PR:

1. **Roles foundation** — role enum widening + `owner → super_admin` migration +
   shared types/`AuthUser`/`UserApiSchema`. No behavior change.
2. **Permission catalog + `RolePermission`** — table, seeding hook, and capability
   resolution surfaced on `/auth/me`.
3. **Backend enforcement** — `PermissionGuard` + `@RequirePermission` + annotate
   all controllers + `INSUFFICIENT_PERMISSION`.
4. **Frontend gating** — capability in the store, `useCan`, nav/route/action
   gating, read-only modes.
5. **Provisioning rework** — remove self-signup; internal user creation via Admin
   SDK + role select + set-password email; Users module UI.
6. **Permissions module** — matrix UI (per-module + section bulk-apply) + edit
   endpoints + rank rule.
7. **Staff platform + platform admin** — create-institution flow + cross-
   institution admin. Isolation-sensitive; may warrant its own follow-up spec.

## 13. Non-goals (this milestone)

- Pricing/metering/enforcement.
- Multiple roles per user, or per-user capability overrides beyond the role.
- Inherited section tiers (section is bulk-apply only).
- Custom institution-defined roles beyond the four.
- Cross-tenant sharing of clinical data between institutions.
