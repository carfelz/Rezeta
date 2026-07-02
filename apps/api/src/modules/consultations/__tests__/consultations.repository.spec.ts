import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationsRepository } from '../consultations.repository.js'

const now = new Date('2026-01-01T10:00:00Z')

function makeConsultationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    tenantId: 't1',
    patientId: 'p1',
    doctorId: 'u1',
    locationId: 'loc1',
    appointmentId: null,
    status: 'open',
    startedAt: now,
    signedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    patient: { firstName: 'Ana', lastName: 'Reyes' },
    location: { name: 'Clínica Central' },
    doctor: { fullName: 'Dr. García' },
    amendments: [],
    protocolUsages: [],
    ...overrides,
  }
}

function makeProtocolUsageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pu1',
    tenantId: 't1',
    consultationId: 'c1',
    protocolId: 'proto1',
    protocolVersionId: 'ver1',
    content: { version: '1.0', blocks: [] },
    modifications: {},
    modificationSummary: null,
    parentUsageId: null,
    triggerBlockId: null,
    depth: 0,
    status: 'in_progress',
    completedAt: null,
    notes: null,
    appliedAt: now,
    protocol: { title: 'Anaphylaxis' },
    protocolVersion: { versionNumber: 1 },
    childUsages: [],
    ...overrides,
  }
}

const mockTx = {
  consultation: { create: vi.fn(), update: vi.fn() },
  appointment: { update: vi.fn(), updateMany: vi.fn() },
  protocolUsage: { updateMany: vi.fn() },
  prescription: { updateMany: vi.fn() },
  labOrder: { updateMany: vi.fn() },
  imagingOrder: { updateMany: vi.fn() },
}

const mockPrisma = {
  consultation: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  consultationAmendment: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  protocolUsage: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  prescription: { updateMany: vi.fn() },
  labOrder: { updateMany: vi.fn() },
  imagingOrder: { updateMany: vi.fn() },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
}

describe('ConsultationsRepository', () => {
  let repo: ConsultationsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ConsultationsRepository(mockPrisma as never)
  })

  // ── findMany ───────────────────────────────────────────────────────────────

  describe('findMany', () => {
    it('returns mapped consultations with patient and location names', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([makeConsultationRow()])
      const result = await repo.findMany({ tenantId: 't1', userId: 'u1' })
      expect(result).toHaveLength(1)
      expect(result[0].patientName).toBe('Ana Reyes')
      expect(result[0].locationName).toBe('Clínica Central')
      expect(result[0].doctorName).toBe('Dr. García')
    })

    it('adds patientId filter when provided', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', patientId: 'p1' })
      const where = mockPrisma.consultation.findMany.mock.calls[0][0].where
      expect(where.patientId).toBe('p1')
    })

    it('adds locationId filter when provided', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', locationId: 'loc1' })
      const where = mockPrisma.consultation.findMany.mock.calls[0][0].where
      expect(where.locationId).toBe('loc1')
    })

    it('adds both from and to date filters', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([])
      const from = new Date('2026-01-01')
      const to = new Date('2026-01-31')
      await repo.findMany({ tenantId: 't1', userId: 'u1', from, to })
      const where = mockPrisma.consultation.findMany.mock.calls[0][0].where
      expect(where.startedAt.gte).toBe(from)
      expect(where.startedAt.lte).toBe(to)
    })

    it('adds only from filter when to is omitted', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([])
      const from = new Date('2026-01-01')
      await repo.findMany({ tenantId: 't1', userId: 'u1', from })
      const where = mockPrisma.consultation.findMany.mock.calls[0][0].where
      expect(where.startedAt.gte).toBe(from)
      expect(where.startedAt.lte).toBeUndefined()
    })

    it('adds only to filter when from is omitted', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([])
      const to = new Date('2026-01-31')
      await repo.findMany({ tenantId: 't1', userId: 'u1', to })
      const where = mockPrisma.consultation.findMany.mock.calls[0][0].where
      expect(where.startedAt.lte).toBe(to)
    })

    it('maps protocol usages in result', async () => {
      const row = makeConsultationRow({ protocolUsages: [makeProtocolUsageRow()] })
      mockPrisma.consultation.findMany.mockResolvedValue([row])
      const result = await repo.findMany({ tenantId: 't1', userId: 'u1' })
      expect(result[0].protocolUsages).toHaveLength(1)
      expect(result[0].protocolUsages[0].protocolTitle).toBe('Anaphylaxis')
      expect(result[0].protocolUsages[0].protocolTypeName).toBeNull()
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns mapped consultation when found', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow())
      const result = await repo.findById('c1', 't1')
      expect(result?.id).toBe('c1')
      expect(result?.startedAt).toBe(now.toISOString())
    })

    it('returns null when not found', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null)
      expect(await repo.findById('bad', 't1')).toBeNull()
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates consultation with required fields', async () => {
      mockTx.consultation.create.mockResolvedValue(makeConsultationRow())
      const result = await repo.create('t1', 'u1', { patientId: 'p1', locationId: 'loc1' } as never)
      expect(result.id).toBe('c1')
      expect(result.status).toBe('open')
    })

    it('does not touch appointment when no appointmentId (walk-in)', async () => {
      mockTx.consultation.create.mockResolvedValue(makeConsultationRow())
      await repo.create('t1', 'u1', { patientId: 'p1', locationId: 'loc1' } as never)
      expect(mockTx.appointment.update).not.toHaveBeenCalled()
    })

    it('includes optional appointmentId when provided', async () => {
      mockTx.consultation.create.mockResolvedValue(makeConsultationRow({ appointmentId: 'apt1' }))
      await repo.create('t1', 'u1', {
        patientId: 'p1',
        locationId: 'loc1',
        appointmentId: 'apt1',
      } as never)
      const data = mockTx.consultation.create.mock.calls[0][0].data
      expect(data.appointmentId).toBe('apt1')
      expect(data.status).toBe('open')
    })

    it('moves the appointment to in_progress in the same transaction', async () => {
      mockTx.consultation.create.mockResolvedValue(makeConsultationRow({ appointmentId: 'apt1' }))
      await repo.create('t1', 'u1', {
        patientId: 'p1',
        locationId: 'loc1',
        appointmentId: 'apt1',
      } as never)
      expect(mockTx.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'apt1', tenantId: 't1', deletedAt: null }),
          data: expect.objectContaining({ status: 'in_progress' }),
        }),
      )
    })
  })

  // ── findOpenByAppointment ────────────────────────────────────────────────────

  describe('findOpenByAppointment', () => {
    it('returns the mapped open consultation for the appointment', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(
        makeConsultationRow({ appointmentId: 'apt1' }),
      )
      const result = await repo.findOpenByAppointment('apt1', 't1')
      expect(result?.id).toBe('c1')
      const where = mockPrisma.consultation.findFirst.mock.calls[0][0].where
      expect(where).toMatchObject({
        appointmentId: 'apt1',
        tenantId: 't1',
        status: 'open',
        deletedAt: null,
      })
    })

    it('returns null when no open consultation exists', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null)
      const result = await repo.findOpenByAppointment('apt1', 't1')
      expect(result).toBeNull()
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates consultation and returns mapped result', async () => {
      mockPrisma.consultation.findFirstOrThrow.mockResolvedValue(makeConsultationRow())
      const result = await repo.update('c1', 't1', {} as never)
      expect(result.id).toBe('c1')
    })
  })

  // ── sign ───────────────────────────────────────────────────────────────────

  describe('sign', () => {
    it('signs consultation and sets status to signed', async () => {
      mockTx.consultation.update.mockResolvedValue(
        makeConsultationRow({ status: 'signed', signedAt: now }),
      )
      const result = await repo.sign('c1', 't1', 'u1')
      expect(result.id).toBe('c1')
      const data = mockTx.consultation.update.mock.calls[0][0].data
      expect(data.status).toBe('signed')
      expect(data.signedAt).toBeInstanceOf(Date)
    })

    it('atomically completes in-progress protocol usages', async () => {
      mockTx.consultation.update.mockResolvedValue(
        makeConsultationRow({ status: 'signed', signedAt: now }),
      )
      await repo.sign('c1', 't1', 'u1')
      expect(mockTx.protocolUsage.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ consultationId: 'c1', status: 'in_progress' }),
          data: expect.objectContaining({ status: 'completed' }),
        }),
      )
    })

    it('atomically signs queued prescriptions', async () => {
      mockTx.consultation.update.mockResolvedValue(
        makeConsultationRow({ status: 'signed', signedAt: now }),
      )
      await repo.sign('c1', 't1', 'u1')
      expect(mockTx.prescription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ consultationId: 'c1', status: 'queued' }),
          data: expect.objectContaining({ status: 'signed' }),
        }),
      )
    })

    it('atomically signs queued lab and imaging orders', async () => {
      mockTx.consultation.update.mockResolvedValue(
        makeConsultationRow({ status: 'signed', signedAt: now }),
      )
      await repo.sign('c1', 't1', 'u1')
      expect(mockTx.labOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ consultationId: 'c1', status: 'queued' }),
          data: expect.objectContaining({ status: 'signed' }),
        }),
      )
      expect(mockTx.imagingOrder.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ consultationId: 'c1', status: 'queued' }),
          data: expect.objectContaining({ status: 'signed' }),
        }),
      )
    })

    it('completes the linked appointment in the same transaction when appointmentId given', async () => {
      mockTx.consultation.update.mockResolvedValue(
        makeConsultationRow({ status: 'signed', signedAt: now }),
      )
      await repo.sign('c1', 't1', 'u1', 'apt1')
      expect(mockTx.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'apt1', tenantId: 't1', deletedAt: null, status: 'in_progress' },
        data: { status: 'completed' },
      })
    })

    it('does not touch any appointment when appointmentId is null (walk-in)', async () => {
      mockTx.consultation.update.mockResolvedValue(
        makeConsultationRow({ status: 'signed', signedAt: now }),
      )
      await repo.sign('c1', 't1', 'u1', null)
      expect(mockTx.appointment.updateMany).not.toHaveBeenCalled()
    })

    it('rolls back if consultation update throws', async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (fn) => {
        await fn({
          protocolUsage: { updateMany: vi.fn() },
          prescription: { updateMany: vi.fn() },
          labOrder: { updateMany: vi.fn() },
          imagingOrder: { updateMany: vi.fn() },
          appointment: { updateMany: vi.fn() },
          consultation: {
            update: vi.fn().mockRejectedValue(new Error('DB error')),
          },
        })
      })
      await expect(repo.sign('tenant-1', 'c-1', 'u1', null)).rejects.toThrow('DB error')
    })
  })

  // ── createAmendment ────────────────────────────────────────────────────────

  describe('createAmendment', () => {
    it('creates first amendment with number 1 when no prior amendments', async () => {
      mockPrisma.consultationAmendment.findFirst.mockResolvedValue(null)
      mockPrisma.consultationAmendment.create.mockResolvedValue({})
      mockPrisma.consultation.findFirstOrThrow.mockResolvedValue(makeConsultationRow())
      await repo.createAmendment('c1', 't1', 'u1', { reason: 'Fix' } as never)
      const data = mockPrisma.consultationAmendment.create.mock.calls[0][0].data
      expect(data.amendmentNumber).toBe(1)
    })

    it('increments from last amendment number', async () => {
      mockPrisma.consultationAmendment.findFirst.mockResolvedValue({ amendmentNumber: 3 })
      mockPrisma.consultationAmendment.create.mockResolvedValue({})
      mockPrisma.consultation.findFirstOrThrow.mockResolvedValue(makeConsultationRow())
      await repo.createAmendment('c1', 't1', 'u1', { reason: 'Fix again' } as never)
      const data = mockPrisma.consultationAmendment.create.mock.calls[0][0].data
      expect(data.amendmentNumber).toBe(4)
    })

    it('stores amendment_content in content field', async () => {
      mockPrisma.consultationAmendment.findFirst.mockResolvedValue(null)
      mockPrisma.consultationAmendment.create.mockResolvedValue({})
      mockPrisma.consultation.findFirstOrThrow.mockResolvedValue(makeConsultationRow())
      await repo.createAmendment('c1', 't1', 'u1', {
        reason: 'All fields',
        amendment_content: { note: 'correction', diagnoses: ['Dx1'] },
      } as never)
      const content = mockPrisma.consultationAmendment.create.mock.calls[0][0].data.content
      expect(content.amendment_content).toEqual({ note: 'correction', diagnoses: ['Dx1'] })
    })

    it('returns mapped ConsultationWithDetails', async () => {
      mockPrisma.consultationAmendment.findFirst.mockResolvedValue(null)
      mockPrisma.consultationAmendment.create.mockResolvedValue({})
      mockPrisma.consultation.findFirstOrThrow.mockResolvedValue(makeConsultationRow())
      const result = await repo.createAmendment('c1', 't1', 'u1', { reason: 'R' } as never)
      expect(result.id).toBe('c1')
    })
  })

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('sets deletedAt on the consultation', async () => {
      mockTx.consultation.update.mockResolvedValue({})
      await repo.softDelete('c1', 't1', null)
      expect(mockTx.consultation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      )
    })

    it('reverts the linked in_progress appointment back to scheduled', async () => {
      mockTx.consultation.update.mockResolvedValue({})
      await repo.softDelete('c1', 't1', 'apt1')
      expect(mockTx.appointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'apt1', tenantId: 't1', deletedAt: null, status: 'in_progress' },
        data: { status: 'scheduled' },
      })
    })

    it('does not touch any appointment for a walk-in consultation (null appointmentId)', async () => {
      mockTx.consultation.update.mockResolvedValue({})
      await repo.softDelete('c1', 't1', null)
      expect(mockTx.appointment.updateMany).not.toHaveBeenCalled()
    })
  })

  // ── launchProtocolUsage ────────────────────────────────────────────────────

  describe('launchProtocolUsage', () => {
    it('creates usage and returns mapped result', async () => {
      mockPrisma.protocolUsage.create.mockResolvedValue(makeProtocolUsageRow())
      const result = await repo.launchProtocolUsage({
        consultationId: 'c1',
        tenantId: 't1',
        userId: 'u1',
        protocolId: 'proto1',
        protocolVersionId: 'ver1',
        content: { version: '1.0', blocks: [] },
        depth: 0,
      })
      expect(result.id).toBe('pu1')
      expect(result.protocolTitle).toBe('Anaphylaxis')
      expect(result.versionNumber).toBe(1)
    })

    it('includes parentUsageId and triggerBlockId when provided', async () => {
      mockPrisma.protocolUsage.create.mockResolvedValue(makeProtocolUsageRow())
      await repo.launchProtocolUsage({
        consultationId: 'c1',
        tenantId: 't1',
        userId: 'u1',
        protocolId: 'proto1',
        protocolVersionId: 'ver1',
        content: {},
        parentUsageId: 'pu-parent',
        triggerBlockId: 'blk1',
        depth: 1,
      })
      const data = mockPrisma.protocolUsage.create.mock.calls[0][0].data
      expect(data.parentUsageId).toBe('pu-parent')
      expect(data.triggerBlockId).toBe('blk1')
      expect(data.depth).toBe(1)
    })
  })

  // ── updateProtocolUsage ────────────────────────────────────────────────────

  describe('updateProtocolUsage', () => {
    it('merges new modifications with existing ones', async () => {
      mockPrisma.protocolUsage.findFirst.mockResolvedValue({
        modifications: { steps_completed: [{ step_id: 'stp1', timestamp: 't1' }] },
      })
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      await repo.updateProtocolUsage('pu1', 't1', {
        modifications: { steps_skipped: [{ step_id: 'stp2', timestamp: 't2' }] },
      } as never)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.modifications.steps_completed).toHaveLength(1)
      expect(data.modifications.steps_skipped).toHaveLength(1)
    })

    it('appends to existing modification arrays', async () => {
      mockPrisma.protocolUsage.findFirst.mockResolvedValue({
        modifications: { steps_completed: [{ step_id: 'stp1' }] },
      })
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      await repo.updateProtocolUsage('pu1', 't1', {
        modifications: { steps_completed: [{ step_id: 'stp2' }] },
      } as never)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.modifications.steps_completed).toHaveLength(2)
    })

    it('updates status when provided', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue(
        makeProtocolUsageRow({ status: 'completed' }),
      )
      await repo.updateProtocolUsage('pu1', 't1', { status: 'completed' } as never)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.status).toBe('completed')
    })

    it('converts completedAt ISO string to Date', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      await repo.updateProtocolUsage('pu1', 't1', { completedAt: '2026-01-01T10:00:00Z' } as never)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.completedAt).toBeInstanceOf(Date)
    })

    it('sets completedAt to null when explicitly null', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      await repo.updateProtocolUsage('pu1', 't1', { completedAt: null } as never)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.completedAt).toBeNull()
    })
  })

  // ── updateCheckedState ─────────────────────────────────────────────────────

  describe('updateCheckedState', () => {
    it('updates completedAt and returns mapped result', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      const result = await repo.updateCheckedState('pu1', 't1', null, null)
      expect(result.id).toBe('pu1')
    })

    it('includes completedAt when provided', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      const completedAt = new Date('2026-01-01')
      await repo.updateCheckedState('pu1', 't1', completedAt, undefined)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.completedAt).toBe(completedAt)
    })

    it('omits completedAt when undefined', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue(makeProtocolUsageRow())
      await repo.updateCheckedState('pu1', 't1', undefined, undefined)
      const data = mockPrisma.protocolUsage.update.mock.calls[0][0].data
      expect(data.completedAt).toBeUndefined()
    })
  })

  // ── removeProtocolUsage ────────────────────────────────────────────────────

  describe('removeProtocolUsage', () => {
    it('sets deletedAt and status to abandoned', async () => {
      mockPrisma.protocolUsage.update.mockResolvedValue({})
      await repo.removeProtocolUsage('pu1', 't1')
      expect(mockPrisma.protocolUsage.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date), status: 'abandoned' }),
        }),
      )
    })
  })

  // ── findProtocolUsageById ──────────────────────────────────────────────────

  describe('findProtocolUsageById', () => {
    it('returns mapped usage when found', async () => {
      mockPrisma.protocolUsage.findFirst.mockResolvedValue(makeProtocolUsageRow())
      const result = await repo.findProtocolUsageById('pu1', 't1')
      expect(result?.id).toBe('pu1')
      expect(result?.protocolTitle).toBe('Anaphylaxis')
    })

    it('returns null when not found', async () => {
      mockPrisma.protocolUsage.findFirst.mockResolvedValue(null)
      expect(await repo.findProtocolUsageById('bad', 't1')).toBeNull()
    })
  })

  // ── getUsageDepth ──────────────────────────────────────────────────────────

  describe('getUsageDepth', () => {
    it('returns parent depth + 1', async () => {
      mockPrisma.protocolUsage.findFirst.mockResolvedValue({ depth: 2 })
      expect(await repo.getUsageDepth('pu-parent', 't1')).toBe(3)
    })

    it('returns 1 when parent not found (depth 0 + 1)', async () => {
      mockPrisma.protocolUsage.findFirst.mockResolvedValue(null)
      expect(await repo.getUsageDepth('bad', 't1')).toBe(1)
    })
  })

  // ── field mapping ──────────────────────────────────────────────────────────

  describe('field mapping', () => {
    it('maps signedAt to ISO string', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(
        makeConsultationRow({ signedAt: now, status: 'signed' }),
      )
      const result = await repo.findById('c1', 't1')
      expect(result?.signedAt).toBe(now.toISOString())
    })

    it('maps null doctor fullName to empty string', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(
        makeConsultationRow({ doctor: { fullName: null } }),
      )
      const result = await repo.findById('c1', 't1')
      expect(result?.doctorName).toBe('')
    })

    it('maps null deletedAt to null', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow({ deletedAt: null }))
      const result = await repo.findById('c1', 't1')
      expect(result?.deletedAt).toBeNull()
    })

    it('maps deletedAt to ISO string when set', async () => {
      const deletedAt = new Date('2026-06-01')
      mockPrisma.consultation.findFirst.mockResolvedValue(makeConsultationRow({ deletedAt }))
      const result = await repo.findById('c1', 't1')
      expect(result?.deletedAt).toBe(deletedAt.toISOString())
    })

    it('maps protocolUsage with child usages', async () => {
      const child = {
        id: 'pu2',
        protocolId: 'proto2',
        depth: 1,
        status: 'in_progress',
        protocol: { title: 'Child Protocol' },
      }
      const usage = makeProtocolUsageRow({ childUsages: [child] })
      mockPrisma.consultation.findFirst.mockResolvedValue(
        makeConsultationRow({ protocolUsages: [usage] }),
      )
      const result = await repo.findById('c1', 't1')
      expect(result?.protocolUsages[0].childUsages).toHaveLength(1)
      expect(result?.protocolUsages[0].childUsages![0].protocolTitle).toBe('Child Protocol')
    })

    it('maps amendments in result', async () => {
      const amendment = {
        id: 'amd1',
        consultationId: 'c1',
        amendmentNumber: 1,
        amendedBy: 'u1',
        reason: 'Fix',
        content: {},
        amendedAt: now,
        signedAt: null,
      }
      mockPrisma.consultation.findFirst.mockResolvedValue(
        makeConsultationRow({ amendments: [amendment] }),
      )
      const result = await repo.findById('c1', 't1')
      expect(result?.amendments).toHaveLength(1)
      expect(result?.amendments[0].amendmentNumber).toBe(1)
      expect(result?.amendments[0].amendedByUserId).toBe('u1')
    })
  })
})
