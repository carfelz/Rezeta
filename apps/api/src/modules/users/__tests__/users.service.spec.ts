import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { UsersService } from '../users.service.js'

const mockRepo = {
  findByFirebaseUid: vi.fn(),
  findById: vi.fn(),
}

describe('UsersService', () => {
  let service: UsersService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new UsersService(mockRepo as never)
  })

  describe('getByFirebaseUid', () => {
    it('returns user when found', async () => {
      const user = { id: 'u1', firebaseUid: 'fb1' }
      mockRepo.findByFirebaseUid.mockResolvedValue(user)
      const result = await service.getByFirebaseUid('fb1')
      expect(result).toEqual(user)
      expect(mockRepo.findByFirebaseUid).toHaveBeenCalledWith('fb1')
    })

    it('returns null when not found', async () => {
      mockRepo.findByFirebaseUid.mockResolvedValue(null)
      const result = await service.getByFirebaseUid('not-exist')
      expect(result).toBeNull()
    })
  })

  describe('getById', () => {
    it('returns user when found', async () => {
      const user = { id: 'u1', tenantId: 't1' }
      mockRepo.findById.mockResolvedValue(user)
      const result = await service.getById('u1', 't1')
      expect(result).toEqual(user)
      expect(mockRepo.findById).toHaveBeenCalledWith('u1', 't1')
    })

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getById('missing', 't1')).rejects.toThrow(NotFoundException)
    })
  })
})
