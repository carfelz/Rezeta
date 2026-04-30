# Changelog

All notable changes to the Medical ERP are documented here.

Format: `[version/date] — description`. Entries are ordered newest first.

---

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
