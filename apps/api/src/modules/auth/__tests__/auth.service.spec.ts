import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { AuthService } from '../auth.service.js'

const mockRepo = {
  provisionUser: vi.fn(),
  findByFirebaseUid: vi.fn(),
}

const makeConfig = (nodeEnv: string, emulatorHost = '', webApiKey = 'key-123') => ({
  get: vi.fn((key: string) => {
    if (key === 'nodeEnv') return nodeEnv
    if (key === 'firebase') return { emulatorHost, webApiKey }
    return undefined
  }),
})

const baseUser = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner',
  specialty: 'cardiology',
  licenseNumber: 'MED-001',
  tenant: { seededAt: new Date('2026-01-01') },
}

describe('AuthService', () => {
  let service: AuthService

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // ── provision ─────────────────────────────────────────────────────────────

  describe('provision', () => {
    it('delegates to repository.provisionUser', async () => {
      const config = makeConfig('development')
      service = new AuthService(mockRepo as never, config as never)
      mockRepo.provisionUser.mockResolvedValue(baseUser)
      const decoded = { uid: 'fb1', email: 'dr@test.com' } as never
      const result = await service.provision(decoded)
      expect(result).toEqual(baseUser)
      expect(mockRepo.provisionUser).toHaveBeenCalledWith(decoded)
    })
  })

  // ── toAuthUser ─────────────────────────────────────────────────────────────

  describe('toAuthUser', () => {
    beforeEach(() => {
      service = new AuthService(mockRepo as never, makeConfig('development') as never)
    })

    it('maps user fields correctly', () => {
      const auth = service.toAuthUser(baseUser as never)
      expect(auth).toMatchObject({
        id: 'u1',
        firebaseUid: 'fb1',
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
  })

  // ── devGetToken ────────────────────────────────────────────────────────────

  describe('devGetToken', () => {
    it('throws ForbiddenException in production', async () => {
      service = new AuthService(mockRepo as never, makeConfig('production') as never)
      await expect(service.devGetToken('dr@test.com', 'pass')).rejects.toThrow(ForbiddenException)
    })

    it('calls Firebase REST API with emulator host when set', async () => {
      service = new AuthService(
        mockRepo as never,
        makeConfig('development', 'localhost:9099') as never,
      )
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ idToken: 'tok-123', expiresIn: '3600' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await service.devGetToken('dr@test.com', 'pass')
      expect(result).toEqual({ access_token: 'tok-123', token_type: 'bearer', expires_in: 3600 })
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('localhost:9099'),
        expect.objectContaining({ method: 'POST' }),
      )
      // Emulator always uses 'fake-api-key'
      expect(mockFetch.mock.calls[0][0]).toContain('fake-api-key')
    })

    it('calls Firebase REST API with real endpoint when no emulator', async () => {
      service = new AuthService(mockRepo as never, makeConfig('development', '') as never)
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ idToken: 'tok-456', expiresIn: '3600' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      await service.devGetToken('dr@test.com', 'pass')
      expect(mockFetch.mock.calls[0][0]).toContain('identitytoolkit.googleapis.com')
      expect(mockFetch.mock.calls[0][0]).toContain('key-123')
    })

    it('throws UnauthorizedException when Firebase returns error', async () => {
      service = new AuthService(
        mockRepo as never,
        makeConfig('development', 'localhost:9099') as never,
      )
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'INVALID_PASSWORD' } }),
      }))
      await expect(service.devGetToken('dr@test.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      )
    })

    it('throws UnauthorizedException with fallback message when no error message', async () => {
      service = new AuthService(
        mockRepo as never,
        makeConfig('development', 'localhost:9099') as never,
      )
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      }))
      await expect(service.devGetToken('dr@test.com', 'wrong')).rejects.toThrow('Invalid credentials')
    })
  })
})
