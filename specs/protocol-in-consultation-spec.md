# Slice 2.5: Protocol-in-Consultation — Full Implementation Specification

> **Target completion:** 10-12 days
> **Prerequisites:** Auth, Patients, Locations, Appointments, Consultations modules completed
> **Delivers:** Complete protocol-in-consultation integration with medication/imaging/lab ordering, multi-prescription support, protocol chains, and learning system

## Table of Contents

1. [Overview](#1-overview)
2. [Data Model Changes](#2-data-model-changes)
3. [API Specification](#3-api-specification)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Build Sequence](#5-build-sequence)
6. [Testing Requirements](#6-testing-requirements)
7. [Done-When Criteria](#7-done-when-criteria)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Appendix: Design System Updates](#appendix-design-system-updates)

---

## 1. Overview

### What This Slice Delivers

A logged-in doctor can:

1. **Launch a protocol during consultation** — pick from their protocol library, protocol opens in side panel as a working copy
2. **Follow protocol interactively** — check steps (Completado/Omitido), select decision branches, review medication/imaging/lab order tables
3. **Edit protocol on-the-fly** — change medication doses, add/remove medications, skip steps, modify orders - all tracked
4. **Auto-populate SOAP fields** — as doctor progresses through protocol, findings flow into consultation notes
5. **Queue orders** — medications, imaging studies, and lab tests appear in unified order panel with tabs
6. **Separate prescriptions** — create multiple prescription groups (DR insurance/bureaucratic requirement)
7. **Separate imaging/lab orders** — create multiple order groups per type
8. **Launch linked protocols** — decision branches can trigger child protocols, creating clinical reasoning chains
9. **Receive weekly insights** — system detects modification patterns, auto-creates optimized variants, emails weekly summary

### Key Architectural Decisions

**Working Copy Model:**

- When protocol is launched, a complete copy is saved to `ProtocolUsage.content`
- Doctor edits THIS copy, not the original protocol
- All modifications tracked in `ProtocolUsage.modifications`
- Original protocol remains unchanged

**Order Integration:**

- Protocols with `metadata.requires_medication: true` must have ≥1 required dosage table
- Protocols with `metadata.requires_imaging: true` must have ≥1 required imaging_order block
- Protocols with `metadata.requires_labs: true` must have ≥1 required lab_order block
- All order types support multiple groups (separate PDFs for DR bureaucracy)

**Protocol Chains:**

- Decision branches can have `linked_protocol_id`
- Launching creates parent/child relationship via `parent_usage_id`
- Breadcrumb navigation shows chain: "Chest Pain → STEMI → Fibrinolysis"

**Learning System:**

- Weekly cron job analyzes modification patterns
- 90%+ consistency → auto-creates variant
- 75-89% consistency → creates suggestion (email link)
- <75% → no action (noise)

---

## 2. Data Model Changes

### 2.1 Prisma Schema Updates

**File:** `packages/db/prisma/schema.prisma`

```prisma
model ProtocolTemplate {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String?   @db.Uuid  // nullable for system templates
  template_key          String    @unique   // e.g., "emergency-intervention"

  title                 String
  description           String?
  specialty             String?
  is_system             Boolean   @default(false)

  // Schema stored as JSONB
  schema                Json      // Enhanced with metadata.requires_medication/imaging/labs

  version               String    @default("1.0")
  locale                String    @default("es")

  created_by            String?   @db.Uuid
  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?

  // Relations
  protocols             Protocol[]
  creator               User?     @relation(fields: [created_by], references: [id])
  tenant                Tenant?   @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id, deleted_at])
  @@index([template_key])
  @@index([is_system])
}

model Protocol {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String    @db.Uuid
  template_id           String?   @db.Uuid
  owner_user_id         String    @db.Uuid

  title                 String
  description           String?
  specialty             String?
  tags                  String[]  @default([])

  status                String    @default("draft")
  visibility            String    @default("private")

  current_version_id    String?   @db.Uuid

  // Metadata for auto-generated variants
  metadata              Json?     @db.JsonB

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?

  // Relations
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])
  template              ProtocolTemplate? @relation(fields: [template_id], references: [id])
  owner                 User      @relation(fields: [owner_user_id], references: [id])
  versions              ProtocolVersion[]
  current_version       ProtocolVersion? @relation("CurrentVersion", fields: [current_version_id], references: [id])
  usages                ProtocolUsage[]
  suggestions           ProtocolSuggestion[]

  @@index([tenant_id, deleted_at])
  @@index([owner_user_id, deleted_at])
  @@index([template_id])
  @@index([status])
}

model ProtocolVersion {
  id                    String    @id @default(uuid()) @db.Uuid
  protocol_id           String    @db.Uuid
  tenant_id             String    @db.Uuid

  version_number        Int
  content               Json      @db.JsonB
  change_summary        String?

  status                String    @default("draft")

  created_by            String    @db.Uuid
  created_at            DateTime  @default(now())

  // Relations
  protocol              Protocol  @relation(fields: [protocol_id], references: [id])
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])
  creator               User      @relation(fields: [created_by], references: [id])
  current_for_protocols Protocol[] @relation("CurrentVersion")
  protocol_usages       ProtocolUsage[]

  @@unique([protocol_id, version_number])
  @@index([protocol_id])
  @@index([tenant_id])
}

// Core table for protocol-in-consultation
model ProtocolUsage {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String    @db.Uuid
  consultation_id       String    @db.Uuid

  // Source protocol (reference only)
  protocol_id           String    @db.Uuid
  protocol_version_id   String    @db.Uuid

  // WORKING COPY - full editable snapshot
  content               Json      @db.JsonB

  // Change tracking
  modifications         Json      @db.JsonB
  modification_summary  String?

  // Protocol chain support
  parent_usage_id       String?   @db.Uuid
  trigger_block_id      String?
  depth                 Int       @default(0)

  // Lifecycle
  started_at            DateTime  @default(now())
  completed_at          DateTime?
  status                String    @default("in_progress")

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?

  // Relations
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])
  consultation          Consultation @relation(fields: [consultation_id], references: [id])
  protocol              Protocol  @relation(fields: [protocol_id], references: [id])
  protocol_version      ProtocolVersion @relation(fields: [protocol_version_id], references: [id])
  parent_usage          ProtocolUsage? @relation("ProtocolChain", fields: [parent_usage_id], references: [id])
  child_usages          ProtocolUsage[] @relation("ProtocolChain")

  @@index([tenant_id, deleted_at])
  @@index([consultation_id])
  @@index([protocol_id])
  @@index([parent_usage_id])
  @@index([status])
  @@index([created_at])
}

// Auto-generated suggestions from pattern detection
model ProtocolSuggestion {
  id                    String    @id @default(uuid()) @db.Uuid
  protocol_id           String    @db.Uuid
  protocol_version_id   String    @db.Uuid
  tenant_id             String    @db.Uuid

  pattern_type          String
  pattern_data          Json      @db.JsonB

  suggested_changes     Json      @db.JsonB
  impact_summary        String

  occurrence_count      Int
  total_uses            Int
  occurrence_percentage Decimal   @db.Decimal(5, 2)

  status                String    @default("pending")
  applied_at            DateTime?
  dismissed_at          DateTime?

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt

  // Relations
  protocol              Protocol  @relation(fields: [protocol_id], references: [id])
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])

  @@index([protocol_id, status])
  @@index([tenant_id])
  @@index([created_at])
}

// Update Consultation model
model Consultation {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String    @db.Uuid

  // ... existing fields

  // SOAP fields
  chief_complaint       String?
  subjective            String?
  objective             String?
  assessment            String?
  plan                  String?

  // Optional: denormalized for quick filtering
  protocols_applied     String[]  @default([])

  // Relations
  protocol_usages       ProtocolUsage[]
  prescriptions         Prescription[]
  imaging_orders        ImagingOrder[]
  lab_orders            LabOrder[]

  // ... existing relations
}

// Prescription with group support
model Prescription {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String    @db.Uuid
  consultation_id       String    @db.Uuid
  patient_id            String    @db.Uuid

  // Group support for multiple prescriptions per consultation
  group_title           String?
  group_order           Int       @default(1)

  status                String    @default("draft")
  signed_at             DateTime?

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?

  // Relations
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])
  consultation          Consultation @relation(fields: [consultation_id], references: [id])
  patient               Patient   @relation(fields: [patient_id], references: [id])
  items                 PrescriptionItem[]

  @@index([consultation_id, group_order])
  @@index([patient_id])
  @@index([tenant_id])
}

model PrescriptionItem {
  id                    String    @id @default(uuid()) @db.Uuid
  prescription_id       String    @db.Uuid

  drug                  String
  dose                  String
  route                 String
  frequency             String
  duration              String
  notes                 String?

  // Track source for analytics
  source                String?   // "protocol:blk_id:row_id" | "manual"

  created_at            DateTime  @default(now())

  // Relations
  prescription          Prescription @relation(fields: [prescription_id], references: [id])

  @@index([prescription_id])
}

// NEW: Imaging orders
model ImagingOrder {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String    @db.Uuid
  consultation_id       String    @db.Uuid
  patient_id            String    @db.Uuid

  // Group support
  group_title           String?
  group_order           Int       @default(1)

  // Order details
  study_type            String
  indication            String
  urgency               String    @default("routine")
  contrast              Boolean   @default(false)
  fasting_required      Boolean   @default(false)
  special_instructions  String?

  // Source tracking
  source                String?

  // Status
  status                String    @default("draft")
  signed_at             DateTime?

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?

  // Relations
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])
  consultation          Consultation @relation(fields: [consultation_id], references: [id])
  patient               Patient   @relation(fields: [patient_id], references: [id])

  @@index([consultation_id, group_order])
  @@index([patient_id])
  @@index([tenant_id])
}

// NEW: Lab orders
model LabOrder {
  id                    String    @id @default(uuid()) @db.Uuid
  tenant_id             String    @db.Uuid
  consultation_id       String    @db.Uuid
  patient_id            String    @db.Uuid

  // Group support
  group_title           String?
  group_order           Int       @default(1)

  // Order details
  test_name             String
  test_code             String?
  indication            String
  urgency               String    @default("routine")
  fasting_required      Boolean   @default(false)
  sample_type           String
  special_instructions  String?

  // Source tracking
  source                String?

  // Status
  status                String    @default("draft")
  signed_at             DateTime?

  created_at            DateTime  @default(now())
  updated_at            DateTime  @updatedAt
  deleted_at            DateTime?

  // Relations
  tenant                Tenant    @relation(fields: [tenant_id], references: [id])
  consultation          Consultation @relation(fields: [consultation_id], references: [id])
  patient               Patient   @relation(fields: [patient_id], references: [id])

  @@index([consultation_id, group_order])
  @@index([patient_id])
  @@index([tenant_id])
}
```

**Migration file:** `packages/db/prisma/migrations/<timestamp>_protocol_in_consultation/migration.sql`

### 2.2 Modification Tracking Structure

**`ProtocolUsage.modifications` JSON schema:**

```typescript
{
  // Medication modifications
  medication_changes: [
    {
      block_id: string,
      row_id: string,
      field: 'drug' | 'dose' | 'route' | 'frequency' | 'notes',
      original_value: string,
      modified_value: string,
      timestamp: string,
      user_note?: string  // Optional (no UI in MVP)
    }
  ],
  medications_added: [
    {
      block_id: string,
      row_id: string,
      drug: string,
      dose: string,
      route: string,
      frequency: string,
      notes?: string,
      timestamp: string
    }
  ],
  medications_removed: [
    {
      block_id: string,
      row_id: string,
      drug: string,
      reason?: string,
      timestamp: string
    }
  ],

  // Step modifications
  steps_completed: [
    {
      step_id: string,
      completed: true,
      timestamp: string
    }
  ],
  steps_skipped: [
    {
      step_id: string,
      reason?: string,  // Optional (future)
      timestamp: string
    }
  ],

  // Checklist modifications
  checklist_items: [
    {
      item_id: string,
      checked: boolean,
      timestamp: string
    }
  ],

  // Decision modifications
  decision_branches: [
    {
      decision_id: string,
      branch_id: string,
      linked_protocol_launched: boolean,
      timestamp: string
    }
  ],

  // Imaging order modifications
  imaging_orders_queued: [
    {
      order_id: string,
      study_type: string,
      timestamp: string
    }
  ],
  imaging_orders_modified: [
    {
      order_id: string,
      field: string,
      original_value: string,
      modified_value: string,
      timestamp: string
    }
  ],
  imaging_orders_removed: [
    {
      order_id: string,
      study_type: string,
      reason?: string,
      timestamp: string
    }
  ],

  // Lab order modifications
  lab_orders_queued: [
    {
      order_id: string,
      test_name: string,
      timestamp: string
    }
  ],
  lab_orders_modified: [
    {
      order_id: string,
      field: string,
      original_value: string,
      modified_value: string,
      timestamp: string
    }
  ],
  lab_orders_removed: [
    {
      order_id: string,
      test_name: string,
      reason?: string,
      timestamp: string
    }
  ],

  // Text block edits
  text_blocks_edited: [
    {
      block_id: string,
      original_content: string,
      modified_content: string,
      timestamp: string
    }
  ]
}
```

### 2.3 Template Schema Enhancement

**`ProtocolTemplate.schema` with all requirement flags:**

```json
{
  "version": "1.0",
  "metadata": {
    "suggested_specialty": "cardiology",
    "intended_use": "Heart failure workup",
    "requires_medication": true,
    "requires_imaging": true,
    "requires_labs": true
  },
  "blocks": [
    {
      "id": "sec_workup",
      "type": "section",
      "title": "Estudios Diagnósticos",
      "required": true,
      "placeholder_blocks": [
        {
          "id": "blk_imaging",
          "type": "imaging_order",
          "required": true,
          "title": "Estudios de Imagen",
          "placeholder": "Rx Tórax, Ecocardiograma"
        },
        {
          "id": "blk_labs",
          "type": "lab_order",
          "required": true,
          "title": "Estudios de Laboratorio",
          "placeholder": "BNP, Química renal, Hemograma"
        }
      ]
    },
    {
      "id": "sec_treatment",
      "type": "section",
      "title": "Tratamiento",
      "required": true,
      "placeholder_blocks": [
        {
          "id": "blk_meds",
          "type": "dosage_table",
          "required": true,
          "title": "Medicamentos",
          "placeholder": "Diuréticos, IECA, beta-bloqueadores"
        }
      ]
    }
  ]
}
```

### 2.4 Block Type Schemas

**Imaging Order Block:**

```json
{
  "type": "imaging_order",
  "title": "Imaging Studies Required",
  "orders": [
    {
      "id": "img_01",
      "study_type": "Rx Tórax PA y Lateral",
      "indication": "Evaluar cardiomegalia",
      "urgency": "routine",
      "contrast": false,
      "fasting_required": false,
      "special_instructions": "Con placa inspiratoria completa"
    }
  ]
}
```

**Lab Order Block:**

```json
{
  "type": "lab_order",
  "title": "Laboratory Studies",
  "orders": [
    {
      "id": "lab_01",
      "test_name": "Hemograma completo",
      "test_code": "CBC",
      "indication": "Descartar anemia",
      "urgency": "routine",
      "fasting_required": false,
      "sample_type": "blood",
      "special_instructions": ""
    }
  ]
}
```

**Decision Block with Linked Protocol:**

```json
{
  "type": "decision",
  "condition": "STEMI confirmed on ECG?",
  "branches": [
    {
      "id": "brn_yes",
      "label": "Yes - STEMI",
      "action": "Initiate STEMI protocol",
      "linked_protocol_id": "uuid-of-stemi-protocol",
      "auto_launch": true
    },
    {
      "id": "brn_no",
      "label": "No",
      "action": "Continue standard workup"
    }
  ]
}
```

---

## 3. API Specification

### 3.1 Protocol Usage Endpoints

**Base path:** `/v1/consultations/:consultationId/protocols`

All endpoints require `FirebaseAuthGuard` + `TenantGuard`.

#### Launch Protocol

**Endpoint:** `POST /v1/consultations/:consultationId/protocols`

**Request:**

```typescript
{
  protocol_id: string;        // UUID of protocol to launch
  parent_usage_id?: string;   // If launching from decision branch
  trigger_block_id?: string;  // Which decision block triggered this
}
```

**Response:** (201 Created)

```typescript
{
  usage_id: string
  protocol_id: string
  protocol_version_id: string
  content: ProtocolContent // Full working copy
  depth: number
  parent_usage_id: string | null
  started_at: string
}
```

**Errors:**

- `CONSULTATION_NOT_FOUND` (404)
- `PROTOCOL_NOT_FOUND` (404)
- `PROTOCOL_ALREADY_ACTIVE` (409)
- `PARENT_USAGE_NOT_FOUND` (404)

#### Update Protocol Usage

**Endpoint:** `PATCH /v1/consultations/:consultationId/protocols/:usageId`

**Request:**

```typescript
{
  content: ProtocolContent;          // Updated working copy
  modifications: Modifications;      // Incremental modification log
  modification_summary?: string;     // Optional human-readable summary
  status?: 'in_progress' | 'completed' | 'abandoned';
}
```

**Response:** (200 OK)

```typescript
{
  id: string
  // ... full ProtocolUsageResponse
}
```

#### Get Protocol Usage

**Endpoint:** `GET /v1/consultations/:consultationId/protocols/:usageId`

**Response:** (200 OK)

```typescript
{
  id: string;
  protocol_id: string;
  protocol_version_id: string;
  content: ProtocolContent;
  modifications: Modifications;
  modification_summary: string | null;
  parent_usage_id: string | null;
  trigger_block_id: string | null;
  depth: number;
  started_at: string;
  completed_at: string | null;
  status: string;

  protocol: {
    id: string;
    title: string;
    template_id: string | null;
  };

  child_usages?: Array<{
    id: string;
    protocol_id: string;
    protocol: { title: string };
    depth: number;
  }>;
}
```

#### List Protocol Usages

**Endpoint:** `GET /v1/consultations/:consultationId/protocols`

#### Delete/Abandon Protocol Usage

**Endpoint:** `DELETE /v1/consultations/:consultationId/protocols/:usageId`

**Response:** (204 No Content)

Sets `status = 'abandoned'` and `deleted_at = now()`. Does not hard-delete.

### 3.2 Order Generation Endpoints

#### Generate Prescription

**Endpoint:** `POST /v1/consultations/:consultationId/prescriptions`

**Request:**

```typescript
{
  group_title?: string;
  group_order: number;
  medications: [
    {
      drug: string;
      dose: string;
      route: string;
      frequency: string;
      duration: string;
      notes?: string;
      source?: string;
    }
  ];
}
```

**Response:**

```typescript
{
  prescription_id: string
  pdf_url: string
  group_title: string
  group_order: number
}
```

#### Generate Imaging Order

**Endpoint:** `POST /v1/consultations/:consultationId/imaging-orders`

**Request:**

```typescript
{
  group_title?: string;
  group_order: number;
  orders: [
    {
      study_type: string;
      indication: string;
      urgency: 'routine' | 'urgent' | 'stat';
      contrast: boolean;
      fasting_required: boolean;
      special_instructions?: string;
      source?: string;
    }
  ];
}
```

**Response:**

```typescript
{
  imaging_order_id: string
  pdf_url: string
  group_title: string
  group_order: number
}
```

#### Generate Lab Order

**Endpoint:** `POST /v1/consultations/:consultationId/lab-orders`

**Request:**

```typescript
{
  group_title?: string;
  group_order: number;
  orders: [
    {
      test_name: string;
      test_code?: string;
      indication: string;
      urgency: 'routine' | 'urgent' | 'stat';
      fasting_required: boolean;
      sample_type: 'blood' | 'urine' | 'stool' | 'other';
      special_instructions?: string;
      source?: string;
    }
  ];
}
```

**Response:**

```typescript
{
  lab_order_id: string
  pdf_url: string
  group_title: string
  group_order: number
}
```

#### Generate All Orders

**Endpoint:** `POST /v1/consultations/:consultationId/orders/generate-all`

**Request:**

```typescript
{
  prescriptions: CreatePrescriptionSchema[];
  imaging_orders: CreateImagingOrderSchema[];
  lab_orders: CreateLabOrderSchema[];
}
```

**Response:**

```typescript
{
  prescriptions: Array<{ id, pdf_url, group_title, group_order }>;
  imaging_orders: Array<{ id, pdf_url, group_title, group_order }>;
  lab_orders: Array<{ id, pdf_url, group_title, group_order }>;
  zip_url?: string;  // Optional: all PDFs in a zip
}
```

### 3.3 Suggestion Endpoints

**Base path:** `/v1/protocols/:protocolId/suggestions`

#### Get Suggestions

**Endpoint:** `GET /v1/protocols/:protocolId/suggestions`

**Response:**

```typescript
{
  data: Array<{
    id: string
    pattern_type: string
    impact_summary: string
    occurrence_count: number
    total_uses: number
    occurrence_percentage: number
    suggested_changes: any
    created_at: string
  }>
}
```

#### Apply Suggestion

**Endpoint:** `POST /v1/protocols/:protocolId/suggestions/:suggestionId/apply`

Creates new protocol version with suggested changes applied.

#### Create Variant from Suggestion

**Endpoint:** `POST /v1/protocols/:protocolId/suggestions/:suggestionId/create-variant`

Creates new protocol with suggested changes applied.

#### Dismiss Suggestion

**Endpoint:** `DELETE /v1/protocols/:protocolId/suggestions/:suggestionId`

### 3.4 Background Job: Pattern Detection

**Trigger:** Weekly cron (Sunday 3am)

**Process:**

1. Get all active protocols across all tenants
2. For each protocol:
   - Get completed usages from last 90 days (minimum 3 required)
   - Detect patterns:
     - Medication dose changes
     - Medications added/removed
     - Steps skipped
     - Imaging orders added/removed
     - Lab orders added/removed
3. Evaluate each pattern:
   - ≥90% occurrence → auto-create variant
   - 75-89% occurrence → create suggestion
   - <75% → ignore

**Pattern Detection Functions:**

```typescript
async function detectMedicationDosePatterns(usages: ProtocolUsage[]): MedicationDosePattern[]
async function detectMedicationsAddedPatterns(usages: ProtocolUsage[]): MedicationAddedPattern[]
async function detectStepsSkippedPatterns(usages: ProtocolUsage[]): StepSkippedPattern[]
async function detectImagingOrderPatterns(usages: ProtocolUsage[]): ImagingOrderPattern[]
async function detectLabOrderPatterns(usages: ProtocolUsage[]): LabOrderPattern[]
```

**Auto-Variant Creation:**

When pattern ≥90%, automatically:

1. Create new Protocol: `"[Original Title] - Variante Optimizada"`
2. Apply pattern changes to content
3. Set `metadata.auto_generated = true`
4. Set `metadata.source_protocol_id = originalProtocolId`
5. Set status = 'draft'
6. Queue email notification to doctor

**Suggestion Creation:**

When pattern 75-89%:

1. Create ProtocolSuggestion row
2. Store pattern data and suggested changes
3. Include in weekly summary email

### 3.5 Weekly Email Summary

**Template:** `protocol_weekly_summary`

**Triggered by:** Cron job Sunday 8am

**Recipients:** All users with active protocols that have pending suggestions

**Email content:**

```
Subject: Resumen Semanal de Protocolos - [Fecha]

Hola Dr. [Nombre],

Esta semana detectamos oportunidades para optimizar tus protocolos:

[For each protocol with suggestions]

📋 [Protocol Title]

  💡 Sugerencia:
  [Impact Summary]

  Basado en [X] de tus últimos [Y] usos ([Z]%)

  [Ver Detalles] [Aplicar Cambio] [Crear Variante]

---

Nuevas Variantes Creadas Automáticamente:

[For each auto-created variant this week]

✨ [Variant Title]
  Optimizado de: [Original Protocol Title]
  Cambios: [Pattern Summary]

  [Ver Protocolo]
```

---

## 4. Frontend Architecture

### 4.1 Design System & Components

**All UI components use Shadcn/Radix primitives + Tailwind utility classes.**

**Available components:**

- `Dialog` (Modal wrapper)
- `Select`
- `Tabs`
- `Toast`
- `Button`
- `Input`
- `Card`
- `Badge`
- `Callout`

**Usage examples:**

```tsx
// Button
import { Button } from '@/components/ui/Button';
<Button variant="outline" size="sm">Completado</Button>

// Tabs
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
<Tabs defaultValue="medications">
  <TabsList>
    <TabsTrigger value="medications">Medicamentos</TabsTrigger>
    <TabsTrigger value="imaging">Imagen</TabsTrigger>
  </TabsList>
  <TabsContent value="medications">...</TabsContent>
</Tabs>

// Badge
import { Badge } from '@/components/ui/Badge';
<Badge variant="success">✓ Completado</Badge>
<Badge variant="warning">⊘ Omitido</Badge>

// Select
import { Select, SelectTrigger, SelectContent, SelectItem } from '@/components/ui/Select';
<Select value={groupId} onValueChange={setGroupId}>
  <SelectTrigger>
    <SelectValue placeholder="Mover a..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="group_1">Receta 1</SelectItem>
  </SelectContent>
</Select>
```

### 4.2 State Management

**Zustand stores:**

```typescript
// apps/web/src/stores/protocolUsageStore.ts
interface ProtocolUsageStore {
  activeUsage: ProtocolUsage | null
  usageChain: ProtocolUsage[]

  launchProtocol: (consultationId: string, protocolId: string) => Promise<void>
  updateUsage: (usageId: string, updates: Partial<ProtocolUsage>) => Promise<void>
  trackModification: (modification: Modification) => void
  completeUsage: (usageId: string) => Promise<void>
  abandonUsage: (usageId: string) => Promise<void>

  pushToChain: (usage: ProtocolUsage) => void
  popFromChain: () => void

  saveToLocalStorage: () => void
  restoreFromLocalStorage: (consultationId: string) => void
  clearLocalStorage: (consultationId: string) => void
}
```

```typescript
// apps/web/src/stores/orderQueueStore.ts
interface OrderQueueStore {
  prescriptionGroups: OrderGroup<QueuedMedication>[]
  imagingGroups: OrderGroup<QueuedImagingOrder>[]
  labGroups: OrderGroup<QueuedLabOrder>[]

  activeTab: 'medications' | 'imaging' | 'labs'
  setActiveTab: (tab) => void

  // Prescription actions
  createPrescriptionGroup: (title?: string) => string
  queueMedication: (medication, groupId?) => void
  moveMedication: (medicationId, toGroupId) => void
  updateMedication: (medicationId, updates) => void
  removeMedication: (medicationId) => void

  // Imaging actions (similar pattern)
  createImagingGroup: (title?) => string
  queueImagingOrder: (order, groupId?) => void
  // ...

  // Lab actions (similar pattern)
  createLabGroup: (title?) => string
  queueLabOrder: (order, groupId?) => void
  // ...

  // Generation
  generatePrescription: (groupId) => Promise<void>
  generateAllPrescriptions: () => Promise<void>
  generateImagingOrder: (groupId) => Promise<void>
  generateLabOrder: (groupId) => Promise<void>

  initializeDefaultGroups: () => void
}
```

### 4.3 Component Tree

```
ConsultationPage
├── ConsultationForm (SOAP fields)
├── ProtocolButton
├── ProtocolSidePanel
│   ├── ProtocolHeader
│   │   ├── BreadcrumbNav
│   │   ├── ProtocolTitle
│   │   └── CloseButton
│   ├── ProtocolContent
│   │   └── BlockRenderer
│   │       ├── SectionBlock
│   │       ├── TextBlock
│   │       ├── ChecklistBlock
│   │       ├── StepsBlock (Completado/Omitido buttons)
│   │       ├── DecisionBlock (launch linked protocols)
│   │       ├── DosageTableBlock
│   │       ├── ImagingOrderBlock
│   │       ├── LabOrderBlock
│   │       └── AlertBlock
│   └── ProtocolFooter
├── OrderQueuePanel
│   ├── Tabs (Medications | Imaging | Labs)
│   ├── TabsContent[medications]
│   │   ├── PrescriptionGroups
│   │   │   ├── PrescriptionGroup (multiple)
│   │   │   │   ├── GroupHeader
│   │   │   │   ├── MedicationList
│   │   │   │   └── GeneratePDFButton
│   │   │   └── CreateGroupButton
│   │   └── GenerateAllButton
│   ├── TabsContent[imaging] (similar)
│   └── TabsContent[labs] (similar)
└── SessionStateManager

ProtocolPickerModal
├── DialogHeader
├── ProtocolList
│   └── ProtocolCard
└── DialogFooter
```

### 4.4 Key Components

#### StepsBlock (Interactive)

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export function StepsBlock({ block, mode, onModification }: StepsBlockProps) {
  const [stepStates, setStepStates] = useState<Map<string, 'pending' | 'completed' | 'skipped'>>(
    new Map(),
  )

  const handleStepComplete = (stepId: string, step: Step) => {
    setStepStates((prev) => new Map(prev).set(stepId, 'completed'))
    onModification?.({ type: 'step_completed', step_id: stepId /* ... */ })
    consultationStore.appendToPlan(`✓ ${step.title}`)
  }

  const handleStepSkip = (stepId: string) => {
    setStepStates((prev) => new Map(prev).set(stepId, 'skipped'))
    onModification?.({ type: 'step_skipped', step_id: stepId /* ... */ })
  }

  return (
    <div className="space-y-3">
      {block.steps.map((step, index) => {
        const state = stepStates.get(step.id) || 'pending'

        return (
          <div
            key={step.id}
            className={cn(
              'p-3 border rounded-md',
              state === 'completed' && 'bg-success-bg border-success-border',
              state === 'skipped' && 'bg-warning-bg border-warning-border',
            )}
          >
            <div className="flex items-start gap-3">
              <span className="font-mono text-sm">{index + 1}.</span>
              <span className="flex-1">{step.title}</span>
              {state === 'completed' && <Badge variant="success">✓ Completado</Badge>}
              {state === 'skipped' && <Badge variant="warning">⊘ Omitido</Badge>}
            </div>

            {mode === 'interactive' && state === 'pending' && (
              <div className="flex gap-2 ml-8 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStepComplete(step.id, step)}
                >
                  ✓ Completado
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleStepSkip(step.id)}>
                  ⊘ Omitido
                </Button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

#### OrderQueuePanel

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useOrderQueueStore } from '@/stores/orderQueueStore'

export function OrderQueuePanel({ consultationId }: { consultationId: string }) {
  const { activeTab, setActiveTab } = useOrderQueueStore()

  return (
    <div className="border border-border rounded-md p-4">
      <h3 className="text-lg font-semibold mb-4">Órdenes Médicas</h3>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="medications">Medicamentos</TabsTrigger>
          <TabsTrigger value="imaging">Imagen</TabsTrigger>
          <TabsTrigger value="labs">Laboratorio</TabsTrigger>
        </TabsList>

        <TabsContent value="medications" className="mt-4">
          <PrescriptionGroups consultationId={consultationId} />
        </TabsContent>

        <TabsContent value="imaging" className="mt-4">
          <ImagingOrderGroups consultationId={consultationId} />
        </TabsContent>

        <TabsContent value="labs" className="mt-4">
          <LabOrderGroups consultationId={consultationId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### 4.5 Auto-Population Logic

```typescript
function handleModification(modification: Modification) {
  protocolUsageStore.trackModification(modification)

  if (modification.type === 'checklist_item_checked') {
    const item = modification.item
    if (item.critical) {
      consultationStore.appendToObjective(`✓ ${item.text}`)
    }
  }

  if (modification.type === 'step_completed') {
    const step = modification.step
    consultationStore.appendToPlan(`✓ ${step.title}`)
  }

  if (modification.type === 'decision_branch_selected') {
    const branch = modification.branch
    consultationStore.appendToAssessment(branch.action)
  }

  if (modification.type === 'medication_queued') {
    const med = modification.medication
    consultationStore.appendToPlan(`${med.drug} ${med.dose} prescribed`)
  }

  if (modification.type === 'imaging_order_queued') {
    const order = modification.order
    consultationStore.appendToPlan(`Imaging: ${order.study_type}`)
  }

  if (modification.type === 'lab_order_queued') {
    const order = modification.order
    consultationStore.appendToPlan(`Lab: ${order.test_name}`)
  }
}
```

---

## 5. Build Sequence

### Day 1: Data Model & Template Updates

**Backend:**

- [ ] Prisma schema updates
- [ ] Run migration
- [ ] Update seed script with new template metadata
- [ ] Template validation for required blocks

**Testing:**

- [ ] Unit test: template validation
- [ ] Seed script runs

### Day 2: Protocol Launch & Order Endpoints

**Backend:**

- [ ] Launch protocol endpoint
- [ ] Update usage endpoint
- [ ] Generate prescription endpoint
- [ ] Generate imaging order endpoint
- [ ] Generate lab order endpoint
- [ ] Repositories & services
- [ ] Zod schemas

**Testing:**

- [ ] Integration tests for all endpoints
- [ ] Cross-tenant isolation tests

### Day 3: Frontend Picker + Side Panel Shell

**Frontend:**

- [ ] ProtocolPickerModal (using Dialog)
- [ ] ProtocolSidePanel (shell)
- [ ] BreadcrumbNav
- [ ] Zustand stores (basic)
- [ ] TanStack Query hooks
- [ ] Integrate into consultation page

**Testing:**

- [ ] E2E: picker → side panel opens

### Day 4: Interactive Blocks

**Frontend:**

- [ ] BlockRenderer with mode prop
- [ ] All interactive block components
- [ ] Modification tracking
- [ ] Auto-population helpers

**Backend:**

- [ ] Modification merging logic

**Testing:**

- [ ] E2E: check step → SOAP updated

### Day 5: Order Queue Panel

**Frontend:**

- [ ] OrderQueuePanel (Tabs)
- [ ] PrescriptionGroups
- [ ] ImagingOrderGroups
- [ ] LabOrderGroups
- [ ] Group management
- [ ] PDF generation buttons

**Testing:**

- [ ] E2E: queue → move → generate PDF

### Day 6: Session State

**Frontend:**

- [ ] SessionStateManager
- [ ] Auto-save (30s interval)
- [ ] Restore banner
- [ ] Unsaved changes warning

**Testing:**

- [ ] E2E: reload → session restored

### Day 7: Linked Protocols

**Frontend:**

- [ ] DecisionBlock linked protocol launch
- [ ] Protocol chain navigation
- [ ] Breadcrumb back button

**Backend:**

- [ ] Parent/child relationship handling
- [ ] Depth calculation

**Testing:**

- [ ] E2E: linked protocol flow
- [ ] Integration: depth increments

### Day 8-9: Pattern Detection

**Backend:**

- [ ] Pattern detection job
- [ ] Detection functions (all types)
- [ ] Pattern evaluation
- [ ] Auto-variant creation
- [ ] Suggestion creation
- [ ] Cron registration

**Testing:**

- [ ] Unit tests with mock data
- [ ] Integration: end-to-end job

### Day 10: Suggestions API + Email

**Backend:**

- [ ] Suggestion endpoints
- [ ] Email template
- [ ] Email job (Sunday 8am)

**Testing:**

- [ ] Integration: apply/create variant/dismiss
- [ ] Manual: email rendering

### Day 11: Frontend Suggestions

**Frontend:**

- [ ] Suggestion banner (Callout)
- [ ] Action buttons
- [ ] TanStack Query hooks

**Testing:**

- [ ] E2E: apply suggestion → new version

### Day 12: Polish & Testing

**All:**

- [ ] Cross-tenant isolation verification
- [ ] Performance testing
- [ ] Accessibility audit
- [ ] Error handling polish
- [ ] Loading/empty states
- [ ] Documentation
- [ ] Design system compliance

**Final E2E:**

- [ ] Complete flow: launch → edit → orders → complete → suggestion → apply

---

## 6. Testing Requirements

### 6.1 Unit Tests

**Backend:**

- [ ] Modification merging
- [ ] Pattern detection algorithms
- [ ] Template validation
- [ ] Variant creation logic

**Frontend:**

- [ ] BlockRenderer mode switching
- [ ] Order queue operations
- [ ] Session state save/restore
- [ ] Auto-population logic

### 6.2 Integration Tests

**All endpoints:**

- [ ] Happy path (200/201)
- [ ] Not found (404)
- [ ] Cross-tenant isolation (404)
- [ ] Validation errors (400)
- [ ] Auth required (401)

**Scenarios:**

- [ ] Launch → creates usage
- [ ] Update → appends modifications
- [ ] Complete → sets timestamp
- [ ] Launch child → depth increments
- [ ] Pattern detection → suggestion/variant
- [ ] Multiple prescriptions → separate PDFs

### 6.3 E2E Tests

**Critical flows:**

- [ ] Basic protocol use
- [ ] Medication queueing (multiple groups)
- [ ] Linked protocols
- [ ] Session recovery
- [ ] Imaging/lab ordering
- [ ] Weekly summary

---

## 7. Done-When Criteria

### 7.1 Core Functionality

- [ ] Launch protocol during consultation
- [ ] Protocol opens in side panel
- [ ] All blocks render in interactive mode
- [ ] Steps have Completado/Omitido buttons
- [ ] Step state locks after interaction
- [ ] Badges show for completed/skipped
- [ ] Auto-population to SOAP fields works
- [ ] All order types can be queued
- [ ] Modifications tracked

### 7.2 Order Management

- [ ] Order panel has 3 tabs
- [ ] Multiple groups per order type
- [ ] Group CRUD operations work
- [ ] Move orders between groups
- [ ] Generate PDF per group
- [ ] Generate all PDFs
- [ ] PDFs show group title + page number

### 7.3 Linked Protocols

- [ ] Launch button shows for linked protocols
- [ ] Child protocol launches correctly
- [ ] Breadcrumb shows chain
- [ ] Depth increments
- [ ] Back navigation preserves state

### 7.4 Session State

- [ ] Auto-save every 30s
- [ ] Restore on reload
- [ ] Clear on save
- [ ] Unsaved changes warning

### 7.5 Pattern Detection

- [ ] Weekly cron runs
- [ ] Patterns detected (3+ usages)
- [ ] 90%+ → variant
- [ ] 75-89% → suggestion
- [ ] <75% → no action

### 7.6 Suggestions

- [ ] Weekly email sent
- [ ] Banner shows on protocol view
- [ ] Apply/Create Variant/Dismiss work

### 7.7 Cross-Cutting

- [ ] Tenant isolation enforced
- [ ] Auth required
- [ ] User-friendly errors
- [ ] Loading states
- [ ] Empty states
- [ ] Shadcn UI + Tailwind only
- [ ] Design tokens via Tailwind
- [ ] Keyboard navigation
- [ ] Screen reader support

### 7.8 Performance

- [ ] 50-block protocol loads <2s
- [ ] Smooth scrolling (60fps)
- [ ] Auto-save non-blocking
- [ ] Pattern detection <5min for 100 protocols

---

## 8. Non-Functional Requirements

### 8.1 Security

- [ ] No cross-tenant data exposure
- [ ] Server-side input validation
- [ ] SOAP content sanitization
- [ ] Rate limit pattern detection

### 8.2 Performance

- [ ] API <500ms (p95)
- [ ] Pattern detection scales to 1000+ usages
- [ ] LocalStorage non-blocking
- [ ] Large JSON (<1MB) handled

### 8.3 Accessibility

- [ ] Keyboard accessible
- [ ] Focus indicators
- [ ] Screen reader announcements
- [ ] Color + icons (not color alone)

### 8.4 Observability

- [ ] Pattern detection logging
- [ ] Email failure logging
- [ ] Variant creation logging
- [ ] Suggestion creation logging

### 8.5 Documentation

- [ ] Swagger docs
- [ ] JSDoc on components
- [ ] Algorithm documentation
- [ ] README updates

---

## Appendix: Design System Updates

**All UI now uses Shadcn/Radix + Tailwind utilities.**

**Migration from old design system:**

| Old CSS Class | New Component | Import                    |
| ------------- | ------------- | ------------------------- |
| `.btn`        | `<Button>`    | `@/components/ui/Button`  |
| `.card`       | `<Card>`      | `@/components/ui/Card`    |
| `.input`      | `<Input>`     | `@/components/ui/Input`   |
| `.modal-*`    | `<Dialog>`    | `@/components/ui/Modal`   |
| `.badge`      | `<Badge>`     | `@/components/ui/Badge`   |
| `.callout`    | `<Callout>`   | `@/components/ui/Callout` |
| `.tabs-*`     | `<Tabs>`      | `@/components/ui/Tabs`    |

**Tailwind patterns:**

```tsx
// Spacing
<div className="p-4 mb-6 space-y-3">

// Colors (via design tokens)
<div className="bg-background text-foreground border-border">
<div className="bg-success-bg text-success-text border-success-border">

// Typography
<h3 className="text-lg font-semibold">
<p className="text-sm text-muted-foreground">
```

**Design tokens still via CSS custom properties** (referenced in `tailwind.config.ts`).

---

**This specification is complete and ready for implementation.**
