# Consultation API Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the consultation backend to match the new workflow: no SOAP fields, status `open → signed → amended`, walk-in support (no appointment required), protocol management via `/consultations/:id/protocols`, and order group CRUD via normalized sub-routes.

**Architecture:** All changes are in `apps/api/src/modules/consultations/` and `apps/api/src/modules/orders/`. The consultation module gains protocol-management endpoints. The orders module gets updated to work with the normalized `ImagingOrderItem` and `LabOrderItem` sub-tables.

**Tech Stack:** NestJS + Prisma + Zod, pnpm monorepo

**Prerequisite:** Plans 01 and 02 complete — schema reset done, `ProtocolCategory` exists, shared schemas updated.

---

## File Map

| Action | File |
|---|---|
| Modify | `apps/api/src/modules/consultations/consultations.controller.ts` |
| Modify | `apps/api/src/modules/consultations/consultations.service.ts` |
| Modify | `apps/api/src/modules/consultations/consultations.repository.ts` |
| Modify | `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts` |
| Modify | `apps/api/src/modules/consultations/__tests__/consultations.controller.spec.ts` |
| Modify | `apps/api/src/modules/consultations/__tests__/consultations.repository.spec.ts` |
| Modify | `apps/api/src/modules/orders/orders.controller.ts` |
| Modify | `apps/api/src/modules/orders/orders.service.ts` |
| Modify | `apps/api/src/modules/orders/orders.repository.ts` |
| Modify | `apps/api/src/modules/orders/__tests__/orders.service.spec.ts` |

---

## Task 1: Update consultation creation — remove SOAP gate, support walk-ins

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.service.ts`
- Modify: `apps/api/src/modules/consultations/consultations.repository.ts`
- Modify: `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts`

- [ ] **Step 1: Write failing tests**

In `consultations.service.spec.ts`, add/replace:

```typescript
describe('create', () => {
  it('creates walk-in consultation without appointmentId', async () => {
    const mockConsultation = {
      id: 'c-1',
      status: 'open',
      patientId: 'p-1',
      doctorId: 'u-1',
      locationId: 'loc-1',
      appointmentId: null,
      startedAt: new Date(),
    }
    mockRepo.create.mockResolvedValue(mockConsultation)

    const result = await service.create('tenant-1', 'u-1', {
      patientId: 'p-1',
      locationId: 'loc-1',
      // no appointmentId — walk-in
    })

    expect(result.status).toBe('open')
    expect(result.appointmentId).toBeNull()
  })

  it('creates planned consultation with appointmentId', async () => {
    const mockConsultation = {
      id: 'c-2',
      status: 'open',
      patientId: 'p-1',
      doctorId: 'u-1',
      locationId: 'loc-1',
      appointmentId: 'appt-1',
      startedAt: new Date(),
    }
    mockRepo.create.mockResolvedValue(mockConsultation)

    const result = await service.create('tenant-1', 'u-1', {
      patientId: 'p-1',
      locationId: 'loc-1',
      appointmentId: 'appt-1',
    })

    expect(result.appointmentId).toBe('appt-1')
  })

  it('does NOT accept SOAP fields', async () => {
    // CreateConsultationDto no longer has these fields — TypeScript enforces at compile time,
    // but this test ensures no sneaky pass-through
    mockRepo.create.mockResolvedValue({ id: 'c-3', status: 'open' })
    const dto = { patientId: 'p-1', locationId: 'loc-1' }
    // @ts-expect-error — subjective is not part of the DTO
    expect(() => service.create('t-1', 'u-1', { ...dto, subjective: 'notes' })).not.toThrow()
    // The key assertion: repository is never called with subjective
    expect(mockRepo.create).toHaveBeenCalledWith(
      't-1',
      'u-1',
      expect.not.objectContaining({ subjective: expect.anything() }),
    )
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern consultations.service
```

- [ ] **Step 3: Update repository create method**

In `consultations.repository.ts`, replace the `create` method:

```typescript
async create(
  tenantId: string,
  doctorId: string,
  dto: { patientId: string; locationId: string; appointmentId?: string | null },
) {
  return this.prisma.consultation.create({
    data: {
      tenantId,
      patientId: dto.patientId,
      doctorId,
      locationId: dto.locationId,
      appointmentId: dto.appointmentId ?? null,
      status: 'open',
    },
    include: {
      patient: true,
      location: true,
      protocolUsages: {
        where: { deletedAt: null },
        include: { protocol: { select: { id: true, title: true } } },
      },
    },
  })
}
```

Remove from the `findById` include any SOAP field projections.

- [ ] **Step 4: Update service create method**

```typescript
async create(tenantId: string, doctorId: string, dto: CreateConsultationDto) {
  return this.repo.create(tenantId, doctorId, {
    patientId: dto.patientId,
    locationId: dto.locationId,
    appointmentId: dto.appointmentId ?? null,
  })
}
```

Remove any `protocolId` handling from the create method — protocols are added after creation.

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern consultations.service
```

---

## Task 2: Update consultation sign endpoint — atomic completion

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.service.ts`
- Modify: `apps/api/src/modules/consultations/__tests__/consultations.service.spec.ts`

The sign action must atomically:
1. Mark all `ProtocolUsage` records for this consultation as `completed`
2. Set all `queued` orders (Prescription, LabOrder, ImagingOrder) to `signed`
3. Set `Consultation.status = 'signed'` and `signedAt = now()`

- [ ] **Step 1: Write failing test**

```typescript
describe('sign', () => {
  it('marks consultation signed, completes all protocol usages, and signs all queued orders', async () => {
    const consultationId = 'c-sign-1'
    mockRepo.findById.mockResolvedValue({
      id: consultationId,
      status: 'open',
      tenantId: 'tenant-1',
    })
    mockRepo.signConsultation.mockResolvedValue({
      id: consultationId,
      status: 'signed',
      signedAt: new Date(),
    })

    const result = await service.sign('tenant-1', 'doctor-1', consultationId)

    expect(mockRepo.signConsultation).toHaveBeenCalledWith('tenant-1', consultationId)
    expect(result.status).toBe('signed')
  })

  it('throws ConflictException if consultation is already signed', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c-1', status: 'signed' })
    await expect(service.sign('tenant-1', 'doctor-1', 'c-1')).rejects.toThrow('already signed')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern consultations.service
```

- [ ] **Step 3: Implement signConsultation in repository**

Add to `consultations.repository.ts`:

```typescript
async signConsultation(tenantId: string, consultationId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Complete all in-progress protocol usages
    await tx.protocolUsage.updateMany({
      where: { consultationId, status: 'in_progress', deletedAt: null },
      data: { status: 'completed', completedAt: new Date() },
    })

    // 2. Sign all queued prescriptions
    await tx.prescription.updateMany({
      where: { consultationId, status: 'queued', deletedAt: null },
      data: { status: 'signed', signedAt: new Date() },
    })

    // 3. Sign all queued lab orders
    await tx.labOrder.updateMany({
      where: { consultationId, status: 'queued', deletedAt: null },
      data: { status: 'signed', signedAt: new Date() },
    })

    // 4. Sign all queued imaging orders
    await tx.imagingOrder.updateMany({
      where: { consultationId, status: 'queued', deletedAt: null },
      data: { status: 'signed', signedAt: new Date() },
    })

    // 5. Mark consultation signed
    return tx.consultation.update({
      where: { id: consultationId },
      data: { status: 'signed', signedAt: new Date() },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        prescriptions: {
          where: { deletedAt: null },
          include: { prescriptionItems: true },
        },
        labOrders: {
          where: { deletedAt: null },
          include: { items: true },
        },
        imagingOrders: {
          where: { deletedAt: null },
          include: { items: true },
        },
        protocolUsages: {
          where: { deletedAt: null },
          select: { id: true, status: true, protocol: { select: { title: true } } },
        },
      },
    })
  })
}
```

- [ ] **Step 4: Implement sign in service**

```typescript
async sign(tenantId: string, doctorId: string, consultationId: string) {
  const consultation = await this.repo.findById(tenantId, consultationId)
  if (!consultation) throw new NotFoundException(`Consultation ${consultationId} not found`)
  if (consultation.status !== 'open') {
    throw new ConflictException(`Consultation is already ${consultation.status}`)
  }
  return this.repo.signConsultation(tenantId, consultationId)
}
```

- [ ] **Step 5: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern consultations.service
```

---

## Task 3: Add protocol-in-consultation management endpoints

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.controller.ts`
- Modify: `apps/api/src/modules/consultations/consultations.service.ts`
- Modify: `apps/api/src/modules/consultations/consultations.repository.ts`

These endpoints manage `ProtocolUsage` records within an open consultation.

Routes:
- `POST /v1/consultations/:id/protocols` — add a protocol (creates ProtocolUsage snapshot)
- `PATCH /v1/consultations/:id/protocols/:usageId` — update usage (block interactions)
- `DELETE /v1/consultations/:id/protocols/:usageId` — abandon usage

- [ ] **Step 1: Write failing tests**

Add to `consultations.service.spec.ts`:

```typescript
describe('addProtocol', () => {
  it('creates a ProtocolUsage snapshot for the given protocol', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c-1', status: 'open', tenantId: 'tenant-1' })
    mockProtocolRepo.findActiveVersion.mockResolvedValue({
      id: 'v-1',
      protocolId: 'proto-1',
      content: { version: '1', blocks: [] },
    })
    mockRepo.createProtocolUsage.mockResolvedValue({
      id: 'usage-1',
      protocolId: 'proto-1',
      consultationId: 'c-1',
      status: 'in_progress',
    })

    const result = await service.addProtocol('tenant-1', 'u-1', 'c-1', { protocolId: 'proto-1' })
    expect(result.status).toBe('in_progress')
  })

  it('throws if consultation is not open', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'c-1', status: 'signed' })
    await expect(service.addProtocol('tenant-1', 'u-1', 'c-1', { protocolId: 'proto-1' })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern consultations.service
```

- [ ] **Step 3: Add createProtocolUsage to repository**

```typescript
async createProtocolUsage(
  tenantId: string,
  consultationId: string,
  userId: string,
  dto: AddProtocolUsageDto,
  versionSnapshot: { id: string; protocolId: string; content: unknown },
) {
  return this.prisma.protocolUsage.create({
    data: {
      tenantId,
      consultationId,
      protocolId: versionSnapshot.protocolId,
      protocolVersionId: versionSnapshot.id,
      userId,
      patientId: undefined, // set from consultation if needed
      content: versionSnapshot.content as object,
      parentUsageId: dto.parentUsageId ?? null,
      triggerBlockId: dto.triggerBlockId ?? null,
      status: 'in_progress',
    },
  })
}

async updateProtocolUsage(tenantId: string, usageId: string, dto: UpdateProtocolUsageDto) {
  return this.prisma.protocolUsage.update({
    where: { id: usageId },
    data: {
      ...(dto.content !== undefined && { content: dto.content as object }),
      ...(dto.modifications !== undefined && { modifications: dto.modifications as object }),
      ...(dto.modificationSummary !== undefined && { modificationSummary: dto.modificationSummary }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.completedAt !== undefined && {
        completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
      }),
    },
  })
}

async abandonProtocolUsage(tenantId: string, usageId: string) {
  return this.prisma.protocolUsage.update({
    where: { id: usageId },
    data: { status: 'abandoned', deletedAt: new Date() },
  })
}
```

- [ ] **Step 4: Add methods to service**

```typescript
async addProtocol(tenantId: string, doctorId: string, consultationId: string, dto: AddProtocolUsageDto) {
  const consultation = await this.repo.findById(tenantId, consultationId)
  if (!consultation) throw new NotFoundException(`Consultation ${consultationId} not found`)
  if (consultation.status !== 'open') throw new ConflictException('Consultation is not open')

  const version = await this.protocolsService.getActiveVersion(tenantId, dto.protocolId)
  if (!version) throw new NotFoundException(`No active version for protocol ${dto.protocolId}`)

  return this.repo.createProtocolUsage(tenantId, consultationId, doctorId, dto, version)
}

async updateProtocolUsage(tenantId: string, consultationId: string, usageId: string, dto: UpdateProtocolUsageDto) {
  const consultation = await this.repo.findById(tenantId, consultationId)
  if (!consultation) throw new NotFoundException(`Consultation ${consultationId} not found`)
  if (consultation.status !== 'open') throw new ConflictException('Consultation is not open')
  return this.repo.updateProtocolUsage(tenantId, usageId, dto)
}

async abandonProtocolUsage(tenantId: string, consultationId: string, usageId: string) {
  const consultation = await this.repo.findById(tenantId, consultationId)
  if (!consultation) throw new NotFoundException(`Consultation ${consultationId} not found`)
  if (consultation.status !== 'open') throw new ConflictException('Consultation is not open')
  return this.repo.abandonProtocolUsage(tenantId, usageId)
}
```

Note: `this.protocolsService` needs to be injected. Inject `ProtocolsService` into `ConsultationsModule` imports and add to constructor.

- [ ] **Step 5: Add controller routes**

In `consultations.controller.ts`, add:

```typescript
@Post(':id/protocols')
addProtocol(
  @TenantId() tenantId: string,
  @UserId() doctorId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @Body(new ZodValidationPipe(AddProtocolUsageSchema)) dto: AddProtocolUsageDto,
) {
  return this.service.addProtocol(tenantId, doctorId, id, dto)
}

@Patch(':id/protocols/:usageId')
updateProtocolUsage(
  @TenantId() tenantId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @Param('usageId', ParseUUIDPipe) usageId: string,
  @Body(new ZodValidationPipe(UpdateProtocolUsageSchema)) dto: UpdateProtocolUsageDto,
) {
  return this.service.updateProtocolUsage(tenantId, id, usageId, dto)
}

@Delete(':id/protocols/:usageId')
abandonProtocolUsage(
  @TenantId() tenantId: string,
  @Param('id', ParseUUIDPipe) id: string,
  @Param('usageId', ParseUUIDPipe) usageId: string,
) {
  return this.service.abandonProtocolUsage(tenantId, id, usageId)
}
```

Import `AddProtocolUsageSchema`, `AddProtocolUsageDto`, `UpdateProtocolUsageSchema`, `UpdateProtocolUsageDto` from `@rezeta/shared`.

- [ ] **Step 6: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern consultations
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/consultations/
git commit -m "feat(api): consultation workflow redesign — open status, walk-in, protocol management, atomic sign"
```

---

## Task 4: Update orders module — normalized ImagingOrderItem and LabOrderItem

**Files:**
- Modify: `apps/api/src/modules/orders/orders.repository.ts`
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Modify: `apps/api/src/modules/orders/__tests__/orders.service.spec.ts`

The key changes: ImagingOrder and LabOrder are now group records with item sub-tables. The existing repository created one `ImagingOrder`/`LabOrder` per item (groupTitle/groupOrder used for logical grouping). Now we create one `ImagingOrder` per group and multiple `ImagingOrderItem` records per group.

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/modules/orders/__tests__/orders.service.spec.ts` (replace or add):

```typescript
import { Test } from '@nestjs/testing'
import { OrdersService } from '../orders.service.js'
import { OrdersRepository } from '../orders.repository.js'

const mockRepo = {
  createPrescriptionGroup: jest.fn(),
  createImagingOrderGroup: jest.fn(),
  createLabOrderGroup: jest.fn(),
  getOrdersForConsultation: jest.fn(),
  updatePrescriptionGroup: jest.fn(),
  deletePrescriptionGroup: jest.fn(),
}

describe('OrdersService', () => {
  let service: OrdersService

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: mockRepo },
      ],
    }).compile()
    service = module.get(OrdersService)
    jest.clearAllMocks()
  })

  it('createImagingOrderGroup creates group with item sub-records', async () => {
    mockRepo.createImagingOrderGroup.mockResolvedValue({
      id: 'io-1',
      groupTitle: 'Urgente',
      groupOrder: 1,
      status: 'queued',
      items: [{ id: 'item-1', studyType: 'Rx de tórax', urgency: 'urgent' }],
    })
    const result = await service.createImagingOrderGroup('tenant-1', 'c-1', 'p-1', 'doc-1', {
      groupTitle: 'Urgente',
      groupOrder: 1,
      items: [{ studyType: 'Rx de tórax', indication: 'Dolor torácico', urgency: 'urgent', contrast: false, fastingRequired: false }],
    })
    expect(result.status).toBe('queued')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].studyType).toBe('Rx de tórax')
  })

  it('createLabOrderGroup creates group with item sub-records', async () => {
    mockRepo.createLabOrderGroup.mockResolvedValue({
      id: 'lo-1',
      groupTitle: 'Referencia',
      items: [{ id: 'item-1', testName: 'Hemograma completo' }],
    })
    const result = await service.createLabOrderGroup('tenant-1', 'c-1', 'p-1', 'doc-1', {
      groupTitle: 'Referencia',
      groupOrder: 1,
      items: [{ testName: 'Hemograma completo', indication: 'Control anual', urgency: 'routine', fastingRequired: false, sampleType: 'blood' }],
    })
    expect(result.items[0].testName).toBe('Hemograma completo')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern orders.service
```

- [ ] **Step 3: Rewrite orders repository for normalized model**

Replace `createImagingOrderGroup` in `orders.repository.ts`:

```typescript
async createImagingOrderGroup(
  tenantId: string,
  consultationId: string,
  patientId: string,
  doctorId: string,
  dto: CreateImagingOrderGroupDto,
) {
  return this.prisma.imagingOrder.create({
    data: {
      tenantId,
      consultationId,
      patientId,
      doctorId,
      groupTitle: dto.groupTitle ?? null,
      groupOrder: dto.groupOrder ?? 1,
      status: 'queued',
      items: {
        create: dto.items.map((item) => ({
          studyType: item.studyType,
          indication: item.indication,
          urgency: item.urgency ?? 'routine',
          contrast: item.contrast ?? false,
          fastingRequired: item.fastingRequired ?? false,
          specialInstructions: item.specialInstructions ?? null,
          source: item.source ?? 'manual',
        })),
      },
    },
    include: { items: true },
  })
}

async createLabOrderGroup(
  tenantId: string,
  consultationId: string,
  patientId: string,
  doctorId: string,
  dto: CreateLabOrderGroupDto,
) {
  return this.prisma.labOrder.create({
    data: {
      tenantId,
      consultationId,
      patientId,
      doctorId,
      groupTitle: dto.groupTitle ?? null,
      groupOrder: dto.groupOrder ?? 1,
      status: 'queued',
      items: {
        create: dto.items.map((item) => ({
          testName: item.testName,
          indication: item.indication,
          urgency: item.urgency ?? 'routine',
          fastingRequired: item.fastingRequired ?? false,
          sampleType: item.sampleType ?? 'blood',
          specialInstructions: item.specialInstructions ?? null,
          source: item.source ?? 'manual',
        })),
      },
    },
    include: { items: true },
  })
}
```

Also update `getOrdersForConsultation` to include the items:

```typescript
async getOrdersForConsultation(tenantId: string, consultationId: string) {
  const [prescriptions, imagingOrders, labOrders] = await Promise.all([
    this.prisma.prescription.findMany({
      where: { consultationId, deletedAt: null },
      include: { prescriptionItems: { orderBy: { createdAt: 'asc' } } },
      orderBy: { groupOrder: 'asc' },
    }),
    this.prisma.imagingOrder.findMany({
      where: { consultationId, deletedAt: null },
      include: { items: true },
      orderBy: { groupOrder: 'asc' },
    }),
    this.prisma.labOrder.findMany({
      where: { consultationId, deletedAt: null },
      include: { items: true },
      orderBy: { groupOrder: 'asc' },
    }),
  ])
  return { prescriptions, imagingOrders, labOrders }
}
```

- [ ] **Step 4: Update orders service**

Update `createImagingOrderGroup` and `createLabOrderGroup` in `orders.service.ts` to pull `patientId` and `doctorId` from the consultation record (not from the DTO):

```typescript
async createImagingOrderGroup(
  tenantId: string,
  doctorId: string,
  consultationId: string,
  dto: CreateImagingOrderGroupDto,
) {
  const consultation = await this.consultationRepo.findById(tenantId, consultationId)
  if (!consultation) throw new NotFoundException('Consultation not found')
  if (consultation.status !== 'open') throw new ConflictException('Consultation is not open')
  return this.repo.createImagingOrderGroup(
    tenantId,
    consultationId,
    consultation.patientId,
    doctorId,
    dto,
  )
}

async createLabOrderGroup(
  tenantId: string,
  doctorId: string,
  consultationId: string,
  dto: CreateLabOrderGroupDto,
) {
  const consultation = await this.consultationRepo.findById(tenantId, consultationId)
  if (!consultation) throw new NotFoundException('Consultation not found')
  if (consultation.status !== 'open') throw new ConflictException('Consultation is not open')
  return this.repo.createLabOrderGroup(
    tenantId,
    consultationId,
    consultation.patientId,
    doctorId,
    dto,
  )
}
```

Inject `ConsultationsRepository` (or a lighter service) into `OrdersService`. Add `ConsultationsModule` to `OrdersModule` imports and export `ConsultationsRepository` from `ConsultationsModule`.

- [ ] **Step 5: Update orders controller routes**

Update route param order in `orders.controller.ts` to use `consultationId` from URL params:

```typescript
@Post('consultations/:consultationId/imaging-orders')
createImagingOrderGroup(
  @TenantId() tenantId: string,
  @UserId() doctorId: string,
  @Param('consultationId', ParseUUIDPipe) consultationId: string,
  @Body(new ZodValidationPipe(CreateImagingOrderGroupSchema)) dto: CreateImagingOrderGroupDto,
) {
  return this.service.createImagingOrderGroup(tenantId, doctorId, consultationId, dto)
}

@Post('consultations/:consultationId/lab-orders')
createLabOrderGroup(
  @TenantId() tenantId: string,
  @UserId() doctorId: string,
  @Param('consultationId', ParseUUIDPipe) consultationId: string,
  @Body(new ZodValidationPipe(CreateLabOrderGroupSchema)) dto: CreateLabOrderGroupDto,
) {
  return this.service.createLabOrderGroup(tenantId, doctorId, consultationId, dto)
}

@Get('consultations/:consultationId/orders')
getOrders(
  @TenantId() tenantId: string,
  @Param('consultationId', ParseUUIDPipe) consultationId: string,
) {
  return this.service.getOrdersForConsultation(tenantId, consultationId)
}
```

Add DELETE and PATCH routes for each order type (remove group, rename group title):

```typescript
@Delete('consultations/:consultationId/imaging-orders/:orderId')
deleteImagingOrderGroup(
  @TenantId() tenantId: string,
  @Param('consultationId', ParseUUIDPipe) consultationId: string,
  @Param('orderId', ParseUUIDPipe) orderId: string,
) {
  return this.service.deleteImagingOrderGroup(tenantId, consultationId, orderId)
}

@Patch('consultations/:consultationId/imaging-orders/:orderId')
updateImagingOrderGroup(
  @TenantId() tenantId: string,
  @Param('consultationId', ParseUUIDPipe) consultationId: string,
  @Param('orderId', ParseUUIDPipe) orderId: string,
  @Body(new ZodValidationPipe(UpdateImagingOrderGroupSchema)) dto: UpdateImagingOrderGroupDto,
) {
  return this.service.updateImagingOrderGroup(tenantId, consultationId, orderId, dto)
}
```

Repeat the delete and patch patterns for lab-orders and prescriptions.

- [ ] **Step 6: Run — expect PASS**

```bash
pnpm --filter @rezeta/api test -- --testPathPattern orders
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/orders/ apps/api/src/modules/consultations/
git commit -m "feat(api): update orders module for normalized imaging/lab order item sub-tables"
```

---

## Task 5: Remove SOAP endpoints — update controller

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.controller.ts`

- [ ] **Step 1: Identify SOAP-related endpoints**

```bash
grep -n "subjective\|chiefComplaint\|objective\|assessment\|diagnoses\|vitals" \
  apps/api/src/modules/consultations/consultations.controller.ts
```

- [ ] **Step 2: Remove SOAP update endpoint or fields**

If there is a `PATCH /v1/consultations/:id` that accepts SOAP fields, replace its body validation schema with a stripped-down schema:

```typescript
@Patch(':id')
update(
  @TenantId() tenantId: string,
  @Param('id', ParseUUIDPipe) id: string,
  // Consultations no longer have SOAP fields — no updateable fields at this level
  // Protocol usage updates go to PATCH /v1/consultations/:id/protocols/:usageId
) {
  // This endpoint can be kept as a no-op or removed
  // Only status transitions and amendments are valid update paths
  throw new BadRequestException('Use /protocols/:usageId to update clinical content')
}
```

If the `PATCH /v1/consultations/:id/sign` endpoint doesn't exist yet, add it:

```typescript
@Patch(':id/sign')
sign(
  @TenantId() tenantId: string,
  @UserId() doctorId: string,
  @Param('id', ParseUUIDPipe) id: string,
) {
  return this.service.sign(tenantId, doctorId, id)
}
```

- [ ] **Step 3: Run full test suite**

```bash
pnpm --filter @rezeta/api test
```

Expected: All pass. Fix any remaining test failures.

- [ ] **Step 4: Run typecheck + lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: 0 errors.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(api): remove SOAP endpoints, finalize consultation API redesign"
```

---

## Self-Review

**Spec coverage check:**
- [x] `POST /v1/consultations` — no protocolId required, appointmentId optional
- [x] Status default `open` (not `draft`)
- [x] `PATCH /v1/consultations/:id/sign` — atomic sign: usages completed, orders signed
- [x] `POST /v1/consultations/:id/protocols` — add protocol via snapshot
- [x] `PATCH /v1/consultations/:id/protocols/:usageId` — update usage content
- [x] `DELETE /v1/consultations/:id/protocols/:usageId` — abandon usage
- [x] `GET /v1/consultations/:id/orders` — returns all queued orders
- [x] `POST /v1/consultations/:id/prescriptions` — create prescription group
- [x] `POST /v1/consultations/:id/imaging-orders` — create imaging order group (with items sub-table)
- [x] `POST /v1/consultations/:id/lab-orders` — create lab order group (with items sub-table)
- [x] `DELETE` and `PATCH` routes for each order group type
- [x] No SOAP fields on any endpoint
- [x] Sign throws `ConflictException` if consultation not `open`

**Type consistency:** `doctorId` (not `userId`) in all repository calls. `CreateImagingOrderGroupDto.items` (camelCase) matches updated shared schema.
