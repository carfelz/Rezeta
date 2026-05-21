import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { UsersService } from '../users.service.js'

const mockRepo = {
  findById: vi.fn(),
  updateProfile: vi.fn(),
  updatePreferences: vi.fn(),
}

describe('UsersService', () => {
  let service: UsersService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new UsersService(mockRepo as never)
  })

  describe('getById', () => {
    it('returns user when found', async () => {
      const user = { id: 'u1', tenantId: 't1', preferences: {} }
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

  describe('updateProfile', () => {
    it('delegates to repository after verifying user exists', async () => {
      const existingUser = { id: 'u1', tenantId: 't1', preferences: {} }
      mockRepo.findById.mockResolvedValue(existingUser)
      mockRepo.updateProfile.mockResolvedValue(undefined)

      await service.updateProfile('u1', 't1', {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
        licenseNumber: '1234',
      })

      expect(mockRepo.updateProfile).toHaveBeenCalledWith('u1', 't1', {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
        licenseNumber: '1234',
      })
    })

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.updateProfile('missing', 't1', {
          fullName: 'Dr. García',
          specialty: null,
          licenseNumber: null,
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('getPreferences', () => {
    it('returns parsed preferences', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: { consultationViewMode: 'canvas' },
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({ consultationViewMode: 'canvas' })
    })

    it('returns empty object when preferences malformed', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: { consultationViewMode: 'invalid-value' },
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({})
    })

    it('handles missing preferences (null/undefined) by returning empty object', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: null,
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({})
    })

    it('handles undefined preferences field by returning empty object', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({})
    })

    it('throws NotFoundException when user missing', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getPreferences('u1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updatePreferences', () => {
    it('merges patch with existing preferences and persists', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: { consultationViewMode: 'soap' },
      })
      const result = await service.updatePreferences('u1', 't1', {
        consultationViewMode: 'canvas',
      })
      expect(result).toEqual({ consultationViewMode: 'canvas' })
      expect(mockRepo.updatePreferences).toHaveBeenCalledWith('u1', 't1', {
        consultationViewMode: 'canvas',
      })
    })

    it('throws NotFoundException when user missing', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.updatePreferences('u1', 't1', { consultationViewMode: 'canvas' }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
