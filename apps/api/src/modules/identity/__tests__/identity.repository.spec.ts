/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityRepository } from '../identity.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const prisma = {
  loginEvent: { create: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  userDevice: { upsert: vi.fn(), findMany: vi.fn() },
  user: { count: vi.fn(), findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  tenant: { findMany: vi.fn() },
  identityPolicy: { findUnique: vi.fn(), upsert: vi.fn() },
} as unknown as PrismaService

function makeRepo(): IdentityRepository {
  return new IdentityRepository(prisma)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('IdentityRepository', () => {
  it('insertLoginEvent creates a row with the given fields', async () => {
    vi.mocked(prisma.loginEvent.create).mockResolvedValue({} as never)
    const input = {
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      outcome: 'success',
      method: 'password',
      mfaUsed: true,
      ipAddress: '1.1.1.1',
      userAgent: 'UA',
    }
    await makeRepo().insertLoginEvent(input)
    expect(prisma.loginEvent.create).toHaveBeenCalledWith({ data: input })
  })

  it('upsertDevice keys on the [userId, fingerprint] compound unique and bumps lastSeenAt', async () => {
    vi.mocked(prisma.userDevice.upsert).mockResolvedValue({} as never)
    await makeRepo().upsertDevice({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: 'fp1',
      userAgent: 'UA',
    })
    expect(prisma.userDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_fingerprint: { userId: 'u1', fingerprint: 'fp1' } },
        create: expect.objectContaining({
          fingerprint: 'fp1',
          firstSeenAt: expect.any(Date),
          lastSeenAt: expect.any(Date),
        }),
        update: expect.objectContaining({ lastSeenAt: expect.any(Date), userAgent: 'UA' }),
      }),
    )
  })

  it('upsertDevice returns the upserted row', async () => {
    const row = {
      id: 'd1',
      fingerprint: 'fp1',
      userAgent: 'UA',
      firstSeenAt: new Date('2026-07-28T00:00:00Z'),
      lastSeenAt: new Date('2026-07-28T00:00:00Z'),
    }
    vi.mocked(prisma.userDevice.upsert).mockResolvedValue(row as never)
    const result = await makeRepo().upsertDevice({
      tenantId: 't1',
      userId: 'u1',
      platformUserId: null,
      fingerprint: 'fp1',
      userAgent: 'UA',
    })
    expect(result).toBe(row)
  })

  it('listDevicesForUser orders by lastSeenAt desc', async () => {
    vi.mocked(prisma.userDevice.findMany).mockResolvedValue([] as never)
    await makeRepo().listDevicesForUser('u1')
    expect(prisma.userDevice.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { lastSeenAt: 'desc' },
    })
  })

  it('listLoginsForTenant filters by tenant/since/optional userId and takes the limit', async () => {
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValue([] as never)
    const since = new Date('2026-07-21T00:00:00Z')
    await makeRepo().listLoginsForTenant('t1', { since, userId: 'u1', limit: 50 })
    expect(prisma.loginEvent.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1', createdAt: { gte: since }, userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  })

  it('findUserNames maps ids to fullName-or-email', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u1', fullName: 'Ana', email: 'ana@rezeta.do' },
      { id: 'u2', fullName: null, email: 'bo@rezeta.do' },
    ] as never)
    const map = await makeRepo().findUserNames(['u1', 'u2'])
    expect(map.get('u1')).toBe('Ana')
    expect(map.get('u2')).toBe('bo@rezeta.do')
  })

  it('securitySummary aggregates logins/blocked/distinctUsers/dormantUsers30d/mfaAdoptionPct', async () => {
    vi.mocked(prisma.loginEvent.count).mockResolvedValueOnce(10).mockResolvedValueOnce(2)
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValueOnce([
      { userId: 'u1' },
      { userId: 'u2' },
    ] as never)
    vi.mocked(prisma.user.count)
      .mockResolvedValueOnce(3) // dormantUsers30d
      .mockResolvedValueOnce(20) // activeUsersTotal
      .mockResolvedValueOnce(5) // mfaEnrolledActive
    const since = new Date('2026-07-21T00:00:00Z')
    const result = await makeRepo().securitySummary('t1', since)
    expect(result).toEqual({ logins: 10, blocked: 2, distinctUsers: 2, dormantUsers30d: 3, mfaAdoptionPct: 25 })
  })

  it('securitySummary returns null mfaAdoptionPct when the tenant has zero active users', async () => {
    vi.mocked(prisma.loginEvent.count).mockResolvedValue(0)
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
    const result = await makeRepo().securitySummary('t1', new Date())
    expect(result.mfaAdoptionPct).toBeNull()
  })

  it('securitySummary rounds mfaAdoptionPct to the nearest whole percent', async () => {
    vi.mocked(prisma.loginEvent.count).mockResolvedValue(0)
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValue([] as never)
    vi.mocked(prisma.user.count).mockResolvedValueOnce(0).mockResolvedValueOnce(3).mockResolvedValueOnce(1)
    const result = await makeRepo().securitySummary('t1', new Date())
    expect(result.mfaAdoptionPct).toBe(33) // round(1/3 * 100) = 33
  })
})

describe('IdentityRepository (staff security aggregates)', () => {
  it('listAllTenants selects id/name/plan ordered by createdAt desc', async () => {
    vi.mocked(prisma.tenant.findMany).mockResolvedValue([] as never)
    await makeRepo().listAllTenants()
    expect(prisma.tenant.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, plan: true },
    })
  })

  it('listSuccessfulLoginsSince filters by outcome success and the since cutoff', async () => {
    vi.mocked(prisma.loginEvent.findMany).mockResolvedValue([] as never)
    const since = new Date('2026-06-28T00:00:00Z')
    await makeRepo().listSuccessfulLoginsSince(since)
    expect(prisma.loginEvent.findMany).toHaveBeenCalledWith({
      where: { outcome: 'success', createdAt: { gte: since } },
      select: { tenantId: true, userId: true, createdAt: true },
    })
  })

  it('listActiveUsersForDormancy filters by isActive/deletedAt only', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never)
    await makeRepo().listActiveUsersForDormancy()
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, isActive: true },
      select: { tenantId: true, lastLoginAt: true, createdAt: true, mfaEnrolledAt: true },
    })
  })
})

describe('IdentityRepository (mfa sync)', () => {
  it('getMfaEnrolledAt returns the stored value', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ mfaEnrolledAt: new Date('2026-07-01T00:00:00Z') } as never)
    const result = await makeRepo().getMfaEnrolledAt('u1')
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { mfaEnrolledAt: true },
    })
    expect(result).toEqual(new Date('2026-07-01T00:00:00Z'))
  })

  it('getMfaEnrolledAt returns null when the user row is missing', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)
    const result = await makeRepo().getMfaEnrolledAt('u1')
    expect(result).toBeNull()
  })

  it('updateMfaEnrolledAt writes the given value', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'u1', mfaEnrolledAt: null } as never)
    const at = new Date('2026-07-28T00:00:00Z')
    await makeRepo().updateMfaEnrolledAt('u1', at)
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { mfaEnrolledAt: at },
      select: { id: true, mfaEnrolledAt: true },
    })
  })
})

describe('IdentityRepository (identity policy)', () => {
  it('getPolicy reads by tenantId', async () => {
    vi.mocked(prisma.identityPolicy.findUnique).mockResolvedValue({ mfaRequirement: 'admins' } as never)
    const result = await makeRepo().getPolicy('t1')
    expect(prisma.identityPolicy.findUnique).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      select: { mfaRequirement: true },
    })
    expect(result).toEqual({ mfaRequirement: 'admins' })
  })

  it('getPolicy returns null when the tenant has no row yet', async () => {
    vi.mocked(prisma.identityPolicy.findUnique).mockResolvedValue(null as never)
    const result = await makeRepo().getPolicy('t1')
    expect(result).toBeNull()
  })

  it('upsertPolicy creates on first write and updates on repeat writes (same call shape)', async () => {
    vi.mocked(prisma.identityPolicy.upsert).mockResolvedValue({ mfaRequirement: 'all' } as never)
    const result = await makeRepo().upsertPolicy('t1', 'all')
    expect(prisma.identityPolicy.upsert).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      update: { mfaRequirement: 'all' },
      create: { tenantId: 't1', mfaRequirement: 'all' },
      select: { mfaRequirement: true },
    })
    expect(result).toEqual({ mfaRequirement: 'all' })
  })
})
