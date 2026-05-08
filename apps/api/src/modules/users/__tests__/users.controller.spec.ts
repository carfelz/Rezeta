import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthUser } from '@rezeta/shared'
import { UsersController } from '../users.controller.js'

const mockSvc = {
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
}

const user: AuthUser = {
  id: 'u1',
  externalUid: 'ext-1',
  tenantId: 't1',
  email: 'doc@test',
  fullName: null,
  role: 'owner',
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
  preferences: {},
}

describe('UsersController', () => {
  let controller: UsersController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new UsersController(mockSvc as never)
  })

  describe('getPreferences', () => {
    it('delegates to service', async () => {
      mockSvc.getPreferences.mockResolvedValue({ consultationViewMode: 'canvas' })
      const result = await controller.getPreferences(user)
      expect(result).toEqual({ consultationViewMode: 'canvas' })
      expect(mockSvc.getPreferences).toHaveBeenCalledWith('u1', 't1')
    })
  })

  describe('updatePreferences', () => {
    it('delegates to service with merged result', async () => {
      mockSvc.updatePreferences.mockResolvedValue({ consultationViewMode: 'canvas' })
      const result = await controller.updatePreferences(user, {
        consultationViewMode: 'canvas',
      })
      expect(result).toEqual({ consultationViewMode: 'canvas' })
      expect(mockSvc.updatePreferences).toHaveBeenCalledWith('u1', 't1', {
        consultationViewMode: 'canvas',
      })
    })
  })
})
