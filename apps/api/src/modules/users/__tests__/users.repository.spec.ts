import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnauthorizedException } from '@nestjs/common'
import { UsersRepository } from '../users.repository.js'

const seededAt = new Date('2026-01-01')

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}

const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never

const existingUser = {
  id: 'u1',
  externalUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  tenant: { seededAt, plan: 'free' },
}

describe('UsersRepository', () => {
  let repo: UsersRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new UsersRepository(mockPrisma as never)
  })

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('queries by id and tenantId with deletedAt null', async () => {
      const user = { id: 'u1', tenantId: 't1' }
      mockPrisma.user.findFirst.mockResolvedValue(user)
      const result = await repo.findById('u1', 't1')
      expect(result).toEqual(user)
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1', deletedAt: null },
      })
    })

    it('returns null when not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)
      expect(await repo.findById('none', 't1')).toBeNull()
    })
  })

  // ── updateProfile ─────────────────────────────────────────────────────────

  describe('updateProfile', () => {
    it('calls updateMany with correct tenant filter and profile data', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      await repo.updateProfile('u1', 't1', {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
        licenseNumber: '1234-DR',
      })
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1', deletedAt: null },
        data: { fullName: 'Dr. García', specialty: 'Cardiología', licenseNumber: '1234-DR' },
      })
    })

    it('allows null specialty and licenseNumber', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      await repo.updateProfile('u1', 't1', {
        fullName: 'Dr. García',
        specialty: null,
        licenseNumber: null,
      })
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ specialty: null, licenseNumber: null }),
        }),
      )
    })
  })

  // ── markSignedIn ───────────────────────────────────────────────────────────

  describe('markSignedIn', () => {
    it('stamps lastLoginAt scoped by id and tenantId', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      await repo.markSignedIn('u1', 't1')
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1' },
        data: { lastLoginAt: expect.any(Date) },
      })
    })
  })

  // ── findByExternalUid ──────────────────────────────────────────────────────

  describe('findByExternalUid', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)
      const result = await repo.findByExternalUid('fb1')
      expect(result).toEqual(existingUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { externalUid: 'fb1', deletedAt: null },
        }),
      )
    })

    it('returns null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      expect(await repo.findByExternalUid('none')).toBeNull()
    })
  })

  // ── provisionUser ──────────────────────────────────────────────────────────

  describe('provisionUser', () => {
    it('returns the existing user for a known externalUid', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)
      const result = await repo.provisionUser(verified)
      expect(result).toEqual(existingUser)
    })

    it('rejects USER_NOT_PROVISIONED when no user row exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      await expect(repo.provisionUser(verified)).rejects.toThrow(UnauthorizedException)
    })

    it('never creates a tenant', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)
      await repo.provisionUser(verified)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  // ── listByTenant ───────────────────────────────────────────────────────────

  describe('listByTenant', () => {
    it('lists active users for the tenant ordered by createdAt', async () => {
      mockPrisma.user.findMany.mockResolvedValue([existingUser])
      const result = await repo.listByTenant('t1')
      expect(result).toEqual([existingUser])
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { tenantId: 't1', deletedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    })
  })

  // ── createProvisionedUser ──────────────────────────────────────────────────

  describe('createProvisionedUser', () => {
    it('creates a user row with the supplied externalUid and role', async () => {
      const created = { ...existingUser, id: 'u2', role: 'assistant' }
      mockPrisma.user.create.mockResolvedValue(created)
      const result = await repo.createProvisionedUser({
        tenantId: 't1',
        externalUid: 'fb-new',
        email: 'nurse@clinic.do',
        fullName: 'Ana Reyes',
        role: 'assistant',
      })
      expect(result).toEqual(created)
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          tenantId: 't1',
          externalUid: 'fb-new',
          email: 'nurse@clinic.do',
          fullName: 'Ana Reyes',
          role: 'assistant',
        },
      })
    })
  })

  // ── updateRole ─────────────────────────────────────────────────────────────

  describe('updateRole', () => {
    it('updates role with a tenant filter', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      await repo.updateRole('u1', 't1', 'admin')
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1', deletedAt: null },
        data: { role: 'admin' },
      })
    })
  })

  // ── setActive ──────────────────────────────────────────────────────────────

  describe('setActive', () => {
    it('deactivating stamps deletedAt and clears isActive', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      await repo.setActive('u1', 't1', false)
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1' },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      })
    })

    it('reactivating clears deletedAt and sets isActive', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })
      await repo.setActive('u1', 't1', true)
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1' },
        data: { isActive: true, deletedAt: null },
      })
    })
  })
})
