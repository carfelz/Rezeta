import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { AuthController } from '../auth.controller.js'

const mockService = {
  devGetToken: vi.fn(),
  provision: vi.fn(),
  toAuthUser: vi.fn(),
}

const baseUser = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner',
  specialty: null,
  licenseNumber: null,
  tenant: { seededAt: new Date('2026-01-01') },
}

const authUser = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner' as const,
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: '2026-01-01T00:00:00.000Z',
}

describe('AuthController', () => {
  let controller: AuthController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new AuthController(mockService as never)
    mockService.provision.mockResolvedValue(baseUser)
    mockService.toAuthUser.mockReturnValue(authUser)
    mockService.devGetToken.mockResolvedValue({
      access_token: 'tok',
      token_type: 'bearer',
      expires_in: 3600,
    })
  })

  // ── devToken ───────────────────────────────────────────────────────────────

  describe('devToken', () => {
    it('returns token for valid JSON body (email field)', async () => {
      const result = await controller.devToken({ email: 'dr@test.com', password: 'pw' })
      expect(mockService.devGetToken).toHaveBeenCalledWith('dr@test.com', 'pw')
      expect(result).toEqual({ access_token: 'tok', token_type: 'bearer', expires_in: 3600 })
    })

    it('uses username field (OAuth2 form body)', async () => {
      await controller.devToken({ username: 'dr@test.com', password: 'pw' })
      expect(mockService.devGetToken).toHaveBeenCalledWith('dr@test.com', 'pw')
    })

    it('prefers username over email when both present', async () => {
      await controller.devToken({ username: 'user@a.com', email: 'email@b.com', password: 'pw' })
      expect(mockService.devGetToken).toHaveBeenCalledWith('user@a.com', 'pw')
    })

    it('throws BadRequestException when email missing', async () => {
      await expect(controller.devToken({ password: 'pw' })).rejects.toThrow(BadRequestException)
      expect(mockService.devGetToken).not.toHaveBeenCalled()
    })

    it('throws BadRequestException when password missing', async () => {
      await expect(controller.devToken({ email: 'dr@test.com' })).rejects.toThrow(
        BadRequestException,
      )
      expect(mockService.devGetToken).not.toHaveBeenCalled()
    })
  })

  // ── provision ──────────────────────────────────────────────────────────────

  describe('provision', () => {
    it('calls service.provision and returns toAuthUser result', async () => {
      const decoded = { uid: 'fb1', email: 'dr@test.com' } as never
      const result = await controller.provision(decoded)
      expect(mockService.provision).toHaveBeenCalledWith(decoded)
      expect(mockService.toAuthUser).toHaveBeenCalledWith(baseUser)
      expect(result).toEqual(authUser)
    })
  })

  // ── me ─────────────────────────────────────────────────────────────────────

  describe('me', () => {
    it('returns the authenticated user as-is', () => {
      const result = controller.me(authUser)
      expect(result).toBe(authUser)
    })
  })
})
