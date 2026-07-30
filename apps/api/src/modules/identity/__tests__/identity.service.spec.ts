import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityService } from '../identity.service.js'
import type { IdentityRepository } from '../identity.repository.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'

const mockRepo = {
  securitySummary: vi.fn(),
  listLoginsForTenant: vi.fn(),
  findUserNames: vi.fn(),
  listDevicesForUser: vi.fn(),
  getMfaEnrolledAt: vi.fn(),
  updateMfaEnrolledAt: vi.fn(),
  getPolicy: vi.fn(),
  upsertPolicy: vi.fn(),
}
const mockAuthProvider = { revokeUserSessions: vi.fn(), getMfaEnrollment: vi.fn() }
const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }

function makeService(): IdentityService {
  return new IdentityService(
    mockRepo as unknown as IdentityRepository,
    mockAuthProvider as unknown as IAuthProvider,
    mockAuditLog as unknown as AuditLogService,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('securitySummary', () => {
  it('defaults to a 7-day window and delegates to the repository', async () => {
    mockRepo.securitySummary.mockResolvedValue({ logins: 1, distinctUsers: 1, blocked: 0, dormantUsers30d: 0 })
    await makeService().securitySummary('t1', undefined)
    const [tenantId, since] = mockRepo.securitySummary.mock.calls[0] as [string, Date]
    expect(tenantId).toBe('t1')
    const ageMs = Date.now() - since.getTime()
    expect(ageMs).toBeGreaterThan(6 * 24 * 60 * 60 * 1000)
    expect(ageMs).toBeLessThan(8 * 24 * 60 * 60 * 1000)
  })

  it('honors an explicit days window', async () => {
    mockRepo.securitySummary.mockResolvedValue({ logins: 0, distinctUsers: 0, blocked: 0, dormantUsers30d: 0 })
    await makeService().securitySummary('t1', 30)
    const [, since] = mockRepo.securitySummary.mock.calls[0] as [string, Date]
    const ageMs = Date.now() - since.getTime()
    expect(ageMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
  })
})

describe('listLogins', () => {
  it('resolves user names with a single findUserNames call', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: null, createdAt: new Date('2026-07-28T00:00:00Z') },
      { id: 'e2', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: null, createdAt: new Date('2026-07-27T00:00:00Z') },
      { id: 'e3', userId: null, outcome: 'blocked', method: 'unknown', ipAddress: null, userAgent: null, createdAt: new Date('2026-07-26T00:00:00Z') },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'Ana García']]))
    const result = await makeService().listLogins('t1', { limit: 50 })
    expect(mockRepo.findUserNames).toHaveBeenCalledTimes(1)
    expect(mockRepo.findUserNames).toHaveBeenCalledWith('t1', ['u1'])
    expect(result[0]).toMatchObject({ userId: 'u1', userName: 'Ana García' })
    expect(result[2]).toMatchObject({ userId: null, userName: null })
  })

  it('skips findUserNames when every row has a null userId', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: null, outcome: 'blocked', method: 'unknown', ipAddress: null, userAgent: null, createdAt: new Date() },
    ])
    await makeService().listLogins('t1', { limit: 50 })
    expect(mockRepo.findUserNames).not.toHaveBeenCalled()
  })

  it('includes userId filter when provided', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([])
    mockRepo.findUserNames.mockResolvedValue(new Map())
    await makeService().listLogins('t1', { days: 7, userId: 'u2', limit: 50 })
    expect(mockRepo.listLoginsForTenant).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ userId: 'u2' }),
    )
  })

  it('returns null userName when user name is not found in the map', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: null, createdAt: new Date() },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map()) // empty map, so u1 is not found
    const result = await makeService().listLogins('t1', { limit: 50 })
    expect(result[0]).toMatchObject({ userId: 'u1', userName: null })
  })
})

describe('exportLoginsCsv', () => {
  it('renders a header row and quotes/escapes commas in text fields', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: '10.0.0.1', userAgent: 'UA, 1', createdAt: new Date('2026-07-28T00:00:00Z') },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'García, Ana']]))
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    const lines = csv.split('\n')
    expect(lines[0]).toBe('created_at,user,outcome,method,ip_address,user_agent')
    expect(lines[1]).toContain('"García, Ana"')
    expect(lines[1]).toContain('"UA, 1"')
  })

  it('escapes double quotes within quoted fields', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: 'Mozilla "test"', createdAt: new Date() },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'User "Name"']]))
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    expect(csv).toContain('"User ""Name"""')
    expect(csv).toContain('"Mozilla ""test"""')
  })

  it('quotes fields with newlines', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: null, userAgent: 'UA\nline2', createdAt: new Date() },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'Test']]))
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    expect(csv).toContain('"UA\nline2"')
  })

  it('does not quote fields without special characters', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: 'u1', outcome: 'success', method: 'password', ipAddress: '10.0.0.1', userAgent: 'Mozilla', createdAt: new Date() },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', 'SimpleUser']]))
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    const lines = csv.split('\n')
    expect(lines[1]).toContain('SimpleUser')
    expect(lines[1]).toContain('Mozilla')
  })

  it('handles null userName and userAgent in CSV export', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      { id: 'e1', userId: null, outcome: 'blocked', method: 'unknown', ipAddress: null, userAgent: null, createdAt: new Date() },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map())
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    const lines = csv.split('\n')
    expect(lines[1]).toContain(',,') // empty userName and userAgent fields
  })

  it('neutralizes a =HYPERLINK(...) formula-injection payload in an attacker-controlled user_agent header (accepted trade-off: an ordinary "-5"-shaped value gets the same \' prefix)', async () => {
    mockRepo.listLoginsForTenant.mockResolvedValue([
      {
        id: 'e1',
        userId: 'u1',
        outcome: 'success',
        method: 'password',
        ipAddress: '10.0.0.1',
        userAgent: '=HYPERLINK("https://evil.example","click")',
        createdAt: new Date('2026-07-28T00:00:00Z'),
      },
    ])
    mockRepo.findUserNames.mockResolvedValue(new Map([['u1', '-5']]))
    const csv = await makeService().exportLoginsCsv('t1', { limit: 1000 })
    const lines = csv.split('\n')
    expect(lines[1]).toContain('"\'=HYPERLINK(""https://evil.example"",""click"")"')
    expect(lines[1]).toContain("'-5")
  })
})

describe('myDevices', () => {
  it('maps device rows to ISO timestamps', async () => {
    mockRepo.listDevicesForUser.mockResolvedValue([
      { id: 'd1', fingerprint: 'fp1', userAgent: 'UA', firstSeenAt: new Date('2026-07-01T00:00:00Z'), lastSeenAt: new Date('2026-07-28T00:00:00Z') },
    ])
    const result = await makeService().myDevices('u1')
    expect(result[0]).toMatchObject({ id: 'd1', fingerprint: 'fp1' })
    expect(result[0]!.firstSeenAt).toBe('2026-07-01T00:00:00.000Z')
  })
})

describe('signOutAllSessions', () => {
  it('revokes provider sessions and audits session_revoked', async () => {
    mockAuthProvider.revokeUserSessions.mockResolvedValue(undefined)
    await makeService().signOutAllSessions({ id: 'u1', externalUid: 'ext-1', tenantId: 't1' })
    expect(mockAuthProvider.revokeUserSessions).toHaveBeenCalledWith('ext-1')
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        actorUserId: 'u1',
        actorType: 'user',
        category: 'auth',
        action: 'session_revoked',
        entityType: 'User',
        entityId: 'u1',
        status: 'success',
      }),
    )
  })
})

describe('syncMfaEnrollment', () => {
  const user = { id: 'u1', externalUid: 'ext-1', tenantId: 't1' }

  it('reads the provider, writes the mirror, and returns the ISO timestamp when enrolled', async () => {
    mockRepo.getMfaEnrolledAt.mockResolvedValue(null)
    mockAuthProvider.getMfaEnrollment.mockResolvedValue({ enrolledAt: new Date('2026-07-28T00:00:00.000Z') })
    mockRepo.updateMfaEnrolledAt.mockResolvedValue(undefined)
    const result = await makeService().syncMfaEnrollment(user)
    expect(mockAuthProvider.getMfaEnrollment).toHaveBeenCalledWith('ext-1')
    expect(mockRepo.updateMfaEnrolledAt).toHaveBeenCalledWith('u1', new Date('2026-07-28T00:00:00.000Z'))
    expect(result).toEqual({ mfaEnrolledAt: '2026-07-28T00:00:00.000Z' })
  })

  it('returns null mfaEnrolledAt when not enrolled', async () => {
    mockRepo.getMfaEnrolledAt.mockResolvedValue(null)
    mockAuthProvider.getMfaEnrollment.mockResolvedValue({ enrolledAt: null })
    mockRepo.updateMfaEnrolledAt.mockResolvedValue(undefined)
    const result = await makeService().syncMfaEnrollment(user)
    expect(mockRepo.updateMfaEnrolledAt).toHaveBeenCalledWith('u1', null)
    expect(result).toEqual({ mfaEnrolledAt: null })
  })

  it('audits mfa_enabled on a null -> enrolled transition', async () => {
    mockRepo.getMfaEnrolledAt.mockResolvedValue(null)
    mockAuthProvider.getMfaEnrollment.mockResolvedValue({ enrolledAt: new Date('2026-07-28T00:00:00.000Z') })
    mockRepo.updateMfaEnrolledAt.mockResolvedValue(undefined)
    await makeService().syncMfaEnrollment(user)
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        actorUserId: 'u1',
        actorType: 'user',
        category: 'auth',
        action: 'mfa_enabled',
        entityType: 'User',
        entityId: 'u1',
        status: 'success',
      }),
    )
  })

  it('does not audit when already enrolled (no transition)', async () => {
    mockRepo.getMfaEnrolledAt.mockResolvedValue(new Date('2026-07-01T00:00:00.000Z'))
    mockAuthProvider.getMfaEnrollment.mockResolvedValue({ enrolledAt: new Date('2026-07-28T00:00:00.000Z') })
    mockRepo.updateMfaEnrolledAt.mockResolvedValue(undefined)
    await makeService().syncMfaEnrollment(user)
    expect(mockAuditLog.record).not.toHaveBeenCalled()
  })

  it('does not audit an enrolled -> not-enrolled transition (no fitting AuditAction this slice)', async () => {
    mockRepo.getMfaEnrolledAt.mockResolvedValue(new Date('2026-07-01T00:00:00.000Z'))
    mockAuthProvider.getMfaEnrollment.mockResolvedValue({ enrolledAt: null })
    mockRepo.updateMfaEnrolledAt.mockResolvedValue(undefined)
    await makeService().syncMfaEnrollment(user)
    expect(mockAuditLog.record).not.toHaveBeenCalled()
  })
})

describe('getPolicy', () => {
  it('defaults to off when the tenant has no stored policy', async () => {
    mockRepo.getPolicy.mockResolvedValue(null)
    const result = await makeService().getPolicy('t1')
    expect(result).toEqual({ mfaRequirement: 'off' })
  })

  it('returns the stored policy', async () => {
    mockRepo.getPolicy.mockResolvedValue({ mfaRequirement: 'admins' })
    const result = await makeService().getPolicy('t1')
    expect(result).toEqual({ mfaRequirement: 'admins' })
  })
})

describe('updatePolicy', () => {
  it('delegates to the repository upsert and returns the new value', async () => {
    mockRepo.getPolicy.mockResolvedValue({ mfaRequirement: 'off' })
    mockRepo.upsertPolicy.mockResolvedValue({ mfaRequirement: 'all' })
    const result = await makeService().updatePolicy('t1', 'all', 'u1')
    expect(mockRepo.upsertPolicy).toHaveBeenCalledWith('t1', 'all')
    expect(result).toEqual({ mfaRequirement: 'all' })
  })

  it('audits mfa_policy_changed with before/after values and the acting user', async () => {
    mockRepo.getPolicy.mockResolvedValue({ mfaRequirement: 'admins' })
    mockRepo.upsertPolicy.mockResolvedValue({ mfaRequirement: 'all' })
    await makeService().updatePolicy('t1', 'all', 'u1')
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        actorUserId: 'u1',
        actorType: 'user',
        category: 'auth',
        action: 'mfa_policy_changed',
        entityType: 'IdentityPolicy',
        entityId: 't1',
        changes: { mfaRequirement: { before: 'admins', after: 'all' } },
        status: 'success',
      }),
    )
  })

  it('treats a missing stored policy as off for the audited before value', async () => {
    mockRepo.getPolicy.mockResolvedValue(null)
    mockRepo.upsertPolicy.mockResolvedValue({ mfaRequirement: 'admins' })
    await makeService().updatePolicy('t1', 'admins', 'u1')
    expect(mockAuditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        changes: { mfaRequirement: { before: 'off', after: 'admins' } },
      }),
    )
  })

  it('does not audit a no-op update (value unchanged)', async () => {
    mockRepo.getPolicy.mockResolvedValue({ mfaRequirement: 'all' })
    mockRepo.upsertPolicy.mockResolvedValue({ mfaRequirement: 'all' })
    await makeService().updatePolicy('t1', 'all', 'u1')
    expect(mockAuditLog.record).not.toHaveBeenCalled()
  })
})
