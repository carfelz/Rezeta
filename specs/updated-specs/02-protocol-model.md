# Protocol Model

> Part of the Rezeta updated specs. See `00-overview.md` for context.
> This spec replaces `protocol-template-schema.md` and `protocol-engine-slices.md`.

## 1. Design Principles

1. **Templates are scaffolds, not contracts.** A template defines a suggested starting structure for a protocol. Once a protocol is created from it, the template's job is done. Templates can be freely edited at any time — edits never affect existing protocols.
2. **Categories are organization, not structure.** `ProtocolCategory` is a name and a color. It carries no structural meaning, no template linkage, and no lock rules.
3. **Snapshots guarantee clinical integrity.** `ProtocolUsage.content` captures the exact protocol version used in a consultation. Historical records are always accurate regardless of subsequent protocol edits.
4. **No lock rules.** The cascade locks of the previous model (template locked when any Type references it, Type locked when any Protocol references it) are removed. The ProtocolUsage snapshot is the integrity mechanism.
5. **Protocols belong to doctors, not to categories.** A doctor's full protocol library is always accessible regardless of category. Category is a filter lens, not a container.

---

## 2. The Two-Layer Model

```
ProtocolTemplate  —  scaffold blueprint (structure + placeholder hints)
        |
        | used at creation time only (informational link thereafter)
        ↓
Protocol          —  the actual clinical content (via ProtocolVersion)
        |
        | optional organizational tag
        ↓
ProtocolCategory  —  name + color only (filter / folder)
```

### What Each Layer Is

**`ProtocolTemplate`** — A reusable block structure that guides protocol authoring. When a doctor creates a new protocol, they pick a template and the template's block structure is copied into the initial `ProtocolVersion.content` as a starting point. After creation, the template is informational only — editing the template does not change existing protocols.

**`Protocol`** — The doctor's actual clinical content. It belongs to one doctor (owner), lives in a tenant, and optionally carries a category tag and a template reference. Its content lives in immutable `ProtocolVersion` snapshots — every save creates a new version.

**`ProtocolCategory`** — A lightweight organizational tag. Name + color. A protocol can belong to zero or one category. Deleting a category sets `Protocol.category_id = null` on all referencing protocols — no cascade, no data loss.

---

## 3. Entities

### 3.1 ProtocolTemplate

```prisma
model ProtocolTemplate {
  id           String    @id @default(uuid()) @db.Uuid
  tenant_id    String    @db.Uuid
  name         String
  description  String?
  specialty    String?   // informational tag, not enforced
  schema       Json      @db.JsonB  // block structure with placeholder hints
  is_seeded    Boolean   @default(false)
  created_at   DateTime  @default(now())
  updated_at   DateTime  @updatedAt
  deleted_at   DateTime?

  tenant       Tenant      @relation(...)
  protocols    Protocol[]  // informational back-reference

  @@index([tenant_id, deleted_at])
}
```

**Key rules:**
- Always editable. No lock conditions.
- Soft delete only.
- Editing a template does not modify any existing `Protocol` or `ProtocolVersion`.
- `schema` is JSONB — same block structure as `ProtocolVersion.content` but with `placeholder` and `required` hints on blocks.

### 3.2 ProtocolCategory

```prisma
model ProtocolCategory {
  id         String    @id @default(uuid()) @db.Uuid
  tenant_id  String    @db.Uuid
  name       String
  color      String    @default("#6B7280")  // hex color for UI chip
  is_seeded  Boolean   @default(false)
  created_at DateTime  @default(now())
  updated_at DateTime  @updatedAt
  deleted_at DateTime?

  tenant     Tenant     @relation(...)
  protocols  Protocol[]

  @@unique([tenant_id, name])   // unique name per tenant (excluding soft-deleted)
  @@index([tenant_id, deleted_at])
}
```

**Key rules:**
- Freely create, rename, delete at any time.
- Deleting a category: sets `Protocol.category_id = null` on all referencing protocols (no cascade delete of protocols).
- `(tenant_id, name)` unique constraint — two categories with the same name in the same tenant are rejected.

### 3.3 Protocol

```prisma
model Protocol {
  id                 String    @id @default(uuid()) @db.Uuid
  tenant_id          String    @db.Uuid
  owner_user_id      String    @db.Uuid
  title              String
  description        String?
  template_id        String?   @db.Uuid  // informational only — which template was used to create this
  category_id        String?   @db.Uuid  // nullable — optional organizational tag
  status             String    @default("draft")  // draft | active | archived
  is_favorite        Boolean   @default(false)
  current_version_id String?   @db.Uuid
  created_at         DateTime  @default(now())
  updated_at         DateTime  @updatedAt
  deleted_at         DateTime?

  tenant          Tenant            @relation(...)
  owner           User              @relation(...)
  template        ProtocolTemplate? @relation(...)
  category        ProtocolCategory? @relation(...)
  versions        ProtocolVersion[]
  current_version ProtocolVersion?  @relation("CurrentVersion", ...)
  usages          ProtocolUsage[]

  @@index([tenant_id, deleted_at])
  @@index([owner_user_id, deleted_at])
  @@index([category_id])
  @@index([status])
}
```

**Key rules:**
- `template_id` is informational — records which template was used at creation. Not enforced, not locked.
- `category_id` is nullable — a protocol with no category is valid.
- `status` transitions: `draft` → `active` → `archived`. A doctor must actively publish a protocol to make it available for use in consultations (only `active` protocols appear in the consultation protocol picker).
- Soft delete only.

### 3.4 ProtocolVersion

```prisma
model ProtocolVersion {
  id             String   @id @default(uuid()) @db.Uuid
  protocol_id    String   @db.Uuid
  tenant_id      String   @db.Uuid
  version_number Int
  content        Json     @db.JsonB  // full block content — immutable after creation
  change_summary String?
  created_by     String   @db.Uuid
  created_at     DateTime @default(now())

  protocol               Protocol        @relation(...)
  tenant                 Tenant          @relation(...)
  creator                User            @relation(...)
  current_for_protocols  Protocol[]      @relation("CurrentVersion")
  usages                 ProtocolUsage[]

  @@unique([protocol_id, version_number])
  @@index([protocol_id])
  @@index([tenant_id])
}
```

**Key rules:**
- `content` is **immutable after creation**. No PATCH or UPDATE on this column ever.
- Every time a doctor saves edits to a protocol, a new `ProtocolVersion` row is created. The previous version row is preserved forever.
- `Protocol.current_version_id` points to the latest version.

### 3.5 ProtocolUsage

```prisma
model ProtocolUsage {
  id                   String    @id @default(uuid()) @db.Uuid
  tenant_id            String    @db.Uuid
  consultation_id      String    @db.Uuid
  protocol_id          String    @db.Uuid
  protocol_version_id  String    @db.Uuid

  // Working copy — full snapshot of protocol content at time of launch
  content              Json      @db.JsonB

  // Structured event log of all doctor interactions
  modifications        Json      @db.JsonB @default("{}")

  // Optional protocol chain support (decision branch → linked protocol)
  parent_usage_id      String?   @db.Uuid
  trigger_block_id     String?
  depth                Int       @default(0)

  status               String    @default("in_progress")  // in_progress | completed | abandoned
  started_at           DateTime  @default(now())
  completed_at         DateTime?

  created_at           DateTime  @default(now())
  updated_at           DateTime  @updatedAt
  deleted_at           DateTime?

  tenant           Tenant          @relation(...)
  consultation     Consultation    @relation(...)
  protocol         Protocol        @relation(...)
  protocol_version ProtocolVersion @relation(...)
  parent_usage     ProtocolUsage?  @relation("ProtocolChain", ...)
  child_usages     ProtocolUsage[] @relation("ProtocolChain")

  @@index([tenant_id, deleted_at])
  @@index([consultation_id])
  @@index([protocol_id])
  @@index([parent_usage_id])
  @@index([status])
}
```

**Key rules:**
- `content` is a **full snapshot** of `ProtocolVersion.content` at the moment the protocol is launched into the consultation. It is never modified by changes to the protocol or template after that point.
- `content` becomes **immutable** when the consultation is signed (`Consultation.status = signed`).
- `modifications` is an append-only event log recording every doctor interaction (step completed, vitals entered, medication queued, etc.).
- `protocol_version_id` records exactly which version was active at launch — provides a permanent link to the exact protocol state used.

---

## 4. Data Integrity Without Locks

The ProtocolUsage snapshot model is the integrity mechanism. No additional lock rules are needed.

| Scenario | What happens | Clinical record safe? |
|---|---|---|
| Doctor edits protocol after using it in consultation | ProtocolUsage already has its own snapshot — untouched | ✅ Yes |
| Doctor deletes a protocol | ProtocolUsage records persist (soft delete only). UI shows "[Protocolo eliminado]" as label — full clinical content in snapshot | ✅ Yes |
| Doctor deletes a category | `Protocol.category_id` set to null — protocol and all usages unaffected | ✅ Yes |
| Doctor edits a template | Existing protocols unaffected — template link is informational. Future protocol creation uses new template | ✅ Yes |
| Protocol open in two consultation tabs simultaneously | Each consultation creates its own ProtocolUsage snapshot on launch | ✅ Yes |

---

## 5. Block Type Catalog

All block types are shared between templates (where blocks carry `required` and `placeholder` hints) and protocol content (where blocks carry actual doctor-authored content).

### 5.1 `section` — Container

Groups related blocks under a collapsible heading.

```json
{
  "id": "sec_01",
  "type": "section",
  "title": "Signos vitales",
  "collapsed_by_default": false,
  "blocks": [ ]
}
```

### 5.2 `vitals` — Structured vitals capture ⭐ NEW

Template author selects which vital fields to include. Only the configured fields appear during consultation. Supports custom fields for specialty-specific measurements.

```json
{
  "id": "blk_vitals_01",
  "type": "vitals",
  "title": "Signos vitales",
  "fields": [
    { "id": "bp",     "label": "Presión arterial",      "unit": "mmHg",   "input_type": "text"   },
    { "id": "hr",     "label": "Frecuencia cardíaca",   "unit": "lpm",    "input_type": "number" },
    { "id": "rr",     "label": "Frecuencia respiratoria","unit": "rpm",   "input_type": "number" },
    { "id": "temp",   "label": "Temperatura",           "unit": "°C",     "input_type": "number" },
    { "id": "o2sat",  "label": "SatO₂",                 "unit": "%",      "input_type": "number" },
    { "id": "weight", "label": "Peso",                  "unit": "kg",     "input_type": "number" },
    { "id": "height", "label": "Talla",                 "unit": "cm",     "input_type": "number" },
    { "id": "bmi",    "label": "IMC",                   "unit": "kg/m²",  "input_type": "computed", "formula": "weight/(height/100)^2" },
    { "id": "glucose","label": "Glucemia",              "unit": "mg/dL",  "input_type": "number" }
  ]
}
```

**Available field IDs (predefined):** `bp`, `hr`, `rr`, `temp`, `o2sat`, `weight`, `height`, `bmi`, `glucose`, `waist`, `hip`, `head_circumference`, `muac`.

**Custom fields:** Template author can add fields with any `id`, `label`, `unit`, and `input_type: "text" | "number"`.

**`computed` fields:** `bmi` is auto-calculated from `weight` and `height` values. Formula defined in the field definition.

**Content when filled (inside ProtocolUsage):**
```json
{
  "id": "blk_vitals_01",
  "type": "vitals",
  "values": {
    "bp": "140/90",
    "hr": "78",
    "weight": "72.4",
    "bmi": "25.1"
  }
}
```

### 5.3 `clinical_notes` — Labeled free-form note ⭐ NEW

Replaces all fixed SOAP fields (`chief_complaint`, `subjective`, `objective`, `assessment`, `plan`, `diagnoses`). Template author sets the label and whether the block is required. Multiple `clinical_notes` blocks per protocol are allowed.

```json
{
  "id": "blk_notes_01",
  "type": "clinical_notes",
  "label": "Motivo de consulta",
  "placeholder": "¿Cuál es la razón principal de la visita?",
  "required": true,
  "content": ""
}
```

**Content when filled:**
```json
{
  "id": "blk_notes_01",
  "type": "clinical_notes",
  "label": "Motivo de consulta",
  "content": "Paciente refiere cefalea occipital de 3 días de evolución, 7/10 en escala de dolor."
}
```

**Common labels by specialty (examples — not enforced):**

| Specialty | Note blocks |
|---|---|
| General / Internist (SOAP) | Motivo de consulta, Subjetivo, Objetivo, Evaluación, Plan |
| Physiotherapy | Motivo de sesión, Hallazgos funcionales, Técnicas aplicadas, Evolución |
| Emergency | Situación, Antecedentes relevantes, Intervención, Respuesta, Disposición |
| Pediatrics | Motivo, Desarrollo, Hallazgos, Impresión diagnóstica, Plan |
| First visit | Historia clínica, Antecedentes patológicos, Antecedentes familiares, Examen físico, Impresión |

### 5.4 `text` — Reference text (read-only during consultation)

Static informational content for the doctor's reference. Not editable during consultation use.

```json
{
  "id": "blk_text_01",
  "type": "text",
  "content": "Administrar epinefrina en los primeros 5 minutos para mejores resultados."
}
```

### 5.5 `checklist` — Unordered verification items

```json
{
  "id": "blk_ck_01",
  "type": "checklist",
  "title": "Verificación previa",
  "items": [
    { "id": "itm_01", "text": "Confirmar identidad del paciente", "critical": true },
    { "id": "itm_02", "text": "Verificar alergias", "critical": true },
    { "id": "itm_03", "text": "Revisar medicamentos actuales", "critical": false }
  ]
}
```

### 5.6 `steps` — Numbered sequential actions

Steps have **Completado / Omitido** buttons during consultation. State locks after interaction.

```json
{
  "id": "blk_steps_01",
  "type": "steps",
  "title": "Manejo de la vía aérea",
  "steps": [
    { "id": "stp_01", "order": 1, "title": "Posicionar al paciente", "detail": "Decúbito supino, cabeza en extensión" },
    { "id": "stp_02", "order": 2, "title": "Evaluar respiración", "detail": "Mirar, escuchar, sentir por 10 segundos" }
  ]
}
```

### 5.7 `decision` — Branching logic

Displays a condition with N mutually exclusive branches. A branch can optionally link to another protocol, which launches as a child `ProtocolUsage`.

```json
{
  "id": "blk_dec_01",
  "type": "decision",
  "condition": "¿PA sistólica < 90 mmHg?",
  "branches": [
    {
      "id": "brn_yes",
      "label": "Sí",
      "action": "Iniciar resucitación con 500mL SSN en bolo. Reevaluar en 10 min.",
      "linked_protocol_id": null
    },
    {
      "id": "brn_no",
      "label": "No",
      "action": "Continuar monitoreo. Repetir PA cada 15 min."
    }
  ]
}
```

### 5.8 `dosage_table` — Structured medication data

Rows are tappable during consultation. Tapping a row adds the medication to the prescription queue.

```json
{
  "id": "blk_meds_01",
  "type": "dosage_table",
  "title": "Medicamentos de primera línea",
  "columns": ["drug", "dose", "route", "frequency", "notes"],
  "rows": [
    {
      "id": "row_01",
      "drug": "Adrenalina",
      "dose": "0.3 mg IM (0.3 mL 1:1000)",
      "route": "IM muslo lateral",
      "frequency": "Cada 5-15 min PRN",
      "notes": "Máx. 3 dosis"
    }
  ]
}
```

### 5.9 `lab_order` — Laboratory test order

Rows are tappable during consultation. Tapping adds the test to the lab order queue.

```json
{
  "id": "blk_lab_01",
  "type": "lab_order",
  "title": "Estudios de laboratorio",
  "orders": [
    {
      "id": "labo_01",
      "test_name": "Hemograma completo",
      "indication": "Descartar anemia",
      "urgency": "routine",
      "fasting_required": false,
      "sample_type": "blood",
      "special_instructions": ""
    }
  ]
}
```

`urgency` values: `routine` | `urgent` | `stat`

### 5.10 `imaging_order` — Imaging study order

Rows are tappable during consultation. Tapping adds the study to the imaging queue.

```json
{
  "id": "blk_img_01",
  "type": "imaging_order",
  "title": "Estudios de imagen",
  "orders": [
    {
      "id": "imgo_01",
      "study_type": "Rx Tórax PA y Lateral",
      "indication": "Evaluar cardiomegalia",
      "urgency": "routine",
      "contrast": false,
      "fasting_required": false,
      "special_instructions": "Placa en inspiración completa"
    }
  ]
}
```

### 5.11 `alert` — Warning or critical callout

Read-only emphasis block. Rendered prominently during consultation.

```json
{
  "id": "blk_alert_01",
  "type": "alert",
  "severity": "danger",
  "title": "Contraindicación absoluta",
  "content": "No administrar si el paciente tiene hipersensibilidad conocida a beta-agonistas."
}
```

`severity` values: `info` | `warning` | `danger` | `success`

---

## 6. Complete Block Catalog Reference

| Block type | Used in templates | Used in protocols | Interactive in consultation |
|---|---|---|---|
| `section` | ✅ | ✅ | Collapse/expand |
| `vitals` ⭐ | ✅ | ✅ | Fill in fields |
| `clinical_notes` ⭐ | ✅ | ✅ | Free-form text entry |
| `checklist` | ✅ | ✅ | Tap to check items |
| `steps` | ✅ | ✅ | Completado / Omitido buttons |
| `decision` | ✅ | ✅ | Select branch |
| `dosage_table` | ✅ | ✅ | Tap row → prescription queue |
| `lab_order` | ✅ | ✅ | Tap row → lab queue |
| `imaging_order` | ✅ | ✅ | Tap row → imaging queue |
| `alert` | ✅ | ✅ | Read-only |
| `text` | ✅ | ✅ | Read-only |
| `calculator` | ❌ | ❌ | Planned for v2 |

---

## 7. Template Schema (with hints)

Templates use the same block catalog with additional fields for authoring guidance:

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "cardiology",
    "intended_use": "Seguimiento de pacientes con hipertensión arterial"
  },
  "blocks": [
    {
      "id": "sec_vitals",
      "type": "section",
      "title": "Signos vitales",
      "required": true,
      "blocks": [
        {
          "id": "blk_vitals",
          "type": "vitals",
          "required": true,
          "fields": [
            { "id": "bp",     "label": "Presión arterial",    "unit": "mmHg",  "input_type": "text"     },
            { "id": "hr",     "label": "Frecuencia cardíaca", "unit": "lpm",   "input_type": "number"   },
            { "id": "weight", "label": "Peso",                "unit": "kg",    "input_type": "number"   },
            { "id": "bmi",    "label": "IMC",                 "unit": "kg/m²", "input_type": "computed", "formula": "weight/(height/100)^2" }
          ]
        }
      ]
    },
    {
      "id": "blk_notes_motivo",
      "type": "clinical_notes",
      "label": "Motivo de consulta",
      "required": true,
      "placeholder": "¿Qué trae al paciente hoy?"
    },
    {
      "id": "blk_notes_evolucion",
      "type": "clinical_notes",
      "label": "Evolución",
      "required": false,
      "placeholder": "¿Cómo ha estado el paciente desde la última visita?"
    }
  ]
}
```

**Template-only fields (not present in protocol content):**
- `required` (boolean) — whether this block must be present in derived protocols
- `placeholder` (string) — hint shown when block is empty in the protocol editor
- `metadata` (object) — template-level descriptive data

---

## 8. Seeded Templates and Categories

### Seeded Categories (5, created on tenant signup)

| Name | Color | Intended use |
|---|---|---|
| Emergencias | `#EF4444` | Acute, time-sensitive protocols |
| Diagnóstico | `#3B82F6` | Diagnostic workup algorithms |
| Medicación | `#22C55E` | Drug reference and dosing protocols |
| Procedimiento | `#F59E0B` | Clinical procedures and interventions |
| Rehabilitación | `#A855F7` | Physiotherapy and recovery protocols |

Doctors can rename, add, or delete categories freely after signup.

### Seeded Templates (5, created on tenant signup)

| Template name | Suggested specialty | Key blocks |
|---|---|---|
| Consulta de seguimiento | General | vitals (bp, hr, weight), clinical_notes × 3 (motivo, evolución, plan) |
| Intervención de emergencia | Emergency | alert (danger), checklist (critical), steps, dosage_table, lab_order |
| Algoritmo diagnóstico | General | clinical_notes (historia), decision (branching workup), lab_order, imaging_order |
| Referencia farmacológica | General | text (indications), dosage_table, alert (contraindications) |
| Sesión de rehabilitación | Physiotherapy | clinical_notes (motivo sesión), checklist, steps, clinical_notes (evolución) |

Doctors can edit seeded templates freely after signup — no lock rules.

---

## 9. Protocol Lifecycle

### Status transitions

```
draft → active → archived
  ↑                ↓
  └── (re-activate if needed)
```

| Status | Visible in consultation picker? | Editable? |
|---|---|---|
| `draft` | No | Yes |
| `active` | Yes | Yes (each edit creates new version) |
| `archived` | No | No (must re-activate first) |

### Favorites

`Protocol.is_favorite` (boolean per protocol per owner) — favorite protocols are pinned to the top of the consultation protocol picker.

---

## 10. Protocol Search and Browse

`GET /v1/protocols` supports:

| Query param | Description |
|---|---|
| `search` | Full-text search over `title` (PostgreSQL `tsvector` + GIN index) |
| `category_id` | Filter by category |
| `status` | Filter by status (default: `active`) |
| `favorites_only` | Boolean — show only favorited protocols |
| `sort` | `updated_at_desc` (default) \| `title_asc` \| `most_used` |

---

## 11. Pattern Detection and Learning (v2)

The weekly cron pattern detection from `protocol-in-consultation-spec.md` (detecting consistent doctor modifications and suggesting protocol improvements) is preserved as a v2 feature. The data model supports it — `ProtocolUsage.modifications` accumulates the event log required for pattern analysis.
