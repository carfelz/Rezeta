# Technical Architecture

> Living document. Last updated: April 2026.
>
> This document specifies the technical architecture, stack, infrastructure, and conventions for the Medical ERP. It is the bridge between the product specs and the actual codebase.

## Table of Contents

1. [Stack Summary](#1-stack-summary)
2. [System Architecture](#2-system-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database & Data Access](#6-database--data-access)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [API Design Conventions](#8-api-design-conventions)
9. [Multi-Tenancy & Data Isolation](#9-multi-tenancy--data-isolation)
10. [Audit Logging & Immutability](#10-audit-logging--immutability)
11. [File Storage & Attachments](#11-file-storage--attachments)
12. [Background Jobs & Scheduled Tasks](#12-background-jobs--scheduled-tasks)
13. [Observability](#13-observability)
14. [Security Baseline](#14-security-baseline)
15. [Environments & Deployment](#15-environments--deployment)
16. [Development Workflow](#16-development-workflow)
17. [Compliance Considerations](#17-compliance-considerations)
18. [Deferred Decisions](#18-deferred-decisions)

---

## 1. Stack Summary

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Language** | TypeScript (end-to-end) | One type system across frontend and backend, shared types |
| **Frontend** | React + Vite | Fast dev server, simple mental model, no SSR complexity needed |
| **Backend** | Node.js + NestJS | Structured DI framework, decorators, excellent REST + validation, scales with codebase size |
| **Database** | PostgreSQL on Google Cloud SQL | Managed, production-grade, supports JSONB & GIN indexes |
| **ORM** | Prisma | Strong TypeScript integration, migrations, good mental model |
| **Auth** | Firebase Authentication | Google-native on GCP, cheap, handles email/password + OAuth |
| **API style** | REST over HTTPS (JSON) | Well-understood, easy to document and test |
| **Hosting** | Google Cloud Platform | Cleaner DX than AWS, Vertex AI for future Claude integration |
| **File storage** | Google Cloud Storage | Native GCP, signed URLs for secure access |
| **Background jobs** | Cloud Tasks + Cloud Run workers | Native, scales to zero, simple to reason about |
| **Email** | SendGrid or Resend | Transactional email, appointment reminders, invoices |
| **Monitoring** | Cloud Logging + Sentry | Platform-native logs + error tracking |
| **CI/CD** | GitHub Actions → Cloud Run | Straightforward, low-friction |

## 2. System Architecture

### High-Level Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                         Users (Doctors)                        │
│              Web browser • PWA • (Native apps in v2)           │
└────────────────────────────────┬───────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│         React + Vite SPA (GCS bucket + Cloud CDN)             │
│  Static HTML/JS/CSS • No server • Custom domain + HTTPS        │
└────────────────────────────────┬───────────────────────────────┘
                                 │ REST (JSON over HTTPS)
                                 │ Firebase ID token in Authorization header
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│          Node.js API Service (Cloud Run service)               │
│     NestJS • Prisma • Zod validation • Auth guards             │
└───┬─────────────────┬───────────────────┬───────────────┬──────┘
    │                 │                   │               │
    ▼                 ▼                   ▼               ▼
┌───────────┐   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Cloud SQL │   │   Firebase   │  │ Google Cloud │  │ Cloud Tasks  │
│ Postgres  │   │     Auth     │  │   Storage    │  │  (async jobs)│
└───────────┘   └──────────────┘  └──────────────┘  └──────┬───────┘
                                                           │
                                                           ▼
                                                  ┌──────────────┐
                                                  │ Worker Svc   │
                                                  │ (Cloud Run)  │
                                                  └──────────────┘
```

### Why Split Frontend and API

- **No server for the frontend.** The React + Vite SPA is static files served from CDN — there is no frontend server to manage, scale, or secure.
- **Independent scaling.** API traffic has different characteristics than web traffic (sessions, long-running queries, background sync).
- **Independent auditing.** Compliance reviewers can examine the API service in isolation.
- **Independent deployment cadence.** Frontend updates (a new static build) can ship without restarting the API.
- **Future mobile.** When native apps arrive in v2, they consume the same API with no changes to the backend.

## 3. Repository Structure

Single repo, monorepo layout once code starts arriving. Until then, the `specs/` folder is all that exists.

```
medical-app/
├── CLAUDE.md
├── README.md
├── specs/                          # all written specifications
├── apps/
│   ├── web/                        # React + Vite frontend
│   └── api/                        # Node.js REST API
├── packages/
│   ├── db/                         # Prisma schema + generated client
│   ├── shared/                     # shared types, validation schemas, constants
│   └── design-system/              # component library + tokens
├── infra/                          # IaC (Terraform or gcloud scripts)
├── .github/workflows/              # CI/CD
└── tools/                          # scripts, seeds, dev helpers
```

Package manager: **pnpm** with workspaces. Smaller install, faster, better monorepo support than npm.

## 4. Frontend Architecture

### Framework

**React 18 + Vite**. No SSR — the app is a fully client-side SPA served from Google Cloud Storage + Cloud CDN. Vite handles the dev server and production build. This keeps the frontend simple: no server to manage, no hydration complexity, instant hot module replacement during development.

### Styling

**Tailwind CSS** + component library built on **Radix UI** primitives. The design system tokens (from Claude Design → Figma output) become the Tailwind config's theme values.

### State Management

**Zustand** for all global client state — active location switcher, authenticated user, open modals, protocol editor state, notification queue. Zustand's minimal API keeps the store easy to reason about and test.

For server state (data fetching, caching, mutations), **TanStack Query (React Query)** sits alongside Zustand. The distinction is clear: Zustand owns UI state, TanStack Query owns remote data. They do not overlap.

No Redux. The problems Redux solves don't exist in this architecture.

### Forms

**React Hook Form + Zod** for validation. The Zod schemas live in `packages/shared` so the backend uses the same schemas for request validation. One definition, two consumers.

### Routing

**React Router v7** (library mode, not framework mode). Route structure mirrors product concepts:

```
/dashboard
/agenda
/pacientes
/pacientes/:patientId
/pacientes/:patientId/consultas/:consultationId
/protocolos
/protocolos/:protocolId/edit
/facturacion
/ajustes
```

### Data Fetching

Calls to the API go through a thin client in `packages/shared/api-client.ts`. It attaches the Firebase ID token automatically and throws typed errors. Each domain gets its own hook layer built on TanStack Query:

```ts
usePatients(), usePatient(id), useCreatePatient(), useUpdatePatient(id), ...
```

### Internationalization

**i18next + react-i18next** for Spanish/English toggling. Default: Spanish (DR locale, `es-DO`).

### Build & Serving

Vite produces a static bundle (`dist/`) that is deployed to a GCS bucket and served via Cloud CDN with a custom domain and HTTPS. No Node.js server involved in serving the frontend.

```
Vite build → dist/ → GCS bucket → Cloud CDN → users
```

### Performance Targets

- First contentful paint < 1.5s on 4G
- Time to interactive < 3s on 4G
- Bundle size budget < 250 KB gzipped for the app shell
- Lighthouse performance score > 85 on desktop

## 5. Backend Architecture

### Framework Choice: NestJS

**NestJS** on Node.js. Chosen for:

- **Opinionated structure.** Modules, controllers, services, providers, guards, interceptors. The skeleton of the app is dictated by the framework, which is a feature, not a limitation, for a team growing from 1 to many.
- **First-class TypeScript.** Decorators, dependency injection, and class-based design feel native rather than bolted on.
- **Built-in patterns for what we need.** Guards (auth), interceptors (audit logging, response wrapping), pipes (validation), exception filters (error handling) — each cross-cutting concern has an idiomatic home.
- **Swagger auto-generation.** OpenAPI specs generated from decorators, kept in sync with code, no drift.
- **Scales with the codebase.** Small apps and large apps both feel natural in NestJS. Express starts small and gets messy; Fastify is fast but unstructured.

### Service Architecture: Modular Monolith

The API is a **modular monolith**: one deployable service, internally organized as clean modules with enforced boundaries. The separate worker service (Section 12) is the only split at this stage.

#### Why Not Microservices

Microservices solve problems we do not yet have:

- **Organizational coordination** — we have one developer, not ten teams.
- **Independent scaling of divergent workloads** — our workloads are similar and light.
- **Technology heterogeneity** — everything is TypeScript and benefits from staying that way.
- **Fault isolation** — our domain is tightly integrated (a consultation needs a patient, which needs a location, etc.); isolating them gains little.

And they introduce problems we do not want:

- **Distributed transactions** — medical invariants like "signing a consultation generates an invoice and marks the appointment complete" become sagas with compensation logic across services. In a monolith this is one database transaction.
- **Network failures as a category** — every cross-service call can time out, retry, or fail, multiplying edge cases.
- **Operational overhead** — N pipelines, N monitoring targets, N deployments, N runbooks. For one developer this is a heavy tax.
- **Premature domain boundaries** — we will learn the right boundaries from building, not from architecting up front. Getting service boundaries wrong is much more expensive to fix than getting module boundaries wrong.
- **Compliance surface area** — every service is another audit target, another log source, another network boundary to secure. Medical compliance favors fewer moving parts.

#### Why a Modular Monolith Specifically

A modular monolith gives us most of what microservices promise (clean boundaries, domain ownership, testability) without the distributed-systems costs. Module boundaries are enforced in code rather than in infrastructure, and the module organization is designed so that any module could be extracted into its own service later without major rewrites — **if and when we have measurable evidence we need to**.

#### When to Revisit (Triggers for Extraction)

The spec commits to revisiting service extraction only when we hit one of these triggers:

1. **Measured contention** — one module's load is materially hurting another's latency, and scaling the whole app is wasteful.
2. **Team boundaries** — a dedicated team owns a domain end-to-end and wants to deploy on its own schedule.
3. **Compliance isolation** — e.g., PCI-DSS for payment data forces physical separation.
4. **Technology divergence** — a module genuinely needs a different language or runtime (e.g., ML, high-performance compute).
5. **Reuse across products** — the module becomes a shared service powering multiple products.

None of these are true today. We will re-evaluate, not refactor preemptively.

### Layering Inside the Monolith

A clean three-layer architecture inside each module:

```
Controllers (HTTP concerns)
  ↓ calls
Services (business logic)
  ↓ uses
Repositories (Prisma queries)
```

- **Controllers** handle request/response shapes, routing, and orchestration of services. No business rules.
- **Services** encapsulate business rules (e.g., "a signed consultation cannot be modified; it must go through an amendment"). Injected via DI, unit-testable in isolation.
- **Repositories** own the Prisma calls. Centralized query logic, easy to mock when testing services.

### Module Boundary Rules

To preserve the option of extracting modules later:

- **No module imports another module's internals.** Only the module's public exports (from `index.ts`) are visible outside.
- **No cross-module database joins through Prisma.** When module A needs data from module B, it calls module B's service.
- **No shared tables between modules.** Each domain entity has a clear owning module.
- **Cross-cutting concerns live in shared infrastructure**, not in modules. Auth, audit logging, tenancy enforcement are framework-level (NestJS guards and interceptors), not module-specific.

These rules are enforced by convention today and by ESLint rules once the codebase is large enough to justify automation.

### Folder Structure (inside `apps/api`)

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── patients/
│   │   │   ├── patients.module.ts
│   │   │   ├── patients.controller.ts
│   │   │   ├── patients.service.ts
│   │   │   ├── patients.repository.ts
│   │   │   ├── dto/
│   │   │   │   ├── create-patient.dto.ts
│   │   │   │   └── update-patient.dto.ts
│   │   │   ├── patients.service.spec.ts
│   │   │   └── index.ts                    # public exports
│   │   ├── appointments/
│   │   ├── consultations/
│   │   ├── prescriptions/
│   │   ├── protocols/
│   │   ├── invoices/
│   │   └── ...
│   ├── common/
│   │   ├── guards/
│   │   │   ├── firebase-auth.guard.ts
│   │   │   └── tenant.guard.ts
│   │   ├── interceptors/
│   │   │   ├── audit-log.interceptor.ts
│   │   │   └── response-envelope.interceptor.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── pipes/
│   │   │   └── zod-validation.pipe.ts
│   │   └── decorators/
│   │       ├── current-user.decorator.ts
│   │       └── tenant-id.decorator.ts
│   ├── lib/
│   │   ├── prisma.service.ts
│   │   ├── firebase.service.ts
│   │   ├── storage.service.ts
│   │   └── logger.service.ts
│   ├── config/
│   │   └── configuration.ts
│   ├── app.module.ts
│   └── main.ts
├── test/                                    # e2e tests
└── tsconfig.json
```

(Prisma schema itself lives in `packages/db` and is consumed as a workspace dependency.)

### Validation

**Zod** for every request body, query parameter, and path parameter via a custom `ZodValidationPipe`. Schemas live in `packages/shared` so frontend and backend use the same definitions. Response shapes are also Zod-validated in development to catch drift early.

### Error Handling

A global `HttpExceptionFilter` translates thrown errors into a consistent JSON envelope:

```ts
{
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient with ID xyz does not exist",
    "details": {}  // optional structured context
  }
}
```

Error codes are a closed enum defined in `packages/shared/errors.ts`. Every error the API can return has a code; clients switch on codes, not on prose messages.

### Cross-Cutting Concerns via NestJS Primitives

- **Authentication:** `FirebaseAuthGuard` verifies the ID token on every request, populates `req.user`.
- **Tenancy:** `TenantGuard` resolves `req.tenantId` from the authenticated user and makes it available via a `@TenantId()` parameter decorator.
- **Audit logging:** `AuditLogInterceptor` writes an entry for every mutation.
- **Response envelope:** `ResponseEnvelopeInterceptor` wraps successful responses in `{ data: ... }`.
- **Validation:** `ZodValidationPipe` on every controller method.
- **Error handling:** `HttpExceptionFilter` at the application level.

These are applied globally in `app.module.ts` so every endpoint inherits them automatically.

## 6. Database & Data Access

### Hosting

**Google Cloud SQL for PostgreSQL 16** (or latest GA). Start with a small instance (2 vCPU, 8 GB RAM, SSD), automatic backups, point-in-time recovery enabled. Scale vertically first; read replicas only when needed.

### Connection Pooling

**PgBouncer** in front of Cloud SQL (or Cloud SQL's built-in connection pool). Prisma uses the pooled connection string for app queries and the direct connection string for migrations.

### ORM: Prisma

Prisma schema lives in `packages/db/schema.prisma`. The generated client is imported by the API service.

Migration flow:

```
Dev: prisma migrate dev --name add_patient_owner
CI:  prisma migrate deploy
```

All migrations are checked into source control. No destructive operations without explicit review.

### Schema Hygiene

- Every table has `id UUID`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, and (where appropriate) `deleted_at TIMESTAMPTZ` for soft deletes.
- `tenant_id` is required on every tenant-scoped table and indexed.
- Foreign keys use `ON DELETE RESTRICT` by default (no cascading deletes for patient data).
- JSONB columns get GIN indexes if they are searched.

### Seeding

A seed script in `tools/seed.ts` populates:

- The five system protocol templates (see `starter-templates.md`)
- A demo tenant with sample patients, locations, and appointments for development
- Never runs in production.

## 7. Authentication & Authorization

### Authentication: Firebase Auth

- **Methods:** email/password + Google OAuth. SMS and Apple Sign In deferred.
- **Token flow:**
  1. User signs in on the frontend using Firebase JS SDK
  2. Frontend receives an ID token (JWT)
  3. Frontend attaches `Authorization: Bearer <token>` on every API request
  4. A global `FirebaseAuthGuard` verifies the token using the Firebase Admin SDK on every request
  5. If valid, the guard populates `req.user` with the resolved `User` row; controllers access it via `@CurrentUser()`

### User Model

Firebase owns the **identity** (email, password hash, OAuth providers). The application database owns the **profile** (medical license, specialty, tenant, role).

On first login, a `User` row is created in Postgres linked to the `firebaseUid`. All subsequent logins look up the existing row.

```
User
├── id (UUID, our primary key)
├── firebase_uid (string, indexed, unique)
├── tenant_id (FK → Tenant)
├── email (cached from Firebase)
├── full_name
├── role
├── specialty
├── license_number
└── ...
```

### Authorization: Tenant-scoped, Role-aware

Every API endpoint passes through two global guards, applied in order:

1. **`FirebaseAuthGuard`** — verifies the Firebase ID token, resolves the `User` record from Postgres, populates `req.user`.
2. **`TenantGuard`** — reads `tenant_id` from the authenticated user, exposes it via `req.tenantId` and the `@TenantId()` decorator for use in repositories.

Role-based authorization uses NestJS metadata + a `RolesGuard` that reads `@Roles('owner')` decorators on endpoints that require elevated permissions.

Roles in MVP: `owner`, `doctor`. Richer RBAC (assistant, admin, billing) is deferred to when multi-user lands.

### Session Lifetime

Firebase ID tokens expire after 1 hour. The Firebase SDK refreshes them automatically. No server-side sessions to manage.

### Signout

Frontend calls Firebase `signOut()`. Token becomes unusable on next request. No server-side revocation endpoint needed for MVP (Firebase handles revocation for password changes).

## 8. API Design Conventions

### URL Style

- Resource-oriented nouns, plural: `/patients`, `/appointments`, `/consultations`
- Nested for hierarchy: `/patients/:patientId/consultations`
- Actions that don't map to CRUD use verb subpaths: `/consultations/:id/sign`, `/protocols/:id/fork`

### HTTP Methods

- `GET` — read
- `POST` — create (or execute an action)
- `PATCH` — partial update
- `PUT` — full replacement (rarely used)
- `DELETE` — soft delete (sets `deleted_at`)

### Response Envelopes

Success:
```json
{
  "data": { ... }
}
```

Error:
```json
{
  "error": { "code": "...", "message": "...", "details": {} }
}
```

Lists include pagination:
```json
{
  "data": [ ... ],
  "pagination": { "cursor": "...", "has_more": true, "limit": 50 }
}
```

### Pagination

Cursor-based. No offset pagination — it scales badly for medical data lists and introduces consistency issues.

### Versioning

URL-prefixed: `/v1/patients`. We do not expect to ship `/v2` soon, but reserving the prefix avoids a painful migration later.

### Idempotency

Destructive or resource-creating endpoints (`POST /invoices`, `POST /prescriptions/:id/send`) accept an optional `Idempotency-Key` header. Results are cached by key for 24 hours.

## 9. Multi-Tenancy & Data Isolation

### Model: Shared Database, Tenant-Scoped Rows

- One Postgres database, one schema
- Every tenant-scoped table has `tenant_id`
- Every query is filtered by `tenant_id` resolved by the `TenantGuard`

### Enforcement Layers

1. **`TenantGuard`** injects `tenantId` from the authenticated user into the request context
2. **Repository layer** always includes `tenant_id` in query filters (via the `@TenantId()` parameter decorator)
3. **Prisma extension** (optional hardening) automatically injects `tenant_id` into `where` clauses across all tenant-scoped models — belt and suspenders

### What Is Not Tenant-Scoped

- **System-provided protocol templates** — `tenant_id` is nullable; null means "global/system"
- **`User` rows** — each has a tenant, but a superadmin internal tool may query across them

### Future: Physical Isolation

For the Enterprise tier (likely hospitals with strict data residency), a migration path to separate databases per tenant may be needed. Design today keeps that door open by never using cross-tenant joins.

## 10. Audit Logging & Immutability

### Audit Table

A single `audit_log` table captures every mutation across the system:

```
AuditLog
├── id (UUID)
├── tenant_id (FK)
├── user_id (FK)
├── entity_type (string) — 'Patient', 'Consultation', etc.
├── entity_id (UUID)
├── action (enum) — 'create', 'update', 'delete', 'sign', 'amend'
├── changes (JSONB) — diff for updates
├── ip_address
├── user_agent
└── created_at
```

### How Entries Are Written

A NestJS `AuditLogInterceptor` wraps every controller invocation. On successful mutations it writes an audit entry inside the same database transaction as the mutation itself, so the two either commit together or roll back together. A Prisma extension backs this up at the ORM level for mutations not triggered through controllers (e.g., seed scripts, background jobs).

### Immutable Clinical Records

Per the protocol spec and data model:

- `Consultation` with `status: 'signed'` is **read-only at the service layer**. The service refuses to update mutable fields on signed consultations.
- Corrections go through `ConsultationAmendment` table.
- `Prescription` follows the same pattern.
- `Invoice` is locked once `status = 'issued'`.

This is enforced in the service layer, not just the UI. The API rejects updates to locked records with a clear error code.

## 11. File Storage & Attachments

### Storage: Google Cloud Storage

- One bucket per environment (`medical-erp-dev-uploads`, `medical-erp-prod-uploads`)
- Uniform bucket-level access, no public objects
- Customer-managed encryption keys (CMEK) for production

### Upload Flow

1. Client requests a **signed upload URL** from the API (short-lived, scoped to tenant + entity)
2. Client uploads directly to GCS using the signed URL
3. Client notifies the API of upload completion
4. API records the attachment in the `Attachment` table

Direct-to-GCS uploads keep the API service out of the data path for large files.

### Download Flow

1. Client requests a **signed download URL** for an attachment
2. API verifies the user has access to the parent entity
3. API returns a short-lived signed URL (5-minute TTL)
4. Client downloads directly from GCS

### File Types

Whitelist: images (jpg, png, webp, heic), PDFs, DICOM (future). Hard limit: 25 MB per file. Virus scanning via Cloud Scanner API on production uploads.

## 12. Background Jobs & Scheduled Tasks

### Queue: Google Cloud Tasks

- API service enqueues tasks (send reminder, generate PDF, process upload)
- Worker service (separate Cloud Run service) consumes them
- At-least-once delivery with idempotency keys

### Scheduled Tasks

- **Cloud Scheduler** triggers HTTP endpoints on the worker for recurring jobs
- Examples: nightly database backups verification, appointment reminder batches, license expiration checks

### What Is Async in MVP

- Sending appointment reminders (email/SMS)
- Generating PDF prescriptions and invoices
- Virus scanning uploaded files
- Daily backup verification

Everything user-facing in the UI is synchronous.

## 13. Observability

### Logs

All services log structured JSON to stdout. Cloud Logging captures them. Log schema:

```json
{
  "timestamp": "...",
  "level": "info",
  "service": "api",
  "trace_id": "...",
  "tenant_id": "...",
  "user_id": "...",
  "message": "...",
  "context": { ... }
}
```

Sensitive fields (passwords, tokens, PII beyond what's necessary) are never logged.

### Errors

**Sentry** on both frontend and backend. Captures exceptions, performance traces, and source maps.

### Metrics

Cloud Monitoring dashboards for:

- Request latency per endpoint (p50, p95, p99)
- Error rate per endpoint
- Database query time
- Queue depth
- Active users per tenant

### Alerts

At minimum:

- API error rate > 2% for 5 minutes
- API p95 latency > 2s for 5 minutes
- Database connection pool exhaustion
- Worker queue backing up (>100 pending tasks for 10 minutes)
- Any 5xx from billing-related endpoints (zero tolerance)

## 14. Security Baseline

### Transport

- HTTPS everywhere, enforced by Cloud Run ingress
- HSTS headers on the frontend
- TLS 1.3 minimum

### Secrets Management

- **Secret Manager** (GCP native) for all secrets
- No secrets in env files committed to git
- Workload Identity for service-to-service auth (Cloud Run → Cloud SQL, Cloud Run → GCS)

### Input Validation

- Every endpoint validates with Zod before business logic runs
- Parameterized queries only (Prisma handles this)
- File uploads limited by size, type, and scanned for malware

### Output Sanitization

- Markdown rendered on the frontend uses a sanitizer (DOMPurify) to prevent XSS
- PDFs generated server-side using a trusted library (e.g., React PDF)

### Rate Limiting

- Cloud Armor or API-layer middleware for per-IP and per-user rate limits
- Stricter limits on auth endpoints to prevent credential stuffing

### Security Headers

Frontend ships with:

- `Content-Security-Policy` restricting script sources
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Dependency Hygiene

- Renovate bot for dependency updates
- Weekly `npm audit` / `pnpm audit` in CI
- Snyk scanning on each PR

## 15. Environments & Deployment

### Environments

- **Local** — Docker Compose: Postgres, Firebase emulator, local cloud storage emulator
- **Dev** — GCP project `medical-erp-dev`, shared by the team, continuous deployment from `main`
- **Staging** — GCP project `medical-erp-staging`, promoted from dev manually, prod-like data
- **Production** — GCP project `medical-erp-prod`, promoted from staging with approval

Each environment gets its own Cloud SQL instance, GCS buckets, Firebase project, and service accounts. No shared resources across environments.

### CI/CD

GitHub Actions workflow:

1. On PR: lint, typecheck, test, build
2. On merge to `main`: deploy to dev automatically
   - Frontend: `vite build` → upload `dist/` to GCS dev bucket → invalidate CDN cache
   - API: build Docker image → push to Artifact Registry → deploy new Cloud Run revision
3. On tag `staging-*`: deploy to staging
4. On tag `prod-*`: deploy to production (requires approval)

Frontend rollbacks are a GCS object restore + CDN invalidation. API rollbacks are a one-click revert to the previous Cloud Run revision.

### Infrastructure as Code

**Terraform** for all GCP resources (Cloud Run services, Cloud SQL, GCS buckets, Secret Manager entries, IAM bindings, Cloud Tasks queues, Cloud Scheduler jobs). Checked into the `infra/` folder.

## 16. Development Workflow

### Local Setup

```
pnpm install
cp .env.example .env
docker compose up -d            # Postgres, Firebase emulator, etc.
pnpm db:migrate                 # applies Prisma migrations
pnpm db:seed                    # loads system templates + demo data
pnpm dev                        # runs web + api in parallel
```

### Code Quality

- **TypeScript strict mode** everywhere
- **ESLint** + **Prettier** with shared configs in `packages/shared`
- **Husky** + **lint-staged** for pre-commit checks
- **Commitlint** enforcing Conventional Commits

### Testing

- **Vitest** for unit tests (services, utilities)
- **Playwright** for end-to-end tests (critical user flows only in MVP)
- **Supertest** for API integration tests
- Coverage target: 80% across services, utilities, and repositories. Routes are integration-tested via Supertest rather than unit-tested.

### Branching

- `main` is always deployable to dev
- Feature branches: `feat/description-short`
- Fix branches: `fix/description-short`
- PRs require at least one approval and passing CI

## 17. Compliance Considerations

### Dominican Republic Law 87-01

- Explicit user consent required for data collection
- Users can request data export and deletion (consent management UI in v1.5)
- Data residency: GCP `southamerica-east1` (São Paulo) as closest region; if DR presence becomes required, evaluate GCP Edge or partner hosting

### HIPAA-Aligned Practices (forward-looking)

Not required for DR market, but building toward it makes future US expansion possible:

- GCP supports HIPAA compliance with a signed BAA
- Encryption at rest and in transit, audit logs, access controls — all designed for it
- PHI is never logged, never sent to third-party analytics without anonymization

### GDPR (if serving EU)

Same principles as Law 87-01 with stricter timelines. Designing to Law 87-01 + our data export/deletion plans covers most GDPR needs.

### Data Retention

Medical records retained for the legally required period (varies by jurisdiction, often 10 years). Soft-deleted records are not purged until that window expires.

## 18. Deferred Decisions

Decisions we are explicitly not making yet — flagged so they are not forgotten:

| Topic | Why Deferred | When to Revisit |
|-------|--------------|-----------------|
| Native mobile framework (Expo? Native? Capacitor?) | MVP is PWA | Before v2 planning |
| Full RBAC matrix | Only `owner` and `doctor` in MVP | When multi-user ships |
| Real-time collaboration in protocol editor | Single-user lock is enough for MVP | v2 |
| Event-driven architecture / event bus | REST covers current needs | When cross-module events become common |
| GraphQL / tRPC migration | REST is simpler to build and audit | Never, unless there's a compelling reason |
| Self-hosted option for enterprise | Not needed at launch | Clinic tier sales conversations |
| Kubernetes | Cloud Run is sufficient | Only if we outgrow Cloud Run |
| Offline-first mode | Complex, not MVP-critical | v2 |
| Microservices split | Modular monolith is sufficient; see Section 5 for the triggers that would justify extracting a module into its own service | When a trigger is met, not on a schedule |