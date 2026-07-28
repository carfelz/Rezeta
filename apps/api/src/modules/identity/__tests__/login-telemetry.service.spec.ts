import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { LoginTelemetryService, fingerprintFor, mapFirebaseSignInMethod } from '../login-telemetry.service.js'
import type { IdentityRepository } from '../identity.repository.js'
import type { InvitationMailerService } from '../../users/index.js'

const mockRepo = { insertLoginEvent: vi.fn(), upsertDevice: vi.fn() }
const mockMailer = { sendNewDeviceEmail: vi.fn().mockResolvedValue(undefined) }

function makeService(): LoginTelemetryService {
  return new LoginTelemetryService(
    mockRepo as unknown as IdentityRepository,
    mockMailer as unknown as InvitationMailerService,
  )
}

const NOW = new Date('2026-07-28T12:00:00.000Z')
const OLD = new Date('2026-07-01T00:00:00.000Z')

function deviceRow(firstSeenAt: Date, lastSeenAt: Date) {
  return { id: 'd1', fingerprint: 'fp1', userAgent: 'UA', firstSeenAt, lastSeenAt }
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
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ tenantId: 't1', userId: 'u1', userAgent: 'Mozilla/5.0', ipAddress: '10.0.0.1' })
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
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ platformUserId: 'p1' })
    expect(mockRepo.upsertDevice).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: null, userId: null, platformUserId: 'p1', userAgent: null }),
    )
  })

  it('returns created: true when firstSeenAt equals lastSeenAt (a brand-new device row)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    const result = await makeService().upsertDevice({ userId: 'u1' })
    expect(result).toEqual({ created: true })
  })

  it('returns created: false when lastSeenAt is bumped past firstSeenAt (an existing device)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(OLD, NOW))
    const result = await makeService().upsertDevice({ userId: 'u1' })
    expect(result).toEqual({ created: false })
  })

  it('sends the new-device email when the device is new, an institution user, and an email is supplied', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ userId: 'u1', userAgent: 'Mozilla/5.0', email: 'dr@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).toHaveBeenCalledWith('dr@rezeta.do', 'Mozilla/5.0')
  })

  it('falls back to a generic device label when userAgent is absent', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ userId: 'u1', email: 'dr@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).toHaveBeenCalledWith('dr@rezeta.do', 'Unknown device')
  })

  it('does not send the new-device email when the device already existed', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(OLD, NOW))
    await makeService().upsertDevice({ userId: 'u1', email: 'dr@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).not.toHaveBeenCalled()
  })

  it('does not send the new-device email when no email is supplied', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ userId: 'u1' })
    expect(mockMailer.sendNewDeviceEmail).not.toHaveBeenCalled()
  })

  it('does not send the new-device email when userId is absent (no institution user to notify)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    await makeService().upsertDevice({ platformUserId: 'p1', email: 'staff@rezeta.do' })
    expect(mockMailer.sendNewDeviceEmail).not.toHaveBeenCalled()
  })

  it('a new-device email failure does not reject upsertDevice (fire-and-forget)', async () => {
    mockRepo.upsertDevice.mockResolvedValue(deviceRow(NOW, NOW))
    mockMailer.sendNewDeviceEmail.mockRejectedValueOnce(new Error('smtp down'))
    await expect(makeService().upsertDevice({ userId: 'u1', email: 'dr@rezeta.do' })).resolves.toEqual({
      created: true,
    })
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
