# Schema Reset & Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing Prisma schema and shared Zod schemas to exactly match the updated specs — removing SOAP fields, adding ProtocolCategory, normalizing order models, and correcting status enums.

**Architecture:** Clean DB reset (no production data). All changes go into one new Prisma migration created with `prisma migrate dev`. Shared Zod schemas in `packages/shared` are updated in lockstep so API and frontend types stay in sync.

**Tech Stack:** Prisma 5 + PostgreSQL, `@rezeta/shared` Zod schemas, pnpm monorepo

---

## File Map

| Action | File |
|---|---|
| Modify | `packages/db/prisma/schema.prisma` |
| Modify | `packages/shared/src/schemas/consultation.ts` |
| Modify | `packages/shared/src/schemas/protocol.ts` |
| Modify | `packages/shared/src/types/protocol.ts` (if exists) |
| Run | `pnpm --filter @rezeta/db prisma migrate reset` |
| Run | `pnpm --filter @rezeta/db prisma migrate dev --name schema-reset-v2` |

---

## Task 1: Update Consultation model — remove SOAP, fix status and field names

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (lines 244–285)

- [ ] **Step 1: Write the failing schema validation test**

Create `packages/db/prisma/__tests__/schema-fields.test.ts` (or update if it exists):

```typescript
// packages/db/prisma/__tests__/schema-fields.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const schema = readFileSync(join(__dirname, '../schema.prisma'), 'utf-8')

describe('Consultation model', () => {
  it('has open as default status', () => {
    expect(schema).toContain('"open"')
  })
  it('has doctor_id instead of user_id', () => {
    expect(schema).toMatch(/doctorId\s+String\s+@map\("doctor_id"\)/)
  })
  it('has started_at instead of consulted_at', () => {
    expect(schema).toMatch(/startedAt\s+DateTime\s+@default\(now\(\)\)\s+@map\("started_at"\)/)
  })
  it('does not have chief_complaint column', () => {
    expect(schema).not.toContain('chief_complaint')
  })
  it('does not have subjective column', () => {
    expect(schema).not.toContain('"subjective"')
  })
  it('does not have vitals Json on Consultation', () => {
    // vitals column should not appear inside the Consultation model block
    const consultationBlock = schema.match(/model Consultation \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(consultationBlock).not.toContain('vitals')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/db test
```

Expected: FAIL — `doctor_id` not found, `chief_complaint` still present, etc.

- [ ] **Step 3: Replace the Consultation model in schema.prisma**

Replace the entire `model Consultation { ... }` block (lines 244–285) with:

```prisma
model Consultation {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId      String    @map("tenant_id") @db.Uuid
  patientId     String    @map("patient_id") @db.Uuid
  doctorId      String    @map("doctor_id") @db.Uuid
  locationId    String    @map("location_id") @db.Uuid
  appointmentId String?   @map("appointment_id") @db.Uuid

  status    String    @default("open") @db.VarChar(20) // open | signed | amended
  startedAt DateTime  @default(now()) @map("started_at")
  signedAt  DateTime? @map("signed_at")

  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  tenant         Tenant                  @relation(fields: [tenantId], references: [id])
  appointment    Appointment?            @relation(fields: [appointmentId], references: [id])
  patient        Patient                 @relation(fields: [patientId], references: [id])
  doctor         User                    @relation("ConsultationDoctor", fields: [doctorId], references: [id])
  location       Location                @relation(fields: [locationId], references: [id])
  amendments     ConsultationAmendment[]
  prescriptions  Prescription[]
  imagingOrders  ImagingOrder[]
  labOrders      LabOrder[]
  invoice        Invoice?
  protocolUsages ProtocolUsage[]

  @@index([tenantId])
  @@index([tenantId, doctorId, startedAt])
  @@index([tenantId, patientId])
  @@index([tenantId, deletedAt])
  @@index([status])
  @@map("consultations")
}
```

Also update `ConsultationAmendment` — replace `amendedBy` author relation if it references an old User relation name. Check for any `@relation("ConsultationSigner")` or `signer` relation on `User` model and remove those references.

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @rezeta/db test
```

Expected: PASS

---

## Task 2: Add ProtocolCategory model

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add after ProtocolUsage block, ~line 566)

- [ ] **Step 1: Write test**

Add to `packages/db/prisma/__tests__/schema-fields.test.ts`:

```typescript
describe('ProtocolCategory model', () => {
  it('exists in schema', () => {
    expect(schema).toContain('model ProtocolCategory')
  })
  it('has unique tenant+name constraint', () => {
    const block = schema.match(/model ProtocolCategory \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('@@unique([tenantId, name])')
  })
  it('has color field', () => {
    expect(schema).toMatch(/color\s+String/)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/db test
```

- [ ] **Step 3: Add ProtocolCategory model to schema**

Insert after the last `model ProtocolUsage` closing brace:

```prisma
model ProtocolCategory {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId  String    @map("tenant_id") @db.Uuid
  name      String    @db.VarChar(200)
  color     String    @default("#6B7280") @db.VarChar(20)
  isSeeded  Boolean   @default(false) @map("is_seeded")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  tenant    Tenant     @relation(fields: [tenantId], references: [id])
  protocols Protocol[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
  @@map("protocol_categories")
}
```

Also add the reverse relation to `Tenant`:
Find the `Tenant` model's relations block and add:
```prisma
  protocolCategories ProtocolCategory[]
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/db test
```

---

## Task 3: Remove ProtocolType, update Protocol to use ProtocolCategory

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Write test**

Add to schema test file:

```typescript
describe('ProtocolType removal', () => {
  it('ProtocolType model no longer exists', () => {
    expect(schema).not.toContain('model ProtocolType')
  })
})

describe('Protocol model', () => {
  it('has categoryId instead of typeId', () => {
    const block = schema.match(/model Protocol \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('categoryId')
    expect(block).not.toContain('typeId')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/db test
```

- [ ] **Step 3: Remove ProtocolType model and update Protocol**

Delete the entire `model ProtocolType { ... }` block (lines 440–459).

In `model Protocol`, replace:
```prisma
  typeId           String?   @map("type_id") @db.Uuid
```
with:
```prisma
  categoryId       String?   @map("category_id") @db.Uuid
```

Replace the `type` relation:
```prisma
  type        ProtocolType?        @relation(fields: [typeId], references: [id])
```
with:
```prisma
  category    ProtocolCategory?    @relation(fields: [categoryId], references: [id])
```

Update index:
```prisma
  @@index([tenantId, typeId])
```
→
```prisma
  @@index([tenantId, categoryId])
```

Also remove `protocolTypes ProtocolType[]` from `ProtocolTemplate` model — ProtocolTemplate no longer needs to track ProtocolTypes.

Remove `protocols Protocol[]` from old ProtocolType and update ProtocolTemplate to remove `protocolTypes` relation.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/db test
```

---

## Task 4: Normalize ImagingOrder — add ImagingOrderItem sub-table

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (lines 595–627)

- [ ] **Step 1: Write test**

```typescript
describe('ImagingOrder normalization', () => {
  it('ImagingOrderItem model exists', () => {
    expect(schema).toContain('model ImagingOrderItem')
  })
  it('ImagingOrder no longer has study_type column', () => {
    const block = schema.match(/model ImagingOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toContain('studyType')
    expect(block).not.toContain('study_type')
  })
  it('ImagingOrder status default is queued', () => {
    const block = schema.match(/model ImagingOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('"queued"')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/db test
```

- [ ] **Step 3: Replace ImagingOrder and add ImagingOrderItem**

Replace the entire `model ImagingOrder` block with:

```prisma
model ImagingOrder {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  consultationId String    @map("consultation_id") @db.Uuid
  patientId      String    @map("patient_id") @db.Uuid
  doctorId       String    @map("doctor_id") @db.Uuid
  groupTitle     String?   @map("group_title") @db.VarChar(200)
  groupOrder     Int       @default(1) @map("group_order")
  status         String    @default("queued") @db.VarChar(20) // queued | signed
  signedAt       DateTime? @map("signed_at")
  pdfUrl         String?   @map("pdf_url") @db.VarChar(2048)
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  tenant       Tenant             @relation(fields: [tenantId], references: [id])
  consultation Consultation       @relation(fields: [consultationId], references: [id])
  patient      Patient            @relation(fields: [patientId], references: [id])
  doctor       User               @relation("ImagingOrderDoctor", fields: [doctorId], references: [id])
  items        ImagingOrderItem[]

  @@index([consultationId, groupOrder])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
  @@map("imaging_orders")
}

model ImagingOrderItem {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  imagingOrderId      String   @map("imaging_order_id") @db.Uuid
  studyType           String   @map("study_type") @db.VarChar(300)
  indication          String   @db.VarChar(500)
  urgency             String   @default("routine") @db.VarChar(20) // routine | urgent | stat
  contrast            Boolean  @default(false)
  fastingRequired     Boolean  @default(false) @map("fasting_required")
  specialInstructions String?  @map("special_instructions") @db.Text
  source              String?  @db.VarChar(200) // "protocol:{usageId}:{blockId}:{rowId}" | "manual"
  createdAt           DateTime @default(now()) @map("created_at")

  imagingOrder ImagingOrder @relation(fields: [imagingOrderId], references: [id])

  @@index([imagingOrderId])
  @@map("imaging_order_items")
}
```

Also add `imagingOrders ImagingOrder[]` and `imagingOrderItems ImagingOrderItem[]` to `User` model if needed for the new `doctorId` FK, and reverse `items ImagingOrderItem[]` is already on `ImagingOrder`.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/db test
```

---

## Task 5: Normalize LabOrder — add LabOrderItem sub-table

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (lines 628–660)

- [ ] **Step 1: Write test**

```typescript
describe('LabOrder normalization', () => {
  it('LabOrderItem model exists', () => {
    expect(schema).toContain('model LabOrderItem')
  })
  it('LabOrder no longer has test_name column', () => {
    const block = schema.match(/model LabOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toContain('testName')
    expect(block).not.toContain('test_name')
  })
  it('LabOrder status default is queued', () => {
    const block = schema.match(/model LabOrder \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('"queued"')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/db test
```

- [ ] **Step 3: Replace LabOrder and add LabOrderItem**

Replace the entire `model LabOrder` block with:

```prisma
model LabOrder {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  consultationId String    @map("consultation_id") @db.Uuid
  patientId      String    @map("patient_id") @db.Uuid
  doctorId       String    @map("doctor_id") @db.Uuid
  groupTitle     String?   @map("group_title") @db.VarChar(200)
  groupOrder     Int       @default(1) @map("group_order")
  status         String    @default("queued") @db.VarChar(20) // queued | signed
  signedAt       DateTime? @map("signed_at")
  pdfUrl         String?   @map("pdf_url") @db.VarChar(2048)
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  tenant       Tenant         @relation(fields: [tenantId], references: [id])
  consultation Consultation   @relation(fields: [consultationId], references: [id])
  patient      Patient        @relation(fields: [patientId], references: [id])
  doctor       User           @relation("LabOrderDoctor", fields: [doctorId], references: [id])
  items        LabOrderItem[]

  @@index([consultationId, groupOrder])
  @@index([tenantId])
  @@index([tenantId, deletedAt])
  @@map("lab_orders")
}

model LabOrderItem {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  labOrderId          String   @map("lab_order_id") @db.Uuid
  testName            String   @map("test_name") @db.VarChar(300)
  indication          String   @db.VarChar(500)
  urgency             String   @default("routine") @db.VarChar(20) // routine | urgent | stat
  fastingRequired     Boolean  @default(false) @map("fasting_required")
  sampleType          String   @default("blood") @map("sample_type") @db.VarChar(50) // blood | urine | stool | csf | other
  specialInstructions String?  @map("special_instructions") @db.Text
  source              String?  @db.VarChar(200)
  createdAt           DateTime @default(now()) @map("created_at")

  labOrder LabOrder @relation(fields: [labOrderId], references: [id])

  @@index([labOrderId])
  @@map("lab_order_items")
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/db test
```

---

## Task 6: Fix Prescription — remove JSON items blob, fix status

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (lines 305–333)

- [ ] **Step 1: Write test**

```typescript
describe('Prescription model', () => {
  it('does not have legacy items Json field', () => {
    const block = schema.match(/model Prescription \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).not.toMatch(/items\s+Json/)
  })
  it('status default is queued', () => {
    const block = schema.match(/model Prescription \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('"queued"')
  })
  it('has doctorId instead of userId', () => {
    const block = schema.match(/model Prescription \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(block).toContain('doctorId')
    expect(block).not.toContain('"user_id"')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/db test
```

- [ ] **Step 3: Update Prescription model**

Replace the `model Prescription` block with:

```prisma
model Prescription {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  tenantId       String    @map("tenant_id") @db.Uuid
  consultationId String?   @map("consultation_id") @db.Uuid
  patientId      String    @map("patient_id") @db.Uuid
  doctorId       String    @map("doctor_id") @db.Uuid
  groupTitle     String?   @map("group_title") @db.VarChar(200)
  groupOrder     Int       @default(1) @map("group_order")
  status         String    @default("queued") @db.VarChar(20) // queued | signed
  signedAt       DateTime? @map("signed_at")
  pdfUrl         String?   @map("pdf_url") @db.VarChar(2048)
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  tenant            Tenant             @relation(fields: [tenantId], references: [id])
  consultation      Consultation?      @relation(fields: [consultationId], references: [id])
  patient           Patient            @relation(fields: [patientId], references: [id])
  doctor            User               @relation("PrescriptionDoctor", fields: [doctorId], references: [id])
  prescriptionItems PrescriptionItem[]

  @@index([tenantId])
  @@index([tenantId, patientId])
  @@index([consultationId, groupOrder])
  @@index([tenantId, deletedAt])
  @@map("prescriptions")
}
```

Also update `PrescriptionItem` to remove `sortOrder` if it's not in the spec, or keep it if used. Ensure the item model maps `prescriptionId` correctly. The existing `PrescriptionItem` model at line 335 should be largely compatible — just verify the FK relation compiles.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/db test
```

---

## Task 7: Run clean migration

**Files:**
- Creates: `packages/db/prisma/migrations/YYYYMMDD_schema_reset_v2/`

- [ ] **Step 1: Validate schema compiles**

```bash
pnpm --filter @rezeta/db exec prisma validate
```

Expected: `The schema at ... is valid`

Fix any compilation errors before continuing. Common issues:
- Broken relation references (one side references a model that no longer exists)
- Missing reverse relations on User/Tenant models
- Ambiguous relations requiring explicit `@relation("name")` on both sides

- [ ] **Step 2: Reset DB and apply schema**

```bash
pnpm --filter @rezeta/db exec prisma migrate reset --force
```

Expected: Database reset, all tables recreated.

- [ ] **Step 3: Generate Prisma client**

```bash
pnpm --filter @rezeta/db exec prisma generate
```

Expected: Prisma Client generated successfully.

- [ ] **Step 4: Run all tests**

```bash
pnpm test
```

Expected: All tests pass or fail for reasons unrelated to the schema (stale repository code will fail — that's expected and addressed in Plans 2 and 3).

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "feat(db): schema reset v2 — remove SOAP, add ProtocolCategory, normalize orders"
```

---

## Task 8: Update shared Zod schemas — consultation.ts

**Files:**
- Modify: `packages/shared/src/schemas/consultation.ts`

- [ ] **Step 1: Write test**

Create `packages/shared/src/__tests__/consultation-schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { CreateConsultationSchema, AmendConsultationSchema } from '../schemas/consultation.js'

describe('CreateConsultationSchema', () => {
  it('accepts minimal walk-in payload (no appointmentId, no protocolId)', () => {
    const result = CreateConsultationSchema.safeParse({
      patientId: 'a0000000-0000-0000-0000-000000000001',
      locationId: 'a0000000-0000-0000-0000-000000000002',
    })
    expect(result.success).toBe(true)
  })
  it('rejects payload with SOAP fields (they no longer exist)', () => {
    // CreateConsultationSchema should not have subjective/objective fields
    const schema = CreateConsultationSchema.shape
    expect('subjective' in schema).toBe(false)
    expect('chiefComplaint' in schema).toBe(false)
    expect('vitals' in schema).toBe(false)
  })
  it('rejects missing patientId', () => {
    const result = CreateConsultationSchema.safeParse({ locationId: 'a0000000-0000-0000-0000-000000000002' })
    expect(result.success).toBe(false)
  })
})

describe('AmendConsultationSchema', () => {
  it('requires reason', () => {
    const result = AmendConsultationSchema.safeParse({ reason: '' })
    expect(result.success).toBe(false)
  })
  it('accepts reason + amendment_content', () => {
    const result = AmendConsultationSchema.safeParse({
      reason: 'Corrección de diagnóstico erróneo',
      amendment_content: { note: 'Patient has type 2, not type 1' },
    })
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/shared test
```

- [ ] **Step 3: Rewrite consultation.ts**

Replace `packages/shared/src/schemas/consultation.ts` with:

```typescript
import { z } from 'zod'

export const CreateConsultationSchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  appointmentId: z.string().uuid().nullable().optional(),
})

export const AddProtocolUsageSchema = z.object({
  protocolId: z.string().uuid(),
  parentUsageId: z.string().uuid().optional(),
  triggerBlockId: z.string().max(100).optional(),
})

const ProtocolContentSchema = z.object({
  version: z.string(),
  template_version: z.string().optional(),
  blocks: z.array(z.record(z.string(), z.unknown())),
})

const StepEventSchema = z.object({
  step_id: z.string().min(1).max(200),
  timestamp: z.string().datetime(),
  reason: z.string().min(1).max(500).optional(),
})

const ModificationsSchema = z.object({
  steps_completed: z.array(StepEventSchema).optional(),
  steps_skipped: z.array(StepEventSchema).optional(),
  checklist_items: z.array(z.record(z.string(), z.unknown())).optional(),
  decision_branches: z.array(z.record(z.string(), z.unknown())).optional(),
  vitals_entered: z.array(z.record(z.string(), z.unknown())).optional(),
  notes_edited: z.array(z.record(z.string(), z.unknown())).optional(),
  medication_changes: z.array(z.record(z.string(), z.unknown())).optional(),
  imaging_orders_queued: z.array(z.record(z.string(), z.unknown())).optional(),
  lab_orders_queued: z.array(z.record(z.string(), z.unknown())).optional(),
})

export const UpdateProtocolUsageSchema = z.object({
  content: ProtocolContentSchema.optional(),
  modifications: ModificationsSchema.optional(),
  modificationSummary: z.string().max(500).nullable().optional(),
  status: z.enum(['in_progress', 'completed', 'abandoned']).optional(),
  completedAt: z.string().datetime().nullable().optional(),
})

export const AmendConsultationSchema = z.object({
  reason: z.string().min(10).max(1000),
  amendment_content: z.record(z.string(), z.unknown()).optional(),
})

const PrescriptionItemSchema = z.object({
  drug: z.string().min(1).max(300),
  dose: z.string().min(1).max(200),
  route: z.string().min(1).max(100),
  frequency: z.string().min(1).max(200),
  duration: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreatePrescriptionGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  items: z.array(PrescriptionItemSchema).min(1),
})

export const UpdatePrescriptionGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).optional(),
  items: z.array(PrescriptionItemSchema).optional(),
})

const ImagingOrderItemSchema = z.object({
  studyType: z.string().min(1).max(300),
  indication: z.string().min(1).max(500),
  urgency: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  contrast: z.boolean().default(false),
  fastingRequired: z.boolean().default(false),
  specialInstructions: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreateImagingOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  items: z.array(ImagingOrderItemSchema).min(1),
})

export const UpdateImagingOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).optional(),
  items: z.array(ImagingOrderItemSchema).optional(),
})

const LabOrderItemSchema = z.object({
  testName: z.string().min(1).max(300),
  indication: z.string().min(1).max(500),
  urgency: z.enum(['routine', 'urgent', 'stat']).default('routine'),
  fastingRequired: z.boolean().default(false),
  sampleType: z.enum(['blood', 'urine', 'stool', 'csf', 'other']).default('blood'),
  specialInstructions: z.string().max(2000).optional(),
  source: z.string().max(200).optional(),
})

export const CreateLabOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).default(1),
  items: z.array(LabOrderItemSchema).min(1),
})

export const UpdateLabOrderGroupSchema = z.object({
  groupTitle: z.string().max(200).nullable().optional(),
  groupOrder: z.number().int().min(1).optional(),
  items: z.array(LabOrderItemSchema).optional(),
})

export type CreateConsultationDto = z.infer<typeof CreateConsultationSchema>
export type AmendConsultationDto = z.infer<typeof AmendConsultationSchema>
export type AddProtocolUsageDto = z.infer<typeof AddProtocolUsageSchema>
export type UpdateProtocolUsageDto = z.infer<typeof UpdateProtocolUsageSchema>
export type CreatePrescriptionGroupDto = z.infer<typeof CreatePrescriptionGroupSchema>
export type UpdatePrescriptionGroupDto = z.infer<typeof UpdatePrescriptionGroupSchema>
export type CreateImagingOrderGroupDto = z.infer<typeof CreateImagingOrderGroupSchema>
export type UpdateImagingOrderGroupDto = z.infer<typeof UpdateImagingOrderGroupSchema>
export type CreateLabOrderGroupDto = z.infer<typeof CreateLabOrderGroupSchema>
export type UpdateLabOrderGroupDto = z.infer<typeof UpdateLabOrderGroupSchema>
```

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/shared test
```

---

## Task 9: Update shared Zod schemas — protocol.ts (add vitals + clinical_notes blocks)

**Files:**
- Modify: `packages/shared/src/schemas/protocol.ts`

- [ ] **Step 1: Write test**

Add to `packages/shared/src/__tests__/protocol-schema.test.ts` (create if not exists):

```typescript
import { describe, it, expect } from 'vitest'
import { TemplateBlockSchema, ProtocolBlockSchema, CreateProtocolCategorySchema } from '../schemas/protocol.js'

describe('vitals block in TemplateBlockSchema', () => {
  it('accepts a valid vitals block', () => {
    const result = TemplateBlockSchema.safeParse({
      id: 'blk_001',
      type: 'vitals',
      fields: [
        { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
        { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('clinical_notes block in TemplateBlockSchema', () => {
  it('accepts a valid clinical_notes block', () => {
    const result = TemplateBlockSchema.safeParse({
      id: 'blk_002',
      type: 'clinical_notes',
      label: 'Motivo de consulta',
      required: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateProtocolCategorySchema', () => {
  it('accepts name + color', () => {
    const result = CreateProtocolCategorySchema.safeParse({ name: 'Emergencias', color: '#EF4444' })
    expect(result.success).toBe(true)
  })
  it('requires name', () => {
    const result = CreateProtocolCategorySchema.safeParse({ color: '#EF4444' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/shared test
```

- [ ] **Step 3: Add vitals + clinical_notes blocks to protocol schemas**

In `packages/shared/src/schemas/protocol.ts`:

After the existing `BaseTemplateBlockSchema` definition, add these new item schemas:

```typescript
export const VitalsFieldSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  unit: z.string().max(50).optional(),
  input_type: z.enum(['text', 'number', 'computed']),
  formula: z.string().max(200).optional(),
})
```

In the `TemplateBlockSchema` discriminated union, add two new variants:

```typescript
    BaseTemplateBlockSchema.extend({
      type: z.literal('vitals'),
      fields: z.array(VitalsFieldSchema).optional(),
    }),
    BaseTemplateBlockSchema.extend({
      type: z.literal('clinical_notes'),
      label: z.string().optional(),
      required: z.boolean().optional(),
      content: z.string().optional(),
    }),
```

In the `ProtocolBlockSchema` discriminated union, add:

```typescript
    BaseBlockSchema.extend({
      type: z.literal('vitals'),
      fields: z.array(VitalsFieldSchema),
      values: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    }),
    BaseBlockSchema.extend({
      type: z.literal('clinical_notes'),
      label: z.string(),
      required: z.boolean().optional(),
      content: z.string(),
    }),
```

Replace the `CreateProtocolSchema` to use `categoryId` instead of `typeId`:

```typescript
export const CreateProtocolSchema = z.object({
  categoryId: z.string().uuid().optional(),
  title: z.string().min(2).max(300),
})

export const ProtocolListQuerySchema = z.object({
  search: z.string().max(300).optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(['draft', 'active', 'archived']).optional(),
  favoritesOnly: z.string().optional().transform((v) => v === 'true'),
  sort: z.enum(['updatedAt_desc', 'updatedAt_asc', 'title_asc', 'title_desc']).optional(),
})
```

Replace ProtocolType schemas with ProtocolCategory schemas:

```typescript
export const CreateProtocolCategorySchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().max(20).optional(),
})

export const UpdateProtocolCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().max(20).optional(),
})

export type CreateProtocolCategoryDto = z.infer<typeof CreateProtocolCategorySchema>
export type UpdateProtocolCategoryDto = z.infer<typeof UpdateProtocolCategorySchema>
```

Remove the old `CreateProtocolTypeSchema`, `UpdateProtocolTypeSchema`, `ProtocolTypeDtoSchema` and their inferred types. Update `ProtocolListItemSchema` and `ProtocolResponseSchema` to use `categoryId`/`categoryName` instead of `typeId`/`typeName`.

- [ ] **Step 4: Run — expect PASS**

```bash
pnpm --filter @rezeta/shared test
```

- [ ] **Step 5: Run full typecheck**

```bash
pnpm typecheck
```

Fix any type errors cascading from the schema changes. Common issues: any place that references `typeId`, `typeName`, `subjective`, `objective`, `chiefComplaint` in shared types.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/schemas/
git commit -m "feat(shared): update Zod schemas — remove SOAP types, add vitals/clinical_notes, ProtocolCategory"
```

---

## Self-Review

**Spec coverage check:**
- [x] Consultation SOAP fields removed (chiefComplaint, subjective, objective, assessment, plan, vitals, diagnoses)
- [x] Consultation status: open | signed | amended (was draft | signed)
- [x] appointmentId no longer unique (walk-ins)
- [x] startedAt replaces consultedAt
- [x] ProtocolCategory model added (name, color, isSeeded)
- [x] ProtocolType model removed
- [x] Protocol.categoryId replaces Protocol.typeId
- [x] ImagingOrderItem sub-table added, ImagingOrder is pure group
- [x] LabOrderItem sub-table added, LabOrder is pure group
- [x] Prescription removes JSON blob, status queued not draft
- [x] vitals block added to block schemas
- [x] clinical_notes block added to block schemas

**Type consistency:** `doctorId` used consistently on Consultation, Prescription, ImagingOrder, LabOrder. `categoryId` used in Protocol and all schemas.
