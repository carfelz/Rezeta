import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocationsRepository } from '../locations.repository.js'

const now = new Date('2026-01-01T00:00:00Z')

function makePrismaLocation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loc1',
    tenantId: 't1',
    name: 'Clínica Central',
    address: '123 Main St',
    city: 'Santo Domingo',
    phone: '809-555-0001',
    isOwned: true,
    notes: null,
    commissionPercent: { toNumber: () => 15 },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    doctorLocations: [{ consultationFee: { toNumber: () => 1500 } }],
    ...overrides,
  }
}

const mockTx = {
  location: { create: vi.fn(), update: vi.fn() },
  doctorLocation: { create: vi.fn(), upsert: vi.fn() },
}

const mockPrisma = {
  location: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  appointment: {
    count: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

describe('LocationsRepository', () => {
  let repo: LocationsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new LocationsRepository(mockPrisma as never)
  })

  describe('findMany', () => {
    it('returns mapped locations with consultationFee', async () => {
      mockPrisma.location.findMany.mockResolvedValue([makePrismaLocation()])
      const result = await repo.findMany('t1', 'u1')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Clínica Central')
      expect(result[0].commissionPercent).toBe(15)
      expect(result[0].consultationFee).toBe(1500)
      expect(result[0].createdAt).toBe(now.toISOString())
    })

    it('returns consultationFee of 0 when no doctorLocation', async () => {
      mockPrisma.location.findMany.mockResolvedValue([makePrismaLocation({ doctorLocations: [] })])
      const result = await repo.findMany('t1', 'u1')
      expect(result[0].consultationFee).toBe(0)
    })

    it('returns empty array when no locations', async () => {
      mockPrisma.location.findMany.mockResolvedValue([])
      expect(await repo.findMany('t1', 'u1')).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns mapped location when found', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(makePrismaLocation())
      const result = await repo.findById('loc1', 't1', 'u1')
      expect(result?.id).toBe('loc1')
      expect(result?.isOwned).toBe(true)
      expect(result?.consultationFee).toBe(1500)
    })

    it('returns null when not found', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(null)
      expect(await repo.findById('missing', 't1')).toBeNull()
    })
  })

  describe('create', () => {
    it('creates location and doctor-location in transaction, returns re-fetched location', async () => {
      const prismaLoc = makePrismaLocation()
      mockTx.location.create.mockResolvedValue(prismaLoc)
      mockTx.doctorLocation.create.mockResolvedValue({})
      // findById re-fetch after transaction
      mockPrisma.location.findFirst.mockResolvedValue(prismaLoc)

      const dto = {
        name: 'Clínica Central',
        address: '123 Main St',
        city: 'Santo Domingo',
        phone: '809-555-0001',
        isOwned: true,
        commissionPercent: 15,
        consultationFee: 1500,
      }
      const result = await repo.create('t1', 'u1', dto as never)
      expect(result.name).toBe('Clínica Central')
      expect(result.consultationFee).toBe(1500)
      expect(mockTx.doctorLocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', consultationFee: 1500 }),
        }),
      )
    })

    it('uses default consultationFee of 0 when not provided', async () => {
      const prismaLoc = makePrismaLocation({
        doctorLocations: [{ consultationFee: { toNumber: () => 0 } }],
      })
      mockTx.location.create.mockResolvedValue(prismaLoc)
      mockTx.doctorLocation.create.mockResolvedValue({})
      mockPrisma.location.findFirst.mockResolvedValue(prismaLoc)

      const dto = { name: 'Clínica B' }
      await repo.create('t1', 'u1', dto as never)
      expect(mockTx.doctorLocation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ consultationFee: 0 }),
        }),
      )
    })
  })

  describe('update', () => {
    it('updates location and consultationFee in transaction, returns re-fetched location', async () => {
      const updated = makePrismaLocation({ name: 'Clínica B' })
      mockTx.location.update.mockResolvedValue(updated)
      mockTx.doctorLocation.upsert.mockResolvedValue({})
      mockPrisma.location.findFirst.mockResolvedValue(updated)

      const result = await repo.update('loc1', 't1', 'u1', {
        name: 'Clínica B',
        consultationFee: 2000,
      } as never)
      expect(result.name).toBe('Clínica B')
      expect(mockTx.doctorLocation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ consultationFee: 2000 }),
          create: expect.objectContaining({
            consultationFee: 2000,
            userId: 'u1',
            locationId: 'loc1',
          }),
        }),
      )
    })

    it('skips doctorLocation update when consultationFee not in dto', async () => {
      mockTx.location.update.mockResolvedValue(makePrismaLocation())
      mockPrisma.location.findFirst.mockResolvedValue(makePrismaLocation())

      await repo.update('loc1', 't1', 'u1', { name: 'New Name' } as never)
      expect(mockTx.doctorLocation.upsert).not.toHaveBeenCalled()
    })
  })

  describe('softDelete', () => {
    it('sets deletedAt on the location', async () => {
      mockPrisma.location.update.mockResolvedValue({})
      await repo.softDelete('loc1', 't1')
      expect(mockPrisma.location.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      )
    })
  })

  describe('hasFutureAppointments', () => {
    it('returns true when count > 0', async () => {
      mockPrisma.appointment.count.mockResolvedValue(3)
      expect(await repo.hasFutureAppointments('loc1', 't1')).toBe(true)
    })

    it('returns false when count is 0', async () => {
      mockPrisma.appointment.count.mockResolvedValue(0)
      expect(await repo.hasFutureAppointments('loc1', 't1')).toBe(false)
    })
  })

  describe('field mapping', () => {
    it('maps deletedAt to ISO string when not null', async () => {
      const deleted = new Date('2026-06-01')
      mockPrisma.location.findFirst.mockResolvedValue(makePrismaLocation({ deletedAt: deleted }))
      const result = await repo.findById('loc1', 't1')
      expect(result?.deletedAt).toBe(deleted.toISOString())
    })

    it('maps null deletedAt to null', async () => {
      mockPrisma.location.findFirst.mockResolvedValue(makePrismaLocation({ deletedAt: null }))
      const result = await repo.findById('loc1', 't1')
      expect(result?.deletedAt).toBeNull()
    })
  })
})
