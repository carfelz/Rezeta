# Orders & Document Generation

> Part of the Rezeta updated specs. See `00-overview.md` for context.

## 1. Overview

Three order types are supported: **Prescriptions** (recetas médicas), **Lab Orders** (órdenes de laboratorio), and **Imaging Orders** (órdenes de imagen). All three share the same structural pattern:

- Orders accumulate in a **per-consultation queue** throughout the encounter
- Each order type supports **multiple named groups** — each group generates a separate signed PDF
- Orders can be sourced from **protocol blocks** (one-tap from dosage_table / lab_order / imaging_order blocks) or **added manually**
- When the consultation is signed, all queued orders are finalized and their PDFs generated atomically

---

## 2. Why Multiple Groups

Dominican Republic medical practice and insurance (ARS) systems require separate physical documents for different order categories. Rezeta reflects this by supporting named groups per order type:

| Order type | Typical group split |
|---|---|
| Prescriptions | Receta 1 (ARS-covered meds) / Receta 2 (out-of-pocket) / Receta 3 (controlled substances) |
| Lab orders | By lab provider (Referencia, Amadita, in-house) or by urgency (STAT, routine) |
| Imaging orders | By urgency (urgente/hoy, electivo) or by ARS pre-authorization requirement |

Each group has a **title** (visible on the PDF header) and an **order index** (controls print order). Doctors can rename groups and move items between groups before signing.

---

## 3. Order Sources

### 3.1 From Protocol Blocks

During an open consultation, protocol blocks that contain orderable items are tappable:

| Block type | Tap action | Destination |
|---|---|---|
| `dosage_table` row | "Agregar a receta" | Prescription queue (default group or doctor-selected) |
| `lab_order` row | "Agregar a laboratorio" | Lab order queue |
| `imaging_order` row | "Agregar a imagen" | Imaging order queue |

- A row can only be added once per consultation (tapping an already-queued item highlights it in the queue instead of duplicating)
- Source is tracked on the order item: `source = "protocol:{usage_id}:{block_id}:{row_id}"`

### 3.2 Manual Entry

From the orders panel (always visible in the right rail), the doctor taps **"+ Agregar"** in any tab:

- **Prescription**: Drug name, dose, route, frequency, duration, notes (free text)
- **Lab order**: Test name, indication, urgency, fasting required, sample type, special instructions
- **Imaging order**: Study type, indication, urgency, contrast required, fasting required, special instructions

Manual items carry `source = "manual"`.

### 3.3 From Multiple Protocols

Multiple protocols can be active in one consultation. Orders from all active `ProtocolUsage` records accumulate in the same queue. The doctor manages the unified queue from the right rail regardless of which protocol each item came from.

---

## 4. Orders Panel UX

The orders panel lives in the consultation's right rail. It is always visible during an open consultation.

**Three tabs:** Recetas | Laboratorio | Imágenes

Within each tab:
- Items are organized into groups
- Groups can be renamed and reordered
- Items can be moved between groups via drag or a move action
- Items can be removed (only while consultation is open)
- **"+ Nuevo grupo"** button adds a named group
- **"Generar PDF"** button per group (prints a preview before signing)
- **"Generar todos"** button generates all PDFs in the tab at once

---

## 5. Entities

### 5.1 Prescription

```prisma
model Prescription {
  id              String    @id @default(uuid()) @db.Uuid
  tenant_id       String    @db.Uuid
  consultation_id String    @db.Uuid
  patient_id      String    @db.Uuid
  group_title     String?               // e.g. "Cobertura ARS", "Bolsillo"
  group_order     Int       @default(1)
  status          String    @default("queued")  // queued | signed
  signed_at       DateTime?
  pdf_url         String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?

  tenant       Tenant             @relation(...)
  consultation Consultation       @relation(...)
  patient      Patient            @relation(...)
  items        PrescriptionItem[]

  @@index([consultation_id, group_order])
  @@index([patient_id])
  @@index([tenant_id])
}

model PrescriptionItem {
  id              String  @id @default(uuid()) @db.Uuid
  prescription_id String  @db.Uuid
  drug            String
  dose            String
  route           String
  frequency       String
  duration        String
  notes           String?
  source          String? // "protocol:{usageId}:{blockId}:{rowId}" | "manual"
  created_at      DateTime @default(now())

  prescription Prescription @relation(...)

  @@index([prescription_id])
}
```

### 5.2 LabOrder

```prisma
model LabOrder {
  id              String    @id @default(uuid()) @db.Uuid
  tenant_id       String    @db.Uuid
  consultation_id String    @db.Uuid
  patient_id      String    @db.Uuid
  group_title     String?
  group_order     Int       @default(1)
  status          String    @default("queued")  // queued | signed
  signed_at       DateTime?
  pdf_url         String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?

  tenant       Tenant         @relation(...)
  consultation Consultation   @relation(...)
  patient      Patient        @relation(...)
  items        LabOrderItem[]

  @@index([consultation_id, group_order])
  @@index([patient_id])
  @@index([tenant_id])
}

model LabOrderItem {
  id                   String  @id @default(uuid()) @db.Uuid
  lab_order_id         String  @db.Uuid
  test_name            String
  indication           String
  urgency              String  @default("routine")  // routine | urgent | stat
  fasting_required     Boolean @default(false)
  sample_type          String  @default("blood")   // blood | urine | stool | csf | other
  special_instructions String?
  source               String?
  created_at           DateTime @default(now())

  lab_order LabOrder @relation(...)

  @@index([lab_order_id])
}
```

### 5.3 ImagingOrder

```prisma
model ImagingOrder {
  id              String    @id @default(uuid()) @db.Uuid
  tenant_id       String    @db.Uuid
  consultation_id String    @db.Uuid
  patient_id      String    @db.Uuid
  group_title     String?
  group_order     Int       @default(1)
  status          String    @default("queued")  // queued | signed
  signed_at       DateTime?
  pdf_url         String?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  deleted_at      DateTime?

  tenant       Tenant            @relation(...)
  consultation Consultation      @relation(...)
  patient      Patient           @relation(...)
  items        ImagingOrderItem[]

  @@index([consultation_id, group_order])
  @@index([patient_id])
  @@index([tenant_id])
}

model ImagingOrderItem {
  id                   String  @id @default(uuid()) @db.Uuid
  imaging_order_id     String  @db.Uuid
  study_type           String
  indication           String
  urgency              String  @default("routine")  // routine | urgent | stat
  contrast             Boolean @default(false)
  fasting_required     Boolean @default(false)
  special_instructions String?
  source               String?
  created_at           DateTime @default(now())

  imaging_order ImagingOrder @relation(...)

  @@index([imaging_order_id])
}
```

---

## 6. Order Lifecycle

```
queued ──(consultation signed)──→ signed ──→ printed / sent
  |
  └──(doctor removes before signing)──→ [deleted from queue]
```

| State | Description | Modifiable? |
|---|---|---|
| `queued` | In the orders panel, consultation is open | Yes — edit, move group, remove |
| `signed` | Consultation signed, PDF generated | No — use ConsultationAmendment for corrections |
| `printed` | Doctor confirmed print action (tracked) | Informational only |

---

## 7. PDF Generation

### 7.1 Trigger

PDFs are generated when the consultation is signed. The signing action (`PATCH /v1/consultations/:id/sign`) triggers atomic generation of all queued order PDFs.

Pre-signing preview: doctor can request a draft PDF per group at any time during the open consultation via `POST /v1/consultations/:id/orders/preview`. This generates a watermarked draft for review.

### 7.2 PDF Anatomy

Every generated document (regardless of type) includes:

**Header — Doctor + Location**
- Doctor full name and specialty
- Exequátur (license number) — from `User` profile
- Location name, address, phone number — from `Location` record
- Practice logo (optional — from `User` or `Tenant` settings)

**Patient block**
- Patient full name and age
- Document number (cédula / passport / RNC) — from `Patient` record
- Date of consultation

**Body — Order items**
- Group title (e.g. "Cobertura ARS", "Urgente")
- Numbered items with all relevant fields
- Special instructions per item where applicable

**Footer**
- Signature line + stamp area
- Page X of Y (for multi-page documents)

### 7.3 Prescription PDF specifics

- Each `PrescriptionItem` listed with: drug name, dose, route, frequency, duration, notes
- Numbered (1. Amlodipino 10mg…)
- Group title printed above item list
- Font: readable at A5 / half-letter (standard DR prescription pad size)

### 7.4 Lab Order PDF specifics

- Each `LabOrderItem` listed with: test name, sample type, fasting requirement, urgency, special instructions
- Urgency highlighted visually for STAT orders
- Standard DR lab order format

### 7.5 Imaging Order PDF specifics

- Each `ImagingOrderItem` listed with: study type, indication, urgency, contrast required, fasting requirement, special instructions
- Clinical indication is required (ARS pre-auth requirement)

### 7.6 Storage

Generated PDFs are stored in Google Cloud Storage (GCS) under the tenant's path. The `pdf_url` field on each order group record holds the GCS URL. URLs are signed (time-limited) when served to the frontend.

---

## 8. API Endpoints

### Order Management (during open consultation)

| Method | Path | Description |
|---|---|---|
| `GET` | `/v1/consultations/:id/orders` | Get all queued orders (all types) |
| `POST` | `/v1/consultations/:id/prescriptions` | Create prescription group |
| `PATCH` | `/v1/consultations/:id/prescriptions/:prescId` | Update group (title, items) |
| `DELETE` | `/v1/consultations/:id/prescriptions/:prescId` | Remove prescription group |
| `POST` | `/v1/consultations/:id/lab-orders` | Create lab order group |
| `PATCH` | `/v1/consultations/:id/lab-orders/:orderId` | Update lab order group |
| `DELETE` | `/v1/consultations/:id/lab-orders/:orderId` | Remove lab order group |
| `POST` | `/v1/consultations/:id/imaging-orders` | Create imaging order group |
| `PATCH` | `/v1/consultations/:id/imaging-orders/:orderId` | Update imaging order group |
| `DELETE` | `/v1/consultations/:id/imaging-orders/:orderId` | Remove imaging order group |

### PDF Generation

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/consultations/:id/orders/preview` | Generate draft (watermarked) PDFs for review |
| `POST` | `/v1/consultations/:id/orders/generate-all` | Generate all signed PDFs (called by sign action) |

### `POST /v1/consultations/:id/prescriptions` request body

```typescript
{
  group_title?: string       // e.g. "Cobertura ARS"
  group_order: number        // 1-based, controls print order
  items: [
    {
      drug: string
      dose: string
      route: string
      frequency: string
      duration: string
      notes?: string
      source?: string       // "protocol:{usageId}:{blockId}:{rowId}" | "manual"
    }
  ]
}
```

---

## 9. Consultation Summary View (post-signing)

After signing, the doctor sees a summary screen listing all generated PDFs grouped by type. Available actions per PDF:

- **Imprimir** — opens browser print dialog
- **Descargar** — downloads the PDF
- **Enviar por WhatsApp** — (v2) sends via WhatsApp Business API
- **Enviar por correo** — (v2) sends via email

The summary also shows:
- Which protocols were used (protocol title + version + steps completed / skipped)
- Patient demographics recap
- Next appointment link (if follow-up scheduled)

---

## 10. Success Criteria

- [ ] Doctor can add a medication from a dosage_table block to the prescription queue in one tap
- [ ] Doctor can create multiple prescription groups and move items between them
- [ ] Each prescription group generates its own PDF with correct doctor + location header
- [ ] Doctor can preview a draft PDF before signing
- [ ] Signing generates all order PDFs atomically — no partial generation
- [ ] Manual order entry is always available regardless of protocol state
- [ ] Duplicate prevention: tapping an already-queued item highlights it rather than adding a duplicate
- [ ] All generated PDFs are accessible from the post-signing summary screen
- [ ] PDFs include correct patient document number (cédula / passport) pulled from patient record
- [ ] Source tracking (`source` field) records whether each item came from a protocol block or manual entry
