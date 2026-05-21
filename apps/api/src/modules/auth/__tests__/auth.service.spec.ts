import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../auth.service.js'

const mockRepo = {
  provisionUser: vi.fn(),
  findByExternalUid: vi.fn(),
}

const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }

const mockAuthProvider = {
  verifyToken: vi.fn(),
  signInWithPassword: vi.fn(),
  revokeUserSessions: vi.fn(),
  deleteUser: vi.fn(),
}

const makeConfig = (nodeEnv: string, webApiKey = 'key-123') => ({
  get: vi.fn((key: string) => {
    if (key === 'nodeEnv') return nodeEnv
    if (key === 'firebase') return { webApiKey }
    return undefined
  }),
})

const baseUser = {
  id: 'u1',
  externalUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner',
  specialty: 'cardiology',
  licenseNumber: 'MED-001',
  tenant: { seededAt: new Date('2026-01-01') },
}

function makeService(nodeEnv = 'development') {
  return new AuthService(
    mockRepo as never,
    makeConfig(nodeEnv) as never,
    mockAuditLog as never,
    mockAuthProvider as never,
  )
}

describe('AuthService', () => {
  let service: AuthService

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // ── provision ─────────────────────────────────────────────────────────────

  describe('provision', () => {
    beforeEach(() => {
      service = makeService()
    })

    it('delegates to repository.provisionUser', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never
      const result = await service.provision(verified)
      expect(result).toEqual(baseUser)
      expect(mockRepo.provisionUser).toHaveBeenCalledWith(verified, undefined)
    })

    it('records login audit event after successful provision', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never
      await service.provision(verified, {
        ip: '192.168.1.1',
        userAgent: 'TestBrowser/1.0',
        requestId: 'req-abc',
      })
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          actorUserId: 'u1',
          actorType: 'user',
          category: 'auth',
          action: 'login',
          status: 'success',
          ipAddress: '192.168.1.1',
          userAgent: 'TestBrowser/1.0',
          requestId: 'req-abc',
        }),
      )
    })

    it('records login audit event without meta when meta is not provided', async () => {
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const verified = { externalUid: 'fb1', email: 'dr@test.com', rawClaims: {} } as never
      await service.provision(verified)
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'auth', action: 'login' }),
      )
    })
  })

  // ── toAuthUser ─────────────────────────────────────────────────────────────

  describe('toAuthUser', () => {
    beforeEach(() => {
      service = makeService()
    })

    it('maps user fields correctly', () => {
      const auth = service.toAuthUser(baseUser as never)
      expect(auth).toMatchObject({
        id: 'u1',
        externalUid: 'fb1',
        tenantId: 't1',
        email: 'dr@test.com',
        fullName: 'Dr. Test',
        role: 'owner',
        specialty: 'cardiology',
        licenseNumber: 'MED-001',
        tenantSeededAt: '2026-01-01T00:00:00.000Z',
      })
    })

    it('returns null tenantSeededAt when seededAt is null', () => {
      const user = { ...baseUser, tenant: { seededAt: null } }
      const auth = service.toAuthUser(user as never)
      expect(auth.tenantSeededAt).toBeNull()
    })

    it('returns empty preferences when stored preferences fail schema validation', () => {
      const user = { ...baseUser, preferences: { consultationViewMode: 'invalid_value' } }
      const auth = service.toAuthUser(user as never)
      expect(auth.preferences).toEqual({})
    })
  })

  // ── devGetToken ────────────────────────────────────────────────────────────

  describe('devGetToken', () => {
    it('throws ForbiddenException in production', async () => {
      service = makeService('production')
      await expect(service.devGetToken('dr@test.com', 'pass')).rejects.toThrow(ForbiddenException)
      expect(mockAuthProvider.signInWithPassword).not.toHaveBeenCalled()
    })

    it('delegates to authProvider.signInWithPassword and maps response', async () => {
      service = makeService('development')
      mockAuthProvider.signInWithPassword.mockResolvedValue({
        accessToken: 'tok-123',
        expiresIn: 3600,
      })
      const result = await service.devGetToken('dr@test.com', 'pass')
      expect(result).toEqual({ access_token: 'tok-123', token_type: 'bearer', expires_in: 3600 })
      expect(mockAuthProvider.signInWithPassword).toHaveBeenCalledWith('dr@test.com', 'pass')
    })

    it('propagates UnauthorizedException from provider', async () => {
      service = makeService('development')
      mockAuthProvider.signInWithPassword.mockRejectedValue(
        new UnauthorizedException('INVALID_PASSWORD'),
      )
      await expect(service.devGetToken('dr@test.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      )
    })
  })
})
