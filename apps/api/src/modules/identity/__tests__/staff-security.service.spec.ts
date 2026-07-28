import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffSecurityService } from '../staff-security.service.js'
import type { IdentityRepository } from '../identity.repository.js'

const mockRepo = {
  listAllTenants: vi.fn(),
  listSuccessfulLoginsSince: vi.fn(),
  listActiveUsersForDormancy: vi.fn(),
}

function makeService(): StaffSecurityService {
  return new StaffSecurityService(mockRepo as unknown as IdentityRepository)
}

const NOW = new Date('2026-07-28T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  mockRepo.listAllTenants.mockResolvedValue([])
  mockRepo.listSuccessfulLoginsSince.mockResolvedValue([])
  mockRepo.listActiveUsersForDormancy.mockResolvedValue([])
})

afterEach(() => {
  vi.useRealTimers()
})

describe('overview', () => {
  it('returns zeroed tiles (mfaAdoptionPct null) and an empty institution list with no data', async () => {
    const result = await makeService().overview()
    expect(result).toEqual({
      tiles: { activeInstitutions: 0, activeUsers30d: 0, logins7d: 0, dormantAccounts60d: 0, mfaAdoptionPct: null },
      institutions: [],
    })
  })

  it('includes every tenant, even one with zero logins and zero dormant/pending users', async () => {
    mockRepo.listAllTenants.mockResolvedValue([
      { id: 't1', name: 'Consultorio Dr. Gómez', plan: 'solo' },
    ])
    const result = await makeService().overview()
    expect(result.institutions).toEqual([
      {
        tenantId: 't1',
        name: 'Consultorio Dr. Gómez',
        plan: 'solo',
        mau30d: 0,
        logins14d: new Array(14).fill(0),
        dormant30d: 0,
        pendingInvites: 0,
      },
    ])
  })

  it('computes activeInstitutions/activeUsers30d/logins7d/mau30d from the 30-day login dataset', async () => {
    mockRepo.listAllTenants.mockResolvedValue([
      { id: 't1', name: 'Tenant One', plan: 'clinic' },
      { id: 't2', name: 'Tenant Two', plan: 'free' },
    ])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      { tenantId: 't1', userId: 'u1', createdAt: daysAgo(1) }, // within 7d
      { tenantId: 't1', userId: 'u1', createdAt: daysAgo(2) }, // within 7d, same user
      { tenantId: 't1', userId: 'u2', createdAt: daysAgo(20) }, // outside 7d, within 30d
      { tenantId: 't2', userId: 'u3', createdAt: daysAgo(29) }, // outside 7d
    ])
    const result = await makeService().overview()
    expect(result.tiles.activeInstitutions).toBe(2)
    expect(result.tiles.activeUsers30d).toBe(3) // u1, u2, u3
    expect(result.tiles.logins7d).toBe(2) // the two daysAgo(1)/daysAgo(2) rows
    const t1 = result.institutions.find((i) => i.tenantId === 't1')
    const t2 = result.institutions.find((i) => i.tenantId === 't2')
    expect(t1?.mau30d).toBe(2) // u1, u2
    expect(t2?.mau30d).toBe(1) // u3
  })

  it('buckets logins14d oldest to newest with the most recent day last, dropping rows older than 14 days', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      { tenantId: 't1', userId: 'u1', createdAt: daysAgo(0) }, // today -> last bucket
      { tenantId: 't1', userId: 'u2', createdAt: daysAgo(0) }, // today, second login
      { tenantId: 't1', userId: 'u3', createdAt: daysAgo(13) }, // 13 days ago -> first bucket
      { tenantId: 't1', userId: 'u4', createdAt: daysAgo(20) }, // older than 14d -> dropped
    ])
    const result = await makeService().overview()
    const buckets = result.institutions[0]?.logins14d
    expect(buckets).toHaveLength(14)
    expect(buckets?.[0]).toBe(1) // 13 days ago
    expect(buckets?.[13]).toBe(2) // today
    expect(buckets?.slice(1, 13)).toEqual(new Array(12).fill(0))
  })

  it('buckets by UTC calendar day, not sliding 24h windows — a late-night login from yesterday lands in yesterday\'s bucket', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      // 12.5h before NOW (2026-07-28T12:00Z) but on the previous UTC calendar day.
      { tenantId: 't1', userId: 'u1', createdAt: new Date('2026-07-27T23:30:00.000Z') },
    ])
    const result = await makeService().overview()
    const buckets = result.institutions[0]?.logins14d
    expect(buckets?.[12]).toBe(1) // yesterday
    expect(buckets?.[13]).toBe(0) // today stays empty
  })

  it('excludes a freshly created account from dormant30d/dormantAccounts60d even with no logins', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: null, createdAt: daysAgo(5), mfaEnrolledAt: null }, // fresh invite
    ])
    const result = await makeService().overview()
    expect(result.tiles.dormantAccounts60d).toBe(0)
    expect(result.institutions[0]?.dormant30d).toBe(0)
    expect(result.institutions[0]?.pendingInvites).toBe(1) // pending has no freshness exclusion
  })

  it('counts a stale, never-logged-in account as dormant at both the 30d and 60d windows', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: null, createdAt: daysAgo(90), mfaEnrolledAt: null },
    ])
    const result = await makeService().overview()
    expect(result.tiles.dormantAccounts60d).toBe(1)
    expect(result.institutions[0]?.dormant30d).toBe(1)
    expect(result.institutions[0]?.pendingInvites).toBe(1)
  })

  it('counts an old account with a stale-but-not-ancient last login as dormant at 30d but not 60d', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: daysAgo(45), createdAt: daysAgo(200), mfaEnrolledAt: null },
    ])
    const result = await makeService().overview()
    expect(result.tiles.dormantAccounts60d).toBe(0)
    expect(result.institutions[0]?.dormant30d).toBe(1)
    expect(result.institutions[0]?.pendingInvites).toBe(0)
  })

  it('computes mfaAdoptionPct as enrolled / total active users, rounded', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: daysAgo(10) },
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: null },
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: null },
    ])
    const result = await makeService().overview()
    expect(result.tiles.mfaAdoptionPct).toBe(33) // 1 of 3, rounded
  })

  it('returns null mfaAdoptionPct when there are zero active users', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([])
    const result = await makeService().overview()
    expect(result.tiles.mfaAdoptionPct).toBeNull()
  })

  it('mfaAdoptionPct is 100 when every active user is enrolled', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: daysAgo(10) },
    ])
    const result = await makeService().overview()
    expect(result.tiles.mfaAdoptionPct).toBe(100)
  })

  it('mfaAdoptionPct is 0 (not null) when there are active users but zero MFA enrollments', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: null },
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: null },
    ])
    const result = await makeService().overview()
    expect(result.tiles.mfaAdoptionPct).toBe(0)
  })

  it('mfaAdoptionPct is a platform-wide count, not per-tenant, across multiple tenants', async () => {
    mockRepo.listAllTenants.mockResolvedValue([
      { id: 't1', name: 'Tenant One', plan: 'clinic' },
      { id: 't2', name: 'Tenant Two', plan: 'free' },
    ])
    mockRepo.listActiveUsersForDormancy.mockResolvedValue([
      { tenantId: 't1', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: daysAgo(10) },
      { tenantId: 't2', lastLoginAt: daysAgo(1), createdAt: daysAgo(100), mfaEnrolledAt: null },
    ])
    const result = await makeService().overview()
    expect(result.tiles.mfaAdoptionPct).toBe(50)
  })
})
