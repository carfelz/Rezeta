import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatientsRepository } from '../patients.repository.js'

const now = new Date('2026-01-01')
const patient = {
  id: 'p1',
  tenantId: 't1',
  ownerUserId: 'u1',
  firstName: 'Ana María',
  lastName: 'Reyes',
  dateOfBirth: null,
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: null,
  email: null,
  address: null,
  bloodType: null,
  allergies: [],
  chronicConditions: [],
  notes: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
}

const mockPrisma = {
  patient: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

describe('PatientsRepository', () => {
  let repo: PatientsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new PatientsRepository(mockPrisma as never)
  })

  describe('findMany', () => {
    it('returns list of patients without search', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([patient])
      const result = await repo.findMany({ tenantId: 't1', ownerId: 'u1' })
      expect(result).toHaveLength(1)
      expect(mockPrisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 't1', ownerUserId: 'u1', deletedAt: null }),
        }),
      )
    })

    it('adds OR search filter when search is provided', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([patient])
      await repo.findMany({ tenantId: 't1', ownerId: 'u1', search: 'Ana' })
      const where = mockPrisma.patient.findMany.mock.calls[0][0].where
      expect(where.OR).toBeDefined()
      expect(where.OR).toHaveLength(4)
    })

    it('uses cursor pagination when cursor is provided', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', ownerId: 'u1', cursor: 'p2', limit: 10 })
      const args = mockPrisma.patient.findMany.mock.calls[0][0]
      expect(args.cursor).toEqual({ id: 'p2' })
      expect(args.skip).toBe(1)
      expect(args.take).toBe(11)
    })
  })

  describe('findById', () => {
    it('returns patient when found', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(patient)
      const result = await repo.findById('p1', 't1')
      expect(result?.id).toBe('p1')
    })

    it('returns null when not found', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      expect(await repo.findById('bad', 't1')).toBeNull()
    })
  })

  describe('create', () => {
    it('splits fullName into firstName and lastName', async () => {
      mockPrisma.patient.create.mockResolvedValue(patient)
      await repo.create('t1', 'u1', { fullName: 'Ana María Reyes' } as never)
      const data = mockPrisma.patient.create.mock.calls[0][0].data
      expect(data.firstName).toBe('Ana María')
      expect(data.lastName).toBe('Reyes')
    })

    it('handles single-word name (no lastName)', async () => {
      mockPrisma.patient.create.mockResolvedValue({ ...patient, firstName: 'Ana', lastName: '' })
      await repo.create('t1', 'u1', { fullName: 'Ana' } as never)
      const data = mockPrisma.patient.create.mock.calls[0][0].data
      expect(data.firstName).toBe('Ana')
      expect(data.lastName).toBe('')
    })

    it('sets dateOfBirth to null when not provided', async () => {
      mockPrisma.patient.create.mockResolvedValue(patient)
      await repo.create('t1', 'u1', { fullName: 'Ana Reyes' } as never)
      expect(mockPrisma.patient.create.mock.calls[0][0].data.dateOfBirth).toBeNull()
    })

    it('converts dateOfBirth string to Date when provided', async () => {
      mockPrisma.patient.create.mockResolvedValue(patient)
      await repo.create('t1', 'u1', { fullName: 'Ana Reyes', dateOfBirth: '1990-05-15' } as never)
      const dob = mockPrisma.patient.create.mock.calls[0][0].data.dateOfBirth
      expect(dob).toBeInstanceOf(Date)
    })
  })

  describe('update', () => {
    it('splits fullName when provided', async () => {
      mockPrisma.patient.update.mockResolvedValue(patient)
      await repo.update('p1', 't1', { fullName: 'María López' } as never)
      const data = mockPrisma.patient.update.mock.calls[0][0].data
      expect(data.firstName).toBe('María')
      expect(data.lastName).toBe('López')
      expect(data.fullName).toBeUndefined()
    })

    it('does not include firstName/lastName when fullName not provided', async () => {
      mockPrisma.patient.update.mockResolvedValue(patient)
      await repo.update('p1', 't1', { phone: '555-1234' } as never)
      const data = mockPrisma.patient.update.mock.calls[0][0].data
      expect(data.firstName).toBeUndefined()
    })

    it('converts dateOfBirth to Date when provided', async () => {
      mockPrisma.patient.update.mockResolvedValue(patient)
      await repo.update('p1', 't1', { dateOfBirth: '1990-05-15' } as never)
      const data = mockPrisma.patient.update.mock.calls[0][0].data
      expect(data.dateOfBirth).toBeInstanceOf(Date)
    })

    it('sets dateOfBirth to null when explicitly null', async () => {
      mockPrisma.patient.update.mockResolvedValue(patient)
      await repo.update('p1', 't1', { dateOfBirth: null } as never)
      const data = mockPrisma.patient.update.mock.calls[0][0].data
      expect(data.dateOfBirth).toBeNull()
    })
  })

  describe('softDelete', () => {
    it('sets deletedAt', async () => {
      mockPrisma.patient.update.mockResolvedValue(patient)
      await repo.softDelete('p1', 't1')
      expect(mockPrisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      )
    })
  })
})
