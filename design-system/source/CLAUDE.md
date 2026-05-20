# Medical ERP — Claude Code Project Memory

> This file is loaded automatically at the start of every Claude Code session.
> Keep it concise (target <200 lines). For details, use @imports to spec files.

## Project Overview

A medical ERP built for Latin American (specifically Dominican Republic) medical specialists. Scales from solo practitioner to multi-location clinic. The differentiating feature is a **protocol engine** that lets doctors define reusable clinical protocols from templates (checklists, algorithms, decision trees, dosage tables, etc.).

**Target market:** solo specialists in the DR who consult at 2–4 different health centers per week.

**Primary differentiator:** native multi-location support (free tier includes unlimited locations) + first-class protocol engine.

## Specification Documents

@./specs/mvp-scope.md
@./specs/full-scope.md
@./specs/business-model.md
@./specs/medical_erp_erd.mmd
@./specs/protocol-template-schema.md
@./specs/starter-templates.md
@./specs/protocol-editor-ux.md
@./specs/template-editor-ux.md
@./specs/onboarding-flow.md

<!-- Slice already done -->
<!-- @./specs/protocol-engine-slices.md -->

@./specs/design-system/tokens.md
@./specs/design-system/components.md
@./specs/design-system/principles.md
@./specs/design-system/implementation.md
@./specs/technical-architecture.md

The ERD is in `specs/medical_erp_erd.mmd` (Mermaid format — view at https://mermaid.live).

## Architectural Principles (Non-Negotiable)

These apply to every decision. If a proposed change violates one, flag it.

1. **Multi-tenancy first** — every record has `tenant_id`. Data isolation is non-negotiable.
2. **Doctor-owned patients** — `Patient.owner_user_id` points to a doctor. Specialists take their patient relationships with them across health centers.
3. **Multi-location is core, not premium** — `Location` appears on appointments, consultations, invoices, schedules. Unlimited even in free tier.
4. **Immutable clinical records** — once a `Consultation` or `Prescription` is signed, never silently edit it. Corrections go through amendment tables.
5. **Soft deletes only** — use `deleted_at` flags. Medical data has legal retention requirements.
6. **UUIDs for all primary keys** — never auto-increment integers.
7. **Audit trail on everything** — every create/update/delete logged with who, when, what changed.
8. **Protocols as first-class citizens** — not an afterthought. Templates define structure, Protocols are instances, ProtocolVersions track every edit.

## Design System

The design system lives in `design-system/`. Import order: `tokens.css` → `components.css`.

- **`design-system/tokens.css`** — all CSS custom properties (colors, type, spacing, radius, shadows, layout)
- **`design-system/components.css`** — component styles (buttons, inputs, cards, sidebar, topbar, modals, badges, protocol blocks, etc.)
- **`design-system/reference.html`** — component library specimens; open in a browser to inspect every individual component and state
- **`design-system/app-prototype.html`** — 9-screen navigable MVP prototype (all routes: /dashboard → /ajustes); the pixel-perfect visual source of truth for each screen

**Before making any UI changes:** read `./design-system/tokens.css`, `./design-system/components.css`, and the spec docs in `./specs/design-system/` (tokens.md, components.md, principles.md, implementation.md). Use `app-prototype.html` as the screen-level reference and `reference.html` for component-level detail.

- Every color, spacing value, radius, and type size must reference a token from `tokens.css`. Never write raw hex values or arbitrary pixel sizes in component code.
- Before building any new UI, check `specs/design-system/components.md` for an existing component that fits. Only create a new component if nothing in the system covers the need — and if so, propose adding it to the system first.
- All new UI must use tokens from `tokens.css`. Components that hardcode values fail the design review.
- Follow the typography scale exactly. Do not introduce new sizes or weights.
- Stick to the defined spacing scale. No `padding: 14px` if the scale is 4/8/12/16/24/32.
- When in doubt, reference `app-prototype.html` before making a judgment call.

Key design decisions:

- **Typefaces:** Source Serif 4 (headings/display) + IBM Plex Sans (UI/body) + IBM Plex Mono (labels/data)
- **Brand color:** `#2D5760` (deep teal-slate) — not SaaS blue, not clinical green
- **Signature element:** 2px vertical teal rule marks active nav, selected items, protocol block headers
- **Hierarchy:** borders over shadows; color only for semantic meaning
- **Icons:** Phosphor Icons (regular weight) — `@phosphor-icons/web`
- **Spacing base:** 4px, scale via `--space-{1..16}` tokens
- **Radius:** 3px (sm) / 5px (md) / 8px (lg) only
- **Density:** information-dense; min touch target 44px

## Tech Stack

- **Database:** PostgreSQL (leverage JSONB for flexible fields: vitals, allergies, diagnoses, protocol content, prescription items)
- **Backend:** TBD — document here once decided
- **Frontend:** TBD — document here once decided
- **Mobile:** Responsive PWA in MVP; native iOS/Android in v2
- **Hosting:** TBD — document here once decided

## Domain Conventions

- **Language:** Spanish is the default UI language. English is a toggle. Spec docs and code are in English; user-facing strings are in Spanish.
- **Currency:** DOP primary, USD secondary.
- **Document types:** `cedula`, `passport`, `rnc` (for Dominican tax IDs).
- **No ICD-10 coding** — diagnoses are free-text. Latin American markets do not typically use ICD-10 in ambulatory care.
- **SOAP note fields:** `subjective`, `objective`, `assessment`, `plan` (plus `chief_complaint`, `vitals`, `diagnoses`).

## MVP Scope Reminder

If asked to add a feature, first check whether it's in MVP scope. The MVP includes:

- Patient management
- Multi-location management
- Appointments & calendar
- Consultations (SOAP notes)
- Prescriptions
- Basic billing/invoicing
- Protocol engine (full — tenant-owned templates, types, onboarding, and protocol CRUD)

Features explicitly out of MVP: telemedicine, lab integrations, inventory, patient portal, insurance claims, multi-user, template versioning, cross-tenant sharing, protocol-to-consultation integration. If a feature request falls in the out-of-scope list, flag it and ask whether to defer.

**For protocol engine work specifically**, the source of truth for what's been built and what's next is `specs/protocol-engine-slices.md`. Read it before starting any protocol engine slice — it encodes architectural decisions and slice boundaries that aren't repeated elsewhere.

## Code Conventions

> To be filled in as implementation begins. Add conventions here as we establish them.

- (placeholder) Indentation: 2 spaces
- (placeholder) Naming: snake_case for DB, camelCase for TypeScript
- (placeholder) Tests live alongside source in `__tests__/` directories

## Commands

- Build: `pnpm build`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Lint (auto-fix): `pnpm lint:fix`
- Dev server: `pnpm dev`

## Code Quality Rule

**Always run `pnpm lint` before finishing any task.** Fix all lint errors before reporting the task as done. Zero lint errors is the bar. If a lint error cannot be fixed cleanly, note it explicitly.

## Changelog Rule

**After every completed task, prepend a new entry to `CHANGELOG.md`.** Use the date format `[YYYY-MM-DD]` with a short title, then bullet points under `### Added`, `### Changed`, and/or `### Fixed` as applicable. Keep entries factual and specific — name the files, components, or endpoints affected. Do not wait for a commit; update the changelog as part of completing the task.

## When in Doubt

- Check the spec files in `specs/` before making design decisions
- For architecture questions, consult `full-scope.md` for the long-term vision
- For "is this in scope?" questions, consult `mvp-scope.md`
- If the user asks about something not covered in specs, ask before inventing

## Non-Goals

Things this system is explicitly NOT trying to be:

- A hospital information system (HIS) for inpatient care
- A standalone telemedicine platform
- A pure insurance claim processor
- A generic international EHR
