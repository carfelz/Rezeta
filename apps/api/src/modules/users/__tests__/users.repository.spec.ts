import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UsersRepository } from '../users.repository.js'

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
}

describe('UsersRepository', () => {
  let repo: UsersRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new UsersRepository(mockPrisma as never)
  })

  describe('findByFirebaseUid', () => {
    it('queries by firebaseUid with deletedAt null', async () => {
      const user = { id: 'u1', firebaseUid: 'fb1' }
      mockPrisma.user.findUnique.mockResolvedValue(user)
      const result = await repo.findByFirebaseUid('fb1')
      expect(result).toEqual(user)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb1', deletedAt: null },
      })
    })

    it('returns null when not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      expect(await repo.findByFirebaseUid('none')).toBeNull()
    })
  })

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
})
