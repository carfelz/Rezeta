# Consultation Workflow

> Part of the Rezeta updated specs. See `00-overview.md` for context.

## 1. Design Principles

1. **Patient-first.** The doctor assesses the patient, then decides which protocol applies. No UI element forces protocol selection before the encounter begins.
2. **No mandatory gate.** The consultation opens with patient context immediately visible. Protocols are addable at any point during the encounter.
3. **Two entry paths are equal citizens.** Planned (from appointment) and walk-in (no appointment) produce the same consultation record and follow the same workflow.
4. **Clinical content lives in protocols.** The `Consultation` record is an administrative container. Every piece of clinical documentation — notes, vitals, diagnoses — lives inside a `ProtocolUsage` block.
5. **Immutability after signing.** Signed consultations are never edited in place. Corrections go through `ConsultationAmendment`.

---

## 2. Entry Paths

### Path A — Planned Consultation (from appointment)

1. Doctor opens their agenda. An appointment is listed for a patient.
2. Doctor taps **"Iniciar consulta"** on the appointment row.
3. System creates a `Consultation` record with `appointment_id` set to that appointment's UUID.
4. Consultation opens in `open` state.

### Path B — Walk-in / Emergency Room

1. Doctor taps **"Nueva consulta"** from any screen (dashboard, patient list, or global nav).
2. Doctor searches for the patient by name or cédula.
   - If patient exists → select and continue.
   - If patient is new or unknown (ER) → create a minimal patient record (name + DOB required; all other fields optional, completable later).
3. System creates a `Consultation` record with `appointment_id = null`.
4. Consultation opens in `open` state.

> **No appointment required for walk-ins.** `appointment_id` is a nullable FK. Its absence signals a walk-in or ER encounter.

---

## 3. Consultation Lifecycle States

```
[created] ──→ open ──→ signed ──→ amended
                              ↑________|
                    (amendment added to signed record)
```

| State | Description | Editable? |
|---|---|---|
| `open` | Active encounter. Doctor is with the patient. | Yes — full edit |
| `signed` | Encounter finalized. Doctor has signed off. | No — immutable |
| `amended` | Signed, with one or more `ConsultationAmendment` records attached. | No — amendments only |

**State transitions:**

- `open` → `signed`: Doctor taps **"Firmar y cerrar"**. All open `ProtocolUsage` records are marked `completed`. All queued orders are signed and PDFs generated.
- `signed` → `amended`: Doctor creates a `ConsultationAmendment`. The original signed record is untouched; the amendment is a separate record pointing to it.
- No re-opening. A signed consultation cannot return to `open`.

> The previous `draft` state is removed. Consultations are `open` from the moment they are created.

---

## 4. Inside an Open Consultation

### 4.1 Layout

The consultation view has three zones:

**Header bar (always visible)**
- Patient name, age, and active allergy/condition alerts (never hidden, regardless of protocol state)
- Location name
- Consultation status indicator + autosave state
- **"Firmar y cerrar"** button (primary action)

**Main panel (scrollable)**
- Active protocol block content (vitals, notes, checklists, steps, decisions, dosage tables, lab/imaging orders)
- If no protocol is active: a single **"Agregar protocolo"** call-to-action. Protocols are the only content-entry surface — there is no SOAP form and no free-form fallback.

**Right rail (always visible)**
- **"+ Agregar protocolo"** button — opens protocol picker at any time
- Orders queue (Prescriptions / Labs / Imaging tabs)
- Previous consultations list for this patient (last 5, link to full history)

### 4.2 Adding a Protocol

At any point during an open consultation, the doctor taps **"+ Agregar protocolo"**:

1. Protocol picker opens (search + category filter).
2. Doctor selects a protocol from their library.
3. System creates a `ProtocolUsage` record — a full snapshot of the current protocol version stored in `content` JSONB.
4. Protocol blocks render inline in the main panel.
5. Multiple protocols can be active simultaneously — each gets its own `ProtocolUsage`. They stack in the main panel with clear section headers.

### 4.3 Interacting with Protocol Blocks

| Block type | Doctor action | Result |
|---|---|---|
| `vitals` | Fills in the fields configured by the template | Values stored in ProtocolUsage snapshot |
| `clinical_notes` | Types free-form text | Stored in ProtocolUsage snapshot |
| `checklist` | Taps items to check them off | State stored in ProtocolUsage snapshot |
| `steps` | Taps **Completado** or **Omitido** per step | State + timestamp stored; step locks after interaction |
| `decision` | Selects a branch | Branch selection stored; linked protocol auto-launches if configured |
| `dosage_table` | Taps a row → **"Agregar a receta"** | Medication added to prescription queue |
| `lab_order` | Taps a test → **"Agregar a laboratorio"** | Test added to lab order queue |
| `imaging_order` | Taps a study → **"Agregar a imagen"** | Study added to imaging order queue |
| `alert` | Read-only callout | No interaction needed |
| `text` | Read-only reference text | No interaction needed |
| `section` | Collapsible container | Toggle open/closed |

### 4.4 No Protocol Mode

There is no "no protocol" documentation mode. Clinical content lives only inside a
`ProtocolUsage` (Design Principle #4), so documenting requires adding a protocol.

- A consultation opens with no protocol attached — patient context is immediately visible
  and no protocol selection is forced (Design Principle #2, "No mandatory gate").
- To document anything, the doctor adds a protocol via **"Agregar protocolo"**. If they
  want unstructured notes, they add a protocol whose template contains a `clinical_notes`
  block (e.g. a general-notes protocol from their library).
- A consultation cannot be signed while it has zero `ProtocolUsage` records (see §5).
- There is no "Nota libre" quick-action and no automatic system-template usage.

> **Why no free-form fallback?** A silent free-text surface that bypasses protocols
> fragments the clinical record and (in the prior implementation) did not persist at all.
> Forcing a protocol keeps every encounter's documentation structured and storable.

### 4.5 Allergy and Condition Alerts

Patient allergy and chronic condition flags appear in the header bar for the entire duration of the open consultation. They are never collapsed or hidden behind a protocol view. This is a hard UI requirement — not a preference.

### 4.6 Autosave

The consultation autosaves every 30 seconds and on every meaningful interaction (step completed, medication queued, etc.). The header bar shows autosave state:

| State | Display |
|---|---|
| All saved | `Guardado · hace 12s` |
| Saving | `Guardando…` |
| Error | `Error al guardar · Reintentar` |
| Offline | `Sin conexión · Borrador local` |

---

## 5. Signing a Consultation

When the doctor taps **"Firmar y cerrar"**:

1. System validates that at least one `ProtocolUsage` exists. A consultation with zero protocols cannot be signed — the API rejects it with `CONSULTATION_REQUIRES_PROTOCOL`, and the **"Firmar y cerrar"** button is disabled in the UI until a protocol is added.
2. All in-progress `ProtocolUsage` records are marked `completed`.
3. All queued orders are finalized:
   - Status changes from `queued` → `signed`
   - PDFs are generated for each order group
4. `Consultation.status` → `signed`
5. `Consultation.signed_at` = now()
6. Doctor is redirected to a summary view showing all generated PDFs, with print / share / download options.

---

## 6. Amendments

If an error is found in a signed consultation:

1. Doctor opens the signed consultation (read-only view).
2. Taps **"Agregar enmienda"**.
3. A `ConsultationAmendment` record is created with:
   - `consultation_id` pointing to the original
   - `amended_by` (user_id)
   - `reason` (required text)
   - `amendment_content` (JSONB — structured correction)
4. Original `Consultation` record is never touched.
5. Consultation status moves to `amended`.

---

## 7. Consultation DB Entity

```prisma
model Consultation {
  id              String    @id @default(uuid()) @db.Uuid
  tenant_id       String    @db.Uuid
  patient_id      String    @db.Uuid
  doctor_id       String    @db.Uuid       // references User
  location_id     String    @db.Uuid
  appointment_id  String?   @db.Uuid       // null = walk-in / ER

  status          String    @default("open")   // open | signed | amended
  started_at      DateTime  @default(now())
  signed_at       DateTime?

  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?

  // Relations
  tenant          Tenant         @relation(...)
  patient         Patient        @relation(...)
  doctor          User           @relation(...)
  location        Location       @relation(...)
  appointment     Appointment?   @relation(...)
  protocol_usages ProtocolUsage[]
  prescriptions   Prescription[]
  lab_orders      LabOrder[]
  imaging_orders  ImagingOrder[]
  amendments      ConsultationAmendment[]

  @@index([tenant_id, deleted_at])
  @@index([patient_id])
  @@index([doctor_id])
  @@index([appointment_id])
  @@index([status])
  @@index([started_at])
}
```

**Removed from previous schema:**
- `chief_complaint` — now a `clinical_notes` block in ProtocolUsage
- `subjective` — now a `clinical_notes` block in ProtocolUsage
- `objective` — now a `clinical_notes` block in ProtocolUsage
- `assessment` — now a `clinical_notes` block in ProtocolUsage
- `plan` — now a `clinical_notes` block in ProtocolUsage
- `diagnoses` — now a `clinical_notes` block or decision block in ProtocolUsage
- `vitals` — now a `vitals` block in ProtocolUsage
- `protocols_applied String[]` — replaced by the `protocol_usages` relation

---

## 8. API Endpoints

### Consultation CRUD

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/consultations` | Create consultation (planned or walk-in) |
| `GET` | `/v1/consultations/:id` | Get consultation with usages and orders |
| `GET` | `/v1/consultations` | List consultations for tenant (filterable by patient, status, date) |
| `PATCH` | `/v1/consultations/:id/sign` | Sign the consultation |
| `POST` | `/v1/consultations/:id/amendments` | Add amendment to signed consultation |

### Protocol Usage (inside consultation)

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/consultations/:id/protocols` | Launch a protocol (creates ProtocolUsage snapshot) |
| `PATCH` | `/v1/consultations/:id/protocols/:usageId` | Update usage (block interactions, modifications) |
| `DELETE` | `/v1/consultations/:id/protocols/:usageId` | Abandon a usage (soft-delete, status = abandoned) |

### `POST /v1/consultations` request body

```typescript
{
  patient_id: string        // required
  location_id: string       // required
  appointment_id?: string   // optional — omit for walk-in
}
```

---

## 9. Consultation Summary View (post-signing)

After signing, the doctor sees a summary screen with:

- Patient name + consultation date
- All `ProtocolUsage` records (protocol name, steps completed, steps skipped)
- All generated order PDFs grouped by type:
  - Prescription group PDFs (Receta 1, Receta 2, …)
  - Lab order group PDFs
  - Imaging order group PDFs
- Actions per PDF: **Imprimir**, **Descargar**, **Enviar** (WhatsApp / email — v2)
- **"Volver a agenda"** button

---

## 10. Success Criteria

- [ ] Doctor can start a consultation from an appointment in under 3 taps
- [ ] Doctor can start a walk-in consultation (no appointment) in under 3 taps
- [ ] Doctor can create a minimal patient record during walk-in without leaving the consultation creation flow
- [ ] Protocol can be added to a consultation at any point while it is `open`
- [ ] Multiple protocols can be active simultaneously in one consultation
- [ ] Allergy alerts are always visible in the header — never hidden
- [ ] Autosave state is always visible in the header
- [ ] Signing generates PDFs for all queued order groups in one action
- [ ] Signed consultation is fully read-only; amendment flow is the only correction path
- [ ] Walk-in consultation (`appointment_id = null`) follows identical workflow to planned consultation
