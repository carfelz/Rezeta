# Workflow Interconnection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the clinical loop — appointment → consultation → sign → invoice → follow-up — plus patient-page tabs and the walk-in entry path.

**Architecture:** Incremental wiring (per approved spec `docs/superpowers/specs/2026-07-02-workflow-interconnection-design.md`). No new models. Appointment gains an `in_progress` status driven one-way by the consultation lifecycle. All transitions live in API services inside transactions; the UI only renders status.

**Tech Stack:** NestJS + Prisma (apps/api), React 18 + TanStack Query + Tailwind/Radix (apps/web), shared Zod schemas + types (packages/shared).

## Global Constraints

- Spanish user-facing strings; English code/comments.
- Every color/spacing/radius via existing tokens (`text-n-700`, `bg-p-500`, `rounded-md`…); no raw hex/px.
- Icons: Phosphor (`<i className="ph ph-{name}">`).
- Error codes only from the closed enum `packages/shared/src/errors.ts`.
- Repository queries always filter `tenantId` and `deletedAt: null`.
- Soft deletes only; UUIDs; audit via existing service-layer interceptors.
- No `TODO`/`FIXME` comments (ESLint `no-warning-comments` fails CI).
- Tests live in `__tests__/` beside source. **Match the existing test harness in each module's `__tests__` directory** — the test code in this plan defines the cases and assertions; adapt the setup/mock helpers to the local pattern already used there.
- Before finishing any task: `pnpm lint` and `pnpm test` must pass. Coverage bar: 90% (`pnpm test:coverage`).
- Commit after each task with a conventional-commit message.

## Status model (reference for all tasks)

Appointment: `scheduled | in_progress | completed | cancelled | no_show`

| Trigger | Transition |
|---|---|
| Consultation created with `appointmentId` | `scheduled → in_progress` |
| Consultation signed | `in_progress → completed` |
| Open consultation soft-deleted | `in_progress → scheduled` |
| Manual "Completar" | allowed only when appointment has **no** live linked consultation |
| Manual cancel / no_show | blocked while a linked **open** consultation exists |
| Start consultation | blocked on `cancelled` / `no_show` / `completed` appointments |

---

### Task 1: Shared foundations — status enum, types, error codes

**Files:**
- Modify: `packages/shared/src/schemas/appointment.ts`
- Modify: `packages/shared/src/types/appointment.ts`
- Modify: `packages/shared/src/errors.ts`
- Modify: `packages/db/prisma/schema.prisma:222` (comment only)
- Test: `packages/shared/src/schemas/__tests__/appointment.test.ts`

**Interfaces:**
- Produces: `AppointmentStatusSchema` including `'in_progress'`; type `AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'`; `AppointmentWithDetails` gains `consultationId: string | null` and `consultationStatus: 'open' | 'signed' | 'amended' | null`; error codes `APPOINTMENT_NOT_STARTABLE`, `APPOINTMENT_HAS_CONSULTATION`, `APPOINTMENT_HAS_OPEN_CONSULTATION`.

- [ ] **Step 1: Write the failing test**

Add to `packages/shared/src/schemas/__tests__/appointment.test.ts` (create the file if the schema has no test yet, following the pattern of sibling schema tests):

```typescript
import { describe, it, expect } from 'vitest'
import { AppointmentStatusSchema, UpdateAppointmentStatusSchema } from '../appointment'
import { ErrorCode } from '../../errors'

describe('AppointmentStatusSchema', () => {
  it('accepts in_progress', () => {
    expect(AppointmentStatusSchema.safeParse('in_progress').success).toBe(true)
  })

  it('accepts all lifecycle statuses', () => {
    for (const s of ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']) {
      expect(AppointmentStatusSchema.safeParse(s).success).toBe(true)
    }
  })

  it('rejects unknown statuses', () => {
    expect(AppointmentStatusSchema.safeParse('done').success).toBe(false)
  })

  it('UpdateAppointmentStatusSchema accepts in_progress', () => {
    expect(UpdateAppointmentStatusSchema.safeParse({ status: 'in_progress' }).success).toBe(true)
  })
})

describe('appointment workflow error codes', () => {
  it('defines the workflow guard codes', () => {
    expect(ErrorCode.APPOINTMENT_NOT_STARTABLE).toBe('APPOINTMENT_NOT_STARTABLE')
    expect(ErrorCode.APPOINTMENT_HAS_CONSULTATION).toBe('APPOINTMENT_HAS_CONSULTATION')
    expect(ErrorCode.APPOINTMENT_HAS_OPEN_CONSULTATION).toBe('APPOINTMENT_HAS_OPEN_CONSULTATION')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @rezeta/shared test -- appointment`
Expected: FAIL — `in_progress` rejected by enum; error codes undefined.

- [ ] **Step 3: Implement**

`packages/shared/src/schemas/appointment.ts` line 3:

```typescript
export const AppointmentStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
])
```

`packages/shared/src/types/appointment.ts`:

```typescript
export type AppointmentStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentConsultationStatus = 'open' | 'signed' | 'amended'

export interface AppointmentWithDetails extends Appointment {
  patientName: string
  patientDocumentNumber: string | null
  locationName: string
  /** Latest live consultation linked to this appointment (null = none). */
  consultationId: string | null
  consultationStatus: AppointmentConsultationStatus | null
}
```

`packages/shared/src/errors.ts` — add to the closed enum, next to the existing appointment codes (lines 24–26):

```typescript
  APPOINTMENT_NOT_STARTABLE: 'APPOINTMENT_NOT_STARTABLE',
  APPOINTMENT_HAS_CONSULTATION: 'APPOINTMENT_HAS_CONSULTATION',
  APPOINTMENT_HAS_OPEN_CONSULTATION: 'APPOINTMENT_HAS_OPEN_CONSULTATION',
```

`packages/db/prisma/schema.prisma:222` — update the comment (status is `VarChar(30)`, no migration needed):

```prisma
  status     String    @default("scheduled") @db.VarChar(30) // scheduled | in_progress | completed | cancelled | no_show
```

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter @rezeta/shared test && pnpm --filter @rezeta/shared typecheck`
Expected: shared tests PASS. **Note:** `apps/api` will not compile yet because `AppointmentWithDetails` gained two required fields — that is fixed in Task 2, which must land in the same PR/branch. Run `pnpm --filter @rezeta/shared build` so dependents pick up the new types.

- [ ] **Step 5: Commit**

```bash
git add packages/shared packages/db/prisma/schema.prisma
git commit -m "feat(shared): add in_progress appointment status, consultation link fields, workflow error codes"
```

---

### Task 2: API — appointments expose their linked consultation + patientId filter

**Files:**
- Modify: `apps/api/src/modules/appointments/appointments.repository.ts`
- Modify: `apps/api/src/modules/appointments/appointments.controller.ts`
- Test: `apps/api/src/modules/appointments/__tests__/appointments.repository.test.ts` (or the module's existing test file)

**Interfaces:**
- Consumes: `AppointmentWithDetails` from Task 1.
- Produces: every appointment read (findMany/findById/create/update/updateStatus returns) carries `consultationId`/`consultationStatus`; `AppointmentListParams` gains `patientId?: string`; `GET /v1/appointments?patientId=` filter.

- [ ] **Step 1: Write the failing tests**

Cases (adapt to the module's existing harness):

```typescript
describe('appointments consultation link', () => {
  it('findMany maps the latest live consultation onto the appointment', async () => {
    // seed/mocks: appointment A with two consultations — one soft-deleted,
    // one live with status 'open'
    const [appt] = await repo.findMany({ tenantId, userId })
    expect(appt.consultationId).toBe(liveConsultationId)
    expect(appt.consultationStatus).toBe('open')
  })

  it('returns null link fields when no live consultation exists', async () => {
    const [appt] = await repo.findMany({ tenantId, userId })
    expect(appt.consultationId).toBeNull()
    expect(appt.consultationStatus).toBeNull()
  })

  it('filters by patientId when provided', async () => {
    const rows = await repo.findMany({ tenantId, userId, patientId })
    expect(rows.every((r) => r.patientId === patientId)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- appointments`
Expected: FAIL — fields undefined / filter ignored.

- [ ] **Step 3: Implement**

In `appointments.repository.ts`, extract the shared include and use it in `findMany`, `findById`, `create`, `update`, `updateStatus` (every method that returns `AppointmentWithDetails`):

```typescript
const DETAILS_INCLUDE = {
  patient: { select: { firstName: true, lastName: true, documentNumber: true } },
  location: { select: { name: true } },
  consultations: {
    where: { deletedAt: null },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
}
```

Add `patientId?: string` to `AppointmentListParams` and to the `where` in `findMany`:

```typescript
...(params.patientId ? { patientId: params.patientId } : {}),
```

In the `toAppointmentWithDetails` mapper, add:

```typescript
const linked = row.consultations?.[0] ?? null
return {
  // ...existing fields...
  consultationId: linked?.id ?? null,
  consultationStatus: (linked?.status as AppointmentConsultationStatus | undefined) ?? null,
}
```

In `appointments.controller.ts` list handler (next to the existing `locationId`/`from`/`to`/`status` query params), add:

```typescript
@Query('patientId') patientId?: string,
```

and pass it through to the service/repo params (validate as UUID the same way sibling params are validated in this controller).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @rezeta/api test -- appointments && pnpm --filter @rezeta/api typecheck`
Expected: PASS (typecheck now green again after Task 1's type change).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/appointments
git commit -m "feat(api): appointments expose linked consultation and support patientId filter"
```

---

### Task 3: API — creating a consultation from an appointment (validate, idempotent, in_progress)

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.service.ts:96-104` (`create`)
- Modify: `apps/api/src/modules/consultations/consultations.repository.ts:228-245` (`create`)
- Test: `apps/api/src/modules/consultations/__tests__/` (module's existing test file)

**Interfaces:**
- Consumes: error codes from Task 1; existing `CreateConsultationDto` (already has optional `appointmentId`).
- Produces: `ConsultationsRepository.findOpenByAppointment(appointmentId: string, tenantId: string): Promise<ConsultationWithDetails | null>`; `ConsultationsRepository.create` transitions the appointment to `in_progress` in the same transaction.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('create consultation from appointment', () => {
  it('sets appointmentId and moves the appointment to in_progress atomically', async () => {
    const c = await service.create(tenantId, userId, { patientId, locationId, appointmentId })
    expect(c.appointmentId).toBe(appointmentId)
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } })
    expect(appt?.status).toBe('in_progress')
  })

  it('is idempotent: returns the existing open consultation instead of creating a second', async () => {
    const first = await service.create(tenantId, userId, { patientId, locationId, appointmentId })
    const second = await service.create(tenantId, userId, { patientId, locationId, appointmentId })
    expect(second.id).toBe(first.id)
    const count = await prisma.consultation.count({ where: { appointmentId, deletedAt: null } })
    expect(count).toBe(1)
  })

  it('rejects starting on a cancelled appointment with APPOINTMENT_NOT_STARTABLE', async () => {
    // appointment status: 'cancelled'
    await expect(
      service.create(tenantId, userId, { patientId, locationId, appointmentId: cancelledApptId }),
    ).rejects.toMatchObject({ response: { code: 'APPOINTMENT_NOT_STARTABLE' } })
  })

  it('rejects an appointment from another tenant with APPOINTMENT_NOT_FOUND', async () => {
    await expect(
      service.create(tenantId, userId, { patientId, locationId, appointmentId: otherTenantApptId }),
    ).rejects.toMatchObject({ response: { code: 'APPOINTMENT_NOT_FOUND' } })
  })

  it('walk-in (no appointmentId) is unchanged', async () => {
    const c = await service.create(tenantId, userId, { patientId, locationId })
    expect(c.appointmentId).toBeNull()
  })
})
```

Same guards apply to `completed` and `no_show` appointments (add one case each → `APPOINTMENT_NOT_STARTABLE`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- consultations`
Expected: FAIL — appointment stays `scheduled`, duplicate consultations created, no guards.

- [ ] **Step 3: Implement**

`consultations.repository.ts` — add lookup + make `create` transactional:

```typescript
async findOpenByAppointment(
  appointmentId: string,
  tenantId: string,
): Promise<ConsultationWithDetails | null> {
  const row = await this.prisma.consultation.findFirst({
    where: { appointmentId, tenantId, status: 'open', deletedAt: null },
    include: RELATIONS_INCLUDE,
  })
  return row ? toConsultationWithDetails(row) : null
}

async create(
  tenantId: string,
  userId: string,
  dto: CreateConsultationDto,
): Promise<ConsultationWithDetails> {
  const row = await this.prisma.$transaction(async (tx) => {
    const created = await tx.consultation.create({
      data: {
        tenantId,
        doctorId: userId,
        patientId: dto.patientId,
        locationId: dto.locationId,
        ...(dto.appointmentId != null ? { appointmentId: dto.appointmentId } : {}),
        status: 'open',
      },
      include: RELATIONS_INCLUDE,
    })
    if (dto.appointmentId != null) {
      await tx.appointment.update({
        where: { id: dto.appointmentId, tenantId, deletedAt: null },
        data: { status: 'in_progress' },
      })
    }
    return created
  })
  return toConsultationWithDetails(row)
}
```

`consultations.service.ts` — replace `create` (lines 96–104):

```typescript
async create(
  tenantId: string,
  userId: string,
  dto: CreateConsultationDto,
): Promise<ConsultationWithDetails> {
  if (dto.appointmentId != null) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id: dto.appointmentId, tenantId, deletedAt: null },
      select: { status: true },
    })
    if (!appt) {
      throw new NotFoundException({
        code: ErrorCode.APPOINTMENT_NOT_FOUND,
        message: 'Appointment not found',
      })
    }
    if (appt.status !== 'scheduled' && appt.status !== 'in_progress') {
      throw new ConflictException({
        code: ErrorCode.APPOINTMENT_NOT_STARTABLE,
        message: `Cannot start a consultation on a ${appt.status} appointment`,
      })
    }
    const existing = await this.repo.findOpenByAppointment(dto.appointmentId, tenantId)
    if (existing) return existing
  }
  const result = await this.repo.create(tenantId, userId, dto)
  this.recommendationsSvc.invalidate(tenantId, userId, dto.patientId)
  return result
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @rezeta/api test -- consultations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/consultations
git commit -m "feat(api): starting a consultation from an appointment is guarded, idempotent, and marks it in_progress"
```

---

### Task 4: API — signing completes the appointment and reports the invoice outcome

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.service.ts:177-218` (`sign`)
- Modify: `apps/api/src/modules/consultations/consultations.repository.ts:260-290` (`sign`)
- Modify: `apps/api/src/modules/invoices/invoices.service.ts:132-161` (`createFromConsultation`)
- Modify: `packages/shared/src/types/consultation.ts` (add `InvoiceOutcome`, extend sign response type)
- Test: consultations + invoices `__tests__/`

**Interfaces:**
- Produces:
  ```typescript
  // packages/shared/src/types/consultation.ts
  export type InvoiceOutcome =
    | { status: 'created'; invoiceId: string; total: number; currency: string }
    | { status: 'skipped_no_fee' }
    | { status: 'failed' }
  export interface SignConsultationResponse extends ConsultationWithDetails {
    invoiceOutcome: InvoiceOutcome
  }
  ```
  `InvoicesService.createFromConsultation(...): Promise<InvoiceOutcome>` (never throws — returns `{ status: 'failed' }`); `ConsultationsService.sign(...): Promise<SignConsultationResponse>`; `ConsultationsRepository.sign(id, tenantId, userId, appointmentId: string | null)` completes the appointment in the same transaction.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('sign completes the linked appointment', () => {
  it('marks the appointment completed in the same transaction', async () => {
    const res = await service.sign(consultationId, tenantId, userId)
    expect(res.status).toBe('signed')
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } })
    expect(appt?.status).toBe('completed')
  })

  it('walk-in sign leaves no appointment touched', async () => {
    const res = await service.sign(walkInConsultationId, tenantId, userId)
    expect(res.status).toBe('signed')
  })
})

describe('sign reports invoice outcome', () => {
  it('returns created with invoiceId when a fee is configured', async () => {
    const res = await service.sign(consultationId, tenantId, userId)
    expect(res.invoiceOutcome.status).toBe('created')
    if (res.invoiceOutcome.status === 'created') {
      expect(res.invoiceOutcome.invoiceId).toBeTruthy()
    }
  })

  it('returns skipped_no_fee when DoctorLocation fee is 0 or missing', async () => {
    const res = await service.sign(noFeeConsultationId, tenantId, userId)
    expect(res.invoiceOutcome).toEqual({ status: 'skipped_no_fee' })
  })

  it('returns failed (and still signs) when invoice creation throws', async () => {
    // mock invoicesSvc/repo to throw
    const res = await service.sign(consultationId, tenantId, userId)
    expect(res.status).toBe('signed')
    expect(res.invoiceOutcome).toEqual({ status: 'failed' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- consultations invoices`
Expected: FAIL.

- [ ] **Step 3: Implement**

`invoices.service.ts` — `createFromConsultation` now returns the outcome and swallows its own errors:

```typescript
async createFromConsultation(params: {
  consultationId: string
  patientId: string
  locationId: string
  userId: string
  tenantId: string
}): Promise<InvoiceOutcome> {
  try {
    const dl = await this.prisma.doctorLocation.findFirst({
      where: { userId: params.userId, locationId: params.locationId },
      select: { consultationFee: true, commissionPct: true },
    })
    if (!dl || Number(dl.consultationFee) === 0) return { status: 'skipped_no_fee' }

    const fee = Number(dl.consultationFee)
    const commissionPct = Number(dl.commissionPct)
    const row = await this.repo.create(
      params.tenantId,
      params.userId,
      {
        patientId: params.patientId,
        locationId: params.locationId,
        consultationId: params.consultationId,
        currency: 'DOP',
        items: [{ description: 'Consulta médica', quantity: 1, unitPrice: fee, total: fee }],
      },
      commissionPct,
    )
    return { status: 'created', invoiceId: row.id, total: Number(row.total), currency: row.currency }
  } catch {
    return { status: 'failed' }
  }
}
```

`consultations.repository.ts` — `sign` accepts the appointment to complete (add inside the existing `$transaction`, after the order updates):

```typescript
async sign(
  id: string,
  tenantId: string,
  _userId: string,
  appointmentId: string | null,
): Promise<ConsultationWithDetails> {
  // ...existing transaction body...
      if (appointmentId != null) {
        await tx.appointment.updateMany({
          where: { id: appointmentId, tenantId, deletedAt: null, status: 'in_progress' },
          data: { status: 'completed' },
        })
      }
  // ...
}
```

(`updateMany` with the `status: 'in_progress'` filter keeps the write idempotent and never touches manually-completed/cancelled rows.)

`consultations.service.ts` — `sign` awaits the outcome and returns it (replaces the `void … .catch(() => undefined)` block at lines 206–215):

```typescript
async sign(id: string, tenantId: string, userId: string): Promise<SignConsultationResponse> {
  // ...existing validations unchanged...
  const result = await this.repo.sign(id, tenantId, userId, c.appointmentId ?? null)
  const invoiceOutcome = await this.invoicesSvc.createFromConsultation({
    consultationId: id,
    patientId: c.patientId,
    locationId: c.locationId,
    userId,
    tenantId,
  })
  return { ...result, invoiceOutcome }
}
```

Update the controller's sign handler return type to `SignConsultationResponse`.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @rezeta/api test && pnpm --filter @rezeta/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api packages/shared
git commit -m "feat(api): signing completes the linked appointment and returns the invoice outcome"
```

---

### Task 5: API — deletion reverts the appointment; manual status guards

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.service.ts:236-245` (`remove`) + repository `softDelete`
- Modify: `apps/api/src/modules/appointments/appointments.service.ts:94-107` (`updateStatus`) + repository
- Test: both modules' `__tests__/`

**Interfaces:**
- Consumes: error codes from Task 1.
- Produces: `AppointmentsRepository.findLiveConsultation(appointmentId: string, tenantId: string): Promise<{ id: string; status: string } | null>`; `ConsultationsRepository.softDelete(id, tenantId, appointmentId: string | null)`.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('deleting an open consultation reverts its appointment', () => {
  it('moves the appointment back to scheduled', async () => {
    await service.remove(consultationId, tenantId) // consultation open, appointment in_progress
    const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } })
    expect(appt?.status).toBe('scheduled')
  })
})

describe('manual appointment status guards', () => {
  it('blocks Completar when a live consultation is linked', async () => {
    await expect(
      apptService.updateStatus(appointmentId, tenantId, { status: 'completed' }),
    ).rejects.toMatchObject({ response: { code: 'APPOINTMENT_HAS_CONSULTATION' } })
  })

  it('blocks cancelled/no_show while an open consultation exists', async () => {
    for (const status of ['cancelled', 'no_show'] as const) {
      await expect(
        apptService.updateStatus(appointmentId, tenantId, { status }),
      ).rejects.toMatchObject({ response: { code: 'APPOINTMENT_HAS_OPEN_CONSULTATION' } })
    }
  })

  it('still allows Completar when no consultation is linked', async () => {
    const res = await apptService.updateStatus(unlinkedApptId, tenantId, { status: 'completed' })
    expect(res.status).toBe('completed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/api test -- appointments consultations`
Expected: FAIL.

- [ ] **Step 3: Implement**

`consultations.repository.ts`:

```typescript
async softDelete(id: string, tenantId: string, appointmentId: string | null): Promise<void> {
  await this.prisma.$transaction(async (tx) => {
    await tx.consultation.update({
      where: { id, tenantId, deletedAt: null },
      data: { deletedAt: new Date() },
    })
    if (appointmentId != null) {
      await tx.appointment.updateMany({
        where: { id: appointmentId, tenantId, deletedAt: null, status: 'in_progress' },
        data: { status: 'scheduled' },
      })
    }
  })
}
```

`consultations.service.ts` `remove`: pass `c.appointmentId ?? null` (only when `c.status === 'open'` — signed consultations already can't be deleted).

`appointments.repository.ts`:

```typescript
async findLiveConsultation(
  appointmentId: string,
  tenantId: string,
): Promise<{ id: string; status: string } | null> {
  return this.prisma.consultation.findFirst({
    where: { appointmentId, tenantId, deletedAt: null },
    select: { id: true, status: true },
    orderBy: { createdAt: 'desc' },
  })
}
```

`appointments.service.ts` `updateStatus` — after the existing cancelled guard:

```typescript
const linked = await this.repo.findLiveConsultation(id, tenantId)
if (linked) {
  if (dto.status === 'completed') {
    throw new ConflictException({
      code: ErrorCode.APPOINTMENT_HAS_CONSULTATION,
      message: 'Appointment status follows its consultation and cannot be completed manually',
    })
  }
  if ((dto.status === 'cancelled' || dto.status === 'no_show') && linked.status === 'open') {
    throw new ConflictException({
      code: ErrorCode.APPOINTMENT_HAS_OPEN_CONSULTATION,
      message: 'Cannot cancel or no-show an appointment with an open consultation',
    })
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @rezeta/api test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules
git commit -m "feat(api): consultation deletion reverts appointment; guard manual status changes"
```

---

### Task 6: Web — state-aware appointment card (Iniciar / Continuar / Ver consulta)

**Files:**
- Modify: `apps/web/src/pages/Schedule/helpers.ts` (status label/badge for `in_progress`)
- Modify: `apps/web/src/pages/Schedule/AppointmentCard.tsx`
- Modify: `apps/web/src/pages/Schedule/AppointmentCardWithMutation.tsx`
- Modify: `apps/web/src/pages/Schedule/strings.ts`
- Test: `apps/web/src/pages/Schedule/__tests__/AppointmentCard.test.tsx`

**Interfaces:**
- Consumes: `AppointmentWithDetails.consultationId/consultationStatus` (Task 2); `useCreateConsultation()` from `apps/web/src/hooks/consultations/use-consultations.ts` (mutation input `{ patientId, locationId, appointmentId }`, resolves to the consultation).
- Produces: `AppointmentCardProps` gains `onStartConsultation: () => void`, `isStartingConsultation: boolean`. Card renders per the status table below.

Strings (add to `strings.ts`): `Iniciar consulta`, `Continuar consulta`, `Ver consulta`, `En consulta`.

| State | Badge | Primary action |
|---|---|---|
| `scheduled`, no consultation | `Programada` (draft) | **Iniciar consulta** |
| `in_progress` (consultationStatus `open`) | `En consulta` (variant `signed`, teal) | **Continuar consulta** |
| `completed` with consultation | `Completada` (active) | **Ver consulta** |
| `completed` manual / `cancelled` / `no_show` | unchanged | — |

"Completar" renders only when `appt.consultationId === null`. "No asistió"/"Eliminar"/"Editar" render as today but only for `scheduled`.

- [ ] **Step 1: Write the failing component tests**

```tsx
describe('AppointmentCard workflow actions', () => {
  it('shows Iniciar consulta on a scheduled appointment without consultation', () => {
    render(<AppointmentCard appt={scheduledAppt} {...handlers} />)
    expect(screen.getByText('Iniciar consulta')).toBeInTheDocument()
    expect(screen.getByText('Completar')).toBeInTheDocument()
  })

  it('shows Continuar consulta and En consulta badge when in_progress', () => {
    render(<AppointmentCard appt={inProgressAppt} {...handlers} />)
    expect(screen.getByText('Continuar consulta')).toBeInTheDocument()
    expect(screen.getByText('En consulta')).toBeInTheDocument()
    expect(screen.queryByText('Completar')).not.toBeInTheDocument()
    expect(screen.queryByText('No asistió')).not.toBeInTheDocument()
  })

  it('shows Ver consulta on a completed appointment with a consultation', () => {
    render(<AppointmentCard appt={completedWithConsultation} {...handlers} />)
    expect(screen.getByText('Ver consulta')).toBeInTheDocument()
  })

  it('hides Completar when a consultation is linked', () => {
    render(<AppointmentCard appt={{ ...scheduledAppt, consultationId: 'c1', consultationStatus: 'open' }} {...handlers} />)
    expect(screen.queryByText('Completar')).not.toBeInTheDocument()
  })

  it('fires onStartConsultation on Iniciar consulta click', async () => {
    render(<AppointmentCard appt={scheduledAppt} {...handlers} />)
    await userEvent.click(screen.getByText('Iniciar consulta'))
    expect(handlers.onStartConsultation).toHaveBeenCalled()
  })
})
```

Fixtures include the two new fields (`consultationId: null, consultationStatus: null` for the base case).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- AppointmentCard`
Expected: FAIL.

- [ ] **Step 3: Implement**

`helpers.ts`:

```typescript
export function statusBadgeVariant(status: AppointmentStatus): BadgeProps['variant'] {
  switch (status) {
    case 'in_progress':
      return 'signed'
    case 'completed':
      return 'active'
    case 'cancelled':
      return 'archived'
    case 'no_show':
      return 'review'
    default:
      return 'draft'
  }
}

export function statusLabel(status: AppointmentStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Programada'
    case 'in_progress':
      return 'En consulta'
    case 'completed':
      return 'Completada'
    case 'cancelled':
      return 'Cancelada'
    case 'no_show':
      return 'No asistió'
  }
}
```

`AppointmentCard.tsx` — replace the actions `<Stack>` (keep layout, tokens, TextLink idiom):

```tsx
<Stack gap={1} className="shrink-0">
  {appt.status === 'scheduled' && appt.consultationId === null && (
    <TextLink tone="primary" size="md" underline="hover"
      onClick={onStartConsultation} disabled={isStartingConsultation}>
      <i className="ph ph-play-circle text-[14px]" />
      Iniciar consulta
    </TextLink>
  )}
  {appt.status === 'in_progress' && appt.consultationStatus === 'open' && (
    <TextLink tone="primary" size="md" underline="hover" onClick={onStartConsultation}>
      <i className="ph ph-arrow-right text-[14px]" />
      Continuar consulta
    </TextLink>
  )}
  {appt.status === 'completed' && appt.consultationId !== null && (
    <TextLink tone="primary" size="md" underline="hover" onClick={onStartConsultation}>
      <i className="ph ph-file-text text-[14px]" />
      Ver consulta
    </TextLink>
  )}
  {appt.status === 'scheduled' && (
    <>
      {appt.consultationId === null && (
        <TextLink tone="primary" size="md" underline="hover"
          onClick={() => onStatusChange('completed')} disabled={isUpdatingStatus}
          className="text-success-text hover:text-success-text">
          <i className="ph ph-check-circle text-[14px]" />
          Completar
        </TextLink>
      )}
      <TextLink tone="warning" size="md" underline="hover"
        onClick={() => onStatusChange('no_show')} disabled={isUpdatingStatus}>
        <i className="ph ph-user-x text-[14px]" />
        No asistió
      </TextLink>
      <TextLink tone="neutral" size="md" underline="hover" onClick={onEdit}>
        <i className="ph ph-pencil-simple text-[14px]" />
        Editar
      </TextLink>
    </>
  )}
  {appt.status !== 'in_progress' && (
    <TextLink tone="danger" size="md" underline="hover" onClick={onDelete} className="mt-1">
      <i className="ph ph-trash text-[14px]" />
      Eliminar
    </TextLink>
  )}
</Stack>
```

(Use the strings from `strings.ts`, not literals, matching the file's existing pattern.)

`AppointmentCardWithMutation.tsx` — wire navigation + creation:

```tsx
export function AppointmentCardWithMutation({ appt, onEdit, onDelete }: AppointmentCardWithMutationProps): JSX.Element {
  const navigate = useNavigate()
  const statusMutation = useUpdateAppointmentStatus(appt.id)
  const createConsultation = useCreateConsultation()

  const handleStartConsultation = (): void => {
    if (appt.consultationId) {
      void navigate(`/consultas/${appt.consultationId}`)
      return
    }
    void createConsultation
      .mutateAsync({ patientId: appt.patientId, locationId: appt.locationId, appointmentId: appt.id })
      .then((c) => navigate(`/consultas/${c.id}`))
  }

  return (
    <AppointmentCard
      appt={appt}
      onEdit={onEdit}
      onDelete={onDelete}
      onStatusChange={(status) => { void statusMutation.mutateAsync({ status }) }}
      isUpdatingStatus={statusMutation.isPending}
      onStartConsultation={handleStartConsultation}
      isStartingConsultation={createConsultation.isPending}
    />
  )
}
```

After a successful creation/sign, appointment queries must refetch — confirm `useCreateConsultation` and `useSignConsultation` invalidate the appointments query key (add `qc.invalidateQueries({ queryKey: ['appointments'] })` to both if missing, matching the hook file's existing invalidation pattern).

- [ ] **Step 4: Run tests + lint**

Run: `pnpm --filter @rezeta/web test -- AppointmentCard && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Schedule apps/web/src/hooks
git commit -m "feat(web): state-aware appointment card with Iniciar/Continuar/Ver consulta"
```

---

### Task 7: Web — dashboard appointments join the loop

**Files:**
- Modify: `apps/web/src/pages/Dashboard/UpcomingRow.tsx` (and `UpcomingAppointments.tsx` if props thread through it)
- Modify: `apps/web/src/pages/Dashboard/strings.ts`
- Test: `apps/web/src/pages/Dashboard/__tests__/UpcomingRow.test.tsx` (create beside existing dashboard tests if none)

**Interfaces:**
- Consumes: same fields/hooks as Task 6 (`consultationId`, `consultationStatus`, `useCreateConsultation`).
- Produces: each upcoming-appointment row shows one action — `Iniciar` (scheduled, no consultation), `Continuar` (in_progress + open), nothing otherwise. Short labels to fit the dense dashboard row; same navigation behavior as Task 6.

- [ ] **Step 1: Write the failing tests**

```tsx
it('shows Iniciar on scheduled rows and navigates into a new consultation', async () => {
  render(<UpcomingRow appt={scheduledAppt} />)
  expect(screen.getByText('Iniciar')).toBeInTheDocument()
})

it('shows Continuar on in_progress rows', () => {
  render(<UpcomingRow appt={inProgressAppt} />)
  expect(screen.getByText('Continuar')).toBeInTheDocument()
})

it('shows no action on cancelled rows', () => {
  render(<UpcomingRow appt={cancelledAppt} />)
  expect(screen.queryByText('Iniciar')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- UpcomingRow`
Expected: FAIL.

- [ ] **Step 3: Implement**

Reuse the exact `handleStartConsultation` logic from Task 6 — extract it into a small hook so both surfaces share it:

Create `apps/web/src/hooks/consultations/use-start-consultation.ts`:

```typescript
import { useNavigate } from 'react-router-dom'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { useCreateConsultation } from './use-consultations'

export function useStartConsultation(): {
  start: (appt: AppointmentWithDetails) => void
  isStarting: boolean
} {
  const navigate = useNavigate()
  const createConsultation = useCreateConsultation()
  return {
    start: (appt) => {
      if (appt.consultationId) {
        void navigate(`/consultas/${appt.consultationId}`)
        return
      }
      void createConsultation
        .mutateAsync({ patientId: appt.patientId, locationId: appt.locationId, appointmentId: appt.id })
        .then((c) => navigate(`/consultas/${c.id}`))
    },
    isStarting: createConsultation.isPending,
  }
}
```

Refactor Task 6's `AppointmentCardWithMutation` to use this hook, then add the action to `UpcomingRow.tsx` following that file's existing markup/tokens (a `TextLink tone="primary" size="md"` at the row's trailing edge; labels `Iniciar` / `Continuar` from `strings.ts`).

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @rezeta/web test -- UpcomingRow AppointmentCard`
Expected: PASS (including Task 6's tests after the refactor).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): dashboard upcoming appointments can start/continue consultations"
```

---

### Task 8: Web — global walk-in flow ("Nueva consulta" dialog)

**Files:**
- Create: `apps/web/src/components/consultations/NewConsultationDialog.tsx`
- Create: `apps/web/src/components/consultations/__tests__/NewConsultationDialog.test.tsx`
- Modify: `apps/web/src/pages/Schedule/index.tsx` (header button)
- Modify: `apps/web/src/pages/Dashboard/index.tsx` or `Dashboard/PageHeader.tsx` (header button)

**Interfaces:**
- Consumes: `PatientCombobox` (`apps/web/src/pages/Schedule/PatientCombobox.tsx` — reuse; move/re-export to `apps/web/src/components/` only if its current import path makes reuse awkward), `useLocations()`, `useCreateConsultation()`, patient-creation hook from `apps/web/src/hooks/patients/` (create mutation with the minimal `CreatePatientSchema` fields), `useUiStore` for `activeLocationId`.
- Produces: `<NewConsultationDialog open onClose />` — patient search + location select; "not found" path shows inline mini-form (name + DOB, per `CreatePatientSchema` from `packages/shared` — required: firstName, lastName, dateOfBirth; everything else omitted); on submit creates the patient (if new), then the consultation (`appointmentId` omitted → walk-in), then navigates to `/consultas/{id}`.

Strings (Spanish): dialog title `Nueva consulta`, search placeholder `Buscar por nombre o cédula`, empty-state action `Crear paciente`, mini-form labels `Nombre`, `Apellido`, `Fecha de nacimiento`, submit `Iniciar consulta`, location label `Ubicación`.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('NewConsultationDialog', () => {
  it('creates a walk-in consultation for an existing patient and navigates', async () => {
    render(<NewConsultationDialog open onClose={vi.fn()} />)
    // select patient via combobox, location pre-selected from active location
    await userEvent.click(screen.getByText('Iniciar consulta'))
    expect(createConsultationMock).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1', locationId: 'loc1' }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/consultas/c1')
  })

  it('shows the minimal patient form when no match and creates patient then consultation', async () => {
    render(<NewConsultationDialog open onClose={vi.fn()} />)
    await userEvent.click(screen.getByText('Crear paciente'))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Juan')
    await userEvent.type(screen.getByLabelText('Apellido'), 'Pérez')
    await userEvent.type(screen.getByLabelText('Fecha de nacimiento'), '1990-04-12')
    await userEvent.click(screen.getByText('Iniciar consulta'))
    expect(createPatientMock).toHaveBeenCalled()
    expect(createConsultationMock).toHaveBeenCalled()
  })

  it('disables submit until patient and location are set', () => {
    render(<NewConsultationDialog open onClose={vi.fn()} />)
    expect(screen.getByText('Iniciar consulta').closest('button')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- NewConsultationDialog`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Implement**

Build on the existing `Modal`/`DialogCard` + `NativeSelect` + `Button` UI components and `PatientCombobox`. Structure:

```tsx
export interface NewConsultationDialogProps {
  open: boolean
  onClose: () => void
}
```

State machine inside the dialog: `mode: 'search' | 'create-patient'`. Submit handler:

```tsx
const handleSubmit = async (): Promise<void> => {
  let pid = selectedPatientId
  if (mode === 'create-patient') {
    const patient = await createPatient.mutateAsync({ firstName, lastName, dateOfBirth })
    pid = patient.id
  }
  const c = await createConsultation.mutateAsync({ patientId: pid, locationId })
  onClose()
  void navigate(`/consultas/${c.id}`)
}
```

Header buttons: Agenda page header and Dashboard header each get a primary `Button` `Nueva consulta` (icon `ph-plus`) toggling the dialog. Follow each header's existing layout.

- [ ] **Step 4: Run tests + lint**

Run: `pnpm --filter @rezeta/web test -- NewConsultationDialog && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): global Nueva consulta walk-in dialog with inline minimal patient creation"
```

---

### Task 9: Web — post-sign panel: invoice card

**Files:**
- Create: `apps/web/src/pages/Consultation/PostSignPanel.tsx`
- Modify: `apps/web/src/pages/Consultation/index.tsx` (render below `SignedBanner` right after signing)
- Modify: `apps/web/src/hooks/consultations/use-consultations.ts` (`useSignConsultation` result type → `SignConsultationResponse`)
- Modify: `apps/web/src/pages/Consultation/strings.ts`
- Test: `apps/web/src/pages/Consultation/__tests__/PostSignPanel.test.tsx`

**Interfaces:**
- Consumes: `SignConsultationResponse.invoiceOutcome` (Task 4); invoice hooks from `apps/web/src/hooks/invoices/` (reuse the existing status-update mutation the Billing page uses for issuing; reuse the existing invoice-detail query if the card needs fresh data after issuing).
- Produces: `<PostSignPanel invoiceOutcome={InvoiceOutcome} consultation={ConsultationWithDetails} />` rendered when the just-completed sign mutation resolves (keep the outcome in page state — it is not part of the consultation GET payload).

Card states (strings in Spanish, `strings.ts`):

| `invoiceOutcome.status` | Render |
|---|---|
| `created` | `Factura borrador creada · {total} {currency}` + buttons **Emitir factura** (issue via existing invoice status mutation, then show `Factura emitida`) and **Ver en Facturación** (link `/facturacion` — or the invoice detail route if one exists; check `apps/App.tsx` routes) |
| `skipped_no_fee` | Callout: `No se creó factura: no hay tarifa configurada para esta ubicación.` + links **Configurar tarifa** (`/ajustes/ubicaciones`) and **Crear factura manual** (`/facturacion`) |
| `failed` | Callout (danger): `No se pudo crear la factura.` + **Reintentar** is out of API scope — link **Crear factura manual** (`/facturacion`) |

(Design note: the spec's "Reintentar" resolves to manual creation — the sign already happened, so re-running auto-creation would need a dedicated endpoint; YAGNI. The manual path covers it.)

- [ ] **Step 1: Write the failing tests**

```tsx
describe('PostSignPanel invoice card', () => {
  it('shows the draft invoice with Emitir and Ver actions when created', () => {
    render(<PostSignPanel invoiceOutcome={{ status: 'created', invoiceId: 'i1', total: 1500, currency: 'DOP' }} consultation={consultation} />)
    expect(screen.getByText('Emitir factura')).toBeInTheDocument()
    expect(screen.getByText('Ver en Facturación')).toBeInTheDocument()
  })

  it('explains the missing fee and offers config + manual paths when skipped', () => {
    render(<PostSignPanel invoiceOutcome={{ status: 'skipped_no_fee' }} consultation={consultation} />)
    expect(screen.getByText(/no hay tarifa configurada/i)).toBeInTheDocument()
    expect(screen.getByText('Configurar tarifa')).toBeInTheDocument()
  })

  it('shows the failure callout with the manual path when failed', () => {
    render(<PostSignPanel invoiceOutcome={{ status: 'failed' }} consultation={consultation} />)
    expect(screen.getByText('Crear factura manual')).toBeInTheDocument()
  })

  it('issues the invoice on Emitir factura', async () => {
    render(<PostSignPanel invoiceOutcome={{ status: 'created', invoiceId: 'i1', total: 1500, currency: 'DOP' }} consultation={consultation} />)
    await userEvent.click(screen.getByText('Emitir factura'))
    expect(updateInvoiceStatusMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'issued' }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- PostSignPanel`
Expected: FAIL.

- [ ] **Step 3: Implement**

Panel is a bordered card (`border border-n-200 rounded-md bg-n-0 p-5`) with an `Overline` header `DESPUÉS DE FIRMAR`, containing the invoice card and (Task 10) the follow-up card. In `Consultation/index.tsx`, capture the sign mutation result:

```tsx
const [signResult, setSignResult] = useState<SignConsultationResponse | null>(null)
// in the sign handler:
const res = await signMutation.mutateAsync()
setSignResult(res)
```

Render `{signResult && <PostSignPanel invoiceOutcome={signResult.invoiceOutcome} consultation={consultation} />}` below `SignedBanner`. The panel only appears in the just-signed session (revisiting a signed consultation later shows the banner only — invoices are then reachable from the patient tabs / Facturación).

- [ ] **Step 4: Run tests + lint**

Run: `pnpm --filter @rezeta/web test -- PostSignPanel Consultation && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): post-sign panel surfaces the invoice outcome with issue/manual paths"
```

---

### Task 10: Web — post-sign follow-up card ("Agendar seguimiento")

**Files:**
- Modify: `apps/web/src/pages/Schedule/AppointmentFormModal.tsx` (new optional prop)
- Modify: `apps/web/src/pages/Consultation/PostSignPanel.tsx`
- Test: extend `apps/web/src/pages/Consultation/__tests__/PostSignPanel.test.tsx` + `apps/web/src/pages/Schedule/__tests__/` modal test

**Interfaces:**
- Consumes: `AppointmentFormModalProps` (currently `{ appointment?, defaultDate, defaultLocationId, onClose }`).
- Produces: `AppointmentFormModalProps` gains `defaultPatientId?: string` — when set (and not editing), the patient field initializes to it. PostSignPanel gains a "Seguimiento" block with an **Agendar seguimiento** button opening the modal with `defaultPatientId={consultation.patientId}`, `defaultLocationId={consultation.locationId}`, `defaultDate={today}`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('AppointmentFormModal pre-selects the patient from defaultPatientId', () => {
  render(<AppointmentFormModal defaultDate="2026-07-02" defaultLocationId="loc1" defaultPatientId="p1" onClose={vi.fn()} />)
  // assert the patient combobox initial value is patient p1 (per the combobox's testid/label)
})

it('PostSignPanel opens the follow-up modal pre-filled', async () => {
  render(<PostSignPanel invoiceOutcome={{ status: 'skipped_no_fee' }} consultation={consultation} />)
  await userEvent.click(screen.getByText('Agendar seguimiento'))
  expect(screen.getByText('Nueva cita')).toBeInTheDocument() // modal title per its strings.ts
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @rezeta/web test -- PostSignPanel AppointmentFormModal`
Expected: FAIL.

- [ ] **Step 3: Implement**

`AppointmentFormModal.tsx`:

```typescript
export interface AppointmentFormModalProps {
  appointment?: AppointmentWithDetails
  defaultDate: string
  defaultLocationId: string
  defaultPatientId?: string
  onClose: () => void
}
// ...
const initialPatientId = appointment?.patientId ?? defaultPatientId ?? ''
```

`PostSignPanel.tsx` — follow-up block:

```tsx
<div className="mt-4 flex items-center justify-between">
  <div>
    <div className="text-[14px] font-semibold text-n-800">Seguimiento</div>
    <div className="text-[12px] text-n-500">Agenda la próxima cita de este paciente.</div>
  </div>
  <Button variant="secondary" onClick={() => setShowFollowUp(true)}>
    <i className="ph ph-calendar-plus" />
    Agendar seguimiento
  </Button>
</div>
{showFollowUp && (
  <AppointmentFormModal
    defaultDate={toDateInputValue(new Date())}
    defaultLocationId={consultation.locationId}
    defaultPatientId={consultation.patientId}
    onClose={() => setShowFollowUp(false)}
  />
)}
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm --filter @rezeta/web test -- PostSignPanel AppointmentFormModal && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): Agendar seguimiento from the post-sign panel via pre-filled appointment form"
```

---

### Task 11: API + Web — patient page tabs (Citas / Recetas / Facturas)

**Files:**
- Modify: `apps/api/src/modules/consultations/consultations.controller.ts` (the existing `@Controller('v1/patients/:patientId')` controller — add `GET prescriptions`) + service/repo query
- Modify: `apps/web/src/pages/PatientDetail/index.tsx`
- Create: `apps/web/src/pages/PatientDetail/AppointmentsTab.tsx`, `PrescriptionsTab.tsx`, `InvoicesTab.tsx`
- Modify: `apps/web/src/pages/PatientDetail/strings.ts`
- Modify: `apps/web/src/hooks/appointments/use-appointments.ts` (patientId param), `apps/web/src/hooks/invoices/` (patientId param — API already supports it via `InvoiceListParams.patientId`)
- Test: API endpoint test + `apps/web/src/pages/PatientDetail/__tests__/` component tests

**Interfaces:**
- Consumes: `GET /v1/appointments?patientId=` (Task 2); `GET /v1/invoices?patientId=` (already supported — expose the query param in the controller if not already); Prescription model (has `patientId` and optional `consultationId`).
- Produces: `GET /v1/patients/:patientId/prescriptions` → `Prescription[]` (tenant + soft-delete filtered, newest first); hooks `useAppointments({ patientId })`, `usePatientPrescriptions(patientId)`, `useInvoices({ patientId })`; PatientDetail renders a `Tabs` bar — `Historia clínica` (default, existing `ClinicalHistory`), `Citas`, `Recetas`, `Facturas`.

Tab behaviors:
- **Citas**: rows show date/time, status badge (Task 6 helpers), location. Row with `consultationId` links to `/consultas/{id}`; `scheduled` rows show `Iniciar consulta` via `useStartConsultation` (Task 7).
- **Recetas**: rows show date, item count/first drug, status badge (`queued` → draft, `signed` → signed). Rows with `consultationId` link to `/consultas/{id}`.
- **Facturas**: rows show invoice number, date, total + currency, status badge (reuse the Billing page's invoice badge mapping). Row links to `/facturacion` (or invoice detail route if one exists); rows with `consultationId` also link to the consultation.
- Every tab: `EmptyState` component when the list is empty (Spanish copy, e.g. `Sin citas registradas`).

- [ ] **Step 1: Write the failing API test**

```typescript
describe('GET /v1/patients/:patientId/prescriptions', () => {
  it('returns only that patient's live prescriptions for the tenant, newest first', async () => {
    const res = await controller.listPatientPrescriptions(patientId /* + auth ctx per harness */)
    expect(res.every((p) => p.patientId === patientId)).toBe(true)
    // seeded: one soft-deleted prescription and one from another tenant — both excluded
    expect(res.map((p) => p.id)).toEqual([newestId, olderId])
  })
})
```

- [ ] **Step 2: Run to verify it fails, then implement the endpoint**

Run: `pnpm --filter @rezeta/api test -- consultations`

Add to the existing `@Controller('v1/patients/:patientId')` class in `consultations.controller.ts`, following its sibling endpoints' guard/decorator pattern:

```typescript
@Get('prescriptions')
@ApiOperation({ summary: 'List prescriptions for a patient' })
listPatientPrescriptions(/* patientId param + tenant ctx per the sibling endpoints */) {
  return this.service.listPatientPrescriptions(patientId, tenantId)
}
```

Service/repo:

```typescript
async listPatientPrescriptions(patientId: string, tenantId: string): Promise<Prescription[]> {
  return this.prisma.prescription.findMany({
    where: { patientId, tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}
```

Re-run: PASS.

- [ ] **Step 3: Write the failing web tests**

```tsx
describe('PatientDetail tabs', () => {
  it('renders the four tabs with Historia clínica active by default', () => {
    render(<PatientDetail />)
    for (const t of ['Historia clínica', 'Citas', 'Recetas', 'Facturas']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
  })

  it('Citas tab lists appointments with status badges and consultation links', async () => {
    render(<PatientDetail />)
    await userEvent.click(screen.getByText('Citas'))
    expect(screen.getByText('En consulta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /ver consulta/i })).toHaveAttribute('href', '/consultas/c1')
  })

  it('Facturas tab lists invoices with totals', async () => {
    render(<PatientDetail />)
    await userEvent.click(screen.getByText('Facturas'))
    expect(screen.getByText(/1,?500/)).toBeInTheDocument()
  })

  it('shows an empty state on a tab with no records', async () => {
    render(<PatientDetail />) // patient with no prescriptions
    await userEvent.click(screen.getByText('Recetas'))
    expect(screen.getByText('Sin recetas registradas')).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run to verify they fail, then implement the tabs**

Run: `pnpm --filter @rezeta/web test -- PatientDetail`

`PatientDetail/index.tsx` — keep Demographics/MedicalInfo blocks above; replace the single ClinicalHistory card with the Tabs component (check its exact API in `apps/web/src/components/ui/Tabs.tsx` / its stories):

```tsx
<Tabs
  tabs={[
    { id: 'historia', label: 'Historia clínica' },
    { id: 'citas', label: 'Citas' },
    { id: 'recetas', label: 'Recetas' },
    { id: 'facturas', label: 'Facturas' },
  ]}
  activeTab={tab}
  onChange={setTab}
/>
<div className="border border-n-200 rounded-md bg-n-0 p-5 mt-4">
  {tab === 'historia' && <ClinicalHistory patientId={patient.id} {...(activeLocationId ? { locationId: activeLocationId } : {})} />}
  {tab === 'citas' && <AppointmentsTab patientId={patient.id} />}
  {tab === 'recetas' && <PrescriptionsTab patientId={patient.id} />}
  {tab === 'facturas' && <InvoicesTab patientId={patient.id} />}
</div>
```

Each tab component: fetch with its hook, render list rows per the behaviors table above, `EmptyState` when empty. Note: the patient-level Citas list must NOT filter by the doctor's active location — pass only `patientId`.

Re-run: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api apps/web
git commit -m "feat: patient page tabs for citas, recetas y facturas with cross-links"
```

---

### Task 12: Final verification + changelog

**Files:**
- Modify: `CHANGELOG.md` (prepend entry)

- [ ] **Step 1: Full verification**

Run: `pnpm lint && pnpm test && pnpm test:coverage && pnpm build`
Expected: zero lint errors, zero failing tests, ≥90% coverage on all packages, clean build. Fix anything that fails before proceeding.

- [ ] **Step 2: Changelog entry**

Prepend to `CHANGELOG.md`:

```markdown
## [2026-07-02] Workflow interconnection — full clinical loop

### Added
- "Iniciar consulta" / "Continuar consulta" / "Ver consulta" on agenda appointment cards and dashboard upcoming rows (`AppointmentCard.tsx`, `UpcomingRow.tsx`, `use-start-consultation.ts`).
- `in_progress` appointment status; consultation lifecycle drives appointment status one-way (create → in_progress, sign → completed, delete open → scheduled) in `consultations.service/repository`.
- Global "Nueva consulta" walk-in dialog with patient search and inline minimal patient creation (`NewConsultationDialog.tsx`).
- Post-sign panel: invoice outcome card (created / no-fee / failed) with "Emitir factura", and "Agendar seguimiento" pre-filled follow-up appointment (`PostSignPanel.tsx`).
- Patient page tabs: Citas, Recetas, Facturas with cross-links (`PatientDetail/*Tab.tsx`); new `GET /v1/patients/:patientId/prescriptions`; `patientId` filter on `GET /v1/appointments`.
- Error codes `APPOINTMENT_NOT_STARTABLE`, `APPOINTMENT_HAS_CONSULTATION`, `APPOINTMENT_HAS_OPEN_CONSULTATION`.

### Changed
- Signing a consultation now awaits invoice auto-creation and returns `invoiceOutcome` (`SignConsultationResponse`); previously fire-and-forget.
- Manual "Completar" on appointments only available when no consultation is linked; cancel/no-show blocked during an open consultation.
- `AppointmentWithDetails` now carries `consultationId`/`consultationStatus`.
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for workflow interconnection"
```
