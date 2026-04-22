# Onboarding Flow

> Living document. Last updated: April 2026.
>
> This document specifies the first-run onboarding experience — the `/bienvenido` screen — through which every new tenant must pass before reaching the main application. Onboarding's sole job in MVP is to ensure that every tenant has at least one `ProtocolTemplate` and at least one `ProtocolType` before the doctor can create a protocol.

## Table of Contents

1. [Why Onboarding Exists](#1-why-onboarding-exists)
2. [Invariants the Flow Enforces](#2-invariants-the-flow-enforces)
3. [Entry & Exit Points](#3-entry--exit-points)
4. [The Welcome Screen](#4-the-welcome-screen)
5. [The Default Path](#5-the-default-path)
6. [The Personalizar Path](#6-the-personalizar-path)
7. [Backend Behavior](#7-backend-behavior)
8. [Route Guards](#8-route-guards)
9. [Post-Onboarding Tenant State](#9-post-onboarding-tenant-state)
10. [Edge Cases](#10-edge-cases)
11. [Copy & Microcopy](#11-copy--microcopy)
12. [Out of Scope](#12-out-of-scope)

---

## 1. Why Onboarding Exists

In the data model, `Protocol.type_id` is required and `ProtocolType.template_id` is required. A tenant with zero templates or zero types cannot create a protocol — which means a freshly-provisioned tenant would hit an immediate wall on the protocol engine, the product's primary differentiator.

Rather than auto-seed silently or present a blank protocol engine with cryptic errors, we give new doctors a deliberate setup moment: one screen, two paths, both of which end with the tenant usable.

Onboarding also serves a secondary purpose: it signals that the protocol engine is a first-class part of the product, not a side menu item. The first thing a new doctor sees establishes what this tool is for.

## 2. Invariants the Flow Enforces

After onboarding completes, every tenant has:

- At least 1 `ProtocolTemplate` (`tenant_id` = this tenant, `deleted_at` = null)
- At least 1 `ProtocolType` pointing at one of that tenant's templates
- A non-null `seeded_at` timestamp on the `Tenant` row

Onboarding **never** finishes with the tenant in an inconsistent state. If anything in the flow fails, the transaction rolls back and the doctor is returned to the welcome screen.

## 3. Entry & Exit Points

### Entry

A user arrives at `/bienvenido` if and only if:

- They are authenticated
- Their tenant's `seeded_at` is null

This is enforced by a global route guard (see Section 8). Any attempt to navigate elsewhere redirects here.

### Exit

A user leaves `/bienvenido` only by completing one of the two paths. Completion sets `tenant.seeded_at` and redirects to `/dashboard`. Once `seeded_at` is set, `/bienvenido` itself redirects to `/dashboard`, so the doctor never sees it again.

There is **no "skip to dashboard without configuring" escape hatch**. The invariant in Section 2 cannot be weakened by abandoning the flow midway.

### What About Logout Mid-Flow?

If the doctor closes the tab or logs out during the personalizar path, their in-progress state is discarded. On next login they return to `/bienvenido` with a fresh start. Nothing persists until they hit "Finalizar" (personalizar path) or "Empezar con la configuración por defecto" (default path).

## 4. The Welcome Screen

### Layout

A single-column centered layout. Max width ~560px. No top navigation, no sidebar — this screen is a moment, not part of the app shell.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              [serif heading, warm]                       │
│           Bienvenida, Dra. García                        │
│                                                          │
│        [sans secondary copy, one paragraph]              │
│    Antes de crear tu primer protocolo, configura         │
│    las plantillas y tipos que usarás en tu práctica.     │
│                                                          │
│                                                          │
│    [primary CTA, full-width or prominent]                │
│  ┌────────────────────────────────────────────────────┐  │
│  │   Empezar con la configuración por defecto        │  │
│  └────────────────────────────────────────────────────┘  │
│        [muted helper: explains what defaults include]    │
│  5 plantillas listas para emergencias, procedimientos,   │
│  medicación, diagnóstico y fisioterapia.                 │
│                                                          │
│                                                          │
│    [secondary link, centered]                            │
│          Prefiero personalizar                           │
│                                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Content

- **Heading** uses the serif display type and addresses the doctor by name (resolved from the authenticated user profile)
- **Lead paragraph** frames the moment: _why_ they're seeing this screen
- **Primary CTA** dominates visually — the default path is the recommended path
- **Helper text below the CTA** concretely describes what "default" means, so the doctor isn't clicking blind
- **Secondary link** is a quiet text link — present, but clearly the less-traveled road

### No Progress Indicator

This screen is stand-alone. The two paths diverge from here; the default path is a single click, and the personalizar path has its own step indicator once the doctor enters it. Adding a global progress bar to the welcome screen would imply a uniform flow that doesn't exist.

## 5. The Default Path

### Behavior

Clicking **"Empezar con la configuración por defecto"**:

1. Disables the button and shows a subtle spinner (~500ms–2s expected duration)
2. Sends `POST /v1/onboarding/default` to the API
3. On success, redirects to `/dashboard` with a brief toast: _"Configuración lista. Ya puedes crear tu primer protocolo."_
4. On failure (network error, server error), re-enables the button and shows an error toast: _"Algo salió mal. Inténtalo de nuevo."_ No partial state is persisted (see Section 7).

### What the Default Creates

See `starter-templates.md` Section 8 for the canonical spec. Briefly:

- **5 templates** copied into the tenant from the starter fixtures (Spanish by default, English if the tenant's language preference is set to English at provisioning)
- **5 types** pointing at those templates, named `Emergencia`, `Procedimiento`, `Medicación`, `Diagnóstico`, `Fisioterapia`

All 10 rows carry `is_seeded: true` for future analytics (informational only; no behavioral impact).

### Immediate Consequences of the Default Path

Because types are created pointing at templates in the same transaction, **all 5 seeded templates are immediately locked** (per `protocol-template-schema.md` Section 3). A doctor who later wants to customize a seeded template must first delete the corresponding type at `/ajustes/tipos`.

This is spelled out in the onboarding help text for the default path's secondary context (e.g., in an in-app help tooltip or first-time dashboard hint), but it is deliberately not surfaced on the welcome screen itself — the default path optimizes for "get started in one click", and warning about future editability friction would defeat that.

## 6. The Personalizar Path

### Behavior

Clicking **"Prefiero personalizar"** routes to `/bienvenido/personalizar` and begins a two-step guided flow.

### Step 1 — Review Templates

A screen that mirrors the structure of the template list (`/ajustes/plantillas`) but scoped to the onboarding flow:

- The 5 starter template drafts are pre-displayed as unsaved candidates
- Each row can be:
  - Edited (opens the template editor inline; returns to this screen on save)
  - Deleted (removed from the candidate list)
- "+ Crear otra plantilla" at the bottom adds a blank template the doctor can author from scratch
- At least one template must remain in the candidate list to proceed
- Primary CTA at the bottom: **"Continuar a tipos"**
- Secondary link: **"Volver al inicio"** (returns to `/bienvenido`, discards any in-progress customization)

Nothing is persisted yet. The candidate list lives in client state.

### Step 2 — Review Types

A screen that mirrors `/ajustes/tipos`:

- Types are pre-created as candidates, one per template that survived Step 1, using the default type names where applicable (`Emergencia`, `Procedimiento`, etc.)
- If the doctor deleted a template in Step 1 (e.g., "Algoritmo diagnóstico"), the corresponding default type (`Diagnóstico`) is omitted from the candidate list
- If the doctor created an entirely new template in Step 1, a candidate type pointing at it is auto-created with a placeholder name (`Nuevo tipo`) and flagged for renaming
- Each row can be:
  - Renamed inline
  - Deleted
  - Reassigned to a different template from Step 1's survivors (via a dropdown)
- "+ Crear otro tipo" at the bottom adds a new type pointing at a selected template
- At least one type must remain to proceed
- Primary CTA: **"Finalizar configuración"**
- Secondary link: **"Volver a plantillas"** (returns to Step 1 with current candidate state preserved)

### Completion

Clicking **"Finalizar configuración"**:

1. Disables the CTA, shows a spinner
2. Sends `POST /v1/onboarding/custom` with the full template and type candidate payloads
3. Server validates and persists all candidates in a single transaction
4. On success, redirects to `/dashboard` with the same confirmation toast as the default path
5. On failure, shows an error toast and keeps the user on Step 2 with their candidate state intact

### Step Indicator

A simple two-dot indicator at the top of each personalizar screen:

```
●———○   Plantillas          (step 1)
○———●   Tipos               (step 2)
```

Clicking a completed dot navigates back to that step. The candidate state is preserved across navigation within the flow; only a full exit (`"Volver al inicio"` on Step 1) discards it.

## 7. Backend Behavior

### Endpoints

Two endpoints serve onboarding. Neither is reachable from anywhere else in the app.

#### `POST /v1/onboarding/default`

- No request body (tenant + user are resolved from the auth token)
- **Idempotency:** if the tenant's `seeded_at` is already set, respond 409 `ONBOARDING_ALREADY_COMPLETE`. The default path never overwrites.
- **Transaction:**
  1. Lock the tenant row for update
  2. Insert 5 `ProtocolTemplate` rows from the starter fixtures
  3. Insert 5 `ProtocolType` rows pointing at them
  4. Set `tenant.seeded_at = now()`
  5. Commit
- If any step fails, the whole transaction rolls back. No partial seed is ever visible.

#### `POST /v1/onboarding/custom`

- Request body: `{ templates: [...], types: [...] }`
- Validation:
  - Every template passes the same schema validation as a normal template save
  - Every type references one of the templates in the same request (by client-side ID)
  - At least 1 template and at least 1 type present
  - No template has the same name as another in the request (unique per tenant, but here we're inserting all at once)
  - No type has the same name as another in the request
- **Idempotency:** same as `default` — 409 if already seeded.
- **Transaction:**
  1. Lock the tenant row for update
  2. Insert all templates (generate server-side UUIDs; keep a map from client-side IDs to new UUIDs)
  3. Insert all types, resolving `template_id` through the map
  4. Set `tenant.seeded_at = now()`
  5. Commit
- Rollback semantics same as default.

### Why Two Endpoints

A single generic endpoint could handle both paths (the default path is just a specific payload), but splitting them gives us:

- Cleaner telemetry (how many doctors take each path)
- Server-side enforcement that the default-path fixtures are never altered by a hostile or buggy client
- Simpler request validation for the common case

## 8. Route Guards

### Before Onboarding

A global guard on every route (except auth and `/bienvenido`) checks:

```
if authenticated and tenant.seeded_at is null:
  redirect to /bienvenido
```

This applies to `/dashboard`, `/agenda`, `/pacientes`, `/protocolos`, `/ajustes/*`, everything. New doctors cannot reach the app until onboarding is complete.

### After Onboarding

A guard on `/bienvenido` and `/bienvenido/personalizar`:

```
if authenticated and tenant.seeded_at is not null:
  redirect to /dashboard
```

A returning user never sees the welcome screen again.

### Unauthenticated Users

`/bienvenido` requires authentication. Unauthenticated users are redirected to `/login?redirectTo=/bienvenido` (the standard auth flow).

## 9. Post-Onboarding Tenant State

After onboarding completes — by either path — the tenant is in a minimal-but-valid state:

- ≥1 template exists
- ≥1 type exists, each pointing at one of the tenant's templates
- `seeded_at` is set

The doctor can:

- Immediately create protocols (via the type picker in the protocol creation flow)
- Visit `/ajustes/plantillas` to edit or add templates (subject to lock rules)
- Visit `/ajustes/tipos` to edit, rename, delete, or add types

All subsequent template and type management happens in the normal settings surfaces. The onboarding flow is one-shot and non-recurring.

## 10. Edge Cases

### Doctor Deletes All Templates or All Types Post-Onboarding

The invariant "≥1 template and ≥1 type exist" only applies _at the end of onboarding_. After that, normal lock rules govern — but no rule prevents a doctor from deleting everything.

A tenant that later ends up with zero active templates, or zero active types, is valid. The consequence is that protocol creation UI surfaces the correct empty state ("Crea primero un tipo de protocolo en Ajustes") and the doctor recovers by navigating to settings. They do **not** get pushed back through `/bienvenido`.

### Seeding Fails Mid-Transaction

Rollback. The tenant's `seeded_at` stays null. The doctor sees an error and can retry. No partial state persists.

### Doctor Starts Personalizar, Clicks Back to Default

Their in-progress custom state is discarded. The default path runs as normal. No warning dialog — the doctor hasn't saved anything, so there's nothing to warn about.

### Tenant is Provisioned via a Non-Standard Path (e.g., Admin Tool)

If a tenant is provisioned with `seeded_at` already set (e.g., through a data migration or a future team-invite flow), the onboarding guard never triggers. The tenant lands directly on `/dashboard`.

This leaves the door open for future flows (team member invited to an existing tenant, data import from an external system) without needing to retrofit the guard logic.

### Multiple Users on the Same Tenant (Future Multi-User)

MVP assumes one user per tenant (the owner). Future multi-user tenants will need a more nuanced onboarding — the second user shouldn't see `/bienvenido` at all, since the tenant was seeded by the owner. The `seeded_at` check on `Tenant` already handles this correctly for free: the second user's tenant is already seeded, so they skip onboarding.

A per-user first-run tour (which would be orthogonal to tenant onboarding) is out of MVP scope.

## 11. Copy & Microcopy

All Spanish strings live in the central strings module (`apps/web/src/lib/strings.ts` per the slice tracker). Below is the canonical set. English is a translation and appears only when the tenant's language preference is English.

### Welcome Screen

- **Heading:** `Bienvenida, {nombre}` / `Bienvenido, {nombre}` (gendered based on user profile; fallback: `Bienvenida`)
- **Lead:** `Antes de crear tu primer protocolo, configura las plantillas y tipos que usarás en tu práctica.`
- **Primary CTA:** `Empezar con la configuración por defecto`
- **Helper under CTA:** `5 plantillas listas para emergencias, procedimientos, medicación, diagnóstico y fisioterapia.`
- **Secondary link:** `Prefiero personalizar`

### Personalizar Step 1

- **Step title:** `Revisa tus plantillas`
- **Step description:** `Estas son las plantillas que usarás como punto de partida para tus protocolos. Puedes editarlas, eliminarlas o añadir las tuyas.`
- **Add button:** `+ Crear otra plantilla`
- **Primary CTA:** `Continuar a tipos`
- **Secondary link:** `Volver al inicio`
- **Empty-list validation:** `Necesitas al menos una plantilla para continuar.`

### Personalizar Step 2

- **Step title:** `Revisa tus tipos`
- **Step description:** `Cada tipo apunta a una plantilla. Los doctores verán los tipos al crear protocolos; las plantillas quedan detrás.`
- **Add button:** `+ Crear otro tipo`
- **Primary CTA:** `Finalizar configuración`
- **Secondary link:** `Volver a plantillas`
- **Empty-list validation:** `Necesitas al menos un tipo para continuar.`

### Completion Toast

- `Configuración lista. Ya puedes crear tu primer protocolo.`

### Error Toasts

- Default-path failure: `Algo salió mal. Inténtalo de nuevo.`
- Personalizar-path validation failure: `Hay campos por corregir antes de continuar.` (plus inline field errors)

## 12. Out of Scope

| Feature                                                                                          | Target                                       |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Skippable onboarding (go straight to dashboard)                                                  | Never — it would violate the invariants      |
| Re-onboarding trigger if a tenant deletes everything                                             | Never — settings surfaces handle recovery    |
| Onboarding for team members joining an existing tenant                                           | v2 (multi-user)                              |
| Product tour / dashboard coachmarks                                                              | v2 (separate from tenant onboarding)         |
| Video / rich-media welcome                                                                       | v2 (if engagement data justifies it)         |
| Per-specialty onboarding paths (e.g., "I'm a physiotherapist" preselects a reduced template set) | v2 (opportunity once we have specialty data) |
| Importing templates from another system                                                          | v3                                           |
| AI-suggested templates based on stated specialty                                                 | v3+                                          |
