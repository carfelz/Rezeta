# Staff Institutions List — Design

**Date:** 2026-07-28
**Status:** Approved for later implementation (spec only — no plan written yet)
**Origin:** Gap found after identity slice 1 shipped: staff can create institutions
(`POST /v1/staff/institutions`, permissions design §7) but have no way to see
them. The staff-console "Institutions" nav link currently points at the create
form because no list page exists. The identity design's screen 4 shows a
per-institution *security activity* table (slice 5), which is not a roster and
does not cover this.

## 1. Summary

A read-only institutions roster in the staff console: one new
`GET /v1/staff/institutions` endpoint and one new list page at
`/staff/institutions`, with the create form reached from it. No changes to
institution creation itself.

## 2. Decisions

1. **Read-only this slice.** List + navigate to create. No edit, deactivate,
   plan-change, or detail view — those are separate features (institution
   editing has never been specced; staff access to tenant data is a locked
   non-goal of the permissions design).
2. **No pagination initially.** Institutions are staff-created and low-volume
   (tens, not thousands). Return all, ordered by `createdAt` desc. Revisit if
   the roster outgrows a single response (the audit-log cursor pattern is the
   established precedent when needed).
3. **Counts via one grouped query.** User counts come from a single
   `groupBy(tenantId)` over active users, not N+1 per-tenant queries.

## 3. API

`GET /v1/staff/institutions` on the existing `StaffController`
(`@PlatformRoute()`-gated like its siblings; platform principal required).

Response item (`StaffInstitutionDto`, new Zod schema in
`packages/shared/src/schemas/staff.ts` alongside `CreateInstitutionSchema`):

| Field | Source |
| --- | --- |
| `id` | `Tenant.id` |
| `name` | `Tenant.name` (nullable) |
| `type` | `Tenant.type` (`solo` / `practice` / `clinic` / `enterprise`) |
| `plan` | `Tenant.plan` (`free` / `solo` / `practice` / `clinic`) |
| `createdAt` | ISO string |
| `userCount` | count of `User` rows with `deletedAt: null` for the tenant |
| `activeUserCount` | subset with `isActive: true` |

Service method `StaffService.listInstitutions(): Promise<StaffInstitutionDto[]>`.
No audit entry — reads are not audited anywhere in the system.

## 4. Web

- **Route:** `/staff/institutions` (list). `/staff/institutions/new` keeps the
  create form. The `/staff` index redirect and the "Institutions" nav link both
  point at the list.
- **Page:** `Institutions.tsx` in `apps/web/src/pages/staff/`, mirroring the
  platform-users roster: heading + subtitle, primary "New institution" button
  (links to the create form), bordered table — columns Institution (name, with
  type as sub-text), Plan (mono badge, as in the identity mockups' screen 4),
  Users (`activeUserCount` of `userCount`), Created. Empty state when no
  institutions exist. English copy in `staffStrings` / a new
  `institutionsStrings` export.
- **Post-create:** the create form's success state gains a "Back to list" link;
  creating an institution invalidates the list query.
- **Hook:** `useStaffInstitutions()` in `apps/web/src/hooks/staff/`, same
  pattern as `useStaffPlatformUsers`.

## 5. Testing

- Service spec: mapping + grouped-count query shape; controller spec:
  delegation (mirror `staff.controller.spec.ts`).
- Integration spec (real Postgres): seed two tenants with users, assert counts
  and ordering.
- Page test: roster rendering, empty state, nav/new-institution links (mirror
  `PlatformUsers.test.tsx`).

## 6. Non-goals

- Editing/deactivating institutions, plan management, per-institution detail
  pages.
- Staff visibility into any tenant clinical data (unchanged locked invariant).
- Search/filter/pagination (until volume demands it).
- Security metrics per institution — that remains identity slice 5 (screen 4).

## 7. Implementation notes (for the future plan)

- Single slice, one plan. Depends only on code already on `main` (slice 1).
- Touches `StaffLayout` nav — coordinate with the roster-overflow follow-up
  (task chip) if it hasn't merged when this is planned.
