import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { LoginTelemetryService, fingerprintFor, mapFirebaseSignInMethod } from '../login-telemetry.service.js'
import type { IdentityRepository } from '../identity.repository.js'

const mockRepo = { insertLoginEvent: vi.fn(), upsertDevice: vi.fn() }

function makeService(): LoginTelemetryService {
  return new LoginTelemetryService(mockRepo as unknown as IdentityRepository)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recordLogin', () => {
  it('inserts a login event, normalizing missing fields to null', async () => {
    mockRepo.insertLoginEvent.mockResolvedValue(undefined)
    await makeService().recordLogin({ tenantId: 't1', userId: 'u1', outcome: 'success', method: 'password' })
    expect(mockRepo.insertLoginEvent).toHaveBeenCalledWith({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      outcome: 'success',
      method: 'password',
      ipAddress: null,
      userAgent: null,
    })
  })

  it('propagates repository failures — callers are responsible for their own .catch (see AuthGuard/AuthService)', async () => {
    const err = new Error('db down')
    mockRepo.insertLoginEvent.mockRejectedValue(err)
    await expect(makeService().recordLogin({ outcome: 'blocked', method: 'unknown' })).rejects.toBe(err)
  })

  it('passes through platformUserId/ipAddress/userAgent when supplied', async () => {
    mockRepo.insertLoginEvent.mockResolvedValue(undefined)
    await makeService().recordLogin({
      platformUserId: 'p1',
      outcome: 'success',
      method: 'sso',
      ipAddress: '2.2.2.2',
      userAgent: 'UA-x',
    })
    expect(mockRepo.insertLoginEvent).toHaveBeenCalledWith({
      tenantId: null,
      userId: null,
      platformUserId: 'p1',
      outcome: 'success',
      method: 'sso',
      ipAddress: '2.2.2.2',
      userAgent: 'UA-x',
    })
  })
})

describe('upsertDevice', () => {
  it('computes a deterministic sha256 fingerprint and upserts', async () => {
    mockRepo.upsertDevice.mockResolvedValue(undefined)
    await makeService().upsertDevice({
      tenantId: 't1',
      userId: 'u1',
      userAgent: 'Mozilla/5.0',
      ipAddress: '10.0.0.1',
    })
    const expected = createHash('sha256').update('Mozilla/5.0|10.0.0.1').digest('hex')
    expect(mockRepo.upsertDevice).toHaveBeenCalledWith({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: expected,
      userAgent: 'Mozilla/5.0',
    })
  })

  it('normalizes missing tenantId/userId/userAgent and passes through a supplied platformUserId', async () => {
    mockRepo.upsertDevice.mockResolvedValue(undefined)
    await makeService().upsertDevice({ platformUserId: 'p1' })
    expect(mockRepo.upsertDevice).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: null,
        userId: null,
        platformUserId: 'p1',
        userAgent: null,
      }),
    )
  })
})

describe('fingerprintFor', () => {
  it('is deterministic for the same inputs and differs for different inputs', () => {
    const a = fingerprintFor('UA-1', '1.1.1.1')
    const b = fingerprintFor('UA-1', '1.1.1.1')
    const c = fingerprintFor('UA-2', '1.1.1.1')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toHaveLength(64)
  })

  it('handles missing userAgent/ip without throwing', () => {
    expect(fingerprintFor(null, undefined)).toHaveLength(64)
  })
})

describe('mapFirebaseSignInMethod', () => {
  it('maps the password provider', () => {
    expect(mapFirebaseSignInMethod({ firebase: { sign_in_provider: 'password' } })).toBe('password')
  })
  it('maps google.com to google', () => {
    expect(mapFirebaseSignInMethod({ firebase: { sign_in_provider: 'google.com' } })).toBe('google')
  })
  it('maps anything else, or missing claims, to unknown', () => {
    expect(mapFirebaseSignInMethod({ firebase: { sign_in_provider: 'saml.example.com' } })).toBe('unknown')
    expect(mapFirebaseSignInMethod({})).toBe('unknown')
  })
})
