# Remaining MVP Modules — Slice Tracker

> Living document. Last updated: April 2026.
>
> This document tracks implementation of the five remaining MVP modules:
> Locations, Appointments, Consultations, Prescriptions, and Billing.
> The Protocol Engine is complete (see `protocol-engine-slices.md`).
> The DB schema exists for all entities — no migrations needed.

## Table of Contents

1. [Architectural Decisions](#1-architectural-decisions)
2. [Slice Status Overview](#2-slice-status-overview)
3. [Module L — Locations](#3-module-l--locations)
4. [Module A — Appointments & Calendar](#4-module-a--appointments--calendar)
5. [Module C — Consultations (SOAP Notes)](#5-module-c--consultations-soap-notes)
6. [Module P — Prescriptions](#6-module-p--prescriptions)
7. [Module B — Billing / Invoicing](#7-module-b--billing--invoicing)
8. [Cross-Cutting Work](#8-cross-cutting-work)
9. [Build Order & Dependencies](#9-build-order--dependencies)

---

## 1. Architectural Decisions

These apply to every module. Read this section before picking up any slice.

### 1.1 Schema is Complete — No Migrations Needed

All tables exist. Every module's implementation is purely application code:
service + repository + controller on the API, hook + page on the frontend.

### 1.2 Established Patterns — Follow Them Exactly

The patients module (`apps/api/src/modules/patients/`) is the reference implementation.
Every new module must follow the same three-layer pattern:

```
Controller  →  Service  →  Repository  →  Prisma
```

- **Controller:** REST routes, `@TenantId()`, `@CurrentUser()`, Zod validation pipe, no business logic.
- **Service:** business rules, `NotFoundException`/`BadRequestException` with `ErrorCode`, calls repository only.
- **Repository:** Prisma queries, always filters `tenantId` + `deletedAt: null`, cursor pagination pattern.

### 1.3 Tenant Isolation Is Non-Negotiable

Every query includes `tenantId`. Every endpoint uses `FirebaseAuthGuard` + `TenantGuard`. Cross-tenant isolation is tested in every integration test file.

### 1.4 Soft Deletes Only

`deletedAt` field, never hard deletes. `PATCH /{resource}/:id/archive` or `DELETE` that sets `deletedAt`. The `list` queries always filter `deletedAt: null`.

### 1.5 Location Is the Core Axis

`locationId` appears on Appointment, Consultation, and Invoice. Before any of those can be created, the doctor must have at least one Location configured. The **Locations module ships first**; everything else depends on it being selectable in forms.

### 1.6 Consultation Is the Clinical Hub

The consultation is the center of the clinical workflow:

- An appointment can optionally become a consultation.
- A consultation can have prescriptions (1:many).
- A consultation auto-generates an invoice on signing (the billing trigger).

This dependency chain: **Locations → Appointments → Consultations → Prescriptions + Billing**.

### 1.7 Signing Creates Immutable Records

Per the architectural principles:

- A `Consultation` with `status: 'signed'` cannot be mutated. Corrections go through `ConsultationAmendment`.
- A `Prescription` with `status: 'signed'` cannot be mutated.
- An `Invoice` with `status: 'issued'` or `'paid'` cannot be mutated (cancel + reissue pattern).
- These rules live in the **service layer** and are also enforced by API tests.

### 1.8 Invoice Auto-Generation on Consultation Sign

When a doctor signs a consultation:

1. The service creates an `Invoice` (status `draft`) with `consultationId` linked.
2. Line items come from `DoctorLocation.consultationFee` at that location.
3. Commission fields are copied from `Location.commissionPercent` and `DoctorLocation.commissionPct` (use whichever is set; `DoctorLocation.commissionPct` takes precedence when non-zero).
4. `netToDoctor = total - commissionAmount`.
5. The doctor can then mark the invoice as `issued` → `paid` manually.

Auto-generation is synchronous (within the sign transaction), not async.

### 1.9 Location Switcher in the Top Bar

The active location context is global UI state (Zustand). Every page that creates appointments, consultations, or invoices inherits it. The topbar's location switcher (already in the design system) needs to be wired to this store so it shows the doctor's current active location and allows switching.

### 1.10 Strings Module

All Spanish UI strings live in `apps/web/src/lib/strings.ts`. Follow the existing
`DOMAIN_CONTEXT` naming pattern. No hardcoded Spanish in component files.

### 1.11 No New UI Primitives

The design system (`design-system/`) covers all needed patterns: cards, forms, tables, modals, badges, empty states. Check `specs/design-system/components.md` before building any new UI element.

---

## 2. Slice Status Overview

| #   | Slice                                           | Status    | Est.     | Notes                                                     |
| --- | ----------------------------------------------- | --------- | -------- | --------------------------------------------------------- |
| L1  | Location CRUD (backend)                         | ⏸ Pending | 1 day    | GET/POST/PATCH/DELETE + integration tests                 |
| L2  | Location management UI (`/ajustes/ubicaciones`) | ⏸ Pending | 1 day    | List, create, edit, delete + location switcher wired      |
| A1  | Appointment CRUD (backend)                      | ⏸ Pending | 1.5 days | GET/POST/PATCH/DELETE + conflict detection                |
| A2  | Agenda page — calendar view                     | ⏸ Pending | 1.5 days | Week view, appointment cards, create/edit modal           |
| A3  | Appointment status flow                         | ⏸ Pending | 0.5 day  | Mark completed / cancelled / no-show from the calendar    |
| C1  | Consultation CRUD (backend)                     | ⏸ Pending | 1.5 days | GET/POST/PATCH, sign endpoint, amendment endpoint         |
| C2  | Consultation list on patient detail             | ⏸ Pending | 1 day    | Timeline tab + consultation card                          |
| C3  | Consultation editor (SOAP form)                 | ⏸ Pending | 2 days   | Full SOAP form, vitals, diagnoses, save draft, sign       |
| C4  | Amendment flow                                  | ⏸ Pending | 0.5 day  | Reason modal + amendment record display                   |
| P1  | Prescription CRUD (backend)                     | ⏸ Pending | 1 day    | GET/POST/PATCH, sign endpoint                             |
| P2  | Prescription editor UI                          | ⏸ Pending | 1.5 days | Drug/dose form, add/remove items, sign, linked to consult |
| B1  | Invoice CRUD (backend)                          | ⏸ Pending | 1 day    | GET/POST/PATCH, issue/pay/cancel endpoints                |
| B2  | Invoice auto-generation on consult sign         | ⏸ Pending | 0.5 day  | Triggered inside consultation sign service method         |
| B3  | Billing page (`/facturacion`)                   | ⏸ Pending | 1 day    | Invoice list, status filter, mark paid, detail view       |

**Legend:** ✅ Done · ⏳ In progress · ⏸ Pending · ❌ Blocked

**Total estimated effort:** ~15–17 days.

---

## 3. Module L — Locations

### Why First

Every other MVP module requires a `locationId`. Without at least one Location configured, appointments, consultations, and invoices cannot be created. This also wires the topbar location switcher, which is used across all subsequent pages.

---

### Slice L1 — Location CRUD (Backend)

**Status: ⏸ Pending**

#### In scope

**Backend (`apps/api/src/modules/locations/`):**

- `GET /v1/locations` — list tenant's locations (non-deleted), ordered by name
  - Response per location: `id`, `name`, `address`, `city`, `phone`, `isOwned`, `commissionPercent`, `notes`
- `GET /v1/locations/:id` — single location with `doctorLocations` for the current user
- `POST /v1/locations` — create
  - Body: `name` (required), `address?`, `city?`, `phone?`, `isOwned` (boolean), `commissionPercent?`, `notes?`
  - On create: also creates a `DoctorLocation` join row linking the authenticated user to this location, with `consultationFee: 0` and `commissionPct: 0` (defaults editable later)
- `PATCH /v1/locations/:id` — update fields (partial)
- `DELETE /v1/locations/:id` — soft-delete
  - Reject if any non-deleted `Appointment` or `Consultation` references this location (`LOCATION_HAS_RECORDS`)
- `PATCH /v1/locations/:id/doctor-settings` — update `DoctorLocation` fields for the authenticated user
  - Body: `consultationFee?`, `commissionPct?`, `roomOrOffice?`
  - Creates the `DoctorLocation` row if it doesn't exist (idempotent upsert)

**Shared (`packages/shared`):**

- `CreateLocationSchema`, `UpdateLocationSchema`, `UpdateDoctorLocationSchema`
- `LocationResponse` type
- Error codes: `LOCATION_NOT_FOUND`, `LOCATION_HAS_RECORDS`

**Integration tests:**

- CRUD happy paths + cross-tenant isolation
- Creating a location also creates the `DoctorLocation` row
- Soft-delete rejection when active appointments exist

---

### Slice L2 — Location Management UI

**Status: ⏸ Pending**

#### In scope

**Frontend:**

- **`/ajustes/ubicaciones`** (new page, add to router and Ajustes nav):
  - List of locations: name, city, owned/external badge, commission %, edit and delete actions
  - "Nueva ubicación" button → inline modal: name, address, city, phone, isOwned toggle, commission percent
  - Each row: expandable "Mis ajustes en esta ubicación" section showing `consultationFee`, `commissionPct`, `roomOrOffice` (editable in place)
  - Delete: confirms and shows warning if records exist
- **Topbar location switcher** — wire to real data:
  - Loads `GET /v1/locations` on app start
  - Stores `activeLocationId` in Zustand (`useLocationStore`)
  - Displays selected location name; dropdown to switch
  - If only one location, shows it without a dropdown
  - If no locations, shows "Configurar ubicación" link → `/ajustes/ubicaciones`
  - Active location persists in `localStorage` across sessions
- **`useLocations` hook** in `apps/web/src/hooks/locations/use-locations.ts`

**Strings to add:** `LOCATIONS_*` family (page title, new button, labels, error states, empty state)

#### Done when

- Doctor can add their first location from `/ajustes/ubicaciones`
- Topbar shows the active location and allows switching
- Active location context is accessible from Zustand in subsequent pages

---

## 4. Module A — Appointments & Calendar

**Depends on:** Locations (L1 + L2 must be done)

---

### Slice A1 — Appointment CRUD (Backend)

**Status: ⏸ Pending**

#### In scope

**Backend (`apps/api/src/modules/appointments/`):**

- `GET /v1/appointments` — list with filters:
  - `locationId?` (required in practice — client always passes the active location)
  - `date?` (ISO date string, returns that day's appointments)
  - `weekStart?` (ISO date, returns the week's appointments — `startsAt >= weekStart AND startsAt < weekStart + 7 days`)
  - `patientId?` (for patient detail page)
  - `status?` (e.g., `scheduled`, `completed`)
  - No cursor pagination — appointment lists are bounded by date range
  - Response per appointment: `id`, `patientId`, `patientFullName` (joined), `locationId`, `locationName` (joined), `startsAt`, `endsAt`, `status`, `reason`
- `GET /v1/appointments/:id` — full appointment detail
- `POST /v1/appointments` — create
  - Body: `patientId`, `locationId`, `startsAt`, `endsAt`, `reason?`, `notes?`
  - **Conflict detection:** reject if the same doctor already has an appointment at this location overlapping the time range (`APPOINTMENT_CONFLICT`)
  - `status` defaults to `scheduled`
- `PATCH /v1/appointments/:id` — update `startsAt`, `endsAt`, `reason`, `notes`, `locationId`
  - Reject if status is `completed` or `cancelled`
  - Re-run conflict detection on time change
- `PATCH /v1/appointments/:id/status` — transition status
  - Allowed: `scheduled → completed | cancelled | no_show`, `no_show → scheduled`
  - Reject invalid transitions
- `DELETE /v1/appointments/:id` — soft-delete (only `scheduled` appointments)
  - Reject if a `Consultation` exists for this appointment

**Shared:**

- `CreateAppointmentSchema`, `UpdateAppointmentSchema`, `AppointmentStatusSchema`
- `AppointmentListItem`, `AppointmentDetail` types
- Error codes: `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_CONFLICT`, `APPOINTMENT_INVALID_STATUS_TRANSITION`, `APPOINTMENT_HAS_CONSULTATION`

**Integration tests:**

- CRUD happy paths
- Conflict detection: overlapping times rejected, adjacent times allowed
- Status transitions: valid and invalid cases
- Cross-tenant isolation on all endpoints
- Delete rejection when a consultation is linked

---

### Slice A2 — Agenda Page — Calendar View

**Status: ⏸ Pending**

#### In scope

**Frontend (`apps/web/src/pages/Agenda.tsx`):**

Replace the stub with a working calendar page.

- **Week view** (default): 7-column grid, hours 07:00–21:00 on the Y-axis, each appointment rendered as a positioned card
  - Appointment card: patient name, time range, status chip
  - Click card → opens appointment detail modal
  - Click an empty slot → opens create appointment modal pre-filled with the clicked time
- **Day view toggle**: single column, same time axis — useful for busy days
- **Week navigation**: prev/next week buttons + "Hoy" to jump to current week
- **Location filter**: uses active location from Zustand (same location switcher as topbar)
- **"Nueva cita" button** (top right) → create appointment modal:
  - Patient autocomplete (calls `GET /v1/patients?search=...`)
  - Date, start time, end time inputs
  - Reason (optional)
  - Submit → `POST /v1/appointments` → calendar refreshes
- **Edit modal**: opens on appointment card click with the same form pre-filled, plus status action buttons

**Hook:** `useAppointments` in `apps/web/src/hooks/appointments/use-appointments.ts`

**Strings:** `AGENDA_*` family

#### Note on Calendar Implementation

Do not import a heavy calendar library. Build the week grid with CSS Grid — 7 columns, time slots as rows. Position appointment cards using `top` + `height` calculated from `startsAt`/`endsAt` relative to the day start. This is ~60 lines of layout logic and avoids a large dependency.

---

### Slice A3 — Appointment Status Flow

**Status: ⏸ Pending**

#### In scope

**Frontend:**

- Status transition actions on the appointment detail modal:
  - `scheduled` → "Marcar como completada" / "Cancelar cita" / "No se presentó"
  - `no_show` → "Reagendar" (resets to `scheduled`, user edits time)
  - `completed` → no actions (read-only, link to consultation if one exists)
- Status badge in the appointment card uses `Badge` component variants: `scheduled → draft`, `completed → active`, `cancelled → archived`, `no_show → review`
- When an appointment is marked `completed`, show a prompt: "¿Deseas iniciar una consulta para esta cita?" with a primary CTA that navigates to a new consultation pre-linked to this appointment

#### Done when (Slices A1–A3)

- Doctor can see the week's appointments for the active location
- Can create, edit, and cancel appointments with conflict detection
- Can mark appointments completed / no-show
- Completing an appointment surfaces a prompt to start a consultation

---

## 5. Module C — Consultations (SOAP Notes)

**Depends on:** Locations (L1), Appointments (A1) recommended but not required (consultations can exist without a prior appointment)

---

### Slice C1 — Consultation CRUD (Backend)

**Status: ⏸ Pending**

#### In scope

**Backend (`apps/api/src/modules/consultations/`):**

- `GET /v1/consultations` — list with filters:
  - `patientId?` (for patient timeline)
  - `locationId?`
  - `status?` (`draft` | `signed`)
  - `dateFrom?`, `dateTo?` (ISO dates, filter `consultedAt`)
  - Response per consultation: `id`, `patientId`, `patientFullName`, `locationId`, `locationName`, `status`, `signedAt`, `chiefComplaint`, `consultedAt`
- `GET /v1/consultations/:id` — full detail including all SOAP fields, `vitals`, `diagnoses`, amendment list
- `POST /v1/consultations` — create draft
  - Body: `patientId`, `locationId`, `appointmentId?`, `consultedAt?` (defaults to now), `chiefComplaint?`, `subjective?`, `objective?`, `assessment?`, `plan?`, `vitals?`, `diagnoses?`
  - If `appointmentId` provided: validate it belongs to the same tenant and patient, set appointment status to `completed`
- `PATCH /v1/consultations/:id` — update any SOAP field on a `draft` consultation
  - Reject if `status === 'signed'` with `CONSULTATION_ALREADY_SIGNED`
- `POST /v1/consultations/:id/sign` — sign the consultation
  - Sets `status: 'signed'`, `signedAt: now()`, `signedBy: userId`
  - Computes and stores `contentHash` (SHA-256 of the SOAP fields JSON)
  - **Triggers invoice auto-generation** (see Slice B2)
  - Returns updated consultation + the generated invoice id
  - Reject if already signed
- `POST /v1/consultations/:id/amendments` — create an amendment on a signed consultation
  - Body: `reason` (required, 10–1000 chars), `content` (JSONB of changed fields)
  - Assigns `amendmentNumber` as `MAX(amendmentNumber) + 1` for this consultation
  - No re-signing of amendments in MVP — amendments are stored as audit records
- `DELETE /v1/consultations/:id` — soft-delete, only `draft` consultations

**Shared:**

- `CreateConsultationSchema`, `UpdateConsultationSchema`, `SignConsultationSchema`, `CreateAmendmentSchema`
- `ConsultationListItem`, `ConsultationDetail`, `AmendmentRecord` types
- `VitalsSchema`: `{ systolic?: number, diastolic?: number, heartRate?: number, temperature?: number, weight?: number, height?: number, oxygenSat?: number, respiratoryRate?: number }`
- Error codes: `CONSULTATION_NOT_FOUND`, `CONSULTATION_ALREADY_SIGNED`, `CONSULTATION_DRAFT_REQUIRED`

**Integration tests:**

- CRUD happy paths + cross-tenant isolation
- PATCH on signed consultation rejected
- Sign: sets all fields correctly, triggers invoice creation
- Amendment: creates correct `amendmentNumber` sequence
- Soft-delete: only drafts deletable

---

### Slice C2 — Consultation List on Patient Detail

**Status: ⏸ Pending**

#### In scope

**Frontend:**

Add a **"Consultas" tab** to the patient detail page (`/pacientes/:patientId`):

- Timeline list of the patient's consultations, newest first
- Each row: date (`consultedAt`), location name, chief complaint (truncated), status badge, "Ver" / "Editar" link
- Empty state: "Aún no hay consultas para este paciente. Nueva consulta."
- "Nueva consulta" button (top right of tab) → navigates to the consultation editor pre-filled with `patientId` and the active location

**Hook:** `useConsultations` in `apps/web/src/hooks/consultations/use-consultations.ts`

**Strings:** `CONSULTATION_*` family

---

### Slice C3 — Consultation Editor (SOAP Form)

**Status: ⏸ Pending**

#### In scope

**Frontend (`apps/web/src/pages/ConsultationEditor.tsx`):**

Route: `/pacientes/:patientId/consultas/:consultationId` (or `/consultas/nueva?patientId=...`)

- **Page header:** Patient name (large) + location + `consultedAt` date (editable) + status badge
- **Form layout** — four sections as labeled card blocks:
  1. **Chief Complaint** — single textarea
  2. **SOAP Note** — four textareas side-by-side on desktop (Subjective, Objective, Assessment, Plan) or stacked on mobile
  3. **Vitals** — inline numeric inputs: systolic / diastolic, heart rate, temperature, weight, height, O₂ sat, respiratory rate (all optional)
  4. **Diagnoses** — tag input: type a diagnosis and press Enter to add; shows list of chips with × to remove
- **Auto-save draft** every 30 seconds (PATCH to API); dirty state indicator in header
- **"Guardar borrador"** button — explicit save
- **"Firmar consulta"** primary button — opens confirm modal:
  - "Al firmar, la consulta quedará en solo lectura."
  - Primary CTA: "Firmar y guardar" → calls sign endpoint → redirects to read-only view
- **Read-only view** (status `signed`): same layout but all fields disabled, amendment panel shown at bottom
- **Amendment panel** (signed consultations only): lists existing amendments + "Agregar enmienda" button
  - Amendment form: reason textarea (required) + which fields changed (optional free-text notes)

#### Notes

- Use React Hook Form for the SOAP form (matches the tech stack choice in `technical-architecture.md`)
- Vitals are optional — only send non-empty fields
- Diagnoses stored as `string[]` JSON — simple tag input with no autocomplete in MVP (free-text)

---

### Slice C4 — Amendment Flow

**Status: ⏸ Pending**

#### In scope

**Frontend:**

- "Agregar enmienda" button on signed consultation view
- Modal: `reason` textarea (required, 10–1000 chars) + `content` free-text description of what changed
- On submit: `POST /v1/consultations/:id/amendments`
- Amendment list below the SOAP fields: each entry shows amendment number, date, reason, author
- Amendment list is read-only; no editing amendments in MVP

#### Done when (Slices C1–C4)

- Doctor can create and save SOAP note drafts from the patient detail page
- Doctor can sign a consultation (makes it immutable, triggers invoice)
- Signed consultations show amendment history and allow adding amendments
- All edits on signed records are rejected by the API

---

## 6. Module P — Prescriptions

**Depends on:** Consultations (C1) for the linked-to-consultation flow, but prescriptions can also be created standalone (linked to a patient without a consultation).

---

### Slice P1 — Prescription CRUD (Backend)

**Status: ⏸ Pending**

#### In scope

**Backend (`apps/api/src/modules/prescriptions/`):**

- `GET /v1/prescriptions` — list with filters: `patientId?`, `consultationId?`, `status?`
  - Response per prescription: `id`, `patientId`, `patientFullName`, `consultationId?`, `status`, `itemCount`, `createdAt`, `signedAt?`
- `GET /v1/prescriptions/:id` — full detail including `items` JSON
- `POST /v1/prescriptions` — create draft
  - Body: `patientId`, `consultationId?`, `items` (array, see below), `notes?`
  - `items` schema: `[{ drug: string, dose: string, route: string, frequency: string, duration: string, instructions?: string }]`
  - Minimum 1 item required
- `PATCH /v1/prescriptions/:id` — update `items` or `notes`
  - Reject if signed
- `POST /v1/prescriptions/:id/sign` — sign
  - Sets `status: 'signed'`, `signedAt: now()`
  - In MVP: no PDF generation (deferred to post-MVP — `pdfUrl` left null)
  - Reject if already signed or no items
- `DELETE /v1/prescriptions/:id` — soft-delete, drafts only

**Shared:**

- `CreatePrescriptionSchema`, `UpdatePrescriptionSchema`, `PrescriptionItemSchema`
- `PrescriptionListItem`, `PrescriptionDetail` types
- Error codes: `PRESCRIPTION_NOT_FOUND`, `PRESCRIPTION_ALREADY_SIGNED`, `PRESCRIPTION_EMPTY`

**Integration tests:**

- CRUD happy paths + cross-tenant isolation
- Sign validation: rejects if already signed, rejects if items empty
- PATCH on signed: rejected

---

### Slice P2 — Prescription Editor UI

**Status: ⏸ Pending**

#### In scope

**Frontend (`apps/web/src/pages/PrescriptionEditor.tsx`):**

Route: `/pacientes/:patientId/recetas/:prescriptionId` (or `/recetas/nueva?patientId=...&consultationId=...`)

- **Header:** Patient name + status badge + "Firmar receta" button
- **Patient info bar:** DOB, allergies (shown as warning chips if any) — pulled from patient record
- **Item list:** table-style form, one row per drug:
  - Columns: Medicamento, Dosis, Vía, Frecuencia, Duración, Instrucciones (optional)
  - "Añadir medicamento" button appends a new empty row
  - Delete (×) per row (min 1 row always)
- **Notes** textarea at bottom (optional)
- **Save draft** auto-saves on blur of each field; explicit "Guardar borrador" button
- **Sign modal:** "Al firmar, la receta quedará en solo lectura y estará lista para entregar al paciente."
- **Signed view:** same layout, all fields read-only; printable (standard browser print, CSS `@media print` to hide chrome)
- Prescription accessible from **consultation editor** ("Agregar receta" link inside the consultation form that navigates to new prescription pre-filled with `consultationId`)
- Prescription list tab on **patient detail page** (similar to consultations tab)

**Strings:** `PRESCRIPTION_*` family

#### Done when (Slices P1–P2)

- Doctor can create a prescription from a consultation or standalone from a patient
- Doctor can sign the prescription (makes it immutable)
- Signed prescription is printable via browser print

---

## 7. Module B — Billing / Invoicing

**Depends on:** Locations (L1 — for commission data), Consultations (C1 — sign triggers invoice creation)

---

### Slice B1 — Invoice CRUD (Backend)

**Status: ⏸ Pending**

#### In scope

**Backend (`apps/api/src/modules/invoices/`):**

- `GET /v1/invoices` — list with filters:
  - `patientId?`, `locationId?`, `status?`, `dateFrom?`, `dateTo?`
  - Response per invoice: `id`, `invoiceNumber`, `patientId`, `patientFullName`, `locationName`, `status`, `total`, `currency`, `commissionAmount`, `netToDoctor`, `issuedAt`, `paidAt`
- `GET /v1/invoices/:id` — full detail with `items` array
- `POST /v1/invoices` — create a standalone invoice (not from a consultation)
  - Body: `patientId`, `locationId`, `items: [{ description, quantity, unitPrice }]`, `currency?` (default DOP), `notes?`
  - Calculates `subtotal = sum(quantity * unitPrice)`, `tax = 0` (no ITBIS in MVP), `total = subtotal`
  - Looks up `DoctorLocation` for commission: `commissionAmount = total * commissionPct / 100` (uses location-level `commissionPercent` if no doctor-specific override)
  - `netToDoctor = total - commissionAmount`
  - Assigns `invoiceNumber` as sequential per tenant: `INV-{year}-{5-digit-seq}` (e.g., `INV-2026-00001`)
  - Status: `draft`
- `PATCH /v1/invoices/:id` — update items and notes on `draft` invoices only
- `POST /v1/invoices/:id/issue` — transition `draft → issued`, sets `issuedAt`
- `POST /v1/invoices/:id/pay` — transition `issued → paid`, sets `paidAt`, body: `paymentMethod` (cash | card | transfer | check)
- `POST /v1/invoices/:id/cancel` — transition `draft | issued → cancelled`
  - Reject if `paid`

**Shared:**

- `CreateInvoiceSchema`, `UpdateInvoiceSchema`, `InvoiceItemSchema`
- `InvoiceListItem`, `InvoiceDetail` types
- Error codes: `INVOICE_NOT_FOUND`, `INVOICE_IMMUTABLE`, `INVOICE_INVALID_TRANSITION`

**Integration tests:**

- CRUD happy paths + cross-tenant isolation
- Invoice number sequence: two invoices get different numbers
- Commission calculation: correct for both location-level and doctor-level override
- Status transitions: valid and invalid cases
- PATCH on issued/paid/cancelled: rejected

---

### Slice B2 — Invoice Auto-Generation on Consultation Sign

**Status: ⏸ Pending**

#### In scope

This is **backend only** — a small addition inside the `ConsultationsService.sign()` method.

When a consultation is signed:

1. Look up `DoctorLocation` for the combination of `(userId, locationId)` in this consultation
2. Use `consultationFee` as the single line item: `{ description: 'Consulta médica', quantity: 1, unitPrice: consultationFee }`
3. If `consultationFee === 0`, still create the invoice (as RD$ 0.00 — free consultation, trackable)
4. Compute `commissionAmount` and `netToDoctor`
5. Assign invoice number via the same sequence logic as `POST /v1/invoices`
6. Insert `Invoice` + 1 `InvoiceItem` in the same transaction as the consultation sign
7. The sign endpoint response includes `invoiceId` alongside the updated consultation

**Integration tests:**

- Sign consultation → invoice created with correct amounts and linkage
- Commission computed from DoctorLocation override when set, else Location default
- Re-signing rejected (consultation already signed) → no duplicate invoice

---

### Slice B3 — Billing Page (`/facturacion`)

**Status: ⏸ Pending**

#### In scope

**Frontend (`apps/web/src/pages/Facturacion.tsx`):**

Replace the stub with a working billing page.

- **Summary bar** at top (3 stat cards):
  - "Cobrado este mes" (sum of `paid` invoices this calendar month, `netToDoctor`)
  - "Pendiente de cobro" (sum of `issued` invoices, `netToDoctor`)
  - "Total facturado" (sum of all non-cancelled invoices this month, `total`)
- **Invoice list** below:
  - Columns: Número, Paciente, Ubicación, Fecha, Total, Comisión, Neto médico, Estado, Acciones
  - **Status filter tabs**: Todos · Borrador · Emitida · Pagada · Cancelada
  - **Date range filter**: current month by default, date pickers to change
- **Invoice row actions:**
  - `draft`: "Emitir" → calls issue endpoint → optimistic update
  - `issued`: "Marcar pagada" → opens modal asking for payment method → calls pay endpoint
  - Any non-paid: "Ver detalle" → detail drawer showing items + commission breakdown
  - `draft | issued`: "Cancelar" → confirm modal
- **"Nueva factura" button** → create invoice modal:
  - Patient autocomplete
  - Location dropdown (shows doctor's locations)
  - Line items (same UI as prescription items: description, qty, unit price, total)
  - Currency (DOP default)
  - Notes
- **Patient detail page** also shows an "Facturas" tab listing invoices for that patient (reuses hook)

**Hook:** `useInvoices` in `apps/web/src/hooks/invoices/use-invoices.ts`

**Strings:** `BILLING_*` family

#### Done when (Slices B1–B3)

- Auto-generated invoice appears in `/facturacion` after signing a consultation
- Doctor can manually create invoices for services outside consultations
- Doctor can transition invoices through draft → issued → paid
- Summary stats show this month's revenue snapshot

---

## 8. Cross-Cutting Work

These are smaller items that span multiple modules. They should be addressed as the modules they belong to are built.

### Patient Detail Page — Tab Architecture

The patient detail page currently exists but may only show basic info. As modules ship, add tabs:

| Tab       | When to add | Content                              |
| --------- | ----------- | ------------------------------------ |
| Resumen   | L2          | Basic demographics (already exists)  |
| Consultas | C2          | Consultation timeline                |
| Recetas   | P2          | Prescription list                    |
| Facturas  | B3          | Invoice list                         |
| Citas     | A2          | Appointment history for this patient |

Add tabs incrementally — don't wait until all modules are done to add the tab bar. Add each tab when its module lands.

### Sidebar Navigation

Add "Ubicaciones" link under `/ajustes` when L2 ships. Ensure `/facturacion` sidebar item works (it's already in the router).

### Error Codes (`packages/shared/src/errors.ts`)

Add new `ErrorCode` values as each module is built. Follow the existing pattern.

### Active Location in Query Hooks

When `activeLocationId` from Zustand is a filter parameter, hooks should re-fetch automatically when it changes. Pass it in the query key so TanStack Query re-runs: `queryKey: ['appointments', activeLocationId, date]`.

---

## 9. Build Order & Dependencies

The dependency graph enforces this sequence:

```
L1 (Location backend)
  └─ L2 (Location UI + topbar wiring)
       ├─ A1 (Appointments backend)
       │    └─ A2 (Calendar UI)
       │         └─ A3 (Status flow + prompt to consult)
       │
       └─ C1 (Consultations backend)
            ├─ C2 (Consultation list on patient)
            │    └─ C3 (SOAP editor)
            │         └─ C4 (Amendment flow)
            │
            ├─ P1 (Prescriptions backend)
            │    └─ P2 (Prescription editor)
            │
            └─ B1 (Invoices backend)
                 ├─ B2 (Auto-generation — inside C1's sign method)
                 └─ B3 (Billing page)
```

**Recommended sprint order:**

1. **L1 + L2** (2 days) — unlock everything else; topbar becomes functional
2. **A1 + A2 + A3** (3.5 days) — calendar is high-visibility, good early demo
3. **C1 + C2 + C3** (4.5 days) — the clinical core; sign triggers invoicing
4. **B1 + B2 + B3** (2.5 days) — B2 is bundled into C1; B3 completes the revenue picture
5. **P1 + P2** (2.5 days) — completes the clinical workflow

Total: ~15 days. Prescriptions are last because they are standalone-enough to ship independently of billing, and the billing picture is more important to close early.

### Minimum Demoable State at Each Checkpoint

| After  | What the doctor can do                                    |
| ------ | --------------------------------------------------------- |
| L1+L2  | Configure locations, switch active location               |
| +A1–A3 | Schedule patients, manage appointment flow                |
| +C1–C3 | Document consultations, sign SOAP notes, trigger invoices |
| +B1–B3 | View and manage revenue, mark invoices paid               |
| +P1–P2 | Issue prescriptions from consultations, print them        |

At the C1–C3 checkpoint the core clinical loop is closed (patient → appointment → consultation → invoice). Everything after that adds breadth.

---

## Appendix: How to Pick Up a Slice

1. Read Section 1 (Architectural Decisions) completely.
2. Find the slice. Read "In scope" and any dependency notes.
3. Verify the prerequisite slices are done.
4. Check the Prisma schema — the models are already there, no migrations needed.
5. Follow the patients module pattern for controller / service / repository structure.
6. Before writing frontend, check `specs/design-system/components.md` for the right component.
7. Add strings to `apps/web/src/lib/strings.ts` before hardcoding any Spanish in components.
8. Run `pnpm lint` and `pnpm -F api exec tsc --noEmit` and `pnpm -F web exec tsc --noEmit` before marking done. Zero new errors is the bar.
