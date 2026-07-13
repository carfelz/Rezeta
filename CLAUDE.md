# Medical ERP — Claude Code Project Memory

> This file is loaded automatically at the start of every Claude Code session.
> Keep it concise (target <200 lines). For details, use @imports to spec files.

## Project Overview

A medical ERP built for Latin American (specifically Dominican Republic) medical specialists. Scales from solo practitioner to multi-location clinic. The differentiating feature is a **protocol engine** that lets doctors define reusable clinical protocols from templates (checklists, algorithms, decision trees, dosage tables, etc.).

**Target market:** solo specialists in the DR who consult at 2–4 different health centers per week.

**Primary differentiator:** native multi-location support (free tier includes unlimited locations) + first-class protocol engine.

## Specification Documents

<!-- @./specs/mvp-scope.md
@./specs/full-scope.md
@./specs/business-model.md
@./specs/medical_erp_erd.mmd
@./specs/protocol-template-schema.md
@./specs/starter-templates.md
@./specs/protocol-editor-ux.md
@./specs/template-editor-ux.md
@./specs/onboarding-flow.md
@./specs/remaining-mvp-slices.md
@./specs/design-system/tokens.md
@./specs/design-system/components.md
@./specs/design-system/principles.md
@./specs/design-system/implementation.md
@./specs/technical-architecture.md
@./specs/audit-log-implementation-prompt.md
@./specs/01-rezeta-live-audit.md
@./specs/02-claude-code-handoffs.md
@./specs/03-claude-design-handoff.md
@./specs/04-rezeta-improvements.md -->

The ERD is in `specs/medical_erp_erd.mmd` (Mermaid format — view at https://mermaid.live). ⚠️ The ERD is **pre-v2** (shows SOAP columns, `user_id`, 3-layer protocol). The authoritative current schema is `packages/db/prisma/schema.prisma`.

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

## Specs

**Canonical (v2, workflow-first redesign — shipped):** `specs/updated-specs/` is the source of truth for the consultation workflow and protocol model. Start here.

- Overview / what changed: `specs/updated-specs/00-overview.md`
- Consultation workflow (no gate, walk-in + planned, clinical content in blocks): `specs/updated-specs/01-consultation-workflow.md`
- Protocol model (**2-layer:** Template + Protocol + Category, no ProtocolType): `specs/updated-specs/02-protocol-model.md`
- Orders & documents: `specs/updated-specs/03-orders-and-documents.md`
- Audit log spec: `specs/audit-log-spec.md`

**Superseded (kept for history — do not treat as current):** `specs/protocol-in-consultation-spec.md`, `specs/protocol-template-schema.md`, `specs/protocol-engine-slices.md`. These describe the pre-v2 design (consultation gate, 3-layer protocol, fixed SOAP) and are replaced by `specs/updated-specs/`.

**Doc currency marker:** every reconciled spec leads with a `STATUS:` banner — `SUPERSEDED` (do not implement from it), `PARTIAL` (some sections stale; banner says which), or `STALE` (diagram out of date). Run `grep -rn "STATUS:" specs/` to audit currency. Specs with no banner predate the marker — verify against `specs/updated-specs/` and `packages/db/prisma/schema.prisma` before trusting consultation/protocol details.

## Design System

When implementing a design from a handoff bundle, match the visual exactly. Use the exact spacing, colors, and component structure from the bundle. Do not refactor, improve, or simplify. If a deviation is necessary (e.g., a referenced component doesn't exist or there's an accessibility issue), state it explicitly before making the change.

The frontend uses **React + Tailwind CSS + Radix UI + CVA** (shadcn-style). Design tokens live in `apps/web/src/index.css` as CSS custom properties; Tailwind consumes them via `tailwind.config.ts`.

**Key files:**

- **`apps/web/src/index.css`** — all CSS custom properties (colors, type, spacing, radius, shadows, layout, shadcn contract, semantic FG/BG aliases)
- **`apps/web/tailwind.config.ts`** — maps tokens to Tailwind utility classes (`text-n-700`, `bg-p-500`, `border-n-200`, etc.)
- **`apps/web/src/components/ui/`** — React components (Button, Card, Badge, Input, Modal, Tabs, etc.) built on Radix UI + CVA
- **`design-system/colors_and_type.css`** — merged token file + semantic element rules (h1–h6, p, a, code) for standalone HTML documents
- **`design-system/shadcn-tokens.css`** — Rezeta → shadcn CSS variable mapping reference
- **`design-system/ui_kit/index.html`** — interactive 5-screen prototype; open in a browser as the pixel-perfect screen-level reference
- **`design-system/reference.html`** — static component specimen library (self-contained, browser-ready)
- **`design-system/app-prototype.html`** — static 9-screen navigable MVP prototype (self-contained, browser-ready)
- **`design-system/assets/`** — `logo.svg` and `logo-mark.svg`
- **`pnpm storybook`** — live component reference for React code

**Before making any UI changes:** read `apps/web/src/index.css` and the spec docs in `./specs/design-system/`. Use `design-system/ui_kit/index.html` as the screen-level reference and `design-system/reference.html` for component-level detail.

- Every color, spacing value, radius, and type size must reference a token from `index.css`. Never write raw hex values or arbitrary pixel sizes in component code.
- In Tailwind: use `text-n-700`, `bg-p-500`, `border-n-200`, `rounded-sm`, `shadow-floating` — never raw CSS values.
- Before building any new UI, check `specs/design-system/components.md` and `apps/web/src/components/ui/` for an existing component that fits. Only create a new component if nothing in the system covers the need.
- Follow the typography scale exactly. Do not introduce new sizes or weights.
- **Font size — always a token, never raw pixels.** The base UI text size is **`text-sm` (13px)** and the small size is **`text-xs` (12px)**; use these for body/UI text. The full scale is `text-2xs` (10) · `text-overline` (11) · `text-xs` (12) · `text-sm` (13) · `text-base` (14) · `text-body-lg` (16) · `text-h3` (18) · `text-h2` (28) · `text-h1` (40) · `text-display` (56). **Never write `text-[13px]` or any `text-[..px]`/`text-[..rem]`** — an ESLint `no-restricted-syntax` guardrail fails CI on raw pixel/rem font sizes. Round to the nearest token instead of inventing a size.
- Stick to the defined spacing scale. No `p-[14px]` if the scale is 1/2/3/4/5/6/8/10/12/16.
- When in doubt, reference `design-system/ui_kit/index.html` before making a judgment call.

Key design decisions:

- **Typefaces:** Source Serif 4 (headings/display) + IBM Plex Sans (UI/body) + IBM Plex Mono (labels/data)
- **Brand color:** `#2D5760` (deep teal-slate) — not SaaS blue, not clinical green
- **Signature element:** 2px vertical teal rule marks active nav, selected items, protocol block headers
- **Hierarchy:** borders over shadows; color only for semantic meaning
- **Icons:** Phosphor Icons (regular weight) — `@phosphor-icons/web` (`<i className="ph ph-{name}">`)
- **Spacing base:** 4px, scale via `--space-{1..16}` tokens / Tailwind `p-1` through `p-16`
- **Radius:** 3px (sm) / 5px (md) / 8px (lg) only — `rounded-sm`, `rounded-md`, `rounded-lg`
- **Density:** information-dense; min touch target 44px (`min-h-touch`)

## Tech Stack

- **Database:** PostgreSQL (leverage JSONB for flexible fields: vitals, allergies, diagnoses, protocol content, prescription items)
- **Backend:** Node.js + NestJS + Prisma (see `specs/technical-architecture.md`)
- **Frontend:** React 18 + Vite + Tailwind CSS + Radix UI + CVA (shadcn-style) + TanStack Query + Zustand
- **Mobile:** Responsive PWA in MVP; native iOS/Android in v2
- **Hosting:** Google Cloud Platform (Cloud Run API, GCS + CDN frontend)

## Domain Conventions

- **Language:** **Everything written in this repository is in English — with exactly one exception: user-facing UI strings, which are in Spanish (the default UI language; English is a runtime toggle).** "Everything" means all code, comments, commit messages, `CHANGELOG.md`, `README.md`, spec docs, plan docs, decision docs, test descriptions, and any other prose you author. The ONLY Spanish that belongs in the codebase is the literal text shown to end users (colocated UI strings, toasts, labels). If you are writing Spanish anywhere other than a user-facing string, stop — it must be English. Never write a Spanish `CHANGELOG.md` entry.
- **Currency:** DOP primary, USD secondary.
- **Document types:** `cedula`, `passport`, `rnc` (for Dominican tax IDs).
- **No ICD-10 coding** — diagnoses are free-text. Latin American markets do not typically use ICD-10 in ambulatory care.
- **Clinical documentation (v2):** `Consultation` no longer has fixed SOAP columns. It is an administrative container (status `open` → `signed` → `amended`); all clinical content — notes, vitals, diagnoses — lives in `ProtocolUsage` blocks (e.g. `clinical_notes`, `vitals`). See `specs/updated-specs/01-consultation-workflow.md`. (The legacy `subjective/objective/assessment/plan` SOAP fields were removed in the schema reset.) **Protocols are the only content-entry surface** — there is no SOAP form, no view-mode toggle, and no "Nota libre" free-form fallback. To document, a doctor must add a protocol; a consultation with zero `ProtocolUsage` records cannot be signed (`CONSULTATION_REQUIRES_PROTOCOL`).

## Current Version

**v0.0.1 — MVP shipped (2026-05-01).** All seven MVP modules are complete and deployed.

| Module                                | Status  |
| ------------------------------------- | ------- |
| Patient management                    | ✅ Done |
| Multi-location management + schedules | ✅ Done |
| Appointments & calendar               | ✅ Done |
| Consultations (workflow-first)        | ✅ Done |
| Prescriptions                         | ✅ Done |
| Basic billing / invoicing             | ✅ Done |
| Protocol engine (full)                | ✅ Done |
| Audit log                             | ✅ Done |

**Workflow-first redesign — SHIPPED (2026-06-08), deployed to dev.** Plans 01–04 (`docs/superpowers/plans/2026-05-26-0{1..4}-*.md`) are all merged to `main` and live. What shipped:

- **No consultation gate.** Two equal entry paths — planned (from appointment) and walk-in (patient + location only). Protocols are addable at any point during the encounter.
- **SOAP removed** as fixed columns; clinical content lives in `ProtocolUsage` blocks (`vitals`, `clinical_notes`, checklist, etc.).
- **3-zone consultation layout:** fixed header (patient + allergy alerts) · scrollable protocol panel · right rail (Recetas / Laboratorio / Imagen orders).
- **2-layer protocol model:** `ProtocolType` removed; `ProtocolCategory` (name + color) replaces it as a filter, not a hierarchy layer.
- **Atomic sign:** "Firmar y cerrar" completes all protocol usages and signs all queued orders in one transaction; signed consultations correct via `ConsultationAmendment`.

The old "Hybrid redesign" (consultation gate, protocol strip, view-mode toggle, multi-protocol canvas) was superseded by this. Canonical spec: `specs/updated-specs/`.

Work now targets **v1.5** features (see `specs/full-scope.md` Phase 2). If asked to add a feature, check `specs/full-scope.md` for its target phase before starting. Features explicitly deferred: telemedicine, lab integrations, inventory, patient portal, insurance claims, multi-user, template versioning, cross-tenant sharing.

## Code Conventions

- Indentation: 2 spaces
- Naming: `snake_case` for DB columns/tables, `camelCase` for TypeScript
- Tests live alongside source in `__tests__/` directories
- Zod schemas in `packages/shared/src/schemas/` — shared between API validation and frontend forms
- Error codes: closed enum in `packages/shared/src/errors.ts`
- Repository layer always filters by `tenant_id` (or `userId` for tenant-less models like ScheduleBlock)
- Hard deletes only on models without `deleted_at` (e.g. ScheduleBlock, ScheduleException); soft deletes everywhere else

## Commands

- Build: `pnpm build`
- Test: `pnpm test`
- Lint: `pnpm lint`
- Lint (auto-fix): `pnpm lint:fix`
- Dev server: `pnpm dev`

## No TODO Markers

Don't leave `TODO`, `FIXME`, `HACK`, or `XXX` comments in source. Either fix the issue now or capture it in the ticket tracker. ESLint rule `no-warning-comments` enforces this and will fail CI.

## Code Quality Rule

**Always run `pnpm lint` before finishing any task.** Fix all lint errors before reporting the task as done. Zero lint errors is the bar. If a lint error cannot be fixed cleanly, note it explicitly.

## Test Rule

**Always run `pnpm test` before finishing any task.** Zero failing tests is the bar. If you add new code, add the corresponding tests. Minimum 90% coverage across all packages (statements, branches, functions, lines). Run `pnpm test:coverage` to check coverage numbers.

## Changelog Rule

**After every completed task, prepend a new entry to `CHANGELOG.md`.** Use the date format `[YYYY-MM-DD]` with a short title, then bullet points under `### Added`, `### Changed`, and/or `### Fixed` as applicable. Keep entries factual and specific — name the files, components, or endpoints affected. Do not wait for a commit; update the changelog as part of completing the task. **Write the entry in English** (see Domain Conventions → Language) — title and body. A Spanish changelog entry is never acceptable.

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
