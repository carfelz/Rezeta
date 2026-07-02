# Workflow Interconnection — Design Spec

**Date:** 2026-07-02
**Status:** Approved by user (section-by-section review)
**Scope:** Close the full clinical loop — appointment → consultation → sign → invoice → follow-up — plus patient-page cross-links and the walk-in entry path (spec Path B).

## Problem

The app's modules work as disconnected islands. The canonical workflow spec (`specs/updated-specs/01-consultation-workflow.md`) defines an "Iniciar consulta" action on appointments and a two-entry-path model, but the current code does not implement the connection:

1. No "Iniciar consulta" on appointment cards — `Consultation.appointmentId` is never set in practice. Doctors must detour through the patient page to start a consultation.
2. Appointment and consultation statuses are fully independent — "Completar" on an appointment does not reference a consultation; signing a consultation does not complete its appointment.
3. Post-sign dead-end — the draft invoice is created silently (`.catch(() => undefined)`); no link to it, no follow-up scheduling prompt.
4. Patient page shows only consultations — no per-patient view of appointments, prescriptions, or invoices.
5. No real walk-in path — "Nueva consulta" always requires arriving with a patient pre-selected.

## Decisions (from brainstorming)

- **Scope:** full clinical loop.
- **Status sync:** automatic, one-way (consultation drives appointment status). Manual "Completar" kept only for appointments without a linked consultation.
- **Post-sign:** summary shows invoice card + optional "Agendar seguimiento" action. No wizard.
- **Patient page:** tabs per entity (Historia clínica / Citas / Recetas / Facturas).
- **Walk-in:** full spec Path B — global "Nueva consulta" with patient search and inline minimal patient creation.
- **Approach:** incremental wiring. No new models, no encounter aggregate, no work-queue hub (the latter is a natural v1.5 follow-up).

---

## Section 1 — Data model & appointment↔consultation lifecycle

**No new models.** The schema already has `Consultation.appointmentId` (nullable FK), `Invoice.consultationId`, and orders on consultations. The only data change is one new appointment status value.

**Appointment status set:** `scheduled | in_progress | completed | cancelled | no_show`

### Automatic transitions

Server-side, in the consultations service, in the same transaction as the consultation write, audit-logged:

| Trigger | Appointment transition |
|---|---|
| Consultation created with `appointmentId` | `scheduled → in_progress` |
| Consultation signed | `in_progress → completed` |
| Open consultation soft-deleted/abandoned | `in_progress → scheduled` |

### Manual action constraints (appointments service)

- **"Completar"** allowed only when the appointment has no linked (non-deleted) consultation. With a linked consultation, status is read-only — it reflects the consultation.
- **"No asistió"** and **"Cancelar"** blocked while a linked open consultation exists.
- Creating a consultation is blocked on `cancelled` / `no_show` / `completed` appointments.

### Idempotency

"Iniciar consulta" is idempotent: if the appointment already has an open consultation, navigate to it ("Continuar consulta") instead of creating a second one. The schema allows multiple consultations per appointment; the UI/API never creates a second open one for the same appointment.

### Validation & errors

- New status value added to the shared Zod schema in `packages/shared` (single source for API + frontend).
- New typed error codes in the closed enum `packages/shared/src/errors.ts`, e.g. `APPOINTMENT_ALREADY_COMPLETED`, `APPOINTMENT_HAS_OPEN_CONSULTATION`, `APPOINTMENT_NOT_STARTABLE`.
- The UI never computes status; it only renders what the API returns.

---

## Section 2 — Agenda as the workflow's home + walk-in entry

### State-aware appointment card (`apps/web/src/pages/Schedule/AppointmentCard.tsx`)

| Appointment state | Card shows | Primary action |
|---|---|---|
| `scheduled` | current look | **"Iniciar consulta"** → creates consultation with `appointmentId`, navigates into it |
| `in_progress` | `in_progress` badge + active-item vertical teal rule | **"Continuar consulta"** → navigates to the open consultation |
| `completed` (via sign) | completed badge | **"Ver consulta"** (read-only) + secondary link to invoice if one exists |
| `completed` (manual) / `cancelled` / `no_show` | unchanged | — |

"Completar" moves to secondary/overflow actions and only renders when no consultation is linked. All colors/badges use existing design tokens; the 2px teal rule marks the in-progress card.

### Dashboard joins the loop

"UpcomingAppointments" rows on `/dashboard` get the same primary action (Iniciar/Continuar) so the first click of the day goes straight into the encounter.

### Walk-in entry (spec Path B)

- Global **"Nueva consulta"** button on the agenda header and the dashboard.
- Opens a dialog: patient search (name or cédula) + location select (defaults to topbar's active location).
- Patient not found → inline **"Crear paciente"** mini-form: name + date of birth only (all other fields completable later). Flow continues into the consultation without leaving the dialog.
- Resulting consultation has `appointment_id = null` (the walk-in marker). Workflow identical from there.

### Loop closure

"Volver a agenda" returns to the agenda, where the completed card links to its consultation and invoice; a follow-up appointment created post-sign (Section 3) appears on its future date as `scheduled`.

---

## Section 3 — Post-sign flow: invoice surfaced, follow-up offered

The post-sign summary screen gains two optional blocks alongside the existing PDF list.

### Invoice card

- Shows the auto-created draft: line item, amount, currency, commission/net-to-doctor breakdown.
- Actions: **"Emitir factura"** (issues inline — the one-tap common case) and **"Ver en Facturación"** (opens invoice detail for edits before issuing).
- Failure states surfaced instead of swallowed:
  - Creation failed → error state with **"Reintentar"** and **"Crear factura manual"** fallback.
  - No `consultationFee` configured for doctor+location (invoice silently skipped today) → card explains why, links to the fee setting, offers manual creation.
- The sign endpoint/response must expose the invoice-creation outcome (created / skipped-no-fee / failed) so the summary can render the right state. Invoice creation remains non-blocking for the sign itself.

### Follow-up card ("Seguimiento")

- **"Agendar seguimiento"** opens the existing appointment form pre-filled with patient, doctor, and the consultation's location; doctor picks date/time and reason.
- Optional; skipping is the default path. No wizard.

### Scope guard

"Emitir" is the only invoice mutation available from the summary. Payments, edits, cancellations stay on Facturación. Walk-ins get the identical screen (no appointment completes behind the scenes).

---

## Section 4 — Patient page tabs & cross-links

Tab bar on `apps/web/src/pages/PatientDetail/index.tsx` using the existing Tabs component:

- **Historia clínica** — current consultation list, unchanged; default tab.
- **Citas** — patient's appointments (past + upcoming) with status badges. Linked consultation → opens it; `scheduled` rows offer "Iniciar consulta".
- **Recetas** — patient's prescriptions, each linking to its parent consultation when present.
- **Facturas** — patient's invoices with status/amount, linking to Facturación detail and back to the linked consultation.

All tabs are filtered lists reusing existing list/badge components. API additions: list-by-patient endpoints or query params for appointments, prescriptions, invoices — tenant- and soft-delete-filtered as usual.

**Cross-link matrix when shipped:** cita ⇄ consulta ⇄ factura; consulta → recetas/órdenes; all reachable from the patient page.

---

## Error handling & testing (cross-cutting)

- All transitions and guards live in API services inside transactions. Invalid transitions return typed error codes from the closed enum.
- Audit logging flows through the existing audit interceptor (all changes go through the normal service layer).
- Tests alongside each touched module in `__tests__/`:
  - Transition-matrix tests for appointments/consultations services.
  - Idempotency of consultation-from-appointment creation.
  - Invoice-outcome surfacing (created / skipped / failed).
  - Walk-in minimal patient creation validation (Zod).
  - Component tests: state-aware appointment card, walk-in dialog, post-sign cards, patient tabs.
- 90% coverage bar applies (`pnpm test:coverage`). `pnpm lint` clean. User-facing strings in Spanish.

## Out of scope

- Encounter/visit aggregate or event-driven state machine.
- "Sala de espera" work-queue hub (candidate v1.5 follow-up).
- Invoice payments/edits from the post-sign summary.
- WhatsApp/email sending of PDFs (existing v2 deferral).
- Telemedicine, multi-user, patient portal (per `specs/full-scope.md` deferrals).
