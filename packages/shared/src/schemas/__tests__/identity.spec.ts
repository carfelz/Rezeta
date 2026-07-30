import { describe, expect, it } from 'vitest'
import {
  LoginEventItemSchema,
  SecuritySummarySchema,
  UserDeviceItemSchema,
  StaffSecurityOverviewSchema,
  MfaSyncResultSchema,
  IdentityPolicySchema,
} from '../identity.js'

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
      mfaAdoptionPct: 40,
    })
    expect(parsed.logins).toBe(42)
    expect(parsed.mfaAdoptionPct).toBe(40)
  })

  it('accepts a null mfaAdoptionPct (zero active users)', () => {
    const parsed = SecuritySummarySchema.parse({
      logins: 0,
      distinctUsers: 0,
      blocked: 0,
      dormantUsers30d: 0,
      mfaAdoptionPct: null,
    })
    expect(parsed.mfaAdoptionPct).toBeNull()
  })

  it('rejects negative counts', () => {
    expect(() =>
      SecuritySummarySchema.parse({ logins: -1, distinctUsers: 0, blocked: 0, dormantUsers30d: 0, mfaAdoptionPct: null }),
    ).toThrow()
  })

  it('rejects a mfaAdoptionPct outside 0-100', () => {
    expect(() =>
      SecuritySummarySchema.parse({ logins: 0, distinctUsers: 0, blocked: 0, dormantUsers30d: 0, mfaAdoptionPct: 101 }),
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

describe('StaffSecurityOverviewSchema', () => {
  it('accepts a full overview payload', () => {
    const parsed = StaffSecurityOverviewSchema.parse({
      tiles: { activeInstitutions: 3, activeUsers30d: 42, logins7d: 120, dormantAccounts60d: 5, mfaAdoptionPct: 50 },
      institutions: [
        {
          tenantId: '11111111-2222-4333-8444-555555555555',
          name: 'Centro Médico Vista Alegre',
          plan: 'clinic',
          mau30d: 26,
          logins14d: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
          dormant30d: 0,
          pendingInvites: 1,
        },
      ],
    })
    expect(parsed.institutions[0]?.logins14d).toHaveLength(14)
  })

  it('accepts a null institution name', () => {
    const parsed = StaffSecurityOverviewSchema.parse({
      tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0, mfaAdoptionPct: null },
      institutions: [
        {
          tenantId: '11111111-2222-4333-8444-555555555555',
          name: null,
          plan: 'free',
          mau30d: 0,
          logins14d: new Array(14).fill(0),
          dormant30d: 0,
          pendingInvites: 0,
        },
      ],
    })
    expect(parsed.institutions[0]?.name).toBeNull()
  })

  it('rejects a logins14d array with the wrong length', () => {
    expect(() =>
      StaffSecurityOverviewSchema.parse({
        tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0, mfaAdoptionPct: null },
        institutions: [
          {
            tenantId: '11111111-2222-4333-8444-555555555555',
            name: null,
            plan: 'free',
            mau30d: 0,
            logins14d: [0, 1, 2],
            dormant30d: 0,
            pendingInvites: 0,
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects an unknown plan', () => {
    expect(() =>
      StaffSecurityOverviewSchema.parse({
        tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0, mfaAdoptionPct: null },
        institutions: [
          {
            tenantId: '11111111-2222-4333-8444-555555555555',
            name: null,
            plan: 'enterprise',
            mau30d: 0,
            logins14d: new Array(14).fill(0),
            dormant30d: 0,
            pendingInvites: 0,
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects negative tile counts', () => {
    expect(() =>
      StaffSecurityOverviewSchema.parse({
        tiles: { activeInstitutions: -1, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0, mfaAdoptionPct: null },
        institutions: [],
      }),
    ).toThrow()
  })
})

describe('MfaSyncResultSchema', () => {
  it('accepts an enrolled result', () => {
    const parsed = MfaSyncResultSchema.parse({ mfaEnrolledAt: '2026-07-28T00:00:00.000Z' })
    expect(parsed.mfaEnrolledAt).toBe('2026-07-28T00:00:00.000Z')
  })

  it('accepts a not-enrolled (null) result', () => {
    const parsed = MfaSyncResultSchema.parse({ mfaEnrolledAt: null })
    expect(parsed.mfaEnrolledAt).toBeNull()
  })
})

describe('IdentityPolicySchema', () => {
  it.each(['off', 'admins', 'all'] as const)('accepts mfaRequirement %s', (value) => {
    expect(IdentityPolicySchema.parse({ mfaRequirement: value }).mfaRequirement).toBe(value)
  })

  it('rejects an unknown mfaRequirement', () => {
    expect(() => IdentityPolicySchema.parse({ mfaRequirement: 'required' })).toThrow()
  })
})
