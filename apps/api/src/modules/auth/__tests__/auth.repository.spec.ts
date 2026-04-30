import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthRepository } from '../auth.repository.js'

const seededAt = new Date('2026-01-01')

const mockTx = {
  tenant: { create: vi.fn() },
  user: { create: vi.fn() },
}

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

const decoded = { uid: 'fb1', email: 'dr@test.com' } as never

const existingUser = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  tenant: { seededAt },
}

describe('AuthRepository', () => {
  let repo: AuthRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new AuthRepository(mockPrisma as never)
  })

  // ── provisionUser ──────────────────────────────────────────────────────────

  describe('provisionUser', () => {
    it('returns existing user without creating new records (fast path)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)
      const result = await repo.provisionUser(decoded)
      expect(result).toEqual(existingUser)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('creates tenant + user in a transaction when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const tenant = { id: 't1', seededAt }
      const newUser = { ...existingUser, id: 'u2' }
      mockTx.tenant.create.mockResolvedValue(tenant)
      mockTx.user.create.mockResolvedValue(newUser)

      const result = await repo.provisionUser(decoded)
      expect(result).toEqual(newUser)
      expect(mockTx.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ type: 'solo', plan: 'free' }) }),
      )
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ firebaseUid: 'fb1', email: 'dr@test.com', role: 'owner' }),
        }),
      )
    })

    it('handles empty email gracefully (uses empty string)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const newUser = { ...existingUser, email: '' }
      mockTx.tenant.create.mockResolvedValue({ id: 't1' })
      mockTx.user.create.mockResolvedValue(newUser)

      const result = await repo.provisionUser({ uid: 'fb2', email: undefined } as never)
      expect(mockTx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: '' }),
        }),
      )
      expect(result).toEqual(newUser)
    })

    it('handles race condition: P2002 unique violation → re-fetches existing user', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // initial fast-path lookup
        .mockResolvedValueOnce(existingUser) // re-fetch after race

      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error)

      const result = await repo.provisionUser(decoded)
      expect(result).toEqual(existingUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(2)
    })

    it('re-throws non-P2002 errors', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('DB connection lost'))
      await expect(repo.provisionUser(decoded)).rejects.toThrow('DB connection lost')
    })

    it('re-throws P2002 if re-fetch returns null (extreme edge case)', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)

      const p2002Error = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error)

      await expect(repo.provisionUser(decoded)).rejects.toThrow(p2002Error)
    })
  })

  // ── findByFirebaseUid ──────────────────────────────────────────────────────

  describe('findByFirebaseUid', () => {
    it('returns user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(existingUser)
      const result = await repo.findByFirebaseUid('fb1')
      expect(result).toEqual(existingUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { firebaseUid: 'fb1', deletedAt: null },
        }),
      )
    })

    it('returns null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      expect(await repo.findByFirebaseUid('none')).toBeNull()
    })
  })
})
