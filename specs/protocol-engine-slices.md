# Protocol Engine — Slice Tracker

> Living document. Last updated: April 2026.
>
> This document tracks the implementation of the protocol engine across vertical slices. Each slice is small, end-to-end, and demoable on its own. Completed slices are marked; in-progress and pending slices are detailed so they can be picked up without rereading the whole history.

## Table of Contents

1. [Architectural Decisions](#1-architectural-decisions)
2. [Slice Status Overview](#2-slice-status-overview)
3. [Slice 0 — Foundation (Superseded)](#3-slice-0--foundation-superseded)
4. [Slice 1 — Browse System Templates (Superseded)](#4-slice-1--browse-system-templates-superseded)
5. [Auth Slice](#5-auth-slice)
6. [Slice A — Schema Rework](#6-slice-a--schema-rework)
7. [Slice B — Tenant Seeding Service](#7-slice-b--tenant-seeding-service)
8. [Slice C — Template Editor](#8-slice-c--template-editor)
9. [Slice D — Type CRUD](#9-slice-d--type-crud)
10. [Slice E — Onboarding Flow](#10-slice-e--onboarding-flow)
11. [Slice 2+3 — Create & View Protocols](#11-slice-23--create--view-protocols)
12. [Slice 4 — Edit Simple Blocks](#12-slice-4--edit-simple-blocks)
13. [Slice 5 — Edit Collection Blocks](#13-slice-5--edit-collection-blocks)
14. [Slice 6 — Sections](#14-slice-6--sections)
15. [Slice 7 — Browse, Search, Favorites](#15-slice-7--browse-search-favorites)
16. [Slice 8 — Version History & Restore](#16-slice-8--version-history--restore)
17. [Out-of-MVP — Explicitly Deferred](#17-out-of-mvp--explicitly-deferred)

---

## 1. Architectural Decisions

These decisions shape every slice. If you're picking up this work, read this section first.

### 1.1 The Three-Layer Model

The protocol engine is built on three layers: `ProtocolTemplate` (blueprint) → `ProtocolType` (user-facing category) → `Protocol` (instance). Protocols belong to types; types point at templates. This is the load-bearing decision for the whole engine.

**Implications for every slice:**

- Doctors never see templates in the protocol creation flow. They see types.
- A protocol cannot exist without a type; a type cannot exist without a template.
- The template behind a type is immutable once the type is created (swapping templates would invalidate protocols).
- Templates are tenant-owned, not system-owned — every tenant has its own copies of starter templates, seeded at signup.

See `protocol-template-schema.md` Section 2 for the authoritative spec.

### 1.2 Lock Rules

The lock rule cascades through the layers:

- A **template** is locked (no edits, no delete) iff any non-deleted `ProtocolType` in the tenant references it. **Total lock**, not partial — name, structure, placeholder hints all frozen.
- A **type** is locked (no delete, no template reassignment) iff any non-deleted `Protocol` references it. **Rename is always allowed** (safe because protocols reference types by ID).
- `ProtocolType.template_id` is immutable after creation regardless of lock state.

These rules are enforced in the **service layer**, not just the UI. Any slice touching templates or types must uphold them on the server.

### 1.3 Template Authoring Belongs in `/ajustes/plantillas`

Templates are browseable only in the settings surface (`/ajustes/plantillas`), never in the protocol creation flow. The protocol creation flow uses a **type picker** — the type is the user-facing concept; the template is infrastructure.

**Current state (Slice 1):** `/protocolos` currently shows the 5 seeded templates as a gallery from the old model. **This is legacy scaffolding** that Slice 2+3 replaces with the user's protocol library.

### 1.4 No Separate Backoffice — But There Are Settings Surfaces

MVP has no admin site / backoffice. Template and type management happen in the tenant's own settings:

- `/ajustes/plantillas` — template list + editor
- `/ajustes/tipos` — type list + editor

These are user-facing surfaces, not admin tools. Every doctor owns them for their own tenant.

### 1.5 One Shared Block Renderer

All places that render protocol content — mobile viewer, desktop editor (read-only preview), future consultation integration — use the **same** block renderer component. Build it once, use it everywhere. Editor interactivity is a layer _on top of_ this renderer, not a rewrite of it.

The **template editor** is different: it renders the same blocks but strips out their content and shows only structural metadata (type chip, title, required toggle, placeholder hint). See `template-editor-ux.md` Section 4.

### 1.6 Entity Model

| Entity             | Purpose                                                                                 | Tenant scoping           |
| ------------------ | --------------------------------------------------------------------------------------- | ------------------------ |
| `ProtocolTemplate` | Reusable structural blueprint                                                           | **Required** `tenant_id` |
| `ProtocolType`     | User-facing category pointing at a template                                             | **Required** `tenant_id` |
| `Protocol`         | A tenant-owned instance derived from a type                                             | **Required** `tenant_id` |
| `ProtocolVersion`  | Immutable snapshot of a protocol's content at a point in time                           | **Required** `tenant_id` |
| `ProtocolUsage`    | Placeholder for v2 (protocol-in-consultation tracking); table exists, not actively used | **Required** `tenant_id` |

`Protocol.type_id` is required and immutable after creation (the doctor cannot reparent a protocol onto a different type).
`ProtocolType.template_id` is required and immutable after creation.
`Tenant.seeded_at` is a timestamp (nullable) that is set when onboarding completes (see Slice E). It gates protocol engine access.

### 1.7 Required Blocks Are Enforced by the Server, Not Just the UI

When a protocol is saved, the service resolves `protocol → type → template` and validates that every block the template marked `required: true` is present in the protocol content (by ID). Required blocks cannot have their type changed. The UI reinforces this by disabling delete buttons — but the UI is a convenience, not the enforcement boundary.

### 1.8 Onboarding Gates Protocol Access

No tenant can reach the main app until its `seeded_at` is set. A global route guard (Slice E) redirects unseeded tenants to `/bienvenido`. After onboarding, the invariants "≥1 template, ≥1 type" are only enforced _at the end of onboarding_ — if the doctor later deletes everything, the protocol creation UI degrades gracefully, but no forced re-onboarding occurs.

### 1.9 Build Order: Template Editor Before Protocol Editor

Slices A → B → C → D → E ship before Slice 2+3 resumes. This commits us to ~8–12 days of "scaffolding" before protocol CRUD returns. Rationale:

- The protocol creation flow depends on types existing (Slice D) and on at least one template/type pair existing per tenant (Slice E).
- Building the template editor first (Slice C) forces clean separation between structural block controls (row chip, required toggle, drag handle) and content editing controls (per-type input UIs) — entangling them is a known failure mode.
- After Slice E, a seeded tenant is fully usable for configuration even without the protocol editor. After Slice 2+3, the doctor can finally create clinical content.

The alternative ordering (protocol engine first, settings later) would ship core value faster but pay for reordering through retrofit work when the settings surfaces arrive. We accept the front-loaded scaffolding cost.

### 1.10 Spanish Microcopy from a Central Strings Module

All user-visible strings live in `apps/web/src/lib/strings.ts` (or similar). No hardcoded Spanish in components. This enables the English toggle (future) and makes copy reviews easy.

### 1.11 No New UI Primitives Mid-Slice

Every block type, form pattern, and layout fragment used in these slices is already in the design system (see `specs/design-system/components.md`). If a slice surfaces a genuine need for a new primitive, **pause** and decide whether it belongs in the system — don't build it inline.

---

## 2. Slice Status Overview

| #   | Slice                                                                                    | Status               | Size       | Notes                                                                          |
| --- | ---------------------------------------------------------------------------------------- | -------------------- | ---------- | ------------------------------------------------------------------------------ |
| 0   | Foundation (Prisma, Zod, seed)                                                           | ⚠️ Superseded by A   | 0.5 day    | Schema reflects old model; Slice A reworks it                                  |
| 1   | Browse system templates                                                                  | ⚠️ Superseded by 2+3 | 1–2 days   | `/protocolos` page replaced in Slice 2+3                                       |
| —   | Auth slice                                                                               | ✅ Done              | 2–3 days   | Firebase Auth + tenant isolation + dev seed                                    |
| A   | Schema rework (tenant-owned templates, ProtocolType, Protocol.type_id, Tenant.seeded_at) | ✅ Done              | 1–1.5 days | Destructive migration applied                                                  |
| B   | Tenant seeding service                                                                   | ✅ Done              | 1 day      | Fixtures + TenantSeedingService + integration tests                            |
| C   | Template editor (`/ajustes/plantillas`)                                                  | ✅ Done              | 4–5 days   | Full editor + lock enforcement + backend CRUD                                  |
| D   | Type CRUD (`/ajustes/tipos`)                                                             | ✅ Done              | 1–2 days   | List + create + rename + delete + integration tests                            |
| E   | Onboarding flow (`/bienvenido`)                                                          | ✅ Done              | 1–2 days   | Default + personalizar paths, route guards, backend + UI                       |
| 2+3 | Create & view protocols (via type picker)                                                | ✅ Done              | 3–4 days   | Uses types from D + seeded state from E                                        |
| 4   | Edit simple blocks (text + alert)                                                        | ✅ Done              | 2–3 days   |                                                                                |
| 5   | Edit collection blocks                                                                   | ✅ Done              | 3–5 days   | ChecklistBlockEditor, StepsBlockEditor, DecisionBlockEditor, DosageTableEditor |
| 6   | Sections                                                                                 | ✅ Done              | 1–2 days   | SectionEditor + appendToSection + palette section button                       |
| 7   | Browse, search, favorites                                                                | ⏸ Pending            | 2–3 days   | Includes filter-by-type                                                        |
| 8   | Version history & restore                                                                | ⏸ Pending            | 1–2 days   | Ships MVP complete                                                             |

**Legend:** ✅ Done · ⚠️ Superseded · ⏳ In progress / up next · ⏸ Pending · ❌ Blocked

**Total remaining MVP work:** ~15–24 days for Slices 2+3 through 8.

---

## 3. Slice 0 — Foundation (Superseded)

### Status: ⚠️ Superseded by Slice A

### What was done

Prisma models for `ProtocolTemplate` (nullable `tenant_id`, `is_system` flag), `Protocol` (with `template_id`), `ProtocolVersion`, `ProtocolUsage`. Zod schemas for block types and content envelopes. Seed script for 5 system templates with `tenant_id: null`.

### Why it's superseded

The data model has changed:

- Templates are no longer system-owned. `ProtocolTemplate.tenant_id` is now required; `is_system` is removed in favor of `is_seeded`.
- `ProtocolType` didn't exist; now it's a required middle layer.
- `Protocol.template_id` is removed in favor of `Protocol.type_id`.
- `Tenant.seeded_at` didn't exist; now it gates onboarding.
- The old seed script created system templates; the new seed model creates tenant-scoped copies only when onboarding runs.

### What to do with Slice 0's code

- **Keep:** Zod block-type schemas (catalog unchanged), `ProtocolVersion` / `ProtocolUsage` models (unchanged), unit tests for block validation.
- **Replace:** `ProtocolTemplate` model, `Protocol` model, seed script (becomes tenant-copy fixtures per Slice B).
- **Add:** `ProtocolType` model, `seeded_at` column on `Tenant`.

All of the above happens in Slice A.

---

## 4. Slice 1 — Browse System Templates (Superseded)

### Status: ⚠️ Superseded by Slice 2+3

### What was done

Backend `ProtocolTemplatesModule` with `GET /v1/protocol-templates` (auth stubbed). Frontend `/protocolos` page showing the 5 system templates as a card gallery.

### Why it's superseded

The old `/protocolos` page is scaffolding that assumed templates are the browse target. In the new model, `/protocolos` shows the user's **protocols**, and templates are never browsed from this page. Slice 2+3 replaces the implementation.

### What to do with Slice 1's code

- **Delete:** the system-template listing endpoint, the `/protocolos` template gallery UI.
- **Replace in Slice 2+3:** a new `/protocolos` page that lists the tenant's protocols, plus a "Nuevo protocolo" action that opens a type picker.

Template management UI lands in Slice C at `/ajustes/plantillas` — that's where templates will be visible in the new model.

---

## 5. Auth Slice

### Status: ✅ Done

### Goal

Replace the Slice 1 auth stub with real Firebase Auth + tenant isolation. New doctors can sign up; the app greets them with their real profile data; route guards redirect unauthenticated users to `/login`.

### Why before Slice A

The schema rework in Slice A needs to write `tenant_id` to real rows, which means the authenticated user must resolve to a real tenant. Stubbing this further creates retrofit pain.

### Scope summary

See the dedicated auth slice prompt for the full specification. In short:

- Firebase Auth (email/password only) + emulator for local dev
- `FirebaseAuthGuard` + `TenantGuard` + `@Public()` + `@CurrentUser()` + `@TenantId()`
- `POST /v1/auth/provision` (idempotent, special-cased for pre-existing DB user)
- `GET /v1/me`
- Frontend `useAuthStore` (Zustand), `<AuthGate>`, `<PublicOnlyGate>`, `redirectTo` query param support
- Dev seed (`seed:dev-users`) creating two test doctors (`dr.garcia@ejemplo.do`, `dra.reyes@ejemplo.do`) across two tenants for cross-tenant isolation testing
- Slice 1 stubs swapped for real guards

### Done when

- Sign up + login + logout work end-to-end against the emulator
- Protected routes redirect to `/login?redirectTo=...` when unauthenticated
- Dashboard greets user by name (from seeded data — no hardcoded values)
- Slice 1's `/protocolos` still shows the 5 seeded templates, now via real auth (this is legacy behavior that Slice 2+3 will remove — keeping it working in the interim is fine)
- Cross-tenant isolation verified: seeded user A cannot see tenant B data

### Note on Tenant Provisioning

The auth slice's `POST /v1/auth/provision` creates a `Tenant` row but does **not** seed it (does not set `seeded_at`, does not create templates or types). Seeding is explicitly gated behind the onboarding flow in Slice E. New tenants after the auth slice lands will be in an "unseeded" state — they can log in but cannot reach the main app until onboarding lands.

**During the interim between Auth and Slice E**, dev-seeded users (via `seed:dev-users`) should have `seeded_at` set manually in the seed script so the dev environment remains usable. Production-style signup will not work end-to-end until Slice E ships.

---

## 6. Slice A — Schema Rework

### Status: ✅ Done

### Goal

Bring the data model in line with the three-layer model specified in `protocol-template-schema.md`. This is the foundation slice that everything downstream depends on.

### In scope

**Prisma schema changes (`packages/db/prisma/schema.prisma`):**

- **`ProtocolTemplate`:**
  - `tenant_id` → `NOT NULL` (was nullable)
  - Add `is_seeded BOOLEAN DEFAULT false`
  - Remove `is_system` column
  - Remove the unique index on `template_key` (if it was added for system-template dedup)
- **New `ProtocolType` model:**
  - `id UUID PK`
  - `tenant_id UUID FK NOT NULL` (→ `Tenant`)
  - `name TEXT NOT NULL`
  - `template_id UUID FK NOT NULL` (→ `ProtocolTemplate`)
  - `is_seeded BOOLEAN DEFAULT false`
  - `created_at`, `updated_at`, `deleted_at TIMESTAMPTZ NULL`
  - Unique constraint on `(tenant_id, name)` for non-deleted rows
  - Index on `(tenant_id, template_id)`
- **`Protocol`:**
  - Remove `template_id`
  - Add `type_id UUID FK NOT NULL` (→ `ProtocolType`)
  - Add check that resolves protocol's tenant matches type's tenant (via database trigger or application-layer enforcement)
- **`Tenant`:**
  - Add `seeded_at TIMESTAMPTZ NULL`

**Destructive migration:**

Because no tenant has real data yet, the migration is allowed to be destructive:

- Drop existing `protocol_templates` rows (the 5 system-seeded ones). They'll be recreated per-tenant by Slice B.
- Drop existing `protocols` rows if any (there shouldn't be any in production; dev rows are fine to lose).
- Apply the schema changes.
- No data migration logic needed.

**Shared Zod schemas (`packages/shared`):**

- Add `ProtocolTypeSchema` (the entity), `CreateProtocolTypeSchema`, `UpdateProtocolTypeSchema` (rename only — template_id immutable)
- Update `ProtocolResponse` / `CreateProtocolRequest` to reference `type_id` instead of `template_id`
- Update `ProtocolTemplateSchema` for new fields (`tenant_id` required, `is_seeded`)
- Keep block-type and envelope schemas unchanged (they're catalog-level and already correct)

**Service-layer enforcement (baseline — expanded in later slices):**

The service layer contracts needed here (even though many aren't exercised until later slices):

- `ProtocolType.template_id` immutable after creation — reject PATCH requests that include it
- Cross-tenant reference checks: when creating a type, `template_id` must belong to the same tenant; when creating a protocol, `type_id` must belong to the same tenant
- Lock checks (deferred to Slices C, D — the DB allows the operations; the service rejects them)

**Tests:**

- Prisma migration applies cleanly to a fresh DB
- Unique constraint works: two types with same name in same tenant rejected; same name across tenants allowed
- Cross-tenant FK: creating a type pointing at another tenant's template fails
- Zod schemas pass unit tests

### Out of scope

- UI for templates, types, or protocols — those come in C/D/2+3
- Seeding logic — Slice B
- Lock rule enforcement in service calls — Slices C, D implement the CRUD that needs these checks
- Data migration from the old model — not needed (destructive migration)

### Done when

- Prisma migration runs cleanly on a dev DB
- `Tenant.seeded_at` defaults to null; Auth-slice dev seed updated to set it for test users
- Zod schemas updated and tests pass
- The API still builds and the existing Slice 1 endpoint still works (it'll return an empty list because no templates exist; we accept that until Slice B)

---

## 7. Slice B — Tenant Seeding Service

### Status: ✅ Done

### Goal

A reusable service that seeds a tenant with 5 starter templates and 5 matching types in one transaction. No HTTP surface yet — just the service and its fixtures. Slice E wires this to the onboarding endpoints.

### In scope

**Starter fixtures (`apps/api/src/lib/starter-fixtures/`):**

- Spanish template JSON files for all 5 starter templates (per `starter-templates.md` Sections 3–7)
- English counterparts (translations)
- A fixture loader that returns the right language based on an input parameter
- Fixtures are committed to source control, not database rows

**Seeder service (`apps/api/src/modules/tenant-seeding/` or similar):**

- `TenantSeedingService.seedDefault(tenantId, locale)`:
  - Opens a transaction
  - Locks the tenant row for update
  - Checks `tenant.seeded_at` is null (throws `TENANT_ALREADY_SEEDED` if set)
  - Inserts 5 `ProtocolTemplate` rows from the locale's fixtures with `is_seeded: true`
  - Inserts 5 `ProtocolType` rows pointing at them (names per the canonical list: Emergencia, Procedimiento, Medicación, Diagnóstico, Fisioterapia) with `is_seeded: true`
  - Sets `tenant.seeded_at = now()`
  - Commits
- `TenantSeedingService.seedCustom(tenantId, templates, types)`:
  - Same transactional wrapper
  - Takes user-provided template and type definitions (validated upstream — see Slice E)
  - Resolves client-side IDs in the types' `template_id` fields to the server-generated template UUIDs
  - Inserts all templates, then all types, then sets `seeded_at`

**Integration tests:**

- Default seed produces exactly 10 rows (5 templates, 5 types)
- Types correctly reference templates by ID
- All rows carry `is_seeded: true`
- Second call raises `TENANT_ALREADY_SEEDED`
- Rollback: forcing a mid-transaction failure leaves no rows and no `seeded_at`
- Locale selection: Spanish fixtures produce Spanish names, English fixtures produce English names
- Cross-tenant safety: seeding tenant A does not affect tenant B

### Out of scope

- HTTP endpoints — Slice E
- Onboarding UI — Slice E
- Route guards enforcing seeded state — Slice E
- Template editor — Slice C
- Type CRUD — Slice D

### Done when

- The service can be called from any caller (test, future HTTP handler) with a `tenantId` and a locale, and the result is a correctly seeded tenant
- Idempotency enforced via `seeded_at`
- All tests pass
- Dev seeding script (`seed:dev-users`) is updated to call `seedDefault` for each dev tenant so local dev has usable tenants

---

## 8. Slice C — Template Editor

### Status: ✅ Done

### Goal

A working template editor at `/ajustes/plantillas` and `/ajustes/plantillas/:id/edit` that lets doctors manage their tenant-owned templates per `template-editor-ux.md`. This is the largest slice in the protocol engine.

### Why before Slices D and 2+3

The template editor exercises the block-row UI pattern (type chip, title, required toggle, drag handle, context menu) that the protocol editor will reuse in Slices 4–5. Building it first forces clean separation between structural controls and content editing, which is hard to refactor in if the protocol editor ships first.

### In scope

**Backend (`apps/api/src/modules/protocol-templates/`):**

- `GET /v1/protocol-templates` — list the tenant's templates (non-deleted)
  - Response includes: id, name, `is_seeded`, locked state (boolean + list of blocking type IDs if locked), block count, last updated
- `GET /v1/protocol-templates/:id` — full template including schema JSON
- `POST /v1/protocol-templates` — create a blank template
- `PATCH /v1/protocol-templates/:id` — save template (name, suggested_specialty, schema)
  - Rejects if locked (any active type references it)
  - Full schema validation (block structure, section nesting, required flags)
- `DELETE /v1/protocol-templates/:id` — soft-delete
  - Rejects if locked
- All endpoints under `FirebaseAuthGuard` + `TenantGuard`
- Integration tests:
  - Create / read / update / delete happy paths
  - Cross-tenant isolation on every endpoint (user A cannot touch tenant B templates)
  - Lock: create a type, try to edit the template → rejected with `TEMPLATE_LOCKED`
  - Lock: create a type, try to delete the template → rejected with `TEMPLATE_LOCKED`
  - Lock state reflected in the list response

**Frontend (`apps/web`):**

- **`/ajustes/plantillas`** — template list page
  - Table / card list of templates with name, locked state, last updated, actions (Edit, Delete)
  - "Nueva plantilla" button → navigates to `/ajustes/plantillas/new`
  - Empty state (theoretical; after seeding, list always has ≥ 5 rows): "No tienes plantillas. Crea tu primera plantilla."
- **`/ajustes/plantillas/new`** — create flow (blank template → redirect to edit page with the new ID)
- **`/ajustes/plantillas/:id/edit`** — the template editor per `template-editor-ux.md`
  - Single-column layout: header, name/specialty fields, block list, add-block palette
  - Row anatomy: drag handle, type chip, title/placeholder, required toggle, context menu
  - Expand-on-click detail panel per row (one expanded at a time)
  - Add-block buttons append at appropriate position
  - Lock state: read-only UI with banner naming blocking types (each linking to `/ajustes/tipos/:id`)
  - Save button persists the entire template state in one request
  - Dirty-state tracking; confirm on navigate-away
- **Block row components** (`apps/web/src/components/template/`):
  - `<BlockRow>` — the shared row layout (drag + chip + title/placeholder + required toggle + menu)
  - Row variants per block type (only the chip and placeholder differ at collapsed state)
  - Expanded-detail panels per type: section, text, checklist, steps, decision, dosage_table, alert

**Shared (`packages/shared`):**

- `UpdateProtocolTemplateSchema` — validates the full save payload
- Error codes: `TEMPLATE_LOCKED`, `TEMPLATE_NOT_FOUND`, `TEMPLATE_NAME_CONFLICT`

### Sub-slices (roughly, in build order)

1. **C.1** — Backend CRUD with lock enforcement and tests (~1 day)
2. **C.2** — Template list page (`/ajustes/plantillas`) with lock indicators (~0.5 day)
3. **C.3** — Template editor shell: layout, header, name field, empty block list, add-section button (~1 day)
4. **C.4** — Block rows: collapsed state for all 7 types (section + 6 leaves), drag-to-reorder within parent, context menu (~1 day)
5. **C.5** — Block rows: expanded detail panels with placeholder hints and required toggles (~1 day)
6. **C.6** — Save flow, lock banner, dirty state, validation (~0.5 day)

### Out of scope

- Template versioning, draft/publish, comparison — v2
- Template duplication as a starting point — v2
- Template import/export — v2
- Search within the template list — not needed at MVP list sizes
- Approval workflows — v2

### Done when

- A seeded doctor can navigate to `/ajustes/plantillas`, see their 5 seeded templates (all locked), click into one to see the read-only editor with the lock banner, follow the link to the blocking type, delete the type (covered by Slice D — this step works if D ships first or is stubbed), return to the template, edit it, save it
- All lock rules enforced server-side
- All cross-tenant tests pass

---

## 9. Slice D — Type CRUD

### Status: ✅ Done

### Goal

A CRUD surface for `ProtocolType`s at `/ajustes/tipos` and `/ajustes/tipos/:id`. Minimal functionality — list, create, rename, delete.

### In scope

**Backend (`apps/api/src/modules/protocol-types/`):**

- `GET /v1/protocol-types` — list tenant's types with counts
  - Response per type: id, name, template_id, template_name (joined), `is_seeded`, active protocol count, locked state (protocol count > 0)
- `GET /v1/protocol-types/:id` — single type
- `POST /v1/protocol-types` — create (name + template_id)
  - Validates template belongs to same tenant
  - Unique name check (per tenant, excluding soft-deleted)
- `PATCH /v1/protocol-types/:id` — **rename only**
  - Body accepts `name` only
  - Explicitly rejects any `template_id` in the body (immutable)
  - Unique name check
- `DELETE /v1/protocol-types/:id` — soft-delete
  - Rejects if any active protocol references it (`TYPE_LOCKED`)
- All under auth + tenant guards
- Integration tests:
  - CRUD happy paths
  - Cross-tenant isolation
  - Lock: create a protocol, try to delete the type → rejected
  - Template immutability: attempt to PATCH `template_id` → rejected with clear error
  - Name uniqueness: per-tenant, soft-deleted rows don't block

**Frontend (`apps/web/src/pages/ajustes/tipos/`):**

- **`/ajustes/tipos`** — type list page
  - Table showing each type with name, underlying template name, active protocol count, locked indicator, actions (Rename, Delete)
  - "Nuevo tipo" button → opens a modal with: name input + template dropdown (populated from `/v1/protocol-templates`)
  - Rename is inline-edit or via a modal (pick whichever matches the design system's existing pattern)
  - Delete shows a confirm with the protocol count if any (server will reject if non-zero, so the confirm is defensive)
- **`/ajustes/tipos/:id`** — individual type detail page (deep-linked from template editor's lock banner)
  - Shows the type's fields, the template it points at (as a link to the template editor), and a delete button
  - No structural editing beyond rename

**Shared (`packages/shared`):**

- `CreateProtocolTypeSchema`, `UpdateProtocolTypeSchema` (rename only)
- Error codes: `TYPE_LOCKED`, `TYPE_NOT_FOUND`, `TYPE_NAME_CONFLICT`, `TEMPLATE_NOT_FOUND_FOR_TYPE`, `TYPE_TEMPLATE_IMMUTABLE`

### Out of scope

- Type metadata beyond name (tags, analytics) — v2
- Changing a type's template — never (use delete + create)
- Merging types — v2

### Done when

- A seeded doctor can see their 5 seeded types, rename one, create a new type pointing at an existing template, try to delete a type with protocols and get rejected, delete a type with no protocols successfully
- Deleting a type unlocks the template it pointed at (enabling template edits in Slice C)
- All cross-tenant tests pass

---

## 10. Slice E — Onboarding Flow

### Status: ✅ Done

### Goal

The `/bienvenido` screen and its two paths per `onboarding-flow.md`. After this slice, a brand-new doctor can sign up, land on `/bienvenido`, complete onboarding (default or personalizar), and arrive at `/dashboard` with a seeded tenant.

### In scope

**Backend (`apps/api/src/modules/onboarding/`):**

- `POST /v1/onboarding/default` — calls `TenantSeedingService.seedDefault` with the authenticated tenant's ID and locale
  - 409 `ONBOARDING_ALREADY_COMPLETE` if `seeded_at` set
  - 200 with the seeded tenant's summary on success
- `POST /v1/onboarding/custom` — accepts `{ templates: [...], types: [...] }` and calls `TenantSeedingService.seedCustom`
  - Validates every template payload against the full template Zod schema
  - Validates types reference templates in the same payload (by client-side UUID)
  - Enforces at least 1 template and 1 type
  - Same idempotency check as default
- Integration tests:
  - Default path seeds 10 rows; second call returns 409
  - Custom path: doctor supplies 3 templates + 2 types → 5 rows exactly, no starter content
  - Custom path: invalid template structure → 400 with details
  - Custom path: type references unknown template ID → 400
  - Rollback: forcing failure mid-transaction leaves tenant unseeded

**Frontend:**

- **Global route guard** (redirect helper): authenticated users with `tenant.seeded_at == null` → redirected to `/bienvenido` from any other route
- **`/bienvenido`** — welcome screen per `onboarding-flow.md` Section 4
  - Primary CTA: "Empezar con la configuración por defecto" → `POST /v1/onboarding/default`, redirect to `/dashboard`
  - Secondary link: "Prefiero personalizar" → navigate to `/bienvenido/personalizar`
  - Copy resolved from central strings module
- **`/bienvenido/personalizar`** — two-step guided flow
  - Step 1: template review (uses the template editor component from Slice C in "candidate" mode — no server persistence until final save)
  - Step 2: type review (uses type form patterns from Slice D in candidate mode)
  - Step indicator at top
  - "Finalizar configuración" → `POST /v1/onboarding/custom`, redirect to `/dashboard`
  - "Volver al inicio" from Step 1 → `/bienvenido` (discards candidate state)
- **Guard on `/bienvenido*`** — redirect to `/dashboard` if `seeded_at` set
- Toast confirmations and error states per `onboarding-flow.md` Section 11

### Refactoring Note

To support the personalizar path without duplicating UI, Slice C's template editor and Slice D's type form need to accept a "candidate mode" prop that makes them operate on in-memory state instead of calling the API. Slice E is the caller that needs this; plan for the seam in C and D (or retrofit here — judgment call). The simplest approach: the editor component accepts `onSave` / `onCancel` callbacks; in the normal flow these call the API, in onboarding they update candidate state.

### Out of scope

- Re-onboarding if a tenant deletes everything (never — see `onboarding-flow.md` Section 10)
- Per-specialty onboarding paths — v2
- Team member onboarding — v2 (multi-user)

### Done when

- A brand-new doctor signs up, lands on `/bienvenido`, picks default, reaches `/dashboard` with 5 templates + 5 types seeded
- Another brand-new doctor picks personalizar, deletes 2 seeded templates, adds 1 custom template, renames 3 types, deletes 2, adds 1 new one, finishes — reaches `/dashboard` with the exact custom state
- Any attempt to hit `/dashboard`, `/protocolos`, `/ajustes/*` before onboarding redirects to `/bienvenido`
- `/bienvenido` redirects to `/dashboard` for seeded tenants
- Rollback works: simulated failure leaves tenant unseeded and the welcome screen re-entrant

---

## 11. Slice 2+3 — Create & View Protocols

### Status: ✅ Done

### Why combined

Slices 2 (view) and 3 (create) share the block renderer. Building both together lets us design the renderer once and use it in two contexts (read-only view, editor preview) without rework. The slice is larger (3–4 days instead of 2+2) but has less total work than doing them sequentially.

### Goal

A logged-in doctor with a seeded tenant can:

1. Click "Nuevo protocolo" from `/protocolos`
2. See a **type picker** modal showing their tenant's types + a protocol-name input
3. Pick a type, name the protocol → lands on the editor at `/protocolos/:id/edit` with the title field focused, all blocks pre-seeded from the template (resolved via the type) as `placeholder_blocks`, all blocks read-only for now
4. Click "Guardar versión" → creates v1 of the protocol
5. Navigate to `/protocolos/:id` → sees the protocol rendered in read-only mobile-friendly view
6. Back at `/protocolos` → sees the newly-created protocol in their list

### In scope

**Backend (`apps/api/src/modules/protocols/`):**

- `POST /v1/protocols` — creates a `Protocol` + initial `ProtocolVersion` (v1, status `draft`)
  - Body: `{ type_id, title }`
  - Resolves `type_id` → `template_id` → `template.schema.placeholder_blocks`, copies into initial content
  - Validates `type_id` belongs to same tenant
  - Rejects if no type exists for the tenant (`NO_TYPES_AVAILABLE`) — defensive, shouldn't happen post-onboarding
- `GET /v1/protocols/:id` — returns protocol + current version content + template metadata (so editor knows which blocks are required)
- `GET /v1/protocols` — lists tenant's protocols (non-deleted)
- `PATCH /v1/protocols/:id` — title rename only in this slice
- All endpoints go through auth + tenant guards
- Server-side validation:
  - Enforces tenant match on every read/write
  - Enforces required-block presence on save (mostly a no-op in this slice since content isn't editable yet)
- Integration tests:
  - Create from each of 5 seeded types succeeds
  - Cross-tenant isolation
  - Required blocks from template present in initial version
  - List returns only tenant's protocols, including template/type info per row

**Frontend (`apps/web`):**

- **Shared block renderer** (`apps/web/src/components/protocol/BlockRenderer.tsx`):
  - One renderer per block type (reuse the display layer from Slice C's template editor, stripping the edit controls)
  - Read-only variant is the default; interactive variant comes in Slice 4+
  - Session-scoped checkbox state lives in local component state — does NOT mutate the protocol
- **Type picker** (`apps/web/src/components/protocol/TypePickerModal.tsx`):
  - Modal dialog opened from `/protocolos` via a "Nuevo protocolo" button
  - Lists the tenant's types as selectable cards
  - Protocol name input below the cards
  - Primary CTA "Crear protocolo" (disabled until type selected and name entered)
  - On submit: calls `POST /v1/protocols`, navigates to `/protocolos/:id/edit`
  - Empty state (if somehow zero types): link to `/ajustes/tipos`
- **Editor shell** (`apps/web/src/pages/protocolos/[id]/edit.tsx`):
  - Three-panel layout per `protocol-editor-ux.md` Section 3 (palette · canvas · preview)
  - Top bar: title (editable), type name (read-only), last saved, status badge, "Vista previa" toggle, "Guardar versión" button
  - Palette buttons disabled with tooltip "Disponible en el próximo paso"
  - Canvas renders all blocks via the shared renderer, read-only
  - Preview panel uses the same renderer at mobile-viewer scale
  - Title editable inline
  - "Guardar versión" creates a new `ProtocolVersion` with the current title
- **Mobile viewer** (`apps/web/src/pages/protocolos/[id]/index.tsx`):
  - Route `/protocolos/:id` (distinct from `/protocolos/:id/edit`)
  - Mobile-first layout per `protocol-editor-ux.md` Section 7
  - Top bar: back, title, type name, version, updated-at, status
  - Collapsible sections (first 2 expanded, rest collapsed)
  - Shared block renderer, read-only
- **Updated `/protocolos` list page** (replaces Slice 1 scaffolding):
  - Fetches user's protocols via `GET /v1/protocols`
  - Empty state: "Aún no tienes protocolos. Crea tu primer protocolo para empezar." + "Crear primer protocolo" CTA (opens type picker)
  - Populated state: list of protocol cards with title, type name, status, last updated
  - Click → `/protocolos/:id`; "Editar" link → `/protocolos/:id/edit`
  - "Nuevo protocolo" button top-right → opens type picker

**Shared (`packages/shared`):**

- Zod schemas for `CreateProtocolRequest`, `UpdateProtocolRequest`, `ProtocolResponse`, `ProtocolListItem`
- Reuse block / envelope schemas from Slice 0 / A

### Out of scope

- Block editing — Slice 4+
- Palette interactions — Slice 4+
- Version history UI — Slice 8
- Search, filter, favorites — Slice 7
- Delete protocol — TBD (can land here if cheap; otherwise Slice 7)

### Sub-slices (roughly)

1. **Backend create + read + list endpoints + tests** (~1 day)
2. **Shared block renderer** (read-only variants, lifted from Slice C where possible) (~1 day)
3. **Type picker + create flow + editor shell (all read-only) + save v1** (~1 day)
4. **Mobile viewer + transition `/protocolos` to user protocol list** (~0.5–1 day)

### Non-negotiables

- **Block renderer is single-purpose.** It renders. It does not know about editing. Edit controls are a later layer.
- **Server-side required-block validation happens even though nothing is editable.** Sets up the pattern for Slice 4+.
- **Template metadata travels with the protocol response** (resolved through the type) so the editor knows which blocks are required.
- **Cross-tenant isolation tested on every endpoint.**
- **No hardcoded protocol data.** UI reads from API; API reads from DB.

### Done when

- A seeded user can create a protocol from each of their 5 seeded types
- The created protocol shows correctly in both the editor (read-only) and the mobile viewer
- `/protocolos` shows the user's protocols, not types or templates
- `GET /v1/protocols/:id` for another tenant's protocol returns 404 (don't confirm existence cross-tenant)
- All tests pass

---

## 12. Slice 4 — Edit Simple Blocks

### Status: ⏳ Next up (after 2+3)

### Goal

Doctors can edit the content of `text` and `alert` blocks inside the protocol editor. The palette can add new blocks of these two types. Existing blocks can be deleted (unless required) and reordered within their parent section.

### Why text + alert first

Simplest block types — one content field each. They validate the editor pattern (selection, inline editing, dirty-state tracking, save → new version) before scaling to blocks with nested collections.

### In scope

**Backend:**

- `PUT /v1/protocols/:id/versions` — creates a new `ProtocolVersion` with submitted content; full content replacement (not patch)
- Server-side validation:
  - Required blocks (resolved through protocol → type → template) are present
  - Block types haven't changed for required blocks
  - Zod schema validation of full content envelope
- Integration tests for each validation path

**Frontend:**

- Block selection state in Zustand
- Inline field editing: `text` (Markdown textarea with toolbar), `alert` (severity + title + content)
- Palette "text" and "alert" active — click inserts at cursor
- Delete button on each non-required block (confirm dialog)
- Drag handle — reorder within same section (no cross-section drag yet)
- Dirty-state indicator; save opens modal with optional change summary
- Local autosave (browser storage, 30s interval)
- Unsaved-changes warning on navigation

**Shared:**

- `SaveVersionRequest` Zod schema

### Out of scope

- Checklist, steps, decision, dosage_table editing — Slice 5
- Section add/rename/delete — Slice 6
- Cross-section drag — Slice 6
- Real-time collaboration — v2+

### Done when

- Seeded user opens an existing protocol, edits a text block, adds an alert block, deletes an optional text block, saves, reloads — changes persisted
- Required blocks cannot be deleted (disabled button, tooltip explains)
- Saving creates new `ProtocolVersion`; previous version preserved
- Dirty-state warnings work on both reload and in-app navigation

---

## 13. Slice 5 — Edit Collection Blocks

### Status: ✅ Done

### Goal

All four remaining leaf block types fully editable: `checklist`, `steps`, `decision`, `dosage_table`.

### In scope

- **Checklist:** add/remove items, edit text, toggle `critical`
- **Steps:** add/remove/reorder steps, edit title and detail
- **Decision:** edit condition, add/remove branches (min 2), edit labels and actions
- **Dosage table:** add/remove rows, edit cells (fixed MVP columns)

### Out of scope

- Custom dosage table columns — v2
- Nested decision blocks — v2
- Drag-to-reorder items within collections — nice-to-have, can land here or follow-up

### Done when

- All 6 leaf block types fully editable
- Validation rules from `protocol-template-schema.md` Section 9 enforced server-side
- Saving a partial or invalid block rejected with clear error code

---

## 14. Slice 6 — Sections

### Status: ✅ Done

### Goal

Doctors can add, rename, reorder, and delete sections (except template-required sections). Blocks move across sections.

### In scope

- Add section at end of protocol
- Rename section inline
- Reorder sections at top level (drag or keyboard)
- Delete optional section (confirm; cascades to children)
- Collapse/expand sections in editor
- Drag block across section boundaries
- Two-level nesting cap enforced: sections cannot contain sections

### Done when

- Editor feels "done" for authoring — nothing structurally a doctor wants to do is blocked
- Server rejects invalid structures (nested sections, required section deletion)

---

## 15. Slice 7 — Browse, Search, Favorites

### Status: ⏸ Pending

### Goal

The `/protocolos` list page is usable for a doctor with 20+ protocols.

### In scope

- `GET /v1/protocols` accepts query params: `search`, `type_id`, `status`, `favorites_only`, `sort`
- Full-text search over title + optional content snippet via PostgreSQL `tsvector` + GIN index
- **Filter by type** — primary organization axis; replaces the old "status filter as primary" assumption
- Favorites: `ProtocolFavorite` join table or boolean per user. Toggle via `POST /v1/protocols/:id/favorite` / `DELETE`
- Frontend: search input, type filter chips (multi-select), status filter, sort dropdown

### Out of scope

- Semantic/AI-powered search — v2
- Saved searches — v2
- Cross-tenant / public library — v3

### Done when

- Seeded user with 20+ protocols across all 5 types can filter by type, search by title, sort by updated date

---

## 16. Slice 8 — Version History & Restore

### Status: ⏸ Pending

### Goal

Doctors can see a protocol's version history and restore any past version (creates a new version, never destructive).

### In scope

- `GET /v1/protocols/:id/versions` — list all versions
- `GET /v1/protocols/:id/versions/:versionId` — specific version's content
- `POST /v1/protocols/:id/versions/:versionId/restore` — creates new version with restored content
- Frontend: "Historial" drawer in editor top bar
- Click past version → read-only view
- "Restaurar como nueva versión" button

### Out of scope

- Diff view between versions — nice-to-have, later
- Compare across more than two versions — v2

### Done when

- Editing a protocol produces a new version; history drawer shows all versions in order
- Restoring an old version creates a new version (latest); old version untouched

### After this ships

MVP protocol engine is complete. Every spec'd capability is shippable to real doctors.

---

## 17. Out-of-MVP — Explicitly Deferred

Valuable features, considered during scoping, deferred to post-MVP.

| Feature                                                                              | Target                                    |
| ------------------------------------------------------------------------------------ | ----------------------------------------- |
| Template versioning (non-destructive edits, protocols pinned to author-time version) | v2                                        |
| Type metadata (tags, default location, analytics hooks)                              | v2                                        |
| Cross-tenant template sharing / public library                                       | v3                                        |
| Forking public templates / protocols                                                 | v3                                        |
| Protocol-to-consultation integration                                                 | v2                                        |
| Multi-signer approval workflows                                                      | v2                                        |
| Protocol usage analytics                                                             | v2                                        |
| Real-time collaboration in editor                                                    | v2+                                       |
| Nested decision blocks                                                               | v2                                        |
| Custom dosage table columns                                                          | v2                                        |
| Calculator blocks (BMI, GFR, dosing)                                                 | v2                                        |
| Cross-reference / linked protocols                                                   | v2                                        |
| Rich media (images, diagrams) inside blocks                                          | v2                                        |
| Attachment blocks                                                                    | v2                                        |
| Admin / backoffice for cross-tenant template curation                                | v2+ (if ever)                             |
| AI-assisted protocol authoring                                                       | v3+                                       |
| Re-onboarding for tenants that delete everything                                     | Never (settings surfaces handle recovery) |
| Team-member onboarding for multi-user tenants                                        | v2                                        |
| Per-specialty onboarding paths                                                       | v2                                        |

If any of these surface as urgent during user interviews, re-scope at the roadmap level, not by jamming them into an active slice.

---

## Appendix: How to Pick Up This Work

If you (or another developer / Claude Code session) are starting a new slice:

1. Read Section 1 (Architectural Decisions) completely.
2. Find the slice in Sections 3–16. Read its "In scope" and "Out of scope" carefully — they are the boundary.
3. Verify the slice's prerequisites (the prior slice) are done.
4. Read the specs referenced by that slice (`protocol-editor-ux.md`, `template-editor-ux.md`, `onboarding-flow.md`, `protocol-template-schema.md`, `starter-templates.md`, and the design system).
5. Before writing code, produce a plan and get it reviewed. Do not skip this step — the slice specs explicitly require it.

If a question comes up that this document doesn't answer, the answer lives in `specs/` or requires a human decision. In the latter case, surface it in the plan rather than inventing an answer.
