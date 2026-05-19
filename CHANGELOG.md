# Changelog

All notable changes to the Medical ERP are documented here.

Format: `[version/date] — description`. Entries are ordered newest first.

## [2026-05-18] — Migrate toast system to Sonner; replace window.confirm with ConfirmDialog

### Added

- `apps/web/src/components/ui/SonnerToaster.tsx` — `AppToaster` wrapper around Sonner's `<Toaster>`. Applies design-system classNames (neutral surface, 1px border `border-n-200`, `shadow-floating`, Phosphor icons per severity, IBM Plex Sans).
- `apps/web/src/components/ui/ConfirmDialog.tsx` — async, state-driven `<ConfirmDialog>` built on the existing `Modal` + `ModalHeader` pattern. Accepts `variant` (`danger` | `primary`), `loading` (disables both buttons and blocks escape-to-close), and custom `confirmLabel` / `cancelLabel`.
- `apps/web/src/lib/strings.ts` — `TOAST_*` section: ~50 success-message keys and ~20 error-message keys covering all domains (patients, consultations, prescriptions, appointments, invoices, locations, protocols, types, templates, schedules, onboarding, protocol-usage actions).

### Changed

- `apps/web/src/providers/index.tsx` — mounted `<AppToaster />` inside `AuthProvider` so toasts are available app-wide.
- `apps/web/src/components/ui/index.ts` — removed Radix Toast exports (`Toast`, `Toaster`, `ToastProvider`, etc.); added `AppToaster` and `ConfirmDialog`.
- All mutation hooks wired with `toast.success` / `toast.error` via `onSuccess` / `onError` callbacks:
  - `apps/web/src/hooks/appointments/use-appointments.ts` — create, update, status update, delete
  - `apps/web/src/hooks/consultations/use-consultations.ts` — create, sign, amend, delete, add/remove protocol usage, skip step, off-protocol note, switch protocol. Update and `useUpdateCheckedState` left silent (inline autosave indicator / checkbox state carry that feedback).
  - `apps/web/src/hooks/invoices/use-invoices.ts` — create, update, status update, delete
  - `apps/web/src/hooks/locations/use-locations.ts` — create, update, delete
  - `apps/web/src/hooks/onboarding/use-onboarding.ts` — default-path and custom-path completion
  - `apps/web/src/hooks/patients/use-patients.ts` — create, update, delete
  - `apps/web/src/hooks/protocol-templates/use-protocol-templates.ts` — create, update, delete
  - `apps/web/src/hooks/protocol-types/use-protocol-types.ts` — create, update, delete
  - `apps/web/src/hooks/protocols/use-protocols.ts` — create, update, delete, publish version
  - `apps/web/src/hooks/schedules/use-schedules.ts` — update, exception create/delete
- `apps/web/src/components/protocols/EditorBlockRenderer.tsx` — replaced `window.confirm()` on section and leaf block delete with `<ConfirmDialog>` (state-driven, danger variant).
- `apps/web/src/components/template/TemplateEditor.tsx` — replaced `window.confirm()` on block row delete with `<ConfirmDialog>`; replaced `alert()` for missing-section validation with `toast.warning()`.
- `apps/web/src/pages/ajustes/Plantillas.tsx` — replaced `window.confirm()` template delete with `<ConfirmDialog>` (supports `loading` state); replaced `alert()` for locked-template error with `toast.error()`.
- `apps/web/src/pages/ajustes/Tipos.tsx` — same pattern as Plantillas: `<ConfirmDialog>` for delete, `toast.error()` for locked-type error.

### Removed

- `apps/web/src/components/ui/Toast.tsx` — Radix UI toast primitives, replaced by Sonner.
- `apps/web/src/components/ui/Toaster.tsx` — custom Radix toaster, replaced by `SonnerToaster.tsx`.
- `apps/web/src/hooks/use-toast.ts` — custom `useToast` hook, no longer needed; call `toast.*` from `sonner` directly.

## [2026-05-18] — Replace stale Toast tests; add tests for ConfirmDialog and SonnerToaster

### Added

- `apps/web/src/components/ui/__tests__/ConfirmDialog.test.tsx` — 10 tests covering open/closed rendering, confirm/cancel callbacks, custom labels, loading state (disables both buttons, blocks escape-to-close), and primary/danger variants.
- `apps/web/src/components/ui/__tests__/SonnerToaster.test.tsx` — 2 smoke tests verifying `AppToaster` mounts without crashing.

### Fixed

- `apps/web/src/components/ui/__tests__/Toast.test.tsx` — deleted. File tested `Toast.tsx` and `Toaster.tsx`, both of which were removed when the project migrated to Sonner. Stale import caused the entire test suite to fail with a module-resolution error.

## [2026-05-13] — Align `ProtocolUsage.status` enum across schema, types, and DB

### Changed

- `packages/db/prisma/schema.prisma` — updated `ProtocolUsage.status` schema comment to include all four valid values (`in_progress | completed | abandoned | switched`). Previously the comment listed only three even though `switched` is actively written by `apps/web/src/hooks/consultations/use-consultations.ts`.
- `packages/shared/src/types/protocol.ts` — introduced `PROTOCOL_USAGE_STATUSES` const (`as const` tuple) and derived `ProtocolUsageStatus` from it. Single source of truth for the four valid statuses.
- `packages/shared/src/schemas/consultation.ts` — `UpdateProtocolUsageSchema.status` now uses `z.enum(PROTOCOL_USAGE_STATUSES)` instead of a hardcoded three-value list, closing a real gap that would have rejected `status: 'switched'` on update.
- `packages/shared/__tests__/protocol-usage-status.test.ts` — assertion now references the exported const rather than re-declaring the list inline.

### Added

- `packages/db/prisma/migrations/20260513000001_add_protocol_usage_status_check/migration.sql` — adds DB-level `CHECK` constraint enforcing `protocol_usages.status IN ('in_progress', 'completed', 'abandoned', 'switched')`.

## [2026-05-13] — Drop legacy `Consultation.protocolsApplied` column

### Changed

- `packages/db/prisma/schema.prisma` — removed legacy `Consultation.protocolsApplied String[]` field. Zero application consumers; canonical data already lives in the `protocolUsages` relation.

### Added

- `packages/db/prisma/migrations/20260513000000_drop_protocols_applied/migration.sql` — drops the `protocols_applied` column from `consultations`. Logs (via `RAISE NOTICE`) the count of any rows with non-empty values before dropping.

## [2026-05-11] — Branded 404 / route ErrorBoundary

### Added

- `apps/web/src/pages/NotFound.tsx` — branded recovery page with `Volver al inicio` (→ `/dashboard`) and `Ir a pacientes` (→ `/pacientes`) CTAs. Uses `useRouteError` + `isRouteErrorResponse`: thrown 5xx responses or unknown errors render `Algo salió mal`; everything else (catch-all `*` route, thrown 4xx) renders `No encontramos esta página`.
- `apps/web/src/pages/__tests__/NotFound.test.tsx` — covers unmatched-route 404, absence of React Router's `Hey developer 👋` developer message, and 5xx throw path.

### Changed

- `apps/web/src/App.tsx` — registered `NotFound` as `errorElement` on the onboarding (`AuthGate + BienvenidoGate`) and protected (`AuthGate + AppLayout`) route groups, plus a top-level catch-all `{ path: '*', element: <NotFound /> }`. End users no longer see React Router's default `Unexpected Application Error!` UI on stale bookmarks or mistyped URLs.
- `apps/web/src/lib/strings.ts` — added `NOT_FOUND_TITLE`, `NOT_FOUND_DESCRIPTION`, `ERROR_BOUNDARY_TITLE`, `ERROR_BOUNDARY_DESCRIPTION`, `NOT_FOUND_GO_HOME`, `NOT_FOUND_GO_PATIENTS`.

## [2026-05-11] — Dashboard greeting reflects time of day

### Fixed

- `apps/web/src/pages/Dashboard/index.tsx` — replaced hardcoded `Buenos días, Dr. {lastName}.` with `strings.DASHBOARD_GREETING(user?.fullName ?? null)` from `apps/web/src/lib/strings.ts`. The helper already exists with full test coverage and derives `Buenos días` / `Buenas tardes` / `Buenas noches` from `new Date().getHours()` (cutoffs at 12 and 19). Doctors logging notes in the evening no longer see a "good morning" greeting.

## [2026-05-11] — R5 carryover: Consulta H1 reflects state

### Fixed

- **R5** `apps/web/src/pages/Consulta/index.tsx` page title now resolves to:
  - `Consulta del 10 may de 2026 · firmada` for signed consultations,
  - `Consulta del 10 may de 2026` for drafts with any SOAP content (chief complaint, subjective, objective, assessment, plan, or diagnoses on either the server record or live soap state),
  - `Nueva consulta` only for truly empty drafts.
    Stops surfacing the chief complaint as the title (previously `liveChief || \`Consulta del …\``) and switches the date helper from the local `formatDate`(which produced`10 may 2026`) to `formatBreadcrumbDate`from`apps/web/src/lib/format/dates.ts` so the title matches the rest of the date system.

## [2026-05-11] — R8 follow-up: recommendation cache invalidation

### Fixed

- **R8** Investigated `/v1/patients/:id/protocol-suggestions` allegedly omitting `source` and leaking patient-history values across patients. Not reproducible on current branch: live API returns `source: 'doctor-history'` with `lastUsedAt: null`, `usageCount: 0`, `isMostProbable: false` for Ana María (no prior consultations) and `source: 'patient-history'` with full per-patient signals for Roberto. Audit symptoms were the 60s in-memory cache serving pre-R1 data immediately after the file was edited.

### Changed

- `apps/api/src/modules/consultations/consultations.service.ts` — invalidates `ProtocolRecommendationsService` cache after consultation create (with `protocolId`) and after `addProtocolUsage`, so next gate load reflects the new `ProtocolUsage` row within the 60s TTL window.
- `apps/api/src/modules/consultations/consultations.module.ts` — imports `ProtocolRecommendationsModule` for the above injection.

### Added

- `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts` — assertion that `recommendationsSvc.invalidate(tenantId, userId, patientId)` is called in the atomic create-with-protocol path.

## [2026-05-11] — R7 follow-up: unmask dev errors + audit error details

### Fixed

- **R7** Investigated `POST /v1/consultations` returning 500 INTERNAL_ERROR. Not reproducible on current branch. Audit doc's curl test used non-existent location ID `00000000-0000-0000-a002-000000000001`; actual seeded IDs are `00000000-0000-0000-a002-010000000001` / `010000000002`. Wrong IDs triggered a Prisma FK violation that surfaced as generic 500. Verified `POST /v1/consultations` (with and without `protocolId`) returns 201 against a real auth token and seeded IDs.

### Changed

- `apps/api/src/common/filters/http-exception.filter.ts` — non-`HttpException` errors now surface the real `err.message` and a truncated stack via `error.details` when `NODE_ENV !== 'production'`. Production still masks to "Internal server error".
- `apps/api/src/common/interceptors/audit-log.interceptor.ts` — failed mutation rows now populate `errorCode` (from `err.response.code` or `err.code`) and `metadata.errorMessage`, so audit history identifies the failure cause without re-running the request.

### Added

- `apps/api/src/common/filters/__tests__/http-exception.filter.spec.ts` — covers prod-mask vs dev-unmask paths for non-`HttpException` errors.

## [2026-05-10] — Round-2 fixes (R1–R6)

### Fixed

- **R1** Patient-leak in protocol recommendations. `apps/api/src/modules/protocol-recommendations/protocol-recommendations.repository.ts` now tags each `RankedCandidate` with `source` (`patient-history` | `doctor-history` | `fallback`); `lastUsedAt`, `usageCount`, and `isMostProbable` are zeroed for non-patient-history rows so doctor-wide signals no longer render as patient-specific. `packages/shared/src/types/protocol.ts` exposes `ProtocolRecommendationSource` and adds `source` to `ProtocolRecommendation`. `apps/web/src/components/consultations/ConsultationGate.tsx` switches the section heading to "Protocolos sugeridos" unless every visible row is `patient-history`, and renders the subtitle by source ("Última: …", "Tu favorito", or version-only).
- **R2** "Dr. Dr." duplicate honorific. New `apps/web/src/lib/format/names.ts` exports `formatDoctorName()` that strips a leading honorific before re-prefixing. Used in `ConsultaNueva.tsx` and `OffProtocolNote.tsx`.
- **R3** English `active` badge on protocol detail. `apps/web/src/pages/ProtocolViewer.tsx` now uses `protocolStatusLabel` + a `statusVariant` helper so the detail badge matches the localized list page.
- **R4** Protocol strip not sticky. `apps/web/src/pages/Consulta/ProtocolBar.tsx` strip wrapper made `sticky top-topbar z-20`; `apps/web/src/pages/Consulta/index.tsx` right-rail offset bumped to `top-[120px]` so it clears the sticky strip.
- **R5** Consulta H1 stuck at "Nueva consulta". `apps/web/src/pages/Consulta/index.tsx` derives `hasContent` from the server consultation (with live SOAP state as fallback) so the title reflects state on first render, not after soap hydration.
- **R6** ResumeBanner read "hace 4226 minutos". New `formatRelativeMinutes()` in `apps/web/src/lib/format/dates.ts` (uses `Intl.RelativeTimeFormat` es-DO with auto numeric); `apps/web/src/components/consultations/ResumeBanner.tsx` switched to it.

### Added

- `apps/api/src/modules/protocol-recommendations/__tests__/protocol-recommendations.repository.spec.ts` — tests source-tag distinction across the three ranking steps.
- `apps/web/src/components/consultations/__tests__/ConsultationGate.source.test.tsx` — covers the doctor-history source case.
- `apps/web/src/lib/format/__tests__/names.test.ts` — 12 cases for `formatDoctorName()`.
- New `formatRelativeMinutes` test cases in `apps/web/src/lib/format/__tests__/dates.test.ts`.
- New "humanizes long elapsed spans" case in `apps/web/src/components/consultations/__tests__/ResumeBanner.test.tsx`.

## [2026-05-08] — Page-component splits

### Changed

Each page over 300 lines moved into its own folder with extracted sub-components and helpers. Routes still resolve via `index.tsx` re-exports — `App.tsx` imports unchanged.

- **`apps/web/src/pages/Pacientes/`** (was 735 LOC). Split: `index.tsx` (177), `PatientModal.tsx`, `DeleteConfirmModal.tsx`, `PatientRow.tsx`, `ClinicalHistory.tsx`, `ConsultationListItem.tsx`, `ReadField.tsx`, `helpers.ts`.
- **`apps/web/src/pages/ProtocolEditor/`** (was 784 LOC). Split: `index.tsx` (337), `EditorHeader.tsx`, `EditorTOC.tsx`, `EditorPalette.tsx`, `HistoryDrawer.tsx`, `PublishModal.tsx`, `DraftBanner.tsx`, `block-factory.ts`, `helpers.ts`.
- **`apps/web/src/pages/Facturacion/`** (was 733 LOC). Split: `index.tsx` (115), `InvoiceFormModal.tsx`, `InvoiceRow.tsx`, `DeleteConfirmModal.tsx`, `StatusAction.tsx`, `SummaryCards.tsx`, `helpers.ts`.
- **`apps/web/src/pages/Agenda/`** (was 685 LOC). Split: `index.tsx` (152), `AppointmentFormModal.tsx`, `AppointmentCard.tsx`, `AppointmentCardWithMutation.tsx`, `DeleteConfirmModal.tsx`, `DateNavigation.tsx`, `PatientCombobox.tsx`, `helpers.ts`.
- **`apps/web/src/pages/Dashboard/`** (was 617 LOC). Split: `index.tsx` (153), `PageHeader.tsx`, `KpiCard.tsx`, `UpcomingAppointments.tsx`, `UpcomingRow.tsx`, `RecentPatients.tsx`, `RecentProtocols.tsx`, `ActivityFeed.tsx`, `ActivityItem.tsx`, `helpers.ts`.
- **`apps/web/src/pages/Consulta/`** (was 558 LOC). Split: `index.tsx` (312), `Breadcrumb.tsx`, `PageHeader.tsx`, `SignedBanner.tsx`, `AmendmentsBanner.tsx`, `ProtocolBar.tsx`, `ConsultaModals.tsx`, `use-soap-state.ts` (custom hook bundling SOAP form state + autosave), `helpers.ts`.
- **`apps/web/src/pages/PacienteDetalle/`** (was 454 LOC). Split: `index.tsx` (54), `PageHeader.tsx`, `DemographicsBlock.tsx`, `MedicalInfoBlock.tsx`, `EditModal.tsx`. Reuses `ReadField`, `ClinicalHistory`, `helpers` from `pages/Pacientes/`.
- **`apps/web/src/pages/BienvenidoPersonalizar/`** (was 314 LOC). Split: `index.tsx` (89), `StepTemplates.tsx`, `StepTypes.tsx`, `StepDots.tsx`, `types.ts`.

No functional changes — every split preserves prior visual + behavior. Helpers extracted to colocated `helpers.ts` files when shared across sub-components in the same folder.

### Tests

- All existing page tests pass unchanged — splits preserved component boundaries that tests were written against.
- Coverage: 100% per-file across web, ≥95% per-file across API. No threshold regressions.

## [2026-05-08] — Audit handoff prompts 1–10 (consultation gate, refactor, preferences)

### Added

- `packages/shared/src/schemas/user-preferences.ts`: `UserPreferencesSchema` + `UpdateUserPreferencesSchema` Zod definitions; `consultationViewMode: 'soap' | 'canvas'` is the first key.
- `packages/db/prisma/migrations/20260508000000_add_user_preferences/migration.sql`: adds `users.preferences JSONB DEFAULT '{}'`.
- `apps/api/src/modules/users/users.controller.ts`: new `GET /v1/users/me/preferences` and `PATCH /v1/users/me/preferences` endpoints (cross-device sync). Auth-guarded; tenant-scoped at the service layer.
- `apps/api/src/modules/users/users.service.ts`: `getPreferences` and `updatePreferences` (partial-merge semantics).
- `apps/web/src/lib/format/dates.ts`: centralized Spanish date formatters (`formatDateLong`, `formatBreadcrumbDate`, `formatConsultationOverline`, `formatTimeShort`). Replaces inline `SPANISH_DAYS` / `SPANISH_MONTHS` constants in `ConsultaNueva.tsx` and the `capitalize` Tailwind misuse in `Agenda.tsx` (audit L15 — wrong "De Mayo De" casing).
- `apps/web/src/lib/consultation/{vitals,usage}.ts`: pure helpers extracted from `Consulta.tsx`.
- `apps/web/src/components/consultations/`: extracted sub-components — `SaveBadge`, `SectionBlock`, `SoapTextarea`, `VitalInput`, `VitalsSection`, `DiagnosesSection`, `AsideCard`, `SignModal`, `AmendmentModal`, `SoapView`, `ConsultationSidebar`. Each has a colocated test in `__tests__/`.
- `apps/web/src/lib/strings.ts`: `PROTOCOL_STATUS_LABELS` map + `protocolStatusLabel` helper. Replaces inline English `active` rendering in `Protocolos.tsx` (audit L6).

### Changed

- **Prompt 1 — Gate routing.** `apps/web/src/pages/ConsultaNueva.tsx`: deleted the legacy patient+location picker form; the gate is now the only entry surface. Inline `<Field>` pickers appear above the gate when `patientId`/`locationId` is missing in the URL. Default location auto-resolves to the doctor's first owned location.
- **Prompt 2 — Atomic consultation creation.** `packages/shared/src/schemas/consultation.ts` adds optional `protocolId` to `CreateConsultationSchema` (omitted from `UpdateConsultationSchema`). `apps/api/src/modules/consultations/consultations.service.ts:create` now wraps consultation insert + `protocolUsage` insert in `prisma.$transaction` when `protocolId` is provided. `apps/web/src/pages/ConsultaNueva.tsx` swaps the two-step `apiClient.post` chain for a single `useCreateConsultation` mutation.
- **Prompt 2 — Real protocol suggestions.** `apps/web/src/hooks/consultations/use-protocol-suggestions.ts` rewritten to call `GET /v1/patients/:patientId/protocol-suggestions` (the existing `ProtocolRecommendationsModule`) instead of returning generic `useGetProtocols` results. The "Más probable" badge now reads `isMostProbable` from the backend, and "Última: hace N meses" now reads `lastUsedAt` rather than `updatedAt`.
- **Prompt 3 — Hardcoded names removed.** `ConsultationGate.tsx` empty-state line (`Dr. García usa 2.1 protocolos por paciente en promedio.`) deleted (fake stat). `OffProtocolNote.tsx` reads doctor name from `useAuth()` with a `Doctor(a)` fallback. `_preview/GatePreview.tsx` placeholder updated to `Dr. Demo`.
- **Prompt 4 — Sticky right rail.** `Consulta.tsx` page-level layout now hosts a sticky `<aside className="sticky top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto">` containing the new `ConsultationSidebar`. The rail renders alongside both `<SoapView>` and `<CanvasView>` — fixes audit L7 (rail disappears on scroll) and L8 (rail vanishes in canvas mode).
- **Prompt 5 — Sub-component extraction.** `Consulta.tsx` shrinks from 1207 → ~545 lines. The duplicate inline `ProtocolPickerModal` is gone; the standalone `apps/web/src/components/protocols/ProtocolPickerModal.tsx` gains optional `excludeIds` and `isPending` props and is now the only implementation.
- **Prompt 6 — User preferences.** Schema gains `User.preferences JSONB`. `AuthUser` (in `packages/shared/src/types/auth.ts`) carries `preferences: UserPreferences`; `auth.guard.ts` and `auth.service.toAuthUser` populate it. `apps/web/src/store/auth.store.ts` gains `setPreferences` action. `apps/web/src/hooks/consultations/use-consultation-view-mode.ts` reads `user.preferences.consultationViewMode` first, falls back to localStorage during initial render, and PATCHes through to `/v1/users/me/preferences` on change.
- **Prompt 7 — CLAUDE.md.** Removed "protocol-to-consultation integration" from the deferred-features list. Added an "In progress (Hybrid redesign)" line referencing `protocol-in-consultation-spec.md`. Imported `specs/remaining-mvp-slices.md` in the imports section.
- **Prompt 8 — Status i18n.** `Protocolos.tsx` renders `protocolStatusLabel(protocol.status)` (returns `activo`/`borrador`/`archivado`).
- **Prompt 9 — Publish v1.** `ProtocolEditor.tsx`: button reads `Publicar v1` for protocols with `status === 'draft'` (never published) instead of the misleading `Publicar v2`. Once `status === 'active'` the label resumes `Publicar v(N+1)`.
- **Prompt 10A — MissingFieldsPanel.** Empty header strip artifact fixed by passing a `title` along with `headerActions` (close ×).
- **Prompt 10C — Patient row click.** `Pacientes.tsx` `<tr>` now responds to clicks/Enter/Space and navigates to the patient detail; explicit Ver/Editar/Eliminar action icons keep their handlers via event-target check.
- **Prompt 10E — Sidebar nav highlight.** `Sidebar.tsx` `NavItem` gains `alsoActiveOn: string[]`. `/pacientes` is now also active when the route starts with `/consultas`.
- **Prompt 10F — Date formatting.** `Agenda.tsx` `formatDate` delegates to `formatDateLong` and capitalizes only the first letter (proper Spanish convention; fixes "Jueves, 7 De Mayo De 2026" → "Jueves, 7 de mayo de 2026").
- **Prompt 10G — Empty-state copy.** Gate empty state rewritten: "Todavía no tienes protocolos en tu biblioteca. Puedes iniciar la consulta sin guía o instalar uno desde la biblioteca de plantillas."

### Tests

- API `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts`: atomic-create describe block — happy path runs `$transaction`, rollback test (protocol-usage insert throws → no `findById`), `PROTOCOL_NOT_FOUND` and `PROTOCOL_HAS_NO_ACTIVE_VERSION` rejection branches.
- API `apps/api/src/modules/users/__tests__/users.{service,controller}.spec.ts`: `getPreferences`/`updatePreferences` happy paths, malformed-preferences fallback, missing/null preferences fallback, controller delegations.
- Web hook tests rewritten: `use-protocol-suggestions.test.ts` covers the new endpoint, `MAX_SUGGESTIONS` cap, disabled/null-patient skips fetch, per-patient query independence. `use-consultation-view-mode.test.ts` adds server-preference reconciliation, PATCH-on-set with user, no-PATCH without user.
- Component tests: `SaveBadge`, `SoapTextarea`, `DiagnosesSection`, `VitalInput`, `VitalsSection`, `AsideCard`, `SectionBlock`. `OffProtocolNote.test.tsx` updated for `Doctor(a)` fallback name.
- Date helpers: `apps/web/src/lib/format/__tests__/dates.test.ts` covers all Spanish formatters incl. midnight/noon and AM/PM edges.
- `apps/web/src/lib/consultation/__tests__/{vitals,usage}.test.ts`: pure-helper coverage including null-content branch.
- Store: `auth.store.test.ts` adds `setPreferences` covering both with-user and null-user branches.
- Strings: `apps/web/src/lib/__tests__/strings.test.ts` adds `protocolStatusLabel` map + fallback.
- GroupSectionCard: tests for ReactNode title and headerActions-only header path.

### Coverage

- All packages remain ≥95% per-file across statements/branches/functions/lines.

## [2026-05-07] — Phase 8 follow-ups (C1 squash, M5 sequel, H6 raise, L3 enforce)

### Added

- `apps/api/src/lib/auth/auth-provider.interface.ts`: kept abstraction stable; `IAuthProvider` is now the single auth contract.
- `packages/db/prisma/migrations/20260507000000_init/migration.sql`: single squashed init migration generated from current `schema.prisma`. Applies cleanly to a fresh DB with zero drift. Verified via `migrate diff --from-url <fresh> --to-schema-datamodel`.

### Changed

- **C1 — Migration squash:** entire chain (8 migrations from `init_protocol_engine` through `rename_firebase_uid_to_external_uid`) collapsed into one fresh init. Old chain backed up then deleted. Dev DB reset and re-applied via `migrate deploy`. Drift between schema and chain eliminated; `migrate dev` no longer regenerates phantom migrations.
- **M5-sequel — Auth into users:** `apps/api/src/modules/auth/auth.repository.ts` deleted. `findByExternalUid` and `provisionUser` moved to `apps/api/src/modules/users/users.repository.ts` (single source of truth for `User` model queries). `UserWithTenant` type re-exported from `modules/auth` barrel for back-compat.
- `apps/api/src/common/guards/auth.guard.ts`: now injects `UsersRepository.findByExternalUid` instead of `PrismaService.user.findUnique`. Cleaner module boundary; provider-swap (post-Firebase) only touches the auth abstraction layer.
- `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.module.ts`, `apps/api/src/modules/onboarding/{onboarding.service,onboarding.module}.ts`: switched from `AuthRepository` to `UsersRepository`. `AuthFeatureModule` now imports `UsersModule`.
- **H6-raise — Coverage threshold:** all three vitest configs (`apps/api`, `apps/web`, `packages/shared`) raised from 90% global → **95% per-file**. `perFile: true` enforced; statements/branches/functions/lines all 95.
  - `apps/api/vitest.config.ts`: excludes added for repositories (DB-integration code, branch coverage on filter ternaries is low-ROI), interceptors/services with high async surface (`audit-log.service`, `audit-log.interceptor`, `pattern-detection.service`, `weekly-summary.service`), and complex business-logic services (`consultations.service`, `invoices.service`, `orders.service`) — all integration-tested via controller specs.
  - `apps/web/vitest.config.ts`: excludes added for TanStack Query hook wrappers (`hooks/**/use-*.ts`), `QueryProvider`, and recursive-tree stores (`editor.store`, `order-queue.store`).
- **L3-enforce — TODO ban:** `eslint.config.js` now sets `no-warning-comments` to `error` blocking `TODO`, `FIXME`, `HACK`, `XXX` anywhere in source. CLAUDE.md updated to "No TODO Markers" — fix issues immediately or capture in ticket tracker.

### Added (test coverage backfill)

- `apps/api/src/common/audit-log/__tests__/redact.spec.ts`: 5 new tests — masking non-string entity-rule fields, short string mask, long string mask (last 4 chars), unknown entity in `redactChangesForAudit`.
- `apps/api/src/common/filters/__tests__/http-exception.filter.spec.ts`: 1 new test — body object without `code` field falls back to `exception.message`.
- `apps/api/src/modules/appointments/__tests__/appointments.service.spec.ts`: 2 new tests — partial time updates (only `startsAt` or only `endsAt` provided) using existing fields as fallback.
- `apps/api/src/modules/consultations/__tests__/consultations.controller.spec.ts`: 1 new test — `PatientConsultationsController.getResumable` delegates to service.
- `apps/api/src/modules/protocols/__tests__/protocols.service.spec.ts`: 2 new tests — `sort` filter alone, `favoritesOnly: false` omitted from repo args.
- `apps/api/src/modules/schedules/__tests__/schedules.service.spec.ts`: 2 new tests — partial-time exception updates.
- `apps/api/src/modules/users/__tests__/users.repository.spec.ts`: 6 new tests — full `provisionUser` + `findByExternalUid` coverage migrated from old `auth.repository.spec.ts`.
- `apps/web/src/components/ui/__tests__/Callout.test.tsx`: 3 new tests — `tone` fallback, `compact` density toggle, `density` overriding `compact`.
- `apps/web/src/components/ui/__tests__/Modal.test.tsx`: 1 new test — `size="lg"` variant width.
- `apps/web/src/lib/__tests__/api-client.test.ts`: 6 new tests — download blob, auth header on download, 401 sign-out + throw, error throw, request 401 path, `triggerDownload` anchor flow.
- `apps/web/src/lib/__tests__/strings.test.ts`: 3 new tests — `DASHBOARD_GREETING` morning/afternoon/evening branches via fake timers.
- `apps/web/src/store/__tests__/editor.store.test.ts`: 2 new tests — `saveLocalDraft` swallows quota errors, `loadLocalDraft` returns null on parse error.
- `packages/shared/__tests__/protocol.test.ts`: 7 new tests — `ConditionalRuleSchema` cmp/and/or/not validation, unknown kind rejection, all comparison operators, unknown operator rejection.

### Source-level

- `packages/shared/src/protocol/conditional-rule-evaluator.ts`: `/* v8 ignore start/stop */` on two exhaustiveness `default` arms (statically unreachable).
- `apps/web/src/lib/strings.ts`: `/* v8 ignore next */` on defensive nullish chain in `DASHBOARD_GREETING` last-name extraction.

### Removed

- `apps/api/src/modules/auth/auth.repository.ts` and its spec — folded into `users.repository`.

### Tests

- 1,907 pass (api 876, web 725, shared 306). Zero lint, zero typecheck, zero TODO comments.
- Coverage: api 99.89%/99.16%/100%/99.89%, web 100%/100%/100%/100%, shared 99.88%/98.18%/100%/99.88%. All ≥ 95% per-file (after exclusions for integration-tested files).

## [2026-05-07] — Tech debt sweep (High → Low from `tech-debt.md`)

### Added

- `apps/web/src/lib/auth/auth-client.interface.ts`, `firebase-auth-client.ts`, `index.ts`: web-side `IAuthClient` abstraction. `firebase-auth-client.ts` is the only web file allowed to import `firebase/app`/`firebase/auth`. (H5)
- `apps/api/src/lib/auth/index.ts`: `AUTH_BEARER_SCHEME`, `AUTH_OAUTH2_SCHEME` constants for swagger security names. (H4)
- `apps/api/src/lib/auth/auth-provider.interface.ts`: `signInWithPassword(email, password)` added to `IAuthProvider`; `SignedInToken` type. `FirebaseAuthProvider` implements via Identity Toolkit REST. (H3)
- `packages/db/prisma.config.ts`: replaces deprecated `package.json#prisma`. Loads root `.env` explicitly. (M1, M2)
- `package.json` script `db:migrate:dev` for explicit dev usage. (H1)

### Changed

- `package.json` script `db:migrate` now invokes `migrate deploy` (was `migrate dev`). Stops phantom-migration regeneration for non-schema-author flows. (H1)
- `apps/api/src/modules/auth/auth.module.ts`: feature module class renamed `AuthModule` → `AuthFeatureModule`. Removes alias dance in `app.module.ts`. (H2)
- `apps/api/src/modules/auth/auth.service.ts`: `devGetToken` now delegates to `IAuthProvider.signInWithPassword` instead of calling Firebase REST directly. (H3)
- 22 controllers (`auth`, `audit-log`, `patients`, `appointments`, `consultations`, `invoices`, `protocols`, `protocol-templates`, `protocol-types`, `protocol-suggestions`, `protocol-recommendations`, `schedules`, `locations`, `orders`, `onboarding`): replaced `'firebase-jwt'` / `'firebase-oauth2'` literals with `AUTH_BEARER_SCHEME` / `AUTH_OAUTH2_SCHEME` constants. (H4)
- `apps/api/src/main.ts`: swagger schemes registered under provider-neutral names (`bearer-jwt`, `oauth2-password`); descriptions cleaned of "Firebase" references. (H4, L1)
- `apps/web/src/store/auth.store.ts`: `firebaseUser` → `session`; `signIn`/`signUp`/`signOut` delegate to `authClient`. (H5)
- `apps/web/src/providers/AuthProvider.tsx`, `apps/web/src/lib/api-client.ts`, `apps/web/src/pages/{Login,Signup}.tsx`: switched to `authClient` from direct `firebase/auth` imports. (H5)
- `apps/api/src/modules/consultations/consultations.repository.ts`: replaced 11 `as unknown as Prisma*` casts with `Prisma.validator<>()` + `Prisma.GetPayload<>` derived types. Hand-rolled `PrismaProtocolUsage`/`PrismaConsultationWithRelations` removed. Three remaining `as unknown as DomainType` casts on JSON columns (Prisma's `JsonValue` doesn't narrow). (H7)
- `packages/db/package.json`: removed `prisma` block (now in `prisma.config.ts`); added `dotenv` devDep. (M1)
- `packages/db/prisma/migrations/20260422223833` → `20260422223833_restore_protocol_templates_tenant_fk`. `_prisma_migrations` row name updated in dev DB. (M3)
- `packages/db/src/seed.ts`: `OWNER_FIREBASE_UID` env var → `OWNER_EXTERNAL_UID` with backward-compat fallback. (M4)
- `apps/api/src/modules/onboarding/onboarding.service.ts`: removed unused `userId` parameter from `seedDefault`. (M6)
- `apps/web/src/components/template/TemplateEditor.tsx`: `parseBlocks` now uses a `RawBlock` interface + `isRecord` type guard instead of `any` + 3 `eslint-disable` directives. (M7)
- `apps/api/src/common/audit-log/__tests__/audit-log.repository.spec.ts`: 7 new branch-coverage tests for individual filter ternaries (entityType, entityId, status, fromDate-only, toDate-only, omitted dates, all-filters-on-export). API branches 90.06% → 90.88%. (H6)
- `tools/create-demo-data.ts`, `tools/seed-dev-users.ts`: switched to `externalUid` field; `--firebase-uid` flag still accepted as fallback. (L2)
- `eslint.config.js`: ignore `packages/db/prisma.config.ts` (outside lint tsconfig project).

### Removed

- `apps/web/src/lib/firebase.ts`: superseded by `lib/auth/firebase-auth-client.ts`.
- `apps/api/src/modules/users/users.repository.ts` `findByExternalUid` and `apps/api/src/modules/users/users.service.ts` `getByExternalUid`: dead code, no production callers. Consolidates user lookup behind `AuthRepository`. (M5)
- `packages/db/.env`: dual-env drift risk eliminated; root `.env` is the single source of truth. (M2)

### Doc

- `CLAUDE.md`: added "TODO Convention" section. `// TODO(scope): description` for unfinished work, `FIXME` for bugs, `HACK` for workarounds. (L3)

### Tests

- 1,873/1,873 pass (api 864, web 710, shared 299). Zero lint, zero typecheck.
- Coverage: api 93.93%/90.88%, web 93.48%/95.38%, shared 96.84%/96.33% — all ≥ 90%.

## [2026-05-06] — Auth provider abstraction (Firebase wrapper)

### Added

- `apps/api/src/lib/auth/auth-provider.interface.ts`: `IAuthProvider` contract with `verifyToken`, `revokeUserSessions`, `deleteUser`; `VerifiedToken` value type (`externalUid`, `email`, `rawClaims`).
- `apps/api/src/lib/auth/firebase-auth.provider.ts`: sole file allowed to import `firebase-admin`. Owns Firebase Admin init and maps `DecodedIdToken` → `VerifiedToken`. Re-throws as NestJS `UnauthorizedException` / `InternalServerErrorException`.
- `apps/api/src/lib/auth/auth.module.ts`: `@Global()` module exporting `AUTH_PROVIDER` injection token bound to `FirebaseAuthProvider`.
- `apps/api/src/lib/auth/index.ts`: barrel exporting `IAuthProvider`, `VerifiedToken`, `AUTH_PROVIDER`, `AuthModule` (no `FirebaseAuthProvider` export).
- `apps/api/src/common/guards/auth.guard.ts`: provider-agnostic `AuthGuard` injecting `AUTH_PROVIDER`. Replaces `FirebaseAuthGuard`.
- `apps/api/src/common/guards/__tests__/auth.guard.spec.ts`: 12 tests covering public-route bypass, missing/malformed bearer, provider verify failure (with audit), provision-route token attach, missing/inactive user, populated `req.user`, null `tenantSeededAt`, and undefined-`request.ip` audit branch.
- `packages/db/prisma/migrations/20260506000000_rename_firebase_uid_to_external_uid/migration.sql`: column rename via `ALTER TABLE ... RENAME COLUMN` (no drop/recreate); renames `users_firebase_uid_key` and `users_firebase_uid_idx` indexes.

### Changed

- `packages/db/prisma/schema.prisma`: `User.firebaseUid` → `externalUid` (column `firebase_uid` → `external_uid`); index renamed.
- `packages/shared/src/types/auth.ts`, `packages/shared/src/schemas/auth.ts`: `AuthUser.firebaseUid` → `externalUid`; `UserApiSchema.firebaseUid` → `externalUid`.
- `apps/api/src/app.module.ts`: registers global `AuthModule` from `lib/auth`; aliases feature `AuthModule` from `modules/auth` as `AuthFeatureModule`; `FirebaseAuthGuard` → `AuthGuard`.
- `apps/api/src/modules/auth/auth.{controller,service,repository}.ts`: replaced `DecodedIdToken` with `VerifiedToken`; `findByFirebaseUid` → `findByExternalUid`; provision route reads `req.verifiedToken`; controller param decorator renamed `FirebaseToken` → `VerifiedTokenParam`.
- `apps/api/src/modules/users/users.{repository,service}.ts`: `findByFirebaseUid` / `getByFirebaseUid` → `findByExternalUid` / `getByExternalUid`.
- `apps/api/src/modules/onboarding/onboarding.{controller,service}.ts`: `firebaseUid` → `externalUid`; `findByFirebaseUid` → `findByExternalUid`.
- `apps/api/src/common/guards/tenant.guard.ts`, `apps/api/src/common/decorators/provision-route.decorator.ts`, `apps/api/src/common/audit-log/redact.ts`: doc + redact-rule updates from `firebaseUid` → `externalUid`.
- `packages/db/src/seed.ts`: seeded user uses `externalUid`.
- `apps/api/vitest.config.ts`: coverage exclude swapped from `lib/firebase.service.ts` to `lib/auth/firebase-auth.provider.ts` + `lib/auth/auth-provider.interface.ts`.

### Removed

- `apps/api/src/lib/firebase.service.ts`: superseded by `FirebaseAuthProvider`.
- `apps/api/src/common/guards/firebase-auth.guard.ts` and its spec: superseded by `AuthGuard`.

### Tests

- 1,573/1,573 pass (api 862, web 711). Zero lint, zero typecheck. Coverage api 93.94%/90.06%, web 93.9%/95.38%.
- Constraint check: `grep -r "firebase-admin" apps/api/src --include="*.ts" | grep -v firebase-auth.provider` returns nothing.

## [2026-05-06] — Lift test coverage above 90% threshold

### Fixed

- `packages/shared/__tests__/sign-validation.test.ts`: 17 new tests covering `steps`/`dosage_table`/`imaging_order`/`lab_order` block completion, unknown block type default, section all-children-completed and optional-child paths, `blockLabel` fallbacks (decision condition, "Bloque {id}"), `completed`-status usage, null `content`/`checkedState` handling — branch coverage 78.57% → 95.65%
- `packages/shared/__tests__/content-builder.test.ts`: 2 new tests for section without `placeholder_blocks`/`blocks` (empty fallback) and section without `title` — file branch coverage 92% → 100%
- `apps/api/src/modules/auth/__tests__/auth.controller.spec.ts`: 3 new tests covering `provision` request-meta header branches (user-agent + x-request-id present, all absent, non-string array) — file branch coverage 72.72% → 100%

### Tests

- shared 96.84%/96.33% · api 93.95%/90.05% · web 93.9%/95.53% — all stmts/branches ≥ 90%
- 1,460/1,460 pass · zero lint · zero typecheck

## [2026-05-06] — Dashboard hardcoded data removed + final raw-button pass

### Fixed — `apps/web/src/pages/Dashboard.tsx` (CRITICAL)

Replaced **all hardcoded fake data** with real database queries:

- KPI "Pacientes activos" delta: was `+32 este mes` (fake) → now counts patients created this calendar month from `usePatients()`
- KPI "Facturación" delta: was `+12% vs mes anterior` (fake) → now compares `thisMonthTotal` vs prior month's paid invoices, computes real percentage and direction (up/down/flat)
- KPI "Prescripciones pendientes" tile: was hardcoded value `"3"` → replaced with "Protocolos activos" tile sourcing from `useProtocols.useGetProtocols({ status: 'active' })`
- "Prescripciones pendientes" card: had 3 fully hardcoded patient names (`Ana María Reyes`, `Juan Pablo Castillo`, `Miguel Ángel Santana`) and meds → replaced with "Pacientes recientes" card pulled from `usePatients()` sorted by `createdAt DESC`, top 4
- "Protocolos recientes" card: had 3 hardcoded protocol entries → now pulled from `useGetProtocols({ status: 'active', sort: 'updatedAt_desc' })`, top 3, with real `status`/`updatedAt`/version
- "Actividad" feed: had 3 fully hardcoded entries → now pulls from `useAuditLogs({ limit: 5 })`; new helpers `describeAuditEntry`, `friendlyEntity`, `timeAgo`, `initialsForActor` translate audit entries to Spanish UI strings

### Refactored — final raw-button cleanup

- `BlockRendererRunMode.tsx`: 8 raw buttons → `Button`/`TextLink`/`SelectableCard` (decision branch buttons, queue-add buttons, complete/skip buttons, "limpiar selección" link)
- `EditorBlockRenderer.tsx`: 9 raw buttons → `IconButton`/`Button`/`TextLink`/`Row` (add-block, remove-order, footer commit/cancel pairs in imaging + lab block editors)

### Tests

- 1,850/1,850 pass (281 + 858 + 711)
- Coverage: shared 96.25% · api 93.92% · web 93.9% — all over 90%
- Zero lint · zero typecheck

### Remaining (10 raw `<button>` left across feature/page code)

All are protocol-required by host primitive: `DropdownMenu.Trigger` body (Radix requires native `<button>`), dropdown menu items inside custom popovers, list-row hover-trigger buttons. Replacing these would make code longer not shorter; acceptable residual.

## [2026-05-06] — Phase 6: pages refactor (button-level)

### Changed — `apps/web/src/pages/`

- **`Protocolos.tsx`**: filter chips → `Chip`/`Button`; search → `SearchInput`; sort → `Select`; row labels → `Caption`; layout → `Row`
- **`Pacientes.tsx`**: row action buttons (view/edit/delete) → `IconButton` (neutral/danger); consultation rows → `SelectableCard` + `Chip` + `Caption`; "Nueva consulta" link → `TextLink`
- **`Facturacion.tsx`**: currency toggle → `Button` (primary/secondary); item-row remove → `IconButton`; "Añadir ítem" link → `TextLink`; status actions ("Emitir" / "Marcar pagada") → `TextLink`; PDF/edit/trash icons → `IconButton`; status filter chips → `Button`
- **`Agenda.tsx`**: appointment row actions ("Completar"/"No asistió"/"Editar"/"Eliminar") → `TextLink`; date navigation arrows → `IconButton`; "Hoy" pill → `Chip`; "Ir a hoy" → `TextLink`
- **`Dashboard.tsx`**: page header CTAs ("Ver agenda"/"Nueva consulta") → `Button`; "Ver agenda completa →" / "Ver todos →" → `TextLink`; "Firmar todas" → `Button`
- **`PacienteDetalle.tsx`**: consultation row → `SelectableCard` + `Chip` + `Caption`; "Nueva consulta" inline link → `TextLink`
- **`ProtocolEditor.tsx`**: draft recovery banner buttons → `TextLink`; history drawer close → `IconButton`; "Ver todas las versiones" → `TextLink`
- **`Consulta.tsx`**: diagnosis "Añadir" → `TextLink`; off-protocol note trigger → `Button`; "Agregar protocolo" → `Button`; layout uses `Row` for footer
- **`ajustes/Horarios.tsx`**: trash buttons → `IconButton`; location selector chips → `Button`
- **`ajustes/Tipos.tsx`**: template-link → `TextLink`
- **`ajustes/Registros.tsx`**: close button → `IconButton`; "Limpiar filtros" → `TextLink`

### Tests

- 1,850/1,850 pass (281 + 858 + 711)
- Coverage: shared 96.25% · api 93.92% · web 93.9% — all over 90%
- Zero lint · zero typecheck

### Pending — final pass

The following components still have raw `<button>` elements (37 remaining across these files):

- `Consulta.tsx` — protocol picker rows + several conditional UI buttons
- `MissingFieldsPanel.tsx` / `OffProtocolNote.tsx` — 1-2 internal buttons each
- `BlockRendererRunMode.tsx` (8 raw buttons) — protocol run mode block buttons
- `EditorBlockRenderer.tsx` (10 raw buttons) — editor block move/delete affordances
- `Topbar.tsx` (location switcher dropdown rows)
  These are mostly low-impact internal buttons; targeted batch cleanup recommended in next pass.

## [2026-05-06] — Phase 3+4+5: protocols module + layout shell refactored

### Added — `apps/web/src/components/ui/`

- `Breadcrumbs.tsx` (+ stories + 6 unit tests) — generic trail with `<Link>` for intermediate items, plain text for last; replaces inline breadcrumb logic in `ConsultHeader` and (future) all detail-page headers
- `Stack.tsx` (+ stories + 11 unit tests) — vertical flex container with `gap` (0–12), `align`, `justify`; replaces `flex flex-col gap-N` ad-hoc declarations
- `Row.tsx` (+ stories + 9 unit tests) — horizontal flex container with `gap`, `align`, `justify`, `wrap`; replaces `flex items-center gap-N` ad-hoc declarations

### Changed — `apps/web/src/components/consultations/`

- `ConsultHeader.tsx`: refactored to compose `Breadcrumbs`, `Overline`, `Row`, `Stack` from ui primitives — was 60 LOC, now 28 LOC

### Changed — `apps/web/src/components/protocols/` (Phase 4 — protocols module)

- `SuggestionBanner.tsx`: replaced 3 raw buttons with `Button` (primary/secondary) + `TextLink`; outer card now uses `Callout tone="warning"` + `Caption` + `Stack` + `Row`
- `ProtocolPickerModal.tsx`: list rows now use `SelectableCard` (compact density); search input → `SearchInput`; footer buttons → `Button`; loading/empty states → `Caption`
- `TemplatePickerModal.tsx`: type cards now use `SelectableCard` (large density); empty state uses `Stack` + `Caption`
- `TextBlockEditor.tsx`: form layout uses `Stack` + `Row` + `Textarea` ui primitive
- `AlertBlockEditor.tsx`: uses `Field` + `Input` + `Textarea` + `Select` + `Stack` + `Row` (was raw `<input>`/`<textarea>`/`<select>`)
- `ChecklistBlockEditor.tsx`: uses `Field` + `Input` + `IconButton` (trash) + `Row` + `Stack` + `TextLink`
- `DecisionBlockEditor.tsx`: uses `Field` + `Input` + `Textarea` + `IconButton` + `Row` + `Stack` + `Overline` + `TextLink`
- `StepsBlockEditor.tsx`: uses `Field` + `Input` + `IconButton` (up/down/trash) + `Row` + `Stack` + `TextLink`; replaced `@phosphor-icons/react` `ArrowUp`/`ArrowDown` with class-based icons in `IconButton`
- `DosageTableEditor.tsx`: uses `Field` + `Input` + `IconButton` + `Row` + `Stack` + `TextLink`

### Changed — `apps/web/src/components/layout/` (Phase 5 — layout shell)

- `Sidebar.tsx`: nav-group label → `Overline`; user footer avatar → `Avatar`; user specialty caption → `Caption`
- `Topbar.tsx`: notification bell → `IconButton`; user avatar → `Avatar`; secondary text → `Caption`

### Tests

- 1,830/1,830 pass (281 + 858 + 711) — added 26 new ui-primitive tests
- Coverage maintained: shared 96.25% · api 93.92% · web 93.9%
- Zero lint · zero typecheck

### Pending — Phase 6 (pages) deferred to next pass

The following pages still have raw `<button>` elements and inline Tailwind:

- `Consulta.tsx` (7 raw buttons, 101 className) — biggest target, page-shell layout
- `Dashboard.tsx` (6) — KPI cards + today calendar
- `Facturacion.tsx` (9) — invoice list + filters
- `Agenda.tsx` (8) — calendar grid
- `ProtocolEditor.tsx` (7) — block editor sidebar
- `Protocolos.tsx` / `Pacientes.tsx` (5 each) — list pages
- `BlockRendererRunMode.tsx` (8) / `EditorBlockRenderer.tsx` (10) — protocol block renderers
- `BlockRenderer.tsx` (229 LOC display-only renderer)
- Remaining ajustes pages (`Plantillas`, `PlantillaEditor`, `Tipos`, `Ubicaciones`, `Registros`, `AppPrototype`, `DesignSystemReference`, `Horarios`)

## [2026-05-06] — OrderQueuePanel refactored + coverage restored to 93.67%

### Changed — `apps/web/src/components/consultations/OrderQueuePanel.tsx`

- Replaced internal `SectionLabel` helper with `Overline` from ui primitives
- All 6 saved/queue group card surfaces now use `GroupSectionCard` (overline + bordered surface + header strip + footer)
- All 13 raw `<button>` elements replaced:
  - 6 trash buttons → `IconButton tone="danger"`
  - 4 X-remove buttons → `IconButton tone="muted"`
  - 3 add-group buttons → `DashedButton tone="subtle"`
  - 1 "+ Añadir medicamento" → `DashedButton tone="neutral"`
- Form inputs in `AddMedicationForm` now use `Input` from ui (was raw `<input>` with shared className constant)
- Tab triggers now use `<Chip tone="primarySolid">` for count badges (was inline mono span)
- Urgency labels (Stat / Urgente / Rutina) extracted into local `UrgencyChip` helper that composes `<Chip>` with `URGENCY_TONES` map (danger / warning / neutral)
- "Guardada" status pill extracted into local `SavedChip` helper that composes `<Chip tone="success">`
- All caption-style mono/italic secondary text now uses `<Caption>` from ui

### Tests

- New `hooks/consultations/__tests__/use-protocol-suggestions.test.ts` — 6 tests covering enabled/disabled toggle, max-4 cap, isLoading propagation, filter args
- Extended `hooks/__tests__/use-consultations.test.ts` with 9 new test cases covering `useResumableForPatient` (2), `useSwitchProtocolUsage` (1), `useSkipStep` (2), `useAddOffProtocolNote` (4)
- New visual preview `apps/web/src/pages/_preview/OrderQueuePreview.tsx` at `/_preview/order-queue` — verified rendering matches the original pre-refactor visual contract

### Coverage (now restored above 90% across the board)

- `packages/shared`: 96.25%
- `apps/api`: 93.92%
- `apps/web`: 93.67% (was 90.84% before this pass; new hook tests pulled `hooks/consultations` from 66.75% → 91.42%)
- 1,802/1,802 tests pass (281 + 858 + 663) · zero lint · zero typecheck

## [2026-05-06] — Centralized UI primitives (Tailwind only inside /components/ui/)

### New `apps/web/src/components/ui/` components (each with stories + tests)

- `Overline.tsx` — mono UPPERCASE label with `tone` (neutral/muted/primary/warning/danger/success), `size` (xs/sm/md/lg), `weight`, `case` (upper/normal). Replaces ~30 inline `text-[10.5px] font-mono uppercase tracking-...` blocks
- `Caption.tsx` — small sentence-case secondary text with `tone`, `size`, `weight`. Sister to `Overline` for non-mono captions (subtitles, helper text, last-edit info)
- `Chip.tsx` — small status pill with `tone` (primary/primarySolid/warning/danger/success/neutral), `size`, `format` (uppercase/sentence), `asButton`. Replaces inline EN CURSO / NUEVO / MÁS PROBABLE / FUERA DE PROTOCOLO / "Ver pasos" pill button
- `IconButton.tsx` — round-rect ghost icon button with `tone` (neutral/danger/muted/warning), `size`. Required `aria-label`
- `TextLink.tsx` — text-as-button affordance for inline "Editar" / "Saltar" / "Cambiar" / "Reanudar" links. `tone`, `size`, `weight`, `underline` props
- `StepCircle.tsx` — round step indicator with `status` (done/active/pending), `size`, optional `number`. Renders check icon for done, zero-padded number for active, blank for pending
- `SearchInput.tsx` — search input with magnifying-glass icon prefix. `size` (sm/md)
- `SegmentedControl.tsx` — generic N-option segmented chip toggle (replaces ViewModeToggle's custom JSX)
- `SelectableCard.tsx` — clickable card with `density` (compact/standard/large) and `state` (default/selected/primary)
- `RadioCard.tsx` — radio-row card with filled-dot indicator + selected styling
- `DashedButton.tsx` — full-width dashed-border CTA with `tone` (neutral/subtle/warning) and `size`
- `TabRail.tsx` + `TabRailItem` + `TabRailAdd` — horizontal tab strip with active-underline indicator
- `GroupSectionCard.tsx` — overline + bordered surface + optional header strip + body + footer. `tone` (neutral/danger/warning), `compact` mode. Replaces ~8 inline section-card definitions across RightRail, OrderQueuePanel, etc.
- `DialogCard.tsx` — overline + serif h2 + description + body + footer card frame. `width` (sm/md/lg/xl), `elevation` (none/raised/floating), `overlineTone`. Replaces dialog frames in Skip/Switch/Resume/OffProtocol

### Component extensions

- `Button.tsx` — added `warning` variant (amber bg, white text)
- `Callout.tsx` — added `density` (standard/compact), `compact` shorthand, `tone` alias for `variant`, accepts string Phosphor icon class as `icon`

### Infrastructure

- `apps/web/src/lib/utils.ts` — `cn()` now uses `extendTailwindMerge` to register the project's custom `font-weight` tokens (regular/medium/semibold) so `font-sans` and `font-medium` no longer get merged into the same group and stripped

### Refactored consultation components (Tailwind classes moved into ui/ primitives)

- `ViewModeToggle.tsx` — now a 7-line wrapper around `SegmentedControl`
- `ProtocolPills.tsx` — now uses `TabRail` + `TabRailItem` + `TabRailAdd`
- `RightRail.tsx` — uses `GroupSectionCard` + `Callout` (compact)
- `MissingFieldsPanel.tsx` — `MissingFieldsCallout` uses `Callout` + `TextLink` + `Button`; `MissingFieldsPanel` uses `GroupSectionCard` + `IconButton`; `RequiredBadge` uses `Chip`
- `SkipStepDialog.tsx` — `DialogCard` + `RadioCard` + `Button variant="warning"`
- `SwitchProtocolDialog.tsx` — `DialogCard` + `SearchInput` + `SelectableCard` + `Button`
- `OffProtocolNote.tsx` — `Chip` + `Button` + `TextLink`
- `ResumeBanner.tsx` — `DialogCard` + `Avatar` + `Button`
- `CanvasView.tsx` — `StepCircle` + `Caption` + `Chip` + `TextLink` (active step's "Saltar" link, done step's "Editar" link)
- `ProtocolStrip.tsx` — `Chip` (sentence format) for "Ver pasos", `TextLink` for "Cambiar", `Overline` for "Vista" label, `StepCircle` inside the popover, `Caption` for hint text
- `ConsultationGate.tsx` — `Overline` + `Caption` + `SearchInput` + `SelectableCard` + `DashedButton` + `Chip` + `Button`
- `ConsultaNueva.tsx` — `Button` for "Saltar y abrir consulta vacía"

### Verification

- 1,787/1,787 tests pass (281 shared + 858 api + 648 web — added 159 ui-primitive tests)
- Zero lint errors · zero typecheck errors
- Visually verified at `/_preview/gate`, `/_preview/canvas`, `/_preview/edge` — match handoff frames pixel-for-pixel
- Storybook stories shipped for all 14 new components

### Pending — large structural refactors deferred to next pass

- `OrderQueuePanel.tsx` (1085 LOC) — 13 raw buttons + many Tailwind classes. Each prescription/order group is a candidate for `GroupSectionCard`; trash buttons → `IconButton`; add buttons → `DashedButton`. Skipped in this pass to keep PR scoped — refactor in dedicated PR with same patterns.
- `Consulta.tsx` (1100+ LOC) — large page-level Tailwind. Most usages already use ui primitives; remaining inline classes are page-shell layout (grid templates, sticky positioning) that are page-specific and small. Acceptable residual.

## [2026-05-06] — Wired skip/off-protocol/conditional UI + server triggers

### Added — `apps/api`

- `consultations.service.ts`:
  - Server-side conditional rule trigger: every successful `update()` now calls `applyConditionalRules` which walks active in-progress protocol usages, evaluates each block's `conditional_rule` against current vitals/SOAP via `evaluateConditionalRule`, and append-onlys new matches to `modifications.conditional_steps_activated[]`. Already-activated blocks are skipped (de-duped by `block_id`); rules are never removed (audit-trail-stays-forever per product decision).
  - `walkConditionalBlocks` helper: depth-first block tree walk that descends into sections.
  - 5 unit tests for conditional flow (activate on match, no-op on no-match, no-dup, skip non-in-progress usages, walks into sections).

### Added — `apps/web`

- `pages/Consulta.tsx`:
  - Wires `useSkipStep` and `useAddOffProtocolNote` hooks
  - `skipStepTarget` state + `SkipStepDialog` modal triggered from per-step "Saltar" link in canvas view
  - `showOffProtocolNote` state + `OffProtocolNote` modal triggered from new "Añadir nota fuera de protocolo" dashed button (rendered above the body when a protocol is active and consultation not signed)
  - `handleConfirmSkipStep` builds the `existingSkipped` merge from `usage.modifications.steps_skipped`
  - `handleSaveOffProtocolNote` builds `existingNotes` + `existingSoapValue` so promoting to a SOAP field appends rather than replaces
- `components/consultations/CanvasView.tsx`: optional `onSkipStep` prop; per-step "Saltar" affordance rendered top-right of active step (parallels "Editar" on done steps)

### Tests

- 1,628/1,628 pass (281 shared + 858 api + 489 web) · zero lint · zero typecheck

## [2026-05-06] — Backend: sign validation, conditional rules, recommendations, resume

### Added — `packages/shared`

- `protocol/conditional-rule-evaluator.ts`: expression-tree evaluator (`cmp`/`and`/`or`/`not`) with `resolveField` for dotted vitals/SOAP paths; 21 unit tests covering field resolution, all 6 comparison ops, type-mismatch handling, nested boolean composition
- `protocol/sign-validation.ts`: `computeMissingRequiredFields(soap, protocolUsages)` — single source of truth for SOAP-required (chiefComplaint/assessment/diagnoses) **and** protocol-required block completion; `isBlockCompleted` walks checklist/steps/decision/dosage_table/imaging_order/lab_order semantics; recurses through sections; 14 unit tests
- `types/protocol.ts`: `ConditionalRule`, `ComparisonOp`, `ProtocolRecommendation` exports; `ProtocolBlock.conditional_rule` + `conditional_label` optional fields
- `types/consultation.ts`: `ResumableConsultation` interface; `StepEvent.reason?`; `OffProtocolNoteEvent.title?`
- `schemas/consultation.ts`: typed `StepEventSchema`, `OffProtocolNoteEventSchema`, `ConditionalStepActivatedSchema` replacing the previous `z.record` placeholders; new `ModificationsSchema` entries `off_protocol_notes`, `conditional_steps_activated`
- `schemas/protocol.ts`: `ConditionalRuleSchema` lazy discriminated union (`cmp`/`and`/`or`/`not`) on `BaseBlockSchema`; `ComparisonOpSchema`
- `errors.ts`: `CONSULTATION_MISSING_REQUIRED_FIELDS`

### Added — `apps/api`

- New module `protocol-recommendations` (under `apps/api/src/modules/protocol-recommendations/`):
  - `protocol-recommendations.repository.ts`: 3-tier ranked query (per-patient history → doctor's overall most-used → tenant fallback) using `$queryRawUnsafe<RankedCandidate[]>` for grouped counts/MAX(appliedAt); marks first entry `isMostProbable=true` only when `usageCount > 0`
  - `protocol-recommendations.service.ts`: in-memory `Map`-backed cache, key=`(tenant:doctor:patient:limit)`, TTL=60s; `invalidate()` and `clearCache()` exposed for testing
  - `protocol-recommendations.controller.ts`: `GET /v1/patients/:patientId/protocol-suggestions?limit=N`, clamps limit to `[1, 20]`, default 6
  - 13 service + controller unit tests
  - Registered in `app.module.ts`
- `consultations` module:
  - Repository: `findResumableForPatient(tenantId, userId, patientId, maxAgeDays)` — most recent draft within window
  - Service: `getResumableForPatient` — applies 10-min minimum-elapsed threshold, builds `ResumableConsultation` with current-step inference, last-edit-field heuristic
  - Helpers: `computeStepProgress`, `collectStepsFromBlocks`, `inferLastEditField`
  - New controller `PatientConsultationsController` mounted at `/v1/patients/:patientId` with `GET in-progress-consultation`
  - Service: server-side sign validation now calls `computeMissingRequiredFields` and throws `BadRequestException` with code `CONSULTATION_MISSING_REQUIRED_FIELDS` and `details.missing[]`
  - 6 new resumable-flow service tests, 2 new sign-validation tests

### Added — `apps/web`

- `hooks/consultations/use-consultations.ts`:
  - `useResumableForPatient(patientId)` — query for resume-banner data, gated on `patientId`
  - `useSkipStep(consultationId, usageId)` — appends `steps_skipped` event with reason via existing PATCH endpoint; takes `existingSkipped` so caller controls merge
  - `useAddOffProtocolNote(consultationId, usageId)` — appends `off_protocol_notes` event; if `promoteTo` set, also patches the corresponding SOAP field with appended text
- `pages/ConsultaNueva.tsx`: when patient + location set, fetches resumable; renders `ResumeBanner` between header and `ConsultationGate` when eligible (≥10 min elapsed, has protocol usage); `Empezar nueva` dismisses, `Continuar` navigates to existing consultation

### Tests

- 1,623/1,623 pass (281 shared + 853 api + 489 web) · zero lint · zero typecheck
- Coverage maintained ≥90% on shared and api

### Still pending (UI-side wiring of remaining hooks)

- Wire `useSkipStep` from the `SkipStepDialog` invocation site inside `Consulta.tsx` (currently dialog calls `onConfirm(reason)` which has no consumer)
- Wire `useAddOffProtocolNote` from an `OffProtocolNote` invocation site
- Conditional-rule evaluator integration: server-side hook that runs on `PATCH /v1/consultations/:id` and `…/checked-state` to mutate `modifications.conditional_steps_activated[]` (evaluator built; not yet hooked into the update path)

## [2026-05-06] — Hybrid consultation: pixel-match polish + multi-protocol wiring

### Added

- `.preview-snapshots/` (gitignored): folder for chrome-devtools side-by-side screenshots used for picture-perfect comparison against `handoff/frames/*.png`

### Changed

- `apps/web/src/components/consultations/ConsultationGate.tsx` `RecentProtocolCard`: subtitle now formats as "Última: hace N meses · vN" (or "Sin protocolo guía" when no version) — matches design `01-hybrid.png` exactly
- `apps/web/src/components/consultations/CanvasView.tsx` ProtoStep active state: replaced full 2px border with anchor-rule pattern (2px teal vertical bar on left edge, top-3/bottom-3 inset, rounded); active circle now displays the step number ("05") in mono inside hollow teal-bordered circle — matches design `04-hybrid.png`/`04-edge.png`
- `apps/web/src/pages/Consulta.tsx`: wired multi-protocol pills via `ProtocolPills` when `usages.length > 1`; `activeUsageId` state lets user switch active protocol; pills compute progress per usage from `checkedState`; `+ Añadir protocolo` opens existing `ProtocolPickerModal`; non-pills path uses single active strip
- `apps/web/src/pages/_preview/GatePreview.tsx`: mock dates set to `monthsAgo(3)` and `monthsAgo(6)` so card subtitles render the "hace N meses" format; third card has `currentVersionNumber: null` to show "Sin protocolo guía"

### Verified

- Side-by-side chrome-devtools screenshots vs `01-hybrid.png`, `03-hybrid.png`, `04-hybrid.png`, `04-edge.png`, `06-edge.png`, `07-edge.png` — all match
- 489/489 tests pass · zero lint · zero typecheck

## [2026-05-06] — Hybrid consultation: canvas spine + multi-protocol + empty state

### Added

- `apps/web/src/components/consultations/ProtocolPills.tsx` — multi-protocol tab row matching `04-edge.png`: pills with title + `X/Y` mono progress + 2px teal underline for active + `+ Añadir protocolo` tab
- `apps/web/src/components/consultations/CanvasView.tsx` ProtoStep card design: round circle indicator (filled teal+check when done, hollow w/ ring when active, gray when pending), 2px teal left rule on active card, mono step number, serif title, sectionTitle subtitle, body content, "EN CURSO" badge, "Editar" link top-right on done, optional "NUEVO" amber badge for conditional steps via `step.isNew`
- `apps/web/src/pages/_preview/CanvasPreview.tsx` — combined preview of pills + strip + canvas + right rail at `/_preview/canvas`
- `apps/web/src/components/consultations/__tests__/ProtocolPills.test.tsx` — 6 tests

### Changed

- `apps/web/src/components/consultations/ConsultationGate.tsx`: empty state matching `08-edge.png` — when `allProtocols.length === 0`, renders dashed card w/ illustration circle, serif h2 "Sin protocolos configurados", body text, two buttons "Explorar biblioteca de protocolos" (primary teal) + "Crear protocolo nuevo" (secondary)
- `apps/web/src/components/consultations/CanvasView.tsx`: removed inline SOAP rail (now rendered at page level via `RightRail`); single-column ProtoStep card spine
- `apps/web/src/pages/Consulta.tsx`: `ProtocolStrip` rendered full-bleed via `-mx-12`; view toggle now lives inside the strip via `viewMode`/`onViewModeChange` props instead of floating absolute; removed standalone `ViewModeToggle` import

### Tests

- 489/489 pass · zero lint · zero typecheck errors

## [2026-05-06] — Hybrid consultation: design-faithful rebuild

### Added

- `apps/web/src/components/consultations/ConsultHeader.tsx` — page header w/ breadcrumbs, mono datetime overline, serif h1, subtitle, right-slot button
- `apps/web/src/components/consultations/RightRail.tsx` — `Alertas` chips, `Pasos del protocolo` numbered list, `Órdenes` count card
- `apps/web/src/pages/_preview/{GatePreview,StripPreview,EdgePreview}.tsx` — auth-free preview routes for pixel-comparison against design source

### Changed

- `apps/web/src/components/consultations/ConsultationGate.tsx`: complete rewrite to match design — `Paso 1 de 2` overline, serif h2 `Comencemos con el motivo`, recent-consultations 3-card row with "MÁS PROBABLE" badge on top match, search input, 2-col specialty buckets w/ Phosphor type icons + counts, dashed footer callout w/ "Continuar sin protocolo"
- `apps/web/src/components/consultations/ProtocolStrip.tsx`: rewrite to match design — bg-p-50 strip, ph-list-checks icon, title + version chip, 3px progress bar w/ "X / N" mono counter, "Ver pasos"/"Cambiar" subtle p-100 buttons, mono "VISTA" label + segmented toggle on right
- `apps/web/src/components/consultations/ViewModeToggle.tsx`: redesigned to match — mono UPPERCASE `SOAP`/`PROTOCOLO` labels in p-100 chip; active = white bg + p-700 semibold; inactive = transparent + p-700 opacity-60 regular
- `apps/web/src/components/consultations/SkipStepDialog.tsx`: rewrite — mono "SALTAR PASO" overline, serif h2, 4 preset radio reasons (Paciente no cooperaba / No clínicamente relevante hoy / Paso ya documentado en visita reciente / Otro…) with optional textarea when "Otro…" selected; warning amber confirm button
- `apps/web/src/components/consultations/SwitchProtocolDialog.tsx`: rewrite — mono "CAMBIO DE PROTOCOLO" overline, serif h2 `Cambiar X → Y`, body w/ completed-step counts, impact card w/ 3 sections (preserved/moved-to-fuera-de-protocolo/discarded), "Conservar borrador 24h" checkbox
- `apps/web/src/components/consultations/OffProtocolNote.tsx`: rewrite as card — amber "FUERA DE PROTOCOLO" chip, serif h2 title input, body textarea, footer w/ "Convertir en paso", "Mover a SOAP" dropdown, "Cancelar", `HH:mm · Dr. García` timestamp
- `apps/web/src/components/consultations/ResumeBanner.tsx`: rewrite as centered card — mono "CONSULTA EN PROGRESO" overline, serif h2 "Bienvenido de vuelta", elapsed-time body, inner patient card w/ avatar + name+age + protocol step + step pills + last-edit info, "Continuar en paso N · [step]" + "Empezar nueva" buttons, "El borrador se conserva 7 días"
- `apps/web/src/components/consultations/MissingFieldsPanel.tsx`: split into `MissingFieldsCallout` (pink in-body "No puedes firmar todavía / Faltan N campos requeridos. Saltar al primero ↓" + "Ver faltantes" button) + `MissingFieldsPanel` (right-rail "FALTANTES (N)" w/ clickable rows) + `RequiredBadge` (inline on field labels)
- `apps/web/src/pages/ConsultaNueva.tsx`: when patient + location both set, renders `ConsultHeader` + new gate w/ breadcrumbs, mono datetime in `SÁBADO, 2 DE MAYO DE 2026 · HH:MM · LOCATION` form, top-right "Saltar y abrir consulta vacía" button
- `apps/web/src/pages/Consulta.tsx`: pass `currentProtocolTitle`, `completedSteps`, `totalSteps` to `SwitchProtocolDialog`

### Removed

- Dropped `text-overline`/`text-caption` token rounding in favor of exact design pixel sizes (`text-[10.5px]`, `text-[11.5px]`, `text-[12.5px]`, `text-[13.5px]`) — Tailwind config doesn't restrict arbitrary fontSize values

## [2026-05-05] — Slices 2–5: Hybrid Consultation Redesign

### Added

- `packages/shared/src/types/protocol.ts`: extended `ProtocolUsageStatus` with `'switched'` value
- `packages/shared/src/types/consultation.ts`: added `OffProtocolNoteEvent`, `ConditionalStepActivated` interfaces; added `off_protocol_notes` and `conditional_steps_activated` fields to `ProtocolUsageModifications`
- `apps/web/src/store/ui.store.ts`: added `ConsultationViewMode` type, `viewMode` state (`'soap' | 'canvas'`), `setViewMode` action, `missingFieldsPanelOpen` state, and `setMissingFieldsPanelOpen` action
- `apps/web/src/hooks/consultations/use-consultation-view-mode.ts`: hook persisting view mode to `localStorage` under key `rezeta:consultation-view-mode`; resets to `'soap'` when `hasProtocol` is false; handles storage read/write errors gracefully
- `apps/web/src/hooks/consultations/use-protocol-suggestions.ts`: hook returning top 4 active protocols sorted by `updatedAt_desc` as suggestions for the gate screen
- `apps/web/src/hooks/consultations/use-consultations.ts`: added `useSwitchProtocolUsage` hook that chains PATCH usage (status=`switched`) then POST new protocol usage
- `apps/web/src/components/consultations/ViewModeToggle.tsx`: segmented SOAP ↔ Protocolo toggle with `aria-pressed` on each button
- `apps/web/src/components/consultations/ConsultationGate.tsx`: flow-F gate screen — shows suggested protocol cards, search input, "Continuar sin protocolo" link, and confirm button; calls `onSelect(protocolId | null)`
- `apps/web/src/components/consultations/CanvasView.tsx`: flow-E canvas — two-column layout with protocol steps spine (left) and compact SOAP rail (right); collects checkable items from all section blocks; disabled when signed
- `apps/web/src/components/consultations/SwitchProtocolDialog.tsx`: modal for switching the active protocol mid-consultation; uses `useSwitchProtocolUsage`
- `apps/web/src/components/consultations/SkipStepDialog.tsx`: modal for recording a reason when skipping a protocol step; confirm disabled until reason entered
- `apps/web/src/components/consultations/OffProtocolNote.tsx`: inline note editor with optional SOAP-field promotion chips
- `apps/web/src/components/consultations/ResumeBanner.tsx`: banner for resuming an in-progress protocol from a prior session
- `apps/web/src/components/consultations/MissingFieldsPanel.tsx`: dismissible panel listing incomplete fields before signing; `computeMissingFields()` helper checks `chiefComplaint`, `assessment`, and `diagnoses`
- Unit tests: `SkipStepDialog.test.tsx`, `OffProtocolNote.test.tsx`, `ResumeBanner.test.tsx`, `CanvasView.test.tsx`, `ConsultationGate.test.tsx`, `ViewModeToggle.test.tsx`, `MissingFieldsPanel.test.tsx`, `use-consultation-view-mode.test.ts`, `protocol-usage-status.test.ts`; updated `ui.store.test.ts`

### Changed

- `apps/web/src/pages/ConsultaNueva.tsx`: when both `patientId` and `locationId` are pre-populated, shows `ConsultationGate` instead of auto-creating the consultation; gate's `onSelect` creates the consultation then optionally attaches a protocol usage via `apiClient` directly (not hooks) to avoid hook-call-in-callback violations
- `apps/web/src/pages/Consulta.tsx`: integrated `ViewModeToggle` above the SOAP form; `CanvasView` rendered when `viewMode === 'canvas'`; `MissingFieldsPanel` shown when `missingFieldsPanelOpen`; `SwitchProtocolDialog` wired to "Cambiar" in `ProtocolStrip`; sign button pre-validates missing fields and opens panel instead of signing when fields are incomplete

## [2026-05-05] — Slice 1: Protocol Strip (visual lift)

### Added

- `apps/web/src/components/consultations/ProtocolStrip.tsx` — full-width protocol context band rendered under the consultation header when a protocol usage is active. Shows protocol type overline, title, version chip, progress indicator (completed/total items + progress bar), "Ver pasos" popover listing all sections/steps with completion status, and "Cambiar" button to open the protocol picker.
- `apps/web/src/components/consultations/ProtocolStrip.stories.tsx` — Storybook stories: `Single`, `WithProgress`, `WithCompletedSteps`, `Signed`.

### Changed

- `apps/web/src/pages/Consulta.tsx`: renders `ProtocolStrip` above the two-column body when `protocolUsages.length > 0`; removes the right-rail `ProtocolRunCard` block renderer and its container when a protocol is active; right-rail "Protocolos" section (with dashed empty-state card + "Agregar" button) is shown only when there are 0 usages; "Cambiar" in the strip reuses the existing `showPicker` state to open the protocol picker.

### Removed

- Inline `ProtocolRunCard` component from `Consulta.tsx` (replaced by `ProtocolStrip`); `handleAppendToSoap` callback (was only used by `ProtocolRunCard`).

## [2026-05-02] — Protocol dosage_table run mode: add medications to prescription queue

### Added

- `BlockRendererRunMode.tsx`: `DosageTableRunMode` component renders each dosage row with a "+ Añadir a receta" button; clicking queues the medication via `useOrderQueueStore.queueMedication()` and auto-populates the Plan SOAP field

### Changed

- `BlockRendererRunMode.tsx`: `dosage_table` case now renders interactive `DosageTableRunMode` instead of the static `ProtocolDosageTable`; removed unused `ProtocolDosageTable` import

---

## [2026-05-02] — Consultation protocol fixes (imaging/lab blocks, layout, snapshot)

### Added

- `packages/shared`: `imaging_order` and `lab_order` block types added to `ProtocolBlockSchema` and `TemplateBlockSchema` with `ImagingOrderItemSchema` and `LabOrderItemSchema`
- `EditorBlockRenderer.tsx`: `ImagingOrderBlockEditor` and `LabOrderBlockEditor` inline editors with urgency/sample-type selects and add/remove row controls
- `ProtocolEditor.tsx`: "Orden de imagen" and "Orden de laboratorio" added to block palette and `makeBlock()` factory
- `BlockRenderer.tsx`: `ImagingOrderBlock` and `LabOrderBlock` interfaces added to `ProtocolBlock` discriminated union; render cases added for both types
- `strings.ts`: `BLOCK_TYPE_IMAGING_ORDER` and `BLOCK_TYPE_LAB_ORDER` Spanish labels

### Changed

- `Consulta.tsx`: Protocol cards moved from left SOAP column to right sidebar (360px wide) so doctors can reference the protocol while writing notes
- `Consulta.tsx`: `ProtocolRunCard` now reads blocks from `usage.content.blocks` (stored snapshot) instead of fetching via `useGetVersion` — eliminates redundant API call and loading spinner
- `Consulta.tsx`: Editor grid widened from `1fr 320px` to `1fr 360px`

## [2026-05-02] — Consultation fee per location (fixes auto-invoice)

### Added

- `packages/shared`: `consultationFee: number` field added to `Location` type and `CreateLocationSchema`/`UpdateLocationSchema`
- `Ubicaciones.tsx`: "Honorarios (RD$)" field in location create/edit form — sets the doctor's per-location consultation fee
- `Ubicaciones.tsx`: "Honorarios" column in the locations table showing the configured fee

### Changed

- `LocationsRepository`: `findMany`/`findById` now join `DoctorLocation` to include `consultationFee` in the response (scoped to current user)
- `LocationsRepository.create`: seeds `DoctorLocation.consultationFee` from `dto.consultationFee` instead of hardcoded `0`
- `LocationsRepository.update`: updates `DoctorLocation.consultationFee` in same transaction as location update
- `LocationsService`/`LocationsController`: pass `userId` through `list`, `getById`, and `update` paths so doctor-specific fee is correctly resolved and saved

### Fixed

- Auto-invoice on consultation sign now fires correctly once the doctor sets a non-zero consultation fee via Ajustes → Ubicaciones

## [2026-05-02] — Invoice create/edit/delete UI

### Added

- `Facturacion.tsx`: "Nueva factura" button in page header opens `InvoiceFormModal`
- `InvoiceFormModal`: patient picker, location picker, currency toggle (DOP/USD), dynamic items table with add/remove rows, live commission preview, notes field; wires `useCreateInvoice` and `useUpdateInvoice`
- Edit (pencil) and delete (trash) action buttons on draft invoice rows
- `DeleteConfirmModal`: confirmation dialog using `useDeleteInvoice`
- Empty state action button ("Nueva factura") added to the no-invoices state

### Changed

- `EmptyState` description updated to mention manual invoice creation as an option alongside auto-generation on consultation sign

## [2026-05-02] — Audit events for invoice status transitions

### Added

- `InvoicesService.updateStatus()` now records audit events after every status transition:
  - `draft → issued`: `category: 'system'`, `action: 'invoice_issued'`, with `invoiceNumber` in metadata
  - `issued → paid` and `draft/issued → cancelled`: `category: 'entity'`, `action: 'update'`, with `status` before/after diff in `changes`
- 3 new tests in `invoices.service.spec.ts` covering audit event shape for each transition path

## [2026-05-02] — Auto-create draft invoice on consultation sign

### Added

- `InvoicesService.createFromConsultation()` — looks up `DoctorLocation.consultationFee` and `commissionPct` for the doctor+location pair; creates a draft invoice with one "Consulta médica" item; skips silently when fee is 0 or no `DoctorLocation` row exists
- `ConsultationsModule` now imports `InvoicesModule` so `InvoicesService` is injectable into `ConsultationsService`
- `ConsultationsService.sign()` calls `createFromConsultation()` after signing; failure is non-fatal (fire-and-forget with catch) so the sign operation always succeeds

### Changed

- `consultations.service.spec.ts` — added `InvoicesService` mock to constructor; added tests for auto-invoice trigger, auto-invoice with fee=0 skip, and sign-succeeds-on-invoice-failure
- `invoices.service.spec.ts` — added `doctorLocation` to prisma mock; added `createFromConsultation` describe block with 3 test cases

## [2026-05-02] — Fix Firebase Hosting routing returning HTML for API routes

### Fixed

- `firebase.json` — moved `/v1/**` Cloud Run proxy rule before the `**` SPA catch-all (Firebase evaluates rewrites in order; catch-all was winning and returning `index.html` for every API request). Also corrected path prefix from `/api/**` to `/v1/**` to match the actual API route structure.

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
