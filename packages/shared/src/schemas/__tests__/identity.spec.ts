import { describe, expect, it } from 'vitest'
import { LoginEventItemSchema, SecuritySummarySchema, UserDeviceItemSchema } from '../identity.js'

describe('LoginEventItemSchema', () => {
  it('accepts a successful login row', () => {
    const parsed = LoginEventItemSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      userId: '22222222-2222-4333-8444-555555555555',
      userName: 'Dra. Ana García',
      outcome: 'success',
      method: 'password',
      ipAddress: '10.0.0.1',
      userAgent: 'Mozilla/5.0',
      createdAt: '2026-07-28T12:00:00.000Z',
    })
    expect(parsed.outcome).toBe('success')
  })

  it('accepts a blocked row with null userId/userName', () => {
    const parsed = LoginEventItemSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      userId: null,
      userName: null,
      outcome: 'blocked',
      method: 'unknown',
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-07-28T12:00:00.000Z',
    })
    expect(parsed.userId).toBeNull()
  })

  it('rejects an unknown outcome or method', () => {
    const base = {
      id: '11111111-2222-4333-8444-555555555555',
      userId: null,
      userName: null,
      ipAddress: null,
      userAgent: null,
      createdAt: '2026-07-28T12:00:00.000Z',
    }
    expect(() => LoginEventItemSchema.parse({ ...base, outcome: 'pending', method: 'password' })).toThrow()
    expect(() => LoginEventItemSchema.parse({ ...base, outcome: 'success', method: 'oauth' })).toThrow()
  })
})

describe('SecuritySummarySchema', () => {
  it('accepts a summary payload', () => {
    const parsed = SecuritySummarySchema.parse({
      logins: 42,
      distinctUsers: 5,
      blocked: 1,
      dormantUsers30d: 2,
    })
    expect(parsed.logins).toBe(42)
  })

  it('rejects negative counts', () => {
    expect(() =>
      SecuritySummarySchema.parse({ logins: -1, distinctUsers: 0, blocked: 0, dormantUsers30d: 0 }),
    ).toThrow()
  })
})

describe('UserDeviceItemSchema', () => {
  it('accepts a device row', () => {
    const parsed = UserDeviceItemSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      fingerprint: 'a'.repeat(64),
      userAgent: 'Mozilla/5.0',
      firstSeenAt: '2026-07-01T00:00:00.000Z',
      lastSeenAt: '2026-07-28T00:00:00.000Z',
    })
    expect(parsed.fingerprint).toHaveLength(64)
  })
})
