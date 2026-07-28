import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffSecurityService } from '../staff-security.service.js'
import type { IdentityRepository } from '../identity.repository.js'

/**
 * Closes the branch-coverage gap left by `staff-security.service.spec.ts`:
 * `aggregateLogins` has two branches that file's happy-path fixtures never
 * exercise because every login row there always carries both a `tenantId`
 * and a `userId`. Real `LoginEvent` rows can have either be `null` (a login
 * recorded before tenant/user resolution, or a failed lookup), so both
 * branches are reachable in production and worth covering explicitly.
 */

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

describe('aggregateLogins branch coverage', () => {
  it('counts a tenant-less login row toward the global totals but skips it from every per-tenant bucket', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      { tenantId: null, userId: 'u1', createdAt: daysAgo(1) },
    ])
    const result = await makeService().overview()
    expect(result.tiles.activeInstitutions).toBe(0) // no per-tenant row was ever recorded
    expect(result.tiles.activeUsers30d).toBe(1) // still counted in the global user set
    expect(result.tiles.logins7d).toBe(1) // still counted in the global 7d tally
    expect(result.institutions[0]?.mau30d).toBe(0)
    expect(result.institutions[0]?.logins14d).toEqual(new Array(14).fill(0))
  })

  it('falls back mau30d to 0 for a tenant whose only login rows carry no userId', async () => {
    mockRepo.listAllTenants.mockResolvedValue([{ id: 't1', name: 'Tenant One', plan: 'clinic' }])
    mockRepo.listSuccessfulLoginsSince.mockResolvedValue([
      { tenantId: 't1', userId: null, createdAt: daysAgo(1) },
    ])
    const result = await makeService().overview()
    expect(result.tiles.activeInstitutions).toBe(1) // the tenant row itself was recorded
    expect(result.tiles.activeUsers30d).toBe(0) // no userId ever added to the global set
    expect(result.institutions[0]?.mau30d).toBe(0) // perTenantUsers has no entry for 't1'
    expect(result.institutions[0]?.logins14d[12]).toBe(1) // the login itself still buckets (1 day ago)
  })
})
