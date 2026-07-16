import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsersRepository } from '../users.repository.js'

const seededAt = new Date('2026-01-01')

const mockTx = {
  tenant: { create: vi.fn() },
  user: { create: vi.fn() },
}

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
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
    it('returns existing user without creating new records (fast path)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)
      const result = await repo.provisionUser(verified)
      expect(result).toEqual(existingUser)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('backfills profile on an existing user whose fullName is blank (F1)', async () => {
      // A racing empty provision created the row first with no name; the signup
      // provision that carries the profile must patch it, not silently drop it.
      const blankUser = { ...existingUser, fullName: '', specialty: null }
      mockPrisma.user.findUnique.mockResolvedValue(blankUser)
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 })

      const result = await repo.provisionUser(verified, {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
      })

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'u1', tenantId: 't1', deletedAt: null },
        data: { fullName: 'Dr. García', specialty: 'Cardiología' },
      })
      expect(result).toMatchObject({ fullName: 'Dr. García', specialty: 'Cardiología' })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('does not overwrite an already-set fullName when a profile is supplied', async () => {
      const namedUser = { ...existingUser, fullName: 'Dr. Existing', specialty: 'Pediatría' }
      mockPrisma.user.findUnique.mockResolvedValue(namedUser)

      const result = await repo.provisionUser(verified, {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
      })

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
      expect(result).toEqual(namedUser)
    })

    it('does not blank out an existing named user on an empty provision', async () => {
      const namedUser = { ...existingUser, fullName: 'Dr. Existing', specialty: 'Pediatría' }
      mockPrisma.user.findUnique.mockResolvedValue(namedUser)

      const result = await repo.provisionUser(verified)

      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled()
      expect(result).toEqual(namedUser)
    })

    it('creates tenant + user in a transaction when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const tenant = { id: 't1', seededAt }
      const newUser = { ...existingUser, id: 'u2' }
      mockTx.tenant.create.mockResolvedValue(tenant)
      mockTx.user.create.mockResolvedValue(newUser)

      const result = await repo.provisionUser(verified)
      expect(result).toEqual(newUser)
      expect(mockTx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'solo', plan: 'free' }) }),
      )
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            externalUid: 'fb1',
            email: 'dr@test.com',
            role: 'super_admin',
          }),
        }),
      )
    })

    it('saves profile fields on first creation when provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const newUser = { ...existingUser, fullName: 'Dr. García', specialty: 'Cardiología' }
      mockTx.tenant.create.mockResolvedValue({ id: 't1' })
      mockTx.user.create.mockResolvedValue(newUser)

      await repo.provisionUser(verified, { fullName: 'Dr. García', specialty: 'Cardiología' })
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fullName: 'Dr. García', specialty: 'Cardiología' }),
        }),
      )
    })

    it('omits profile fields when not provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockTx.tenant.create.mockResolvedValue({ id: 't1' })
      mockTx.user.create.mockResolvedValue(existingUser)

      await repo.provisionUser(verified)
      const callData = mockTx.user.create.mock.calls[0]![0].data as Record<string, unknown>
      expect(callData).not.toHaveProperty('fullName')
      expect(callData).not.toHaveProperty('specialty')
    })

    it('handles empty email gracefully (uses empty string)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const newUser = { ...existingUser, email: '' }
      mockTx.tenant.create.mockResolvedValue({ id: 't1' })
      mockTx.user.create.mockResolvedValue(newUser)

      const result = await repo.provisionUser({
        externalUid: 'fb2',
        email: '',
        rawClaims: {},
      } as never)
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: '' }),
        }),
      )
      expect(result).toEqual(newUser)
    })

    it('handles race condition: P2002 unique violation → re-fetches existing user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser)

      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error)

      const result = await repo.provisionUser(verified)
      expect(result).toEqual(existingUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2)
    })

    it('re-throws non-P2002 errors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB connection lost'))
      await expect(repo.provisionUser(verified)).rejects.toThrow('DB connection lost')
    })

    it('re-throws P2002 if re-fetch returns null (extreme edge case)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error)

      await expect(repo.provisionUser(verified)).rejects.toThrow(p2002Error)
    })
  })
})
