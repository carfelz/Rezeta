import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppointmentsRepository } from '../appointments.repository.js'

const now = new Date('2026-01-01T10:00:00Z')
const later = new Date('2026-01-01T11:00:00Z')

function makeApptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'apt1',
    tenantId: 't1',
    patientId: 'p1',
    userId: 'u1',
    locationId: 'loc1',
    status: 'scheduled',
    startsAt: now,
    endsAt: later,
    reason: 'Routine',
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    patient: { firstName: 'Ana', lastName: 'Reyes', documentNumber: '001-123' },
    location: { name: 'Clínica Central' },
    ...overrides,
  }
}

const mockPrisma = {
  appointment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
}

describe('AppointmentsRepository', () => {
  let repo: AppointmentsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new AppointmentsRepository(mockPrisma as never)
  })

  describe('findMany', () => {
    it('returns mapped appointments with details', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([makeApptRow()])
      const result = await repo.findMany({ tenantId: 't1', userId: 'u1' })
      expect(result).toHaveLength(1)
      expect(result[0].patientName).toBe('Ana Reyes')
      expect(result[0].locationName).toBe('Clínica Central')
      expect(result[0].startsAt).toBe(now.toISOString())
    })

    it('adds locationId filter when provided', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', locationId: 'loc1' })
      const where = mockPrisma.appointment.findMany.mock.calls[0][0].where
      expect(where.locationId).toBe('loc1')
    })

    it('adds status filter when provided', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', status: 'completed' })
      const where = mockPrisma.appointment.findMany.mock.calls[0][0].where
      expect(where.status).toBe('completed')
    })

    it('adds date range filter with both from and to', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      const from = new Date('2026-01-01')
      const to = new Date('2026-01-31')
      await repo.findMany({ tenantId: 't1', userId: 'u1', from, to })
      const where = mockPrisma.appointment.findMany.mock.calls[0][0].where
      expect(where.startsAt.gte).toBe(from)
      expect(where.startsAt.lte).toBe(to)
    })

    it('adds only from filter when only from is provided', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      const from = new Date('2026-01-01')
      await repo.findMany({ tenantId: 't1', userId: 'u1', from })
      const where = mockPrisma.appointment.findMany.mock.calls[0][0].where
      expect(where.startsAt.gte).toBe(from)
      expect(where.startsAt.lte).toBeUndefined()
    })

    it('adds only to filter when only to is provided', async () => {
      mockPrisma.appointment.findMany.mockResolvedValue([])
      const to = new Date('2026-01-31')
      await repo.findMany({ tenantId: 't1', userId: 'u1', to })
      const where = mockPrisma.appointment.findMany.mock.calls[0][0].where
      expect(where.startsAt.lte).toBe(to)
    })
  })

  describe('findById', () => {
    it('returns mapped appointment when found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(makeApptRow())
      const result = await repo.findById('apt1', 't1')
      expect(result?.id).toBe('apt1')
      expect(result?.patientDocumentNumber).toBe('001-123')
    })

    it('returns null when not found', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(null)
      expect(await repo.findById('bad', 't1')).toBeNull()
    })
  })

  describe('create', () => {
    it('creates appointment and returns mapped result', async () => {
      mockPrisma.appointment.create.mockResolvedValue(makeApptRow())
      const dto = {
        patientId: 'p1',
        locationId: 'loc1',
        startsAt: now.toISOString(),
        endsAt: later.toISOString(),
        reason: 'Routine',
      }
      const result = await repo.create('t1', 'u1', dto as never)
      expect(result.id).toBe('apt1')
      expect(result.status).toBe('scheduled')
    })
  })

  describe('update', () => {
    it('updates appointment and returns mapped result', async () => {
      const updated = makeApptRow({ status: 'completed' })
      mockPrisma.appointment.update.mockResolvedValue(updated)
      const result = await repo.update('apt1', 't1', { reason: 'Follow-up' } as never)
      expect(result.id).toBe('apt1')
    })
  })

  describe('updateStatus', () => {
    it('updates status and returns mapped result', async () => {
      mockPrisma.appointment.update.mockResolvedValue(makeApptRow({ status: 'completed' }))
      const result = await repo.updateStatus('apt1', 't1', 'completed')
      expect(result.status).toBe('completed')
    })
  })

  describe('softDelete', () => {
    it('sets deletedAt on the appointment', async () => {
      mockPrisma.appointment.update.mockResolvedValue({})
      await repo.softDelete('apt1', 't1')
      expect(mockPrisma.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      )
    })
  })

  describe('hasConflict', () => {
    it('returns true when count > 0', async () => {
      mockPrisma.appointment.count.mockResolvedValue(1)
      expect(await repo.hasConflict('u1', 't1', now, later)).toBe(true)
    })

    it('returns false when count is 0', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0)
      expect(await repo.hasConflict('u1', 't1', now, later)).toBe(false)
    })

    it('includes excludeId in query when provided', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0)
      await repo.hasConflict('u1', 't1', now, later, 'exclude-apt')
      const where = mockPrisma.appointment.count.mock.calls[0][0].where
      expect(where.id).toEqual({ not: 'exclude-apt' })
    })

    it('omits excludeId from query when not provided', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0)
      await repo.hasConflict('u1', 't1', now, later)
      const where = mockPrisma.appointment.count.mock.calls[0][0].where
      expect(where.id).toBeUndefined()
    })
  })

  describe('field mapping', () => {
    it('maps patientName from firstName + lastName', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(
        makeApptRow({ patient: { firstName: 'Juan', lastName: 'Pérez', documentNumber: null } }),
      )
      const result = await repo.findById('apt1', 't1')
      expect(result?.patientName).toBe('Juan Pérez')
    })

    it('maps null deletedAt to null', async () => {
      mockPrisma.appointment.findFirst.mockResolvedValue(makeApptRow({ deletedAt: null }))
      const result = await repo.findById('apt1', 't1')
      expect(result?.deletedAt).toBeNull()
    })
  })
})
