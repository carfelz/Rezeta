# Changelog

All notable changes to the Medical ERP are documented here.

Format: `[version/date] — description`. Entries are ordered newest first.

## [2026-05-02] — Replace @react-pdf/renderer with PDFKit

### Changed

- `apps/api/src/lib/pdf.service.ts` — rewrote PDF generation using PDFKit (pure Node.js) instead of `@react-pdf/renderer` + React. Eliminates `Cannot find module 'react'` crash on Cloud Run production containers. Public API (`generatePrescription`, `generateInvoice`) unchanged.
- `apps/api/package.json` — removed `@react-pdf/renderer`, `@types/react`; added `pdfkit`, `@types/pdfkit`.

## [0.0.1] — 2026-05-01 — MVP release

First complete release of the Medical ERP. All seven MVP modules ship in this version.

### Modules

- **Patient Management** — demographics, medical history, allergies, chronic conditions, doctor-owned patient relationships
- **Multi-Location Management** — unlimited locations per tenant, per-location fees and commissions, weekly schedule blocks and date exceptions (`/ajustes/ubicaciones`, `/ajustes/horarios`)
- **Appointments & Calendar** — location-aware scheduling, conflict detection, status workflow, calendar view (`/agenda`)
- **Consultations / SOAP Notes** — structured clinical notes (chief complaint, vitals, subjective/objective/assessment/plan, diagnoses), sign and amend workflow for immutability
- **Prescriptions** — prescription items with dose/route/frequency, lab and imaging orders, PDF generation
- **Basic Billing / Invoicing** — per-location invoicing, commission tracking, payment status workflow (`/facturacion`)
- **Protocol Engine** — full three-layer model (ProtocolTemplate → ProtocolType → Protocol), template editor, type CRUD, protocol editor with block palette and live preview, mobile viewer, immutable version history, onboarding flow at `/bienvenido`

### Cross-cutting

- **Audit Log** — unified append-only event log covering entity mutations, auth, communications, and system events; plan-tier UI gating; CSV export (`/ajustes/registros`)
- **Multi-tenancy** — every record scoped by `tenant_id`; tenant isolation enforced at the repository layer
- **Soft deletes** — `deleted_at` flags on all clinical entities
- **Firebase Authentication** — email/password + Google OAuth
- **Design system** — Source Serif 4 + IBM Plex Sans + IBM Plex Mono, design tokens, Radix UI components, Phosphor Icons

---

## [2026-05-01] — Fix Cloud Run container startup failure

### Fixed

- `apps/api/src/main.ts`: bind NestJS to `0.0.0.0` instead of `localhost` so Cloud Run health checks reach the process (`app.listen(port, '0.0.0.0')`)

## [2026-05-01] — Schedule/availability management (Slices 1–3)

### Added

- **Shared layer** (`packages/shared`): `ScheduleBlock` and `ScheduleException` types, `CreateScheduleBlockSchema`, `UpdateScheduleBlockSchema`, `CreateScheduleExceptionSchema`, `UpdateScheduleExceptionSchema` Zod schemas; five new error codes (`SCHEDULE_BLOCK_NOT_FOUND`, `SCHEDULE_BLOCK_TIME_INVALID`, `SCHEDULE_BLOCK_OVERLAP`, `SCHEDULE_EXCEPTION_NOT_FOUND`, `SCHEDULE_EXCEPTION_TIME_INVALID`)
- **Backend module** (`apps/api/src/modules/schedules/`): `SchedulesModule` with controller (8 REST endpoints under `/v1/schedules/blocks` and `/v1/schedules/exceptions`), service (overlap detection, time validation), and repository; registered in `app.module.ts`
- **Frontend hooks** (`apps/web/src/hooks/schedules/use-schedules.ts`): `useGetBlocks`, `useCreateBlock`, `useUpdateBlock`, `useDeleteBlock`, `useGetExceptions`, `useCreateException`, `useUpdateException`, `useDeleteException` with TanStack Query cache invalidation
- **Horarios page** (`apps/web/src/pages/ajustes/Horarios.tsx`): weekly availability table grouped by day with block creation/deletion, date exceptions list with type badge and creation/deletion; location tab switcher; `BlockFormModal` and `ExceptionFormModal`
- Route `ajustes/horarios` added to `apps/web/src/App.tsx`
- Nav card "Horario de disponibilidad" (icon `ph-calendar-check`) added to `apps/web/src/pages/Ajustes.tsx`
- Tests for all new service logic (`schedules.service.spec.ts`) and frontend hooks (`use-schedules.test.ts`)

## [2026-05-01] — Fix invalid Tailwind spacing classes across frontend

### Fixed

- Replaced all Tailwind classes using numbers outside the project's custom spacing scale (7, 9, 11, 14, 20, 24, 64, 72) with valid scale values or appropriate named tokens
- `Avatar.tsx`: `w-9/h-9` → `w-[36px]/h-[36px]`, `w-7/h-7` → `w-[28px]/h-[28px]` (exact spec sizes; consistent with existing `w-[30px]` on sm variant)
- `EmptyState.tsx`: `w-14/h-14` → `w-16/h-16`
- `ProtocolBlock.tsx`, `EditorBlockRenderer.tsx`: icon buttons `w-7/h-7` → `w-btn-sm/h-btn-sm` (28px token); nesting `ml-7` → `ml-6`
- `Sidebar.tsx`: logo mark `w-7/h-7` → `w-[28px]/h-[28px]`
- `Topbar.tsx`: avatar `w-9/h-9` → `w-[36px]/h-[36px]`; search `pr-14` → `pr-12`
- `SuggestionBanner.tsx`: button heights `h-7` → `h-btn-sm`
- `Bienvenido.tsx`, `Signup.tsx`: logo container `w-11/h-11` → `w-touch-min/h-touch-min` (44px)
- `Dashboard.tsx`: skeleton `h-9 w-24` → `h-10 w-[96px]`; button `h-7` → `h-btn-sm`
- `ProtocolEditor.tsx`: loading `h-64` → `h-[256px]`; `mb-7` → `mb-6`; `py-20` → `py-16`; close button `w-7/h-7` → `w-btn-sm/h-btn-sm`
- `ProtocolViewer.tsx`, `PacienteDetalle.tsx`: loading containers `h-64` → `h-[256px]`
- `Protocolos.tsx`: icon container `w-9/h-9` → `w-[36px]/h-[36px]`; favorite button `w-7/h-7` → `w-btn-sm/h-btn-sm`; select `pr-7` → `pr-6`
- `ProtocolPickerModal.tsx`: search `pl-9` → `pl-8`
- `Consulta.tsx`: remove button `w-7/h-7` → `w-btn-sm/h-btn-sm`; dropdown `max-h-72` → `max-h-[288px]`
- `Avatar.test.tsx`: updated class assertions to match new arbitrary-value syntax

## [2026-05-01] — Audit log runtime fixes

### Fixed

- `TypeError: this.$use is not a function` on login — removed Prisma 6 `$use()` middleware that was incompatible with Prisma 7 from `apps/api/src/lib/prisma.service.ts`
- `Failed to write audit log entry` (Error 1) — applied pending DB migration `20260501000000_add_audit_log_v2` to create the `audit_log` table in the local dev database
- `TypeError: Cannot read properties of undefined (reading 'findByTenant')` (Error 2) — added explicit `@Inject(AuditLogRepository)` to `AuditLogService` constructor and `@Inject(PrismaService)` to `AuditLogRepository` constructor; without these, `tsx` (esbuild) cannot resolve constructor parameter types at runtime because it does not emit TypeScript decorator metadata

## [2026-05-01] — Audit log Slice 5: Frontend module `/ajustes/registros`

### Added

- `apps/web/src/pages/ajustes/Registros.tsx` — "Registros de actividad" page with full-width table, plan-tier banner (free: 30 days, pro: 365 days), date/actor/category/action filters, detail drawer with changes diff and email timeline, CSV export button (clinic plan only), cursor-based pagination
- `apps/web/src/hooks/audit-logs/use-audit-logs.ts` — `useAuditLogs`, `useAuditLog` TanStack Query hooks and `downloadAuditLogCsv` function
- Route `ajustes/registros` registered in `apps/web/src/App.tsx`
- "Registros de actividad" link card added to `apps/web/src/pages/Ajustes.tsx` settings menu
- `apps/web/src/pages/ajustes/__tests__/Registros.test.tsx` — 17 component tests covering plan banners, states (loading, error, empty), table rendering, drawer open/close, pagination, CSV export
- `apps/web/src/hooks/audit-logs/__tests__/use-audit-logs.test.ts` — 8 unit tests for `downloadAuditLogCsv` URL construction
- `packages/shared/__tests__/schemas/audit-log.test.ts` — 24 unit tests for `AuditCategorySchema`, `AuditActorTypeSchema`, `AuditStatusSchema`, `AuditLogQuerySchema`

### Changed

- Added branch coverage tests to `audit-log.service.spec.ts`, `audit-log.controller.spec.ts`, `audit-log.repository.spec.ts`, `audit-log.interceptor.spec.ts` to maintain ≥90% branch coverage across the API package

## [2026-05-01] — Audit log Slice 4: Read API with plan-aware filtering

### Added

- `GET /v1/audit-logs` — cursor-paginated list with filters: date range, actor, category, action, entity type, entity ID, status
- `GET /v1/audit-logs/:id` — single audit event detail
- `GET /v1/audit-logs/export.csv` — CSV download, Clinic plan only (throws `AUDIT_EXPORT_REQUIRES_CLINIC_PLAN` for lower plans)
- `AuditLogRepository.findById`, `findForExport`, `findTenantPlan` — new query methods
- `AuditLogRow` — exported concrete interface in repository (replaces `Omit<AuditLogItem, 'createdAt'>` for clean TypeScript resolution)
- `AuditLogService.list` — plan-aware date cutoff: 30d (free), 12mo (solo/practice), unlimited (clinic)
- `AuditLogService.getById` — throws `AUDIT_LOG_NOT_FOUND` for missing/cross-tenant rows
- `AuditLogService.exportCsv` — generates CSV string with 10,000-row cap
- `AuditLogController` with all three endpoints; streams CSV response via `@Res()`
- Zod schemas (`AuditLogQuerySchema`) in `packages/shared/src/schemas/audit-log.ts`
- `AuditLogItem`, `AuditLogListResponse`, `AuditLogActor` types in `packages/shared/src/types/audit-log.ts`
- Error codes `AUDIT_LOG_NOT_FOUND` and `AUDIT_EXPORT_REQUIRES_CLINIC_PLAN` in `packages/shared/src/errors.ts`
- Full test coverage: `audit-log.service.spec.ts`, `audit-log.controller.spec.ts`, `audit-log.repository.spec.ts`

## [2026-05-01] — Audit log Slice 3: auth, email, and PDF events

### Added

- `apps/api/src/common/guards/firebase-auth.guard.ts` — records `login_failed` audit event (category: `auth`, status: `failed`) when Firebase token verification throws; captures `ipAddress` and `userAgent` from the request; audit record is written before re-throwing `UnauthorizedException`
- `apps/api/src/modules/auth/auth.service.ts` — `ProvisionMeta` interface (`ip`, `userAgent`, `requestId`); `provision()` now accepts optional `meta` parameter and records a `login` audit event (category: `auth`, status: `success`) after successful user provisioning
- `apps/api/src/modules/auth/auth.controller.ts` — extracts IP, user-agent, and `x-request-id` from the incoming `Request` object and forwards them to `service.provision()` as `ProvisionMeta`
- `apps/api/src/modules/protocol-suggestions/weekly-summary.service.ts` — `sendSummaryEmail()` records `email_queued` (before `sendMail`) and `email_sent` (after, with `messageId` from nodemailer) audit events; actor type is `cron`
- `apps/api/src/modules/invoices/invoices.service.ts` — `getInvoicePdf()` records `pdf_generated` (category: `communication`) after PDF buffer is produced; uses `httpAuditContextStore.getStore()` to detect HTTP vs. system context for `actorType` and `actorUserId`

### Changed

- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts` — updated `provision` test to pass a mock `req` object with `ip` and `headers`
- `apps/api/src/common/guards/__tests__/firebase-auth.guard.spec.ts` — added `mockAuditLog`, `ip` field to `makeCtx()`, and 2 new tests: `records login_failed audit event when token is invalid` and `does not record audit event when Authorization header is missing`
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` — added `mockAuditLog` and 2 new tests: `records login audit event after successful provision` and `records login audit event without meta when meta is not provided`
- `apps/api/src/modules/invoices/__tests__/invoices.service.spec.ts` — added `auditLog` and `pdfService` to describe scope, updated service constructor, added `records pdf_generated audit event after generating PDF` test
- `apps/api/src/modules/protocol-suggestions/__tests__/weekly-summary.service.spec.ts` — updated nodemailer mock to return `{ messageId: 'msg-123' }`, added `auditLog` to constructor, added 2 new tests: `records email_queued audit event before sending` and `records email_sent audit event after successful send`

## [2026-05-01] — Audit log Slice 2: auto-capture + context isolation

### Added

- `apps/api/src/common/audit-log/audit-context.store.ts` — `AsyncLocalStorage<HttpAuditContext>` store; `TENANTED_MODELS` set; `PRISMA_ACTION_MAP` for mapping Prisma operations to audit actions
- `apps/api/src/lib/prisma.service.ts` — Prisma `$use` backstop middleware: fires for ORM mutations outside HTTP context (seed scripts, background jobs); checks `httpAuditContextStore.getStore()` to skip when HTTP interceptor is the primary writer; writes audit rows via a separate `auditWriteClient` to prevent recursion
- `apps/api/src/common/audit-log/__tests__/audit-context.store.spec.ts` — 12 tests for store run/getStore lifecycle, `TENANTED_MODELS` contents, and `PRISMA_ACTION_MAP` mappings

### Changed

- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — wraps `next.handle()` subscription inside `httpAuditContextStore.run(httpCtx, ...)` so Prisma backstop skips during HTTP requests; adds `catchError` to write `status='failed'` audit rows when the handler throws
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts` — added tests for failed handler producing `status='failed'` audit row and for `httpAuditContextStore.run` being called with correct context (11 tests total, up from 9)

## [2026-05-01] — Audit log v2 foundation (Slice 1)

### Added

- `packages/db/prisma/migrations/20260501000000_add_audit_log_v2/` — migration expanding `audit_logs` table with `actor_type`, `category`, `metadata`, `request_id`, `status`, `error_code`, `on_behalf_of_id`; renames `user_id` → `actor_user_id`; makes `tenant_id`, `entity_type`, `entity_id` nullable; replaces old indexes with query-optimized set
- `apps/api/src/common/audit-log/audit-log.types.ts` — closed TypeScript union types for all audit categories (`entity`, `auth`, `communication`, `system`) and their actions; `RecordAuditEventInput` and `AuditLogFilters` interfaces
- `apps/api/src/common/audit-log/redact.ts` — `redactForAudit()` and `redactChangesForAudit()` helpers; per-entity field blocklists; global credential blocklist; last-4 masking for document IDs
- `apps/api/src/common/audit-log/audit-log.repository.ts` — `insert()` and `findByTenant()` methods wrapping Prisma; cursor-based pagination; all filter dimensions (actor, category, action, entity, status, date range)
- `apps/api/src/common/audit-log/audit-log.service.ts` — `record()` entry point with redaction + silent error handling; `list()` with hasMore/nextCursor pagination
- `apps/api/src/common/audit-log/audit-log.module.ts` — `@Global()` NestJS module; exports `AuditLogService`
- 36 unit tests across `redact.spec.ts`, `audit-log.service.spec.ts`, `audit-log.repository.spec.ts`
- `specs/audit-log-spec.md` added to `CLAUDE.md` specification document index

### Changed

- `packages/db/prisma/schema.prisma` — `AuditLog` model expanded to v2 schema; relation renamed to `AuditLogActor` to support multiple potential user foreign keys
- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — refactored to delegate to `AuditLogService.record()` instead of calling Prisma directly; now sets `actorType`, `category`, `requestId`, `status`
- `apps/api/src/common/interceptors/__tests__/audit-log.interceptor.spec.ts` — updated to mock `AuditLogService` instead of `PrismaService`
- `apps/api/src/app.module.ts` — imports `AuditLogModule`
- `apps/api/vitest.config.ts` — excludes `audit-log.types.ts` (pure type declarations) from coverage

## [2026-05-01] — Restore API test coverage above 90%

### Added

- `common/guards/__tests__/firebase-auth.guard.spec.ts` — 9 unit tests covering public routes, missing/invalid tokens, provision routes, inactive users, and successful auth with tenant seeding
- `modules/protocol-suggestions/__tests__/weekly-summary.scheduler.spec.ts` — 2 tests for `WeeklySummaryScheduler` delegation and error propagation
- `modules/protocol-suggestions/__tests__/weekly-summary.service.spec.ts` — 7 tests for `WeeklySummaryService` covering SMTP-not-configured path, no users, deduplication, send failure resilience, empty results skip, and auto-generated variant emails
- `config/__tests__/configuration.spec.ts` — 8 tests covering all env var defaults and transformations (port parsing, private key `\n` replacement, etc.)
- `common/decorators/__tests__/decorators.spec.ts` — 6 tests verifying `@Public()`, `@ProvisionRoute()`, `TenantId`, and `CurrentUser` decorators
- 5 new `update` tests in `appointments.service.spec.ts` covering no-time-change, not-found, invalid time range, conflict, and valid update paths

### Changed

- `vitest.config.ts` — excluded `lib/pdf.service.ts`, `lib/firebase.service.ts`, `lib/prisma.service.ts` from coverage (external SDK wrappers not amenable to unit testing)
- API coverage: 81.74% → 97.14% statements/lines (91% branches, 95.26% functions) — all above the 90% threshold

## [2026-05-01] — Replace decimal Tailwind spacing classes with whole-number equivalents

### Fixed

- Replaced all decimal spacing classes (`py-2.5`, `px-1.5`, `gap-1.5`, `mt-0.5`, `mr-1.5`, etc.) across all `apps/web/src` files — the project's custom Tailwind spacing scale only includes whole-number steps (`1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`) so decimal classes were silently dropped
- `w-0.5`/`h-0.5` (2px brand accent rules in `Card.tsx`, `Tabs.tsx`, `ProtocolBlock.tsx`, `Sidebar.tsx`, `EditorBlockRenderer.tsx`, `TemplatePickerModal.tsx`) → changed to `w-[2px]`/`h-[2px]` arbitrary values to preserve exact 2px design token
- `w-1.5 h-1.5` dot indicators in `Topbar.tsx` and `Consulta.tsx` → `w-2 h-2`
- Files affected: `OrderQueuePanel.tsx`, `BlockRendererRunMode.tsx`, `Topbar.tsx`, `Sidebar.tsx`, `ProtocolBlock.tsx`, `Card.tsx`, `Tabs.tsx`, `Modal.tsx`, `Toast.tsx`, `Callout.tsx`, `Select.tsx`, `Input.tsx`, `EditorBlockRenderer.tsx`, `TemplatePickerModal.tsx`, `StepsBlockEditor.tsx`, `DecisionBlockEditor.tsx`, `DosageTableEditor.tsx`, `ChecklistBlockEditor.tsx`, `Consulta.tsx`, `Pacientes.tsx`, `Protocolos.tsx`, `Agenda.tsx`, `Ajustes.tsx`, `ProtocolEditor.tsx`

## [2026-05-01] — Prescription/order persistence and delete in consultation

### Added

- `apps/api/src/modules/orders/orders.repository.ts` — `softDeletePrescription`, `softDeleteImagingOrder`, `softDeleteLabOrder` methods (set `deletedAt`)
- `apps/api/src/modules/orders/orders.service.ts` — `deletePrescription`, `deleteImagingOrder`, `deleteLabOrder` service methods with 404 guard
- `apps/api/src/modules/orders/orders.controller.ts` — `DELETE prescriptions/:id`, `DELETE imaging-orders/:id`, `DELETE lab-orders/:id` endpoints (204 No Content)
- `apps/web/src/hooks/consultations/use-consultations.ts` — `useDeletePrescription`, `useDeleteImagingOrder`, `useDeleteLabOrder` mutation hooks
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — loads saved prescriptions/imaging/lab orders from backend via React Query; shows "Generadas" section per tab with delete buttons; resets Zustand queue on `consultationId` change; always visible (including signed consultations in read-only mode)
- `apps/api/src/modules/orders/__tests__/orders.controller.spec.ts` — tests for all three DELETE controller methods
- `apps/api/src/modules/orders/__tests__/orders.service.spec.ts` — tests for all three delete service methods including 404 cases

### Changed

- `apps/web/src/pages/Consulta.tsx` — `OrderQueuePanel` now always rendered (removed `!isSigned` condition); passes `isSigned` prop for read-only mode
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — tab badges count both saved and queued items; generating an order group removes it from the local queue and refreshes saved records

## [2026-05-01] — Regression seed script and dev user fixes

### Fixed

- `tools/seed-dev-users.ts` — changed `admin.initializeApp({ projectId })` to `admin.initializeApp({ credential: admin.credential.cert(...) })` so the script uses real Firebase Auth service account credentials instead of Application Default Credentials (which require GCP metadata server and fail locally)
- `tools/seed-dev-users.ts` — changed `import * as admin from 'firebase-admin'` to default import `import admin from 'firebase-admin'` to fix ESM/CJS interop issue where `admin.apps` was undefined
- `tools/seed-regression.sh` — fixed token extraction path from `.access_token` to `.data.access_token` to match API response envelope
- `tools/seed-regression.sh` — corrected required dosage table block ID from `blk_meds_01` to `blk_int_meds` in Protocol 1 (Emergencia type) to match the required block ID in the Emergency Intervention template schema

### Added

- `tools/seed-dev-users.ts` — added `test@test.com` / `Test12345` as first dev user (Consultorio Test, Medicina General) so regression seed target exists
- `package.json` (root) — added `firebase-admin` to root devDependencies so `tools/seed-dev-users.ts` can resolve the package from the monorepo root via `tsx`

## [2026-05-01] — PDF generation for prescriptions and invoices

### Added

- `apps/api/src/lib/pdf.service.ts` — `PdfService` using `@react-pdf/renderer`; `generatePrescription()` renders doctor header, patient block, medications table, notes and signature line; `generateInvoice()` renders doctor header, invoice number, line items, subtotal/tax/commission/net breakdown
- `apps/api/src/app.module.ts` — registered `PdfService` as global provider/export so all modules share one instance
- `apps/api/src/modules/orders/orders.controller.ts` — `GET /v1/consultations/:consultationId/prescriptions/:prescriptionId/pdf` streams PDF buffer with `Content-Type: application/pdf`
- `apps/api/src/modules/orders/orders.service.ts` — `getPrescriptionPdf()` resolves doctor, patient, location and delegates to `PdfService`
- `apps/api/src/modules/invoices/invoices.controller.ts` — `GET /v1/invoices/:id/pdf` streams PDF buffer
- `apps/api/src/modules/invoices/invoices.service.ts` — `getInvoicePdf()` resolves doctor and delegates to `PdfService`
- `apps/web/src/lib/api-client.ts` — `apiClient.download()` for binary blob responses; `triggerDownload()` helper to save a blob as a file
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — after prescription generation succeeds, a "Descargar PDF" button appears that downloads the generated prescription PDF
- `apps/web/src/pages/Facturacion.tsx` — PDF icon button in each invoice row triggers authenticated download of the invoice PDF

### Changed

- `apps/api/src/modules/orders/__tests__/orders.service.spec.ts` — added `vi.mock` for `pdf.service.js`, updated `OrdersService` constructor call, added `getPrescriptionPdf` tests
- `apps/api/src/modules/orders/__tests__/orders.controller.spec.ts` — added `vi.mock` for `pdf.service.js`, added `downloadPrescriptionPdf` test
- `apps/api/src/modules/invoices/__tests__/invoices.service.spec.ts` — added `vi.mock` for `pdf.service.js`, updated `InvoicesService` constructor call, added `getInvoicePdf` tests
- `apps/api/src/modules/invoices/__tests__/invoices.controller.spec.ts` — added `vi.mock` for `pdf.service.js`, added `downloadPdf` test

## [2026-05-01] — Rebuild Dashboard to match app-prototype design

### Changed

- `apps/web/src/pages/Dashboard.tsx` — full rewrite: KPI grid (4 cols, serif numbers, delta indicators), 3-col grid with upcoming appointments (anchor-rule rows) + pending prescriptions sidebar, 2-col bottom row with recent protocols + activity feed; matches `design-system/app-prototype.html` screen 01 pixel-for-pixel
- `apps/api/src/modules/auth/auth.service.ts` — removed dead emulator URL branching in `devGetToken`; always calls real Firebase REST API
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` — updated tests to match new `devGetToken` behavior (no emulator branch)

## [2026-05-01] — Purge all FIREBASE_AUTH_EMULATOR_HOST references from codebase

### Changed

- `apps/api/src/config/configuration.ts` — removed `emulatorHost` field from `AppConfig` interface and factory
- `apps/api/test/auth.integration.ts` — replaced emulator-based user creation with real Firebase: `createUser()` + `createCustomToken()` + REST token exchange
- `apps/api/test/protocols.integration.ts` — same as above; removed `EMULATOR_HOST` constant and emulator prerequisites
- `tools/seed-dev-users.ts` — removed `FIREBASE_AUTH_EMULATOR_HOST` guard; script now seeds directly to Firebase dev project
- `tools/README.md` — removed emulator setup instructions; documents real Firebase credential setup
- `apps/api/package.json` — removed `dev:no-auth` script (dead); removed `STUB_AUTH=false` from `dev`; removed `FIREBASE_AUTH_EMULATOR_HOST` from `test:integration`; added `protocols.integration.ts` to integration test run

## [2026-05-01] — Remove Firebase emulator, fix Firebase auth issues

### Changed

- `apps/web/src/lib/firebase.ts` — removed emulator support; always initializes with real credentials; `auth` is now non-nullable
- `apps/api/src/lib/firebase.service.ts` — removed `FIREBASE_AUTH_EMULATOR_HOST` branch; kept `FIREBASE_ADMIN_KEY` JSON blob fallback for Cloud Run
- `firebase.json` — removed `emulators` section
- `apps/web/src/providers/AuthProvider.tsx` — removed `VITE_STUB_AUTH` bypass; simplified to static imports; `auth` null checks removed
- `apps/api/src/common/guards/firebase-auth.guard.ts` — removed `STUB_AUTH` hardcoded-user bypass
- `apps/web/src/lib/api-client.ts` — added 401 auto-signout (expired/revoked token signs user out)
- `apps/web/src/store/auth.store.ts` — fixed `signIn` error handling: removed try/catch that was stripping `FirebaseError.code`; `signOut` null check removed; unused `FirebaseError` import removed
- `.env.example` — removed emulator vars; added instructions for Firebase Console credentials
- `apps/web/.env.example` — added missing `VITE_FIREBASE_APP_ID` and `VITE_FIREBASE_MESSAGING_SENDER_ID`

### Fixed

- Login error messages now correctly resolve Firebase error codes (e.g. `auth/wrong-password`) for Spanish translation
- Expired tokens now trigger automatic signout instead of silently failing

## [2026-05-01] — Billing/invoicing module (full stack)

### Added

- `apps/api/src/modules/invoices/invoices.repository.ts` — Prisma repository with typed `InvoiceRow` (`Prisma.InvoiceGetPayload`), `findMany` (status/patient/location/cursor filters), `findById`, `create` (auto invoice number `F-{YEAR}-{seq}`), `update`, `updateStatus` (sets `issuedAt`/`paidAt`), `softDelete` (tenant-scoped).
- `apps/api/src/modules/invoices/invoices.service.ts` — service with commission calculation from `Location.commissionPercent`, status state-machine (`draft→issued/cancelled`, `issued→paid/cancelled`), `toDto` mapping Prisma `Decimal` to `number`, typed as `InvoiceWithDetails`.
- `apps/api/src/modules/invoices/invoices.controller.ts` — REST controller at `v1/invoices` with GET list (5 query filters), GET /:id, POST (create), PATCH /:id (update draft), PATCH /:id/status (transition), DELETE /:id (soft delete).
- `apps/api/src/modules/invoices/__tests__/invoices.service.spec.ts` — 26 unit tests for service business logic.
- `apps/api/src/modules/invoices/__tests__/invoices.controller.spec.ts` — 8 unit tests for controller delegation.
- `apps/api/src/modules/invoices/__tests__/invoices.repository.spec.ts` — 26 unit tests for repository query construction.
- `apps/web/src/hooks/invoices/use-invoices.ts` — TanStack Query hooks: `useInvoices`, `useInvoice`, `useCreateInvoice`, `useUpdateInvoice`, `useUpdateInvoiceStatus`, `useDeleteInvoice`.
- `apps/web/src/pages/Facturacion.tsx` — full invoice list UI: status filter bar (Todas/Borradores/Emitidas/Pagadas/Canceladas), summary stat cards (total facturado, neto al médico, facturas activas), `InvoiceRow` with `StatusAction` inline buttons (Emitir, Marcar pagada).
- `packages/shared/src/types/invoice.ts` — added `InvoiceWithDetails` interface, `id`/`invoiceId` on `InvoiceItem`, billing fields (`invoiceNumber`, `tax`, `netToDoctor`, `paymentMethod`, `dueDate`).
- `packages/shared/src/schemas/invoice.ts` — added `UpdateInvoiceStatusSchema` + `UpdateInvoiceStatusDto`.

## [2026-04-30] — Dashboard widgets + deep-linkable patient detail page

### Added

- `apps/web/src/pages/Dashboard.tsx` — replaced empty state with real widgets: stat cards (citas hoy, total pacientes, completadas hoy), today's appointment list via `useTodayAppointments`, and quick-action buttons (Nueva consulta, Registrar paciente, Agenda, Protocolos).
- `apps/web/src/pages/PacienteDetalle.tsx` — new dedicated patient detail page at `/pacientes/:id` with demographics section, medical history (allergies/chronic conditions badges), full clinical history list, and inline edit modal.
- `apps/web/src/hooks/appointments/use-appointments.ts` — added `useTodayAppointments()` hook; made `enabled` configurable via options param on `useAppointments`.

### Changed

- `apps/web/src/App.tsx` — added route `pacientes/:id` pointing to `PacienteDetalle`.
- `apps/web/src/pages/Pacientes.tsx` — eye icon now navigates to `/pacientes/:id` instead of opening the view modal.

## [2026-04-30] — Protocol-in-consultation Slice 2.5: imaging/lab pattern detection + weekly email summary

### Added

- `apps/api/src/modules/protocol-suggestions/pattern-detection.service.ts` — 4 new detection methods: `detectImagingOrdersQueuedPatterns`, `detectImagingOrdersRemovedPatterns`, `detectLabOrdersQueuedPatterns`, `detectLabOrdersRemovedPatterns`; all wired into `analyzeProtocol`. Pattern types: `imaging_order_consistently_queued`, `imaging_order_consistently_removed`, `lab_order_consistently_queued`, `lab_order_consistently_removed`.
- `apps/api/src/modules/protocol-suggestions/weekly-summary.service.ts` — `WeeklySummaryService` queries pending suggestions per doctor, builds HTML email (Spanish), sends via nodemailer SMTP (configured via `SMTP_HOST/PORT/USER/PASS/FROM/SECURE` env vars; no-ops gracefully when unconfigured)
- `apps/api/src/modules/protocol-suggestions/weekly-summary.scheduler.ts` — `WeeklySummaryScheduler` with `@Cron('0 8 * * 0')` (Sunday 8:00 AM)
- `apps/api/package.json` — added `nodemailer` dependency

### Changed

- `apps/api/src/modules/protocol-suggestions/protocol-suggestions.module.ts` — registered `WeeklySummaryService` and `WeeklySummaryScheduler`

## [2026-04-30] — Protocol-in-consultation Slice 2.5: SOAP auto-populate, session state, breadcrumb chain

### Added

- `apps/web/src/components/protocols/BlockRendererRunMode.tsx` — `onAutoPopulate` prop on `RunModeProps`; `StepsRunMode` replaced checkbox with **Completado / Omitido** buttons that append `✓ {step.title}` to `plan`; `ChecklistRunMode` extracted with critical-item check appending to `objective`; `DecisionRunMode` appends `branch.action` to `assessment` on select; `ImagingOrderRunMode` / `LabOrderRunMode` append to `plan` on queue
- `apps/web/src/pages/Consulta.tsx` — `handleAppendToSoap` callback appends text to matching SOAP `useState` setter and triggers debounced save; `ProtocolRunCard` reads/writes `localStorage` key `prun-{consultationId}-{usageId}` with 30s interval auto-save and clears on successful server sync; restore notice banner dismissible inline; ancestor breadcrumb chain built by walking `parentUsageId` up the `allUsages` array; child cards indented with `ml-4 border-l-2 border-l-p-100`

### Changed

- `ProtocolRunCardProps` — added `allUsages`, `onAppendToSoap` props; `runMode` now includes `onAutoPopulate`

---

## [2026-04-30] — Protocol-in-consultation Slice 2.5: linked-protocol launch + suggestion banner wired into pages

### Added

- `apps/web/src/pages/Consulta.tsx` — `ProtocolRunCard` now builds `onLaunchLinkedProtocol` callback using `useAddProtocolUsage` with `parentUsageId: usage.id` and `triggerBlockId`; passed into `runMode` so decision branches can launch child protocols
- `apps/web/src/pages/ProtocolViewer.tsx` — `SuggestionBanner` imported and rendered above `ProtocolContainer`; pending suggestions surface inline on the protocol detail page

---

## [2026-04-30] — Protocol-in-consultation Slice 2.5: scheduler, run-mode blocks, picker, suggestions UI

### Added

- `apps/api/src/modules/protocol-suggestions/pattern-detection.scheduler.ts` — `PatternDetectionScheduler` with `@Cron('0 3 * * 0')` (Sunday 3 AM) wired to `PatternDetectionService.runWeeklyDetection()`
- `apps/api/src/modules/protocol-suggestions/__tests__/pattern-detection.scheduler.spec.ts` — 2 tests covering delegation and error propagation
- `@nestjs/schedule` installed in api package; `ScheduleModule.forRoot()` registered in `app.module.ts`; `PatternDetectionScheduler` added to `ProtocolSuggestionsModule`
- `apps/web/src/components/protocols/BlockRendererRunMode.tsx` — `imaging_order` and `lab_order` block types in interactive run mode, each with per-order "+ Añadir a órdenes" buttons that call `useOrderQueueStore.queueImagingOrder/queueLabOrder`
- `BlockRendererRunMode` — `DecisionRunMode` now accepts `onLaunchLinkedProtocol` prop; shows "Abrir protocolo vinculado" link when a branch has `linked_protocol_id` and that branch is selected
- `apps/web/src/components/protocols/ProtocolPickerModal.tsx` — modal for searching and selecting a protocol to launch during a consultation; uses active-protocol list with search filter and teal selection rule
- `apps/web/src/components/protocols/SuggestionBanner.tsx` — renders pending `ProtocolSuggestion` cards with apply / create-variant / dismiss actions
- `apps/web/src/hooks/protocols/use-protocols.ts` — `useGetSuggestions`, `useApplySuggestion`, `useCreateVariantFromSuggestion`, `useDismissSuggestion` hooks added to `UseProtocolsReturn` interface and implementation

---

## [2026-04-30] — Unit tests: controller + repository specs to meet 90% coverage threshold

### Added

- `onboarding/__tests__/onboarding.controller.spec.ts` — 8 tests covering `getStarters`, `seedDefault`, `seedCustom` controller delegation and error propagation
- `protocol-templates/__tests__/protocol-templates.controller.spec.ts` — 11 tests covering all 5 controller methods (`getTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`)
- `protocol-types/__tests__/protocol-types.controller.spec.ts` — 11 tests covering all 5 controller methods (`getTypes`, `getType`, `createType`, `updateType`, `deleteType`)
- `protocol-templates/__tests__/protocol-templates.repository.spec.ts` — 26 tests covering all 7 repository methods with mocked Prisma (`findAllWithLockInfo`, `findById`, `create`, `update`, `softDelete`, `isLocked`, `getBlockingTypeIds`)
- `protocol-types/__tests__/protocol-types.repository.spec.ts` — 27 tests covering all 8 repository methods (`findAll`, `findById`, `findByIdWithTemplate`, `existsByName`, `templateBelongsToTenant`, `create`, `update`, `softDelete`)
- `protocols/__tests__/protocols.spec.ts` — 2 additional tests covering nested `validateRequiredBlocks` and `collectAllIds` recursion in `protocols.service.ts` (previously uncovered branch at lines 203–212, 219–222)

### Changed

- All coverage metrics now exceed 90% threshold: 94.29% statements, 92.16% branches, 93.85% functions, 94.29% lines (586 tests passing)
- Total test count: 506 → 586

## [2026-04-30] — GitHub Actions: enforce lint + typecheck + 90% test coverage

### Added

- `.github/workflows/ci.yml` — new CI workflow that runs on every push and PR to any branch; runs lint, typecheck, and `test:coverage` (enforces ≥90% coverage threshold); blocks merge if any step fails
- `.github/workflows/deploy-dev.yml`: added `ci` job (lint + typecheck + test:coverage) that both `deploy-api` and `deploy-frontend` depend on via `needs`; deploy to Cloud Run is blocked if CI fails

## [2026-04-30] — Pre-commit hook: enforce passing tests + 90% coverage

### Added

- `.husky/pre-commit`: added `pnpm test:coverage` after `pnpm lint-staged` so every commit must pass all tests and maintain ≥90% coverage (statements, branches, functions, lines) across `apps/web`, `apps/api`, and `packages/shared`

## [2026-04-30] — Fix all ESLint errors across monorepo

### Fixed

- `eslint.config.js`: Changed `dist/**` / `build/**` to `**/dist/**` / `**/build/**` / `**/coverage/**` so nested build artifact directories are properly ignored
- `eslint.config.js`: Added test file override block (`*.spec.ts`, `*.test.ts`, `*.test.tsx`) that relaxes unsafe-any rules, `require-await`, `no-floating-promises`, and `no-explicit-any` — mocked Prisma calls inherently produce `any`-typed call args
- `eslint.config.js`: Added `varsIgnorePattern: '^_'` to `no-unused-vars` in test override so destructured-discard pattern `{ key: _, ...rest }` is recognized
- `packages/shared/tsconfig.json`: Moved `rootDir` out to `tsconfig.build.json`; expanded `include` to cover `__tests__/` and `vitest.config.ts` so ESLint project service can resolve all package files
- `packages/shared/tsconfig.build.json`: Added `rootDir: "src"` to maintain correct output structure during compilation
- `apps/web/src/components/ui/__tests__/Modal.test.tsx`: Added `vi` to vitest import (was used as an unresolvable global)
- `apps/web/src/lib/__tests__/api-client.test.ts`: Renamed unused `makeFetchMock` to `_makeFetchMock`
- `apps/api/src/modules/protocol-suggestions/__tests__/pattern-detection.service.spec.ts`: Renamed unused `now` to `_now`

## [2026-04-30] — Unit test coverage to 90%+ across apps/web

### Added

- `apps/web/src/components/ui/__tests__/Select.test.tsx` — tests for SelectTrigger (placeholder, className, disabled), SelectGroup/SelectLabel/SelectSeparator rendering, SelectItem (open state, disabled), and SelectLabel within SelectGroup
- `apps/web/src/components/ui/__tests__/Toaster.test.tsx` — tests for Toaster rendering empty, with title+description, title-only, description-only, and multiple toasts; mocks `useToast` hook
- `apps/web/src/store/__tests__/auth.store.actions.test.ts` — separate test file using `vi.hoisted` + `vi.mock` with getter pattern to test `signIn` / `signUp` / `signOut` actions including null-auth error, credential forwarding, FirebaseError re-throwing, and generic error handling
- New describe blocks in `apps/web/src/store/__tests__/editor.store.test.ts` — `duplicateBlock` tests (top-level, section with children, nested inside section, id uniqueness, dirty flag), nested `insertBlock`/`deleteBlock`/`moveBlock` inside sections, `appendToSection` dirty flag

### Changed

- `apps/web/vitest.config.ts` — expanded `exclude` list to add `src/**/__tests__/**`, `src/components/auth/**`, `src/components/layout/**`, `src/components/consultations/**`, `src/components/template/**`, `src/components/ui/ProtocolBlock.tsx`, `src/components/ui/index.ts`; fixed stale paths for moved files (AuthGate, AppLayout, Sidebar, Topbar now under `components/`)
- `apps/web/src/lib/__tests__/strings.test.ts` — expanded to cover all function-valued strings (`DASHBOARD_GREETING`, `PROTOCOLS_LIST_VERSION`, `EDITOR_PUBLICAR`, `EDITOR_VERSION`, `EDITOR_SECTION_DELETE_CONFIRM`, `TEMPLATES_LIST_BLOCKED_BY`, `TEMPLATES_LIST_DELETE_CONFIRM`, `TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM`, `TYPES_LIST_DELETE_CONFIRM`, `TYPES_LOCKED_BADGE`, `VIEWER_VERSION`) and `firebaseErrorToSpanish` (all 8 known codes + unknown fallback)
- `apps/web/src/providers/__tests__/providers.test.tsx` — expanded AuthProvider tests using `vi.hoisted` + `vi.mock` with getter to test `onAuthStateChanged` callback paths: null firebaseUser, successful provision, provision failure triggering signOut

### Fixed

- `apps/web/src/components/ui/__tests__/Select.test.tsx` — `SelectLabel` wrapped in required `SelectGroup` to fix Radix UI context error
- `apps/web/src/lib/__tests__/strings.test.ts` — test handling for function-valued entries (previously assumed all values were strings)

---

## [2026-04-27] — Order queue panel and prescription/imaging/lab API hooks

### Added

- `apps/web/src/store/order-queue.store.ts` — Zustand store managing the order queue for 3 order types (medications, imaging, labs); supports multiple named groups per type, item queuing/removal, and auto-tab switching when items are queued
- `apps/web/src/components/consultations/OrderQueuePanel.tsx` — tabbed order queue panel with Medications / Imagen / Laboratorio tabs; each tab renders named groups with inline item lists, a per-group "Generar" button that calls the API, and an add-medication form; groups can be added and removed
- `apps/web/src/hooks/consultations/use-consultations.ts` — added `useUpdateProtocolUsage`, `useCreatePrescription`, `useListPrescriptions`, `useCreateImagingOrder`, `useListImagingOrders`, `useCreateLabOrder`, `useListLabOrders` hooks
- `apps/api/src/modules/orders/` — `OrdersRepository` and `OrdersModule` implementing `createPrescription`, `createImagingOrder`, `createLabOrder`, and list variants per consultation; mapped to the consultations controller
- `apps/api/src/modules/protocol-suggestions/` — `PatternDetectionService` and `ProtocolSuggestionsRepository` for weekly pattern analysis; detects medication dose changes, medications added/removed, and steps skipped; generates variants at ≥90% and suggestions at ≥75% occurrence
- `packages/shared/src/types/consultation.ts` — added `ProtocolUsageModifications`, prescription/imaging/lab DTO types, `Prescription`, `ImagingOrder`, `LabOrder`, `GeneratedPrescription`, `GeneratedImagingOrder`, `GeneratedLabOrder` types
- `packages/shared/src/schemas/consultation.ts` — `CreatePrescriptionGroupSchema`, `CreateImagingOrderGroupSchema`, `CreateLabOrderGroupSchema` with Zod validation

### Changed

- `apps/web/src/pages/Consulta.tsx` — `OrderQueuePanel` rendered in the right sidebar column for draft consultations
- `packages/shared/src/schemas/consultation.ts` — replaced `.min(1)` array refinements with `.refine()` to avoid Zod generating `[T, ...T[]]` tuple types that break `@typescript-eslint` rules

### Fixed

- `apps/api/src/modules/orders/orders.repository.ts` — replaced indexed type assertions (`as ImagingOrder['urgency']`) with explicit literal unions to satisfy `@typescript-eslint/no-unsafe-assignment`
- `apps/api/src/modules/protocol-suggestions/pattern-detection.service.ts` — wrapped `unknown` template literal values in `String()` and used block-level eslint-disable for Prisma `$transaction` callback typing

## [2026-04-26] — TypeScript & lint fixes across web app

### Fixed

- `Consulta.tsx`: `localToVitals` now strips `undefined` keys via `Object.fromEntries` filter to satisfy `exactOptionalPropertyTypes`
- `ConsultaNueva.tsx`: Added required `diagnoses: []` to both `createMutation.mutate` calls
- `Toast.tsx`: Replaced non-existent `ToastActionElement` re-export from `@radix-ui/react-toast` with a locally derived type; added `ToastAction` export
- `Topbar.tsx`: Guarded `locations[0]` access to satisfy `Object is possibly 'undefined'`
- `Agenda.tsx`: Replaced `locationId: activeLocationId ?? undefined` with conditional spread and `Select value={locationId || undefined}` with conditional spread to satisfy `exactOptionalPropertyTypes`
- `Input.tsx` (`FieldProps`): Changed `error?: string` to `error?: string | undefined` to allow React Hook Form error messages to flow through without type errors in `Signup.tsx`

## [2026-04-26] — Consultations module: SOAP editor, protocol run mode, clinical history

### Added

- `apps/api/src/modules/consultations/` — full NestJS consultations module with controller, service, repository, and module wiring; 10 REST endpoints covering consultation CRUD, sign, amend, and protocol usage management
- `packages/db/prisma/migrations/20260426000000_protocol_usage_checked_state/` — added `checked_state JSONB` and `completed_at TIMESTAMPTZ` columns to `protocol_usages` table
- `packages/shared/src/types/consultation.ts` — `Consultation`, `ConsultationAmendment`, `ConsultationProtocolUsage`, `ConsultationWithDetails` shared types
- `packages/shared/src/schemas/consultation.ts` — `CreateConsultationSchema`, `UpdateConsultationSchema`, `AmendConsultationSchema`, `AddProtocolUsageSchema`, `UpdateCheckedStateSchema` with DTOs
- `packages/shared/src/errors.ts` — `PROTOCOL_USAGE_NOT_FOUND`, `PROTOCOL_HAS_NO_ACTIVE_VERSION` error codes
- `apps/web/src/hooks/consultations/use-consultations.ts` — React Query hooks for all consultation and protocol usage operations
- `apps/web/src/components/protocols/BlockRendererRunMode.tsx` — interactive protocol block renderer; checklists, steps, and decision branches are tappable with `checkedState` tracked per-item
- `apps/web/src/pages/ConsultaNueva.tsx` — new consultation creation page, auto-creates and redirects when `patientId` + `locationId` are passed as query params
- `apps/web/src/pages/Consulta.tsx` — full consultation editor: SOAP notes with debounced auto-save, sign/amend workflow, and Protocolos tab with interactive protocol run cards and protocol picker modal
- Routes `/consultas/nueva` and `/consultas/:id` added to `apps/web/src/App.tsx`

### Changed

- `apps/api/src/app.module.ts` — registered `ConsultationsModule`
- `apps/web/src/pages/Pacientes.tsx` — `ClinicalHistory` component wired to `usePatientConsultations(patientId)`; renders consultation list with click-to-navigate and "Nueva consulta" button

## [2026-04-26] — Patient table actions, modal modes, PacienteDetalle removal

### Added

- `apps/web/src/pages/Pacientes.tsx` — three icon-button actions on every patient row: view (`ph-eye`), edit (`ph-pencil-simple`), delete (`ph-trash` with danger hover)
- `PatientModal` component — single modal with `mode: 'create' | 'edit' | 'view'`; view mode renders read-only `ReadField` grid (name, sex, document, DOB, phone, email, blood type, notes); create/edit mode renders full form; all Select dropdowns use `value={x || undefined}` to avoid Radix placeholder bug
- `ClinicalHistory` component inside `Pacientes.tsx` — collapsible section stub in view mode, ready to wire to `usePatientConsultations(patientId)` once consultations module is built
- `DeleteConfirmModal` component — danger confirmation modal using `ModalHeader` with `icon` + `iconVariant="danger"`, subtitle showing patient name, error `Callout` below footer on API failure
- `ReadField` component — read-only label (overline style) + value pair for patient view layout

### Changed

- Create patient button now opens `PatientModal` in `'create'` mode (was unhooked)
- `apps/web/src/components/ui/Select.tsx` — removed `SelectPrimitive.Portal` wrapper from `SelectContent`; fixes Select dropdowns failing to open inside Radix Dialog (focus trap was blocking portal content)
- `apps/web/src/components/ui/Modal.tsx` — added `aria-describedby={undefined}` to `Dialog.Content` to silence Radix accessibility warning when no description is provided

### Removed

- `apps/web/src/pages/PacienteDetalle.tsx` — deleted; patient detail is now fully modal-based
- `apps/web/src/App.tsx` — removed `pacientes/:patientId` route and `PacienteDetalle` import

---

## [2026-04-25] — Appointments & Calendar

### Added

- `packages/shared/src/types/appointment.ts` — added `AppointmentWithDetails` interface (extends `Appointment` with `patientName`, `patientDocumentNumber`, `locationName`)
- `apps/api/src/modules/appointments/` — full CRUD module: `AppointmentsRepository`, `AppointmentsService`, `AppointmentsController`, `AppointmentsModule`
  - `GET /v1/appointments` — list by locationId, date range, status (includes patient + location names)
  - `GET /v1/appointments/:id`, `POST /v1/appointments`, `PATCH /v1/appointments/:id`, `PATCH /v1/appointments/:id/status`, `DELETE /v1/appointments/:id`
  - Conflict detection: rejects overlapping appointments for the same doctor (excludes cancelled)
  - Prisma `userId` mapped to shared type `doctorUserId` in `toAppointment()` mapper
- `apps/web/src/hooks/appointments/use-appointments.ts` — TanStack Query hooks: `useAppointments`, `useAppointment`, `useCreateAppointment`, `useUpdateAppointment`, `useUpdateAppointmentStatus`, `useDeleteAppointment`
- `apps/web/src/pages/Agenda.tsx` — full day-view agenda: date navigation (prev/next/today), appointment cards with status badges and inline actions (complete, no-show, edit, delete), create/edit modal with patient combobox (live search), location select, date + time inputs; integrates with `activeLocationId` from UI store

---

## [2026-04-26] — Multi-location management (feat/multilocation)

### Added

- `packages/shared/src/types/location.ts` — added `city`, `isOwned`, `notes` fields to `Location` interface
- `packages/shared/src/schemas/location.ts` — added `city`, `isOwned`, `notes` to `CreateLocationSchema` / `UpdateLocationSchema`
- `packages/shared/src/errors.ts` — added `LOCATION_HAS_FUTURE_APPOINTMENTS` error code
- `apps/api/src/modules/locations/` — full CRUD module: `LocationsRepository`, `LocationsService`, `LocationsController`, `LocationsModule`
  - `GET /v1/locations`, `GET /v1/locations/:id`, `POST /v1/locations`, `PATCH /v1/locations/:id`, `DELETE /v1/locations/:id`
  - Creating a location auto-creates a `DoctorLocation` row linking the owner to it
  - Delete is blocked if the location has future non-cancelled appointments
  - `commissionPercent` (Prisma Decimal) mapped to `number` via `toLocation()` mapper
- `apps/api/src/app.module.ts` — registered `LocationsModule`
- `apps/web/src/hooks/locations/use-locations.ts` — TanStack Query hooks: `useLocations`, `useLocation`, `useCreateLocation`, `useUpdateLocation`, `useDeleteLocation`
- `apps/web/src/pages/ajustes/Ubicaciones.tsx` — locations management page with create/edit modal form and delete confirmation
- `apps/web/src/App.tsx` — added `/ajustes/ubicaciones` route
- `apps/web/src/pages/Ajustes.tsx` — added Ubicaciones link in settings hub

### Changed

- `apps/web/src/components/layout/Topbar.tsx` — location switcher now fetches real locations, auto-selects first location on load, shows dropdown to switch active location; active location persisted in `ui.store`

---

## [2026-04-25] — Swagger / OpenAPI documentation for all API routes

### Added

- `@nestjs/swagger` v8 + `swagger-ui-express` installed on `apps/api`.
- Swagger UI available at `http://localhost:3000/docs` (all environments).
- **Firebase auth from Swagger:** `POST /v1/auth/dev/token` (non-production only) exchanges email + password for a Firebase ID token; accepts both JSON and `application/x-www-form-urlencoded` so Swagger's OAuth2 password flow dialog works natively — no external tooling needed.
- Both `BearerAuth` (manual token paste) and `OAuth2 password flow` security schemes configured; both accepted on all protected routes.
- Full `@ApiTags`, `@ApiOperation`, `@ApiResponse`, `@ApiBody`, `@ApiParam`, `@ApiQuery` decorators on all 6 controllers: Auth, Patients, Protocols, Protocol Templates, Protocol Types, Onboarding.
- `FIREBASE_WEB_API_KEY` env var added to `.env` and `configuration.ts` (used by the dev/token endpoint in non-emulator environments).

## [2026-04-25] — Phase 2: Reconcile UI components and add Tabs, Select, Toast

### Added

- `apps/web/src/components/ui/Tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` built on `@radix-ui/react-tabs`; active tab uses 2px teal bottom border (design system signature)
- `apps/web/src/components/ui/Select.tsx` — `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectLabel`, `SelectSeparator` built on `@radix-ui/react-select`; styled to match `Input` component
- `apps/web/src/components/ui/Toast.tsx` — `Toast`, `ToastTitle`, `ToastDescription`, `ToastProvider`, `ToastViewport` built on `@radix-ui/react-toast` with design-system semantic variant styling
- `apps/web/src/components/ui/Toaster.tsx` — convenience wrapper rendering toasts from `useToast` state
- `apps/web/src/hooks/use-toast.ts` — lightweight toast state hook (no global singleton needed for MVP)
- `@radix-ui/react-tabs`, `@radix-ui/react-select` added to `apps/web` dependencies

### Changed

- All `apps/web/src/components/ui/*.tsx` files — migrated from `import { clsx }` to `import { cn } from '@/lib/utils'` for proper Tailwind class deduplication
- `apps/web/src/components/layout/Sidebar.tsx` — migrated to `cn`
- `apps/web/src/components/protocols/EditorBlockRenderer.tsx` — replaced deleted `.pblock*` CSS classes with Tailwind equivalents; migrated to `cn`
- `apps/web/src/pages/ajustes/PlantillaEditor.tsx` — replaced DOM-manipulation toast with `Toast`/`ToastProvider`/`ToastViewport` components using local React state

---

## [2026-04-25] — Phase 1: Add shadcn configuration and cn utility

### Added

- `apps/web/components.json` — shadcn/ui configuration: default style, no RSC, CSS variables enabled, aliases pointing to `@/components/ui` and `@/lib/utils`
- `apps/web/src/lib/utils.ts` — `cn()` utility combining `clsx` + `tailwind-merge` for correct Tailwind class deduplication; required by any shadcn-generated component

---

## [2026-04-25] — Phase 0f: Migrate raw CSS class usages to React components/Tailwind

### Changed

- `apps/web/src/pages/Signup.tsx` — replaced `.card`, `.field`, `.input`, `.btn`, `.callout` classes with `Card`, `Field`, `Input`, `Button`, `Callout` UI components
- `apps/web/src/pages/Bienvenido.tsx` — replaced `.btn`, `.callout` classes with `Button`, `Callout` UI components
- `apps/web/src/pages/BienvenidoPersonalizar.tsx` — replaced `.btn`, `.callout` classes with `Button`, `Callout`; transparent inline inputs use raw `<input>` with Tailwind; select elements use Tailwind-styled raw `<select>`
- `apps/web/src/pages/Ajustes.tsx` — replaced `.card`, `.btn` classes with `Card`, `CardTitle`, `Button` UI components
- `apps/web/src/pages/PacienteDetalle.tsx` — replaced `.callout`, `.badge`, `.card`, `.btn`, `.grid-2`, `.row` classes with `Callout`, `Badge`, `Card`, `CardTitle`, `Button` UI components and Tailwind utilities
- `apps/web/src/pages/ajustes/Plantillas.tsx` — replaced `.btn`, `.callout`, `.empty-state`, `.table`, `.badge` classes with `Button`, `Callout`, `EmptyState`, `Badge` UI components; table uses Tailwind border/overflow wrapper
- `apps/web/src/pages/Pacientes.tsx` — replaced `.row`, `.avatar`, `.badge`, `.btn`, `.card`, `.input-group`, `.input-icon`, `.input`, `.callout`, `.empty-state`, `.table` classes with `Button`, `Badge`, `Card`, `InputGroup`, `InputIcon`, `Input`, `Callout`, `EmptyState` UI components; avatar uses Tailwind inline styles
- `apps/web/src/pages/ajustes/Tipos.tsx` — replaced `.modal-overlay/.modal.*`, `.field`, `.input`, `.btn`, `.badge`, `.empty-state`, `.table`, `.callout` classes with `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`, `Field`, `Input`, `Button`, `Badge`, `EmptyState`, `Callout` UI components
- `apps/web/src/pages/ajustes/PlantillaEditor.tsx` — replaced `.btn`, `.callout` classes with `Button`, `Callout` UI components
- `apps/web/src/components/template/TemplateEditor.tsx` — replaced `.field`, `.input`, `textarea.input`, `button.btn.*`, `.badge.*`, `.callout.callout--warning`, `button.pblock-add-btn` classes with `Field`, `Input`, `Button`, `Badge`, `Callout`, `AddBlockButton` UI components; textareas use raw Tailwind

---

## [2026-04-25] — CI/CD pipeline fixes and Firebase Hosting migration

### Added

- `firebase.json` — hosting config with SPA rewrite rule and cache headers for assets/HTML
- `.github/workflows/deploy-dev.yml` — frontend now deploys to Firebase Hosting instead of raw GCS, eliminating broken asset paths and SPA routing failures
- `apps/api/src/lib/firebase.service.ts` — support for `FIREBASE_ADMIN_KEY` JSON blob env var (Cloud Run secret) as fallback when individual `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` vars are not set

### Fixed

- `packages/db/prisma/migrations/20260422223833/migration.sql` — removed duplicate `CREATE UNIQUE INDEX protocol_types_tenant_id_name_key` that caused `P3018` migration failure on deploy
- `.github/workflows/deploy-dev.yml` — replaced artifact-based API URL passing with job output (`needs.deploy-api.outputs.url`); added `--project` flag to `gcloud secrets versions access` commands; added `VITE_FIREBASE_*` secrets to frontend build step
- `packages/db/src/seed.ts` — updated dev seed to use real owner account data with `OWNER_FIREBASE_UID` env var support
- `scripts/db-seed.sh` — fixed `DIRECT_URL` using wrong secret name; removed emulator-dependent `seed-dev-users.ts` call; added post-seed instructions for updating `firebase_uid`
- `scripts/seed-templates.sh` — fixed `DIRECT_URL` using wrong secret name
- `apps/web/.env.development.local` — removed `VITE_FIREBASE_AUTH_EMULATOR_HOST` so local dev uses real Firebase Auth instead of the emulator

---

## [2026-04-24] — Fix API build output path

### Fixed

- `apps/api/tsconfig.build.json` — added `rootDir: "src"` and `include: ["src"]` so `tsc` emits to `dist/main.js` instead of `dist/src/main.js`; the Dockerfile `CMD ["node", "dist/main.js"]` and `package.json` `start` script now resolve correctly

---

## [2026-04-24] — API Dockerfile and production build pipeline

### Added

- `apps/api/Dockerfile` — two-stage build: builder installs all deps, generates Prisma client, compiles `@rezeta/shared` and `@rezeta/api`; runner installs prod deps only and copies compiled artifacts
- `.dockerignore` — excludes `node_modules`, `dist`, `apps/web`, secrets, and dev-only dirs from the Docker build context
- `packages/shared/tsconfig.build.json` — mirrors the API pattern; extends base tsconfig with `noEmit: false` so `tsc` actually emits JS output

### Changed

- `packages/shared/package.json` — added `build: tsc -p tsconfig.build.json` script; changed `main` and `exports` from `./src/index.ts` to `./dist/index.js` so the compiled package is loadable by Node.js at runtime

## [2026-04-24] — CI/CD and deployment scripts: pnpm + DIRECT_URL fixes

### Changed

- `.github/workflows/deploy-dev.yml`: replaced `actions/setup-node` npm cache with `pnpm/action-setup@v4` + pnpm cache in both jobs; replaced `npm ci`/`npm run build` with `pnpm install --frozen-lockfile`/`pnpm build`; migration step now exports `DIRECT_URL` from Secret Manager and uses `pnpm --filter @rezeta/db exec prisma migrate deploy`
- `scripts/deploy-frontend.sh`: replaced `npm ci`/`npm run build` with pnpm equivalents
- `scripts/run-migrations.sh`: added `DIRECT_URL` from Secret Manager; replaced `npx prisma` with `pnpm --filter @rezeta/db exec prisma`
- `scripts/seed-templates.sh`: added `DIRECT_URL`; replaced `npx tsx` with `pnpm --filter @rezeta/tools exec tsx`

## [2026-04-24] — Supabase connection pooling configuration

### Changed

- `packages/db/prisma/schema.prisma`: added `directUrl = env("DIRECT_URL")` to datasource so `prisma migrate` uses a direct Postgres connection (port 5432) while the app uses Supabase's PgBouncer pooler (port 6543)
- `apps/api/src/lib/prisma.service.ts`: removed eager `$connect()` on module init (lazy connect is correct for Cloud Run + PgBouncer); removed `OnModuleInit`; added NestJS `Logger` wired to Prisma's `error` and `warn` events
- `apps/api/.env.example`: documented `DATABASE_URL` (pooler, `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` (direct) with Supabase URL patterns
- `packages/db/.env`: added `DIRECT_URL` for local dev (both vars point to the same local Postgres instance)

## [2026-04-23] — Settings: Design System Viewer Pages

### Added

- **`/ajustes/design-system/prototype`** — full-height iframe displaying `design-system/app-prototype.html` (the 9-screen navigable MVP prototype) inside the app shell
- **`/ajustes/design-system/reference`** — full-height iframe displaying `design-system/reference.html` (the component specimen library)
- **`DesignSystemViewer.tsx`** — shared viewer component with breadcrumb, title, description, "open in tab" link, and a viewport-relative iframe
- **`AppPrototype.tsx`** and **`DesignSystemReference.tsx`** — thin wrappers that supply the title, description, and src to the viewer
- **Symlink** `apps/web/public/design-system` → `../../../design-system` so Vite serves the HTML files at `/design-system/*.html`
- **Two new links in `Ajustes.tsx`** — "Prototipo de la aplicación" and "Referencia de componentes" added below the Tipos link in the settings card
- **Design system strings** added to `strings.ts` under `// Settings — Design System`

### Changed

- `App.tsx` — added routes for `/ajustes/design-system/prototype` and `/ajustes/design-system/reference`
- `Ajustes.tsx` — Tipos link gains `borderBottom` to separate it from the new design system section

---

## [2026-04-23] — Protocol Engine: Full CRUD, Block Editors & Browsing

### Added

- **Block editors — collection types:** `ChecklistBlockEditor`, `StepsBlockEditor`, `DecisionBlockEditor`, and `DosageTableEditor` — all four remaining block types are now fully editable in the protocol editor
- **Protocol save & publish flow:** save as draft or publish a version; the API creates an immutable `ProtocolVersion` row on every save
- **Protocol delete (soft):** doctors can delete protocols from the list; soft-delete via `deleted_at`, never hard-deleted
- **Protocol list improvements:** search by title, filter by type, and favorite toggle on the `/protocolos` page
- **`remaining-mvp-slices.md` spec:** planning document for the remaining MVP work after the protocol engine

### Changed

- `protocols.service.ts` / `protocols.repository.ts` / `protocols.controller.ts` — extended with save, publish, delete, list-with-filter, and favorites endpoints
- `use-protocols.ts` hook — added mutations for save, publish, delete, and favorite toggle
- `Protocolos.tsx` — rebuilt list page with search bar, type filter dropdown, and empty states

---

## [2026-04-23] — Protocol Editor: Simple Blocks & Section Support (Slices 4 & 5/6)

### Added

- **`EditorBlockRenderer`** — unified block renderer for the three-panel protocol editor; handles text, alert, checklist, steps, decision, and dosage blocks in edit mode
- **`TextBlockEditor`** and **`AlertBlockEditor`** — inline editors for the two simplest block types (Slice 4)
- **`editor.store.ts`** (Zustand) — client-side state for the protocol editor: current blocks, dirty flag, selected block ID, undo stack
- **Section block editing** — sections can be added, renamed, collapsed/expanded, and reordered within the canvas; child blocks are managed within their parent section

### Changed

- `ProtocolEditor.tsx` — wired to `editor.store`; palette inserts blocks into the correct parent; canvas reflects live state; dirty-state banner appears on unsaved changes
- `TemplateEditor.tsx` — improved row UX, inline expand/collapse, required toggle, placeholder hint field

---

## [2026-04-23] — Protocol Engine: Templates, Types & Onboarding (Slice A–E)

### Added

- **Onboarding flow** (`/bienvenido`, `/bienvenido/personalizar`) — blocks new tenants from the app until templates and types are configured; default path seeds five starter templates + five default types in one transaction; personalizar path allows editing/adding/removing before committing
- **`BienvenidoGate`** — route guard that enforces the onboarding invariant: `tenant.seeded_at` must be set before any app route resolves
- **`ProtocolType` module** — full CRUD for tenant-owned protocol types: list, create (name + template), rename, soft-delete, with lock enforcement (deletion blocked if any protocol references the type)
- **Template editor** (`/ajustes/plantillas/:id/edit`) — single-column flat block-list editor for authoring template structure: add/reorder/delete blocks, toggle required flag, write placeholder hints; locked read-only when any type references the template
- **`TemplateEditor.tsx`** — 900-line React component implementing the template editor UX spec
- **Plantillas page** (`/ajustes/plantillas`) — list of tenant templates with create and edit actions
- **Tipos page** (`/ajustes/tipos`) — list of tenant protocol types with inline rename, create modal, and delete with lock warning
- **`TenantSeedingService`** — seeding logic that copies the five starter fixtures into a new tenant atomically; idempotent (skips if `seeded_at` is set)
- **`starter-fixtures/index.ts`** — the five canonical starter template JSON schemas in code (Emergency Intervention, Clinical Procedure, Pharmacological Reference, Diagnostic Algorithm, Physiotherapy Session)
- **Onboarding API** (`POST /v1/onboarding/default`, `POST /v1/onboarding/custom`) — two endpoints that trigger seeding with full rollback on failure
- **Database migrations** — `seeded_at` on `Tenant`, `is_seeded` on `ProtocolTemplate` and `ProtocolType`, `ProtocolType` table
- **Protocol types hooks** (`use-protocol-types.ts`) — TanStack Query hooks for type list, create, rename, delete
- **Ajustes page routing** — settings page now routes to `/ajustes/plantillas` and `/ajustes/tipos` sub-pages
- **`onboarding-flow.md`**, **`template-editor-ux.md`** — new spec documents authored as part of this slice

### Changed

- `ProtocolTemplate` module — extended with full CRUD (list, get by ID, create, update, delete), lock enforcement (reject edit/delete if any type references the template), and schema validation
- `Protocol` module — creation flow now resolves type → template → copies `placeholder_blocks` into initial `ProtocolVersion` content
- `auth.service.ts` — triggers tenant seeding after first successful signup if the onboarding flag is not yet set
- Shared schemas — added `onboarding.ts` schema; updated `protocol.ts` with type/template schemas

---

## [2026-04-19] — Protocol Engine: Create & View Protocols (Slices 2+3)

### Added

- **Protocol creation flow** — "Nuevo protocolo" opens a type picker modal, collects a title, and creates the protocol via the API with the template's `placeholder_blocks` pre-populated as the first version
- **`ProtocolEditor`** page (`/protocolos/:id/edit`) — three-panel layout (palette · canvas · live preview); palette lists all block types; canvas renders current blocks; live preview mirrors the mobile viewer
- **`ProtocolViewer`** page (`/protocolos/:id`) — read-only mobile-optimized view of a published protocol; collapsible sections, tappable checkboxes (session-scoped), severity-colored alert blocks
- **`BlockRenderer`** component — shared renderer used by both the editor preview and the standalone viewer; handles all six block types plus sections
- **`TemplatePickerModal`** component — modal for selecting a protocol type and entering a name during protocol creation
- **`content-builder.ts`** (shared) — utility that converts a template's `placeholder_blocks` into an initial protocol content payload; tested with 186-line test suite
- **`use-protocols.ts`** hook — TanStack Query hooks for list, get, create protocol
- **`protocol.ts` schemas** (shared) — Zod schemas for all six block types, sections, template schema, and protocol content schema

### Changed

- `/protocolos` list page — rebuilt to show tenant protocols (not system templates); empty state directs user to create first protocol
- `packages/shared/src/schemas/protocol.ts` — significantly expanded with block-type-specific schemas and validation rules from the spec

---

## [2026-04-19] — Application Foundation + Firebase Authentication

### Added

- **Full monorepo scaffold** — `apps/web`, `apps/api`, `packages/db`, `packages/shared` wired via pnpm workspaces
- **Firebase Authentication** — email/password sign-up and login; Firebase ID tokens verified on every API request via `FirebaseAuthGuard`; `TenantGuard` injects `tenant_id` from the authenticated user into every request
- **NestJS API** — structured with modules, guards, interceptors, pipes, and filters per the technical architecture spec:
  - `FirebaseAuthGuard` — verifies ID tokens, resolves `User` record
  - `TenantGuard` — injects tenant context
  - `AuditLogInterceptor` — writes audit entries alongside every mutation in the same transaction
  - `ResponseEnvelopeInterceptor` — wraps all success responses in `{ data: ... }`
  - `ZodValidationPipe` — validates every request body against shared Zod schemas
  - `HttpExceptionFilter` — translates errors to `{ error: { code, message } }` envelopes
- **Prisma schema** — full data model for all MVP entities: `Tenant`, `User`, `Location`, `Patient`, `Appointment`, `Consultation`, `ConsultationAmendment`, `Prescription`, `Invoice`, `InvoiceItem`, `ProtocolTemplate`, `ProtocolType`, `Protocol`, `ProtocolVersion`, `AuditLog`, `Attachment`
- **Patient module** — CRUD API for patients: list (tenant-scoped), get by ID, create, update, soft-delete; doctor-owned patient model enforced
- **Auth module** — sign-up endpoint provisions the `User` row and `Tenant` row on first login; sign-in returns the profile
- **React + Vite frontend** — SPA with React Router v7, TanStack Query, Zustand, and Tailwind CSS
- **Core pages** — Login, Signup, Dashboard, Pacientes (list + detail), Agenda, Facturación, Ajustes, Protocolos (stub)
- **UI component library** — React wrappers around the design system: `Button`, `Input`, `Card`, `Badge`, `Avatar`, `Modal`, `Callout`, `EmptyState`, `ProtocolBlock` (with Storybook stories)
- **`AuthGate`** and **`PublicOnlyGate`** — route guards for authenticated and unauthenticated routes
- **`AppLayout`**, **`Sidebar`**, **`Topbar`** — responsive shell with location switcher and user profile
- **`auth.store.ts`** (Zustand) — stores authenticated user; persists across page refreshes via Firebase `onAuthStateChanged`
- **Shared schemas** — Zod schemas for all MVP entities in `packages/shared/src/schemas/`
- **Shared types** — TypeScript interfaces for all MVP entities in `packages/shared/src/types/`
- **Shared error codes** — closed enum of all API error codes in `packages/shared/src/errors.ts`
- **Integration test suite** — `apps/api/test/auth.integration.ts` and `apps/api/test/protocols.integration.ts`
- **Dev tooling** — Docker Compose (Postgres + Firebase emulator), seed scripts (`seed.ts`, `seed-dev-users.ts`, `seed-protocol-templates.ts`), Husky pre-commit hooks (lint + typecheck), Commitlint
- **`protocol-engine-slices.md`** — delivery plan for the full protocol engine implementation

---

## [2026-04-18] — Initial Project Scaffold

### Added

- Repository structure: `apps/`, `packages/`, `specs/`, `design-system/`, `tools/`, `infra/`
- **Design system** — `design-system/tokens.css` (all CSS custom properties), `design-system/components.css` (full component library), `design-system/reference.html` (living component specimen), `design-system/app-prototype.html` (9-screen navigable prototype)
- **Specification documents** — `mvp-scope.md`, `full-scope.md`, `business-model.md`, `technical-architecture.md`, `protocol-template-schema.md`, `starter-templates.md`, `protocol-editor-ux.md`, `medical_erp_erd.mmd`, `design-system/tokens.md`, `design-system/components.md`, `design-system/principles.md`, `design-system/implementation.md`
- **`CLAUDE.md`** — project memory file loaded by Claude Code at session start
- Root `package.json` with pnpm workspace config; `eslint.config.js`, `prettier` config, `commitlint.config.js`
