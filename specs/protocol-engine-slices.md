# Protocol Engine — Slice Tracker

> Living document. Last updated: April 2026.
>
> This document tracks the implementation of the protocol engine across vertical slices. Each slice is small, end-to-end, and demoable on its own. Completed slices are marked; in-progress and pending slices are detailed so they can be picked up without rereading the whole history.

## Table of Contents

1. [Architectural Decisions](#1-architectural-decisions)
2. [Slice Status Overview](#2-slice-status-overview)
3. [Slice 0 — Foundation](#3-slice-0--foundation)
4. [Slice 1 — Browse System Templates (Scaffolding)](#4-slice-1--browse-system-templates-scaffolding)
5. [Auth Slice (Prerequisite for Future Work)](#5-auth-slice-prerequisite-for-future-work)
6. [Slice 2+3 — Create & View Protocols (Combined)](#6-slice-23--create--view-protocols-combined)
7. [Slice 4 — Edit Simple Blocks](#7-slice-4--edit-simple-blocks)
8. [Slice 5 — Edit Collection Blocks](#8-slice-5--edit-collection-blocks)
9. [Slice 6 — Sections](#9-slice-6--sections)
10. [Slice 7 — Browse, Search, Favorites](#10-slice-7--browse-search-favorites)
11. [Slice 8 — Version History & Restore](#11-slice-8--version-history--restore)
12. [Out-of-MVP — Explicitly Deferred](#12-out-of-mvp--explicitly-deferred)

---

## 1. Architectural Decisions

These decisions shape every slice. If you're picking up this work, read this section first.

### 1.1 Templates are not browsed directly

System templates (and, in v2, tenant-owned custom templates) are **never** exposed as a standalone browseable catalog in the UI. They surface only **in context of creation** — via a template picker modal or a dedicated "new protocol" page that opens the picker.

**Why:** Doctors think "I need to create a protocol," not "I want to browse templates." Treating templates as a first-class browse target confuses the mental model and creates UI surface area that the MVP doesn't need.

**Current state (Slice 1):** `/protocolos` currently shows the 5 system templates as a gallery. **This is scaffolding, not the target design.** Slice 2+3 replaces this with the user's protocol library + a "Nuevo protocolo" action that opens the template picker.

**When this might change:** v2, when tenant-owned custom templates arrive and doctors need a way to manage *their own* template library. At that point, a dedicated `/protocolos/plantillas` page (or similar) might be justified. Not before.

### 1.2 No backoffice / admin site

MVP has no separate admin area for template management, because MVP has no admin role. Every user is an `owner` of their solo-practitioner tenant. System templates are managed via seed script and database migrations, not a UI.

**When this might change:** v2+, when Clinic tier launches and a clinic admin role exists with elevated permissions.

### 1.3 One shared block renderer

All places that render protocol content — mobile viewer, desktop editor (read-only preview), future consultation integration — use the **same** block renderer component. Build it once, use it everywhere. Editor interactivity is a layer *on top of* this renderer, not a rewrite of it.

### 1.4 Protocols vs Templates in the data model

| Entity | Purpose | Tenant scoping |
|---|---|---|
| `ProtocolTemplate` | Reusable structural starting point | Nullable `tenant_id` (null = system template) |
| `Protocol` | A tenant-owned instance derived from a template or created blank | Required `tenant_id` |
| `ProtocolVersion` | Immutable snapshot of a protocol's content at a point in time | Required `tenant_id` |
| `ProtocolUsage` | Placeholder for v2 (protocol-in-consultation tracking); table exists, not actively used | Required `tenant_id` |

These decisions are already baked into Slice 0's Prisma schema.

### 1.5 Required blocks are enforced by the server, not just the UI

When a protocol is derived from a template with `required: true` blocks, the server refuses to save a version missing those blocks (or with their types changed). The UI reinforces this by disabling delete buttons — but the UI is a convenience, not the enforcement boundary.

### 1.6 Spanish microcopy from a central strings module

All user-visible strings live in `apps/web/src/lib/strings.ts` (or similar). No hardcoded Spanish in components. This enables the English toggle (future) and makes copy reviews easy.

### 1.7 No new UI primitives mid-slice

Every block type, form pattern, and layout fragment used in these slices is already in the design system (see `specs/design-system/components.md`). If a slice surfaces a genuine need for a new primitive, **pause** and decide whether it belongs in the system — don't build it inline.

---

## 2. Slice Status Overview

| # | Slice | Status | Size | Notes |
|---|---|---|---|---|
| 0 | Foundation (Prisma, Zod, seed) | ✅ Done | 0.5 day | Baseline for everything |
| 1 | Browse system templates (scaffolding) | ✅ Done | 1–2 days | Stubbed auth — to be replaced |
| — | Auth slice | ⏳ Next | 2–3 days | Prerequisite for real tenancy |
| 2+3 | Create & view protocols (combined) | ⏸ Pending | 3–4 days | After auth |
| 4 | Edit simple blocks (text + alert) | ⏸ Pending | 2–3 days | |
| 5 | Edit collection blocks | ⏸ Pending | 3–5 days | |
| 6 | Sections | ⏸ Pending | 1–2 days | |
| 7 | Browse, search, favorites | ⏸ Pending | 2–3 days | |
| 8 | Version history & restore | ⏸ Pending | 1–2 days | Ships MVP complete |

**Legend:** ✅ Done · ⏳ In progress / up next · ⏸ Pending · ❌ Blocked

---

## 3. Slice 0 — Foundation

### Status: ✅ Done

### Goal

Put the data and type foundations in place so every subsequent slice has stable ground to build on.

### What shipped

- **Prisma models:** `ProtocolTemplate`, `Protocol`, `ProtocolVersion`, `ProtocolUsage` — all with UUID primary keys, tenant scoping (nullable on `ProtocolTemplate`, required on the rest), timestamps, soft-delete via `deleted_at`.
- **Shared Zod schemas** in `packages/shared` covering every block type (`section`, `text`, `checklist`, `steps`, `decision`, `dosage_table`, `alert`) and the top-level template/protocol content envelopes.
- **Seed script** `tools/seed-protocol-templates.ts` creating the 5 system templates idempotently (upsert by `template_key`), with `tenant_id: null` and `is_system: true`. Registered as `pnpm seed:templates`.
- **Unit tests** for Zod schemas covering valid and invalid cases per block type.

### Key files

- `packages/db/prisma/schema.prisma` — protocol engine models
- `packages/db/prisma/migrations/<timestamp>_protocol_engine_foundation/` — the migration
- `packages/shared/src/protocol/blocks.ts` — Zod schemas for block types
- `packages/shared/src/protocol/envelope.ts` — Zod schema for the top-level content envelope
- `tools/seed-protocol-templates.ts` — seed script
- `packages/shared/src/protocol/__tests__/` — unit tests

### Verification

- Prisma migration applied to dev Postgres
- `pnpm seed:templates` inserts 5 rows into `protocol_templates`
- Re-running seed does not duplicate
- Zod unit tests pass

---

## 4. Slice 1 — Browse System Templates (Scaffolding)

### Status: ✅ Done (stubbed auth)

### Goal

Prove end-to-end plumbing works: logged-in doctor can reach `/protocolos` and see the 5 system templates as cards.

### What shipped

- **Backend:** `ProtocolTemplatesModule` in `apps/api/src/modules/protocol-templates/` with `GET /v1/protocol-templates`. Service + repository layering. **Auth stubbed** — will be swapped out in the auth slice.
- **Frontend:** `/protocolos` route with a template gallery. Uses existing design system components (Card, Badge, Empty State). TanStack Query hook `useProtocolTemplates()`.
- **Integration test** verifying the endpoint returns the 5 system templates.

### Known debt

- **Auth stub.** `FirebaseAuthGuard` and `TenantGuard` are not wired up. The endpoint runs without authentication. To be removed in the auth slice.
- **Scaffolding UX.** The `/protocolos` page shows templates as the primary content. Slice 2+3 replaces this with the user's protocol library.

### Key files

- `apps/api/src/modules/protocol-templates/`
- `apps/web/src/pages/protocolos/index.tsx`
- `apps/web/src/hooks/useProtocolTemplates.ts`

---

## 5. Auth Slice (Prerequisite for Future Work)

### Status: ⏳ Next up

### Goal

Replace the Slice 1 auth stub with real Firebase Auth + tenant isolation. New doctors can sign up; the app greets them with their real profile data; route guards redirect unauthenticated users to `/login`.

### Why before Slice 2+3

Slices 2+3 need to write `tenant_id` to real rows, which means the authenticated user must resolve to a real tenant. Stubbing this any further creates retrofit pain.

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
- Slice 1's `/protocolos` still shows the 5 templates, now via real auth
- Cross-tenant isolation verified: seeded user A cannot see tenant B data

---

## 6. Slice 2+3 — Create & View Protocols (Combined)

### Status: ⏸ Pending (after auth)

### Why combined

Slices 2 (view) and 3 (create) share the block renderer. Building both together lets us design the renderer once and use it in two contexts (read-only view, editor preview) without rework. The slice is larger (3–4 days instead of 2+2) but has less total work than doing them sequentially.

### Goal

A logged-in doctor can:

1. Click "Nuevo protocolo" from `/protocolos`
2. See a template picker showing the 5 system templates + a "Empezar desde cero" option
3. Pick a template → lands on the editor at `/protocolos/:id/edit` with the title field focused, all blocks pre-seeded from the template's `placeholder_blocks`, all blocks read-only for now
4. Rename the protocol and click "Guardar versión" → creates v1 of the protocol
5. Navigate to `/protocolos/:id` → sees the protocol rendered in read-only mobile-friendly view
6. Back at `/protocolos` → sees the newly-created protocol in their list (no longer "shows templates")

### In scope

**Backend (`apps/api`):**

- `POST /v1/protocols` — creates a `Protocol` + initial `ProtocolVersion` (v1, status `draft`) from a `template_id`. Copies the template's `placeholder_blocks` into the initial `content`. Accepts an optional `title` (defaults to the template name + " (nuevo)"). Optionally accepts `template_id: null` for blank protocols.
- `GET /v1/protocols/:id` — returns the protocol with its `current_version_id`'s content, including template metadata (so the editor knows which blocks are required).
- `GET /v1/protocols` — lists the tenant's protocols (non-deleted). Minimal filtering for now — no search, no favorites. Slice 7 expands this.
- `PATCH /v1/protocols/:id` — allows title rename only in this slice. Other field updates are out of scope.
- All endpoints go through `FirebaseAuthGuard` + `TenantGuard`.
- Server-side validation: enforces tenant match on every read/write; enforces required-block presence on save (but since nothing is editable yet, this mostly means "the blocks copied from the template are preserved").
- Integration tests:
  - Create from each of the 5 system templates successfully
  - Create a blank protocol (no template)
  - Cross-tenant isolation (user A can't read or update user B's protocols)
  - Required blocks from template are present in the initial version
  - List returns only the tenant's protocols

**Frontend (`apps/web`):**

- **Shared block renderer** (`apps/web/src/components/protocol/BlockRenderer.tsx`):
  - One renderer for each block type (`TextBlock`, `ChecklistBlock`, `StepsBlock`, `DecisionBlock`, `DosageTableBlock`, `AlertBlock`, `SectionBlock`)
  - Each follows the design system spec for that block (see `specs/design-system/components.md` → protocol blocks section)
  - Read-only variant is the default; interactive variant comes in Slice 4+
  - Session-scoped checkbox state lives in local component state — does NOT mutate the protocol
- **Template picker** (`apps/web/src/components/protocol/TemplatePickerModal.tsx`):
  - Modal dialog opened from `/protocolos` via a "Nuevo protocolo" button
  - Shows the 5 system templates as selectable cards + a "Empezar desde cero" option at the end
  - On selection: calls `POST /v1/protocols`, then navigates to `/protocolos/:id/edit`
- **Editor shell** (`apps/web/src/pages/protocolos/[id]/edit.tsx`):
  - Three-panel layout per `specs/protocol-editor-ux.md` section 3 (palette · canvas · preview)
  - Top bar: title (editable), template source, last saved, status badge, "Vista previa" toggle, "Guardar versión" button
  - Palette: disabled buttons with tooltip "Disponible en el próximo paso"
  - Canvas: renders all blocks via the shared renderer, all blocks marked read-only (no editing controls visible yet)
  - Preview panel: same renderer, scaled-down styling matching the mobile viewer
  - Title field is editable inline
  - "Guardar versión" creates a new `ProtocolVersion` with the current title (content is unchanged since nothing else is editable yet, but the save flow is exercised)
- **Mobile viewer** (`apps/web/src/pages/protocolos/[id]/index.tsx`):
  - Route `/protocolos/:id` (note: distinct from `/protocolos/:id/edit`)
  - Mobile-first layout per `specs/protocol-editor-ux.md` section 7
  - Top bar: back button, protocol title, version number, updated-at, status badge
  - Collapsible sections (first 2 expanded, rest collapsed)
  - Uses the same block renderer, read-only variant
  - Search/favorites icons are visible but disabled for now ("Próximamente")
- **Updated `/protocolos` list page** (replaces Slice 1 scaffolding):
  - Fetches the user's protocols via `GET /v1/protocols`
  - Empty state: "Aún no tienes protocolos. Crea tu primer protocolo para empezar." + primary CTA "Crear primer protocolo" (opens template picker)
  - Populated state: list of protocol cards, each showing title, template source, status, last updated. Click navigates to `/protocolos/:id`. Secondary "Editar" link goes to `/protocolos/:id/edit`.
  - "Nuevo protocolo" button in the top-right of the page — opens template picker

**Shared (`packages/shared`):**

- Zod schemas for `CreateProtocolRequest`, `UpdateProtocolRequest`, `ProtocolResponse`, `ProtocolListItem`
- Reuse the existing block / envelope schemas from Slice 0

### Out of scope (explicitly deferred to later slices)

- Block editing of any kind — Slice 4+
- Palette interactions — Slice 4+
- Preview panel interactions — no click/hover affordances yet
- Version history UI — Slice 8
- Search, filter, favorites on list page — Slice 7
- Restore, fork, duplicate, delete — all later

### Build steps (sub-slices)

1. **Backend create + read + list endpoints + tests** (~1 day)
2. **Shared block renderer with read-only variants** (~1 day)
3. **Template picker modal + create flow + editor shell (all read-only) + save v1** (~1 day)
4. **Mobile viewer + transition `/protocolos` to user protocol list** (~0.5–1 day)

### Non-negotiables to bake in

- **Block renderer is single-purpose.** It renders. It does not know about editing. Edit controls are a later layer.
- **Server-side required-block validation happens even though nothing is editable.** This sets up the pattern for Slice 4+.
- **Template metadata travels with the protocol response** so the editor knows which blocks are required (even though nothing is deletable yet).
- **Cross-tenant isolation tested on every endpoint**, not just "covered in principle."
- **Empty state matches the design system spec** (title in serif, description in sans, primary CTA). Not a placeholder.
- **No hardcoded protocol data anywhere.** The UI reads from the API; the API reads from the DB.

### Done when

- A seeded user can create a protocol from each of the 5 templates
- The created protocol shows correctly in both the editor (read-only) and the mobile viewer
- `/protocolos` shows the user's protocols after creation, not the templates
- `GET /v1/protocols/:id` for another tenant's protocol returns 404 (not 403 — we don't confirm existence cross-tenant)
- All tests pass

---

## 7. Slice 4 — Edit Simple Blocks

### Status: ⏸ Pending

### Goal

Doctors can edit the content of `text` and `alert` blocks inside the editor. The palette can add new blocks of these two types. Existing blocks can be deleted (unless required) and reordered within their parent section.

### Why text + alert first

These are the simplest block types — one content field each. They validate the editor pattern (selection, inline editing, dirty-state tracking, save → new version) before scaling to blocks with nested collections.

### In scope

**Backend:**

- `PUT /v1/protocols/:id/versions` — creates a new `ProtocolVersion` with submitted content; full content replacement (not patch)
- Server-side validation:
  - Required blocks from the template are present
  - Block types haven't changed for required blocks
  - Zod schema validation of the full content envelope
- Integration tests for each validation path

**Frontend:**

- Block selection state in Zustand (selected block ID)
- Inline field editing for `text` (Markdown textarea with toolbar) and `alert` (severity dropdown + title input + content textarea)
- Palette "text" and "alert" buttons become active — clicking inserts a new block at the current cursor position
- Delete button on each non-required block — confirms before deleting
- Drag handle on each block — reorder within the same section (no cross-section drag yet)
- Dirty-state indicator in the top bar ("Cambios sin guardar")
- "Guardar versión" opens a modal with an optional change summary, then saves
- Local autosave to browser storage every 30s as a safety net
- Unsaved-changes warning on navigation

**Shared:**

- `SaveVersionRequest` Zod schema

### Out of scope

- Checklist, steps, decision, dosage_table editing — Slice 5
- Section add/rename/delete — Slice 6
- Cross-section block drag — Slice 6
- Real-time collaboration — deferred to v2 (single-user editing lock covered by the auth layer)

### Done when

- A seeded user can open an existing protocol, edit a text block, add a new alert block, delete an optional text block, save, and reload to see the changes persisted
- Required blocks cannot be deleted (button disabled with a tooltip)
- Saving creates a new `ProtocolVersion` row; the previous version is preserved
- Dirty-state warnings work on both reload and in-app navigation

---

## 8. Slice 5 — Edit Collection Blocks

### Status: ⏸ Pending

### Goal

All four remaining leaf block types are fully editable: `checklist`, `steps`, `decision`, `dosage_table`.

### In scope

- **Checklist:** add/remove items, edit text, toggle `critical` flag
- **Steps:** add/remove/reorder steps, edit title and detail
- **Decision:** edit condition, add/remove branches, edit branch labels and actions (minimum 2 branches enforced)
- **Dosage table:** add/remove rows, edit cells (fixed MVP columns: drug, dose, route, frequency, notes)

### Out of scope

- Custom dosage table columns — v2
- Nested decision blocks — v2
- Drag-to-reorder for items within a collection — nice-to-have, can land here or in a follow-up

### Done when

- All six leaf block types (text, alert, checklist, steps, decision, dosage_table) can be fully edited in the editor
- Validation rules from `protocol-template-schema.md` section 7 enforced server-side
- Saving a version with a partial or invalid block rejected with a clear error code

---

## 9. Slice 6 — Sections

### Status: ⏸ Pending

### Goal

Doctors can add, rename, reorder, and delete sections (except template-required sections). Blocks can be moved across sections.

### In scope

- Add section at the end of the protocol
- Rename a section inline
- Reorder sections at the top level (drag or keyboard)
- Delete an optional section (with confirmation; cascades to child blocks)
- Collapse/expand sections in the editor
- Drag a block across section boundaries
- Two-level nesting cap enforced: sections cannot contain sections

### Done when

- The editor feels "done" for authoring — nothing a doctor wants to do structurally is blocked
- Server rejects invalid structures (nested sections, required section deletion)

---

## 10. Slice 7 — Browse, Search, Favorites

### Status: ⏸ Pending

### Goal

The `/protocolos` list page is usable for a doctor with 20+ protocols.

### In scope

- `GET /v1/protocols` accepts query params: `search`, `status`, `tags`, `favorites_only`, `sort`
- Full-text search over title + optional content snippet using PostgreSQL `tsvector` + GIN index
- Favorites: a `ProtocolFavorite` join table or boolean flag per user. Toggle via `POST /v1/protocols/:id/favorite` / `DELETE`
- Frontend: search input, filter chips (status, favorites), sort dropdown

### Out of scope

- Semantic/AI-powered search — v2
- Saved searches — v2
- Cross-tenant / public library — v3

### Done when

- A seeded user with 20+ protocols (seed script for Slice 7 populates these) can search by title and filter by status / favorite

---

## 11. Slice 8 — Version History & Restore

### Status: ⏸ Pending

### Goal

Doctors can see a protocol's version history and restore any past version (which creates a new version, never destructive).

### In scope

- `GET /v1/protocols/:id/versions` — list all versions
- `GET /v1/protocols/:id/versions/:versionId` — fetch a specific version's content
- `POST /v1/protocols/:id/versions/:versionId/restore` — creates a new version with the restored content
- Frontend: "Historial" drawer in the editor top bar showing the version list
- Click a past version → opens a read-only view of that version
- "Restaurar como nueva versión" button on any past version

### Out of scope

- Diff view between versions — nice-to-have, can ship later
- Compare across more than two versions — v2

### Done when

- Editing a protocol produces a new version; the history drawer shows all versions in order
- Restoring an old version creates a new version (latest); the old version is untouched

### After this ships

MVP protocol engine is complete. Every spec'd capability is shippable to real doctors.

---

## 12. Out-of-MVP — Explicitly Deferred

These are valuable features and were considered during scoping. Deferred to post-MVP so we can ship.

| Feature | Target |
|---|---|
| Custom template creation by doctors | v2 |
| Tenant-owned template library / management UI | v2 |
| Cross-tenant template sharing / public library | v3 |
| Forking public templates / protocols | v3 |
| Protocol-to-consultation integration | v2 |
| Multi-signer approval workflows | v2 |
| Protocol usage analytics | v2 |
| Real-time collaboration in editor | v2+ |
| Nested decision blocks | v2 |
| Custom dosage table columns | v2 |
| Calculator blocks (BMI, GFR, dosing) | v2 |
| Cross-reference / linked protocols | v2 |
| Rich media (images, diagrams) inside blocks | v2 |
| Attachment blocks | v2 |
| Admin / backoffice area for system template management | v2+ (if ever) |
| AI-assisted protocol authoring | v3+ |

If any of these surface as urgent during user interviews, re-scope at the roadmap level, not by jamming them into an active slice.

---

## Appendix: How to Pick Up This Work

If you (or another developer / Claude Code session) are starting a new slice:

1. Read this document's Section 1 (Architectural Decisions) completely.
2. Find the slice in Section 2–11. Read its "In scope" and "Out of scope" carefully — they are the boundary.
3. Verify the slice's prerequisites (the prior slice) are done.
4. Read the specs referenced by that slice (usually `protocol-editor-ux.md`, `protocol-template-schema.md`, `starter-templates.md`, and the design system).
5. Before writing code, produce a plan and get it reviewed. Do not skip this step — the slice prompt explicitly requires it.

If a question comes up that this document doesn't answer, the answer lives in `specs/` or requires a human decision. In the latter case, surface it in the plan rather than inventing an answer.
