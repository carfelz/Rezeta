/**
 * Real-Postgres integration coverage for the login telemetry write path
 * (`LoginTelemetryService.recordLogin`/`upsertDevice`) and the tenant
 * security aggregates (`IdentityService.securitySummary`,
 * `signOutAllSessions`).
 *
 * Only `IAuthProvider` is faked — `IdentityRepository`, `LoginTelemetryService`,
 * `IdentityService`, and the audit log stack are real, wired to the test
 * Prisma instance. Construction copied from
 * `apps/api/src/modules/permissions/__tests__/permissions.service.int-spec.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PrismaService } from '../../../lib/prisma.service.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { InvitationMailerService } from '../../users/index.js'
import { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { AuditLogRepository } from '../../../common/audit-log/audit-log.repository.js'
import { IdentityRepository } from '../identity.repository.js'
import { LoginTelemetryService } from '../login-telemetry.service.js'
import { IdentityService } from '../identity.service.js'
import { StaffSecurityService } from '../staff-security.service.js'
import {
  createTestTenant,
  createTestUser,
  hasTestDb,
  truncateAll,
  waitForAuditLog,
} from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('Identity module (integration)', () => {
  let prisma: PrismaService
  let repo: IdentityRepository
  let telemetry: LoginTelemetryService
  let service: IdentityService
  const authProvider = {
    revokeUserSessions: vi.fn().mockResolvedValue(undefined),
    getMfaEnrollment: vi.fn().mockResolvedValue({ enrolledAt: null }),
  } as unknown as IAuthProvider
  const mailer = {
    sendNewDeviceEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as InvitationMailerService

  beforeAll(() => {
    prisma = new PrismaService()
    repo = new IdentityRepository(prisma)
    telemetry = new LoginTelemetryService(repo, mailer)
    const auditLog = new AuditLogService(new AuditLogRepository(prisma))
    service = new IdentityService(repo, authProvider, auditLog)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await truncateAll(prisma)
  })

  describe('recordLogin + upsertDevice', () => {
    it('inserts a LoginEvent row', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await telemetry.recordLogin({
        tenantId: tenant.id,
        userId: user.id,
        outcome: 'success',
        method: 'password',
        ipAddress: '10.0.0.1',
        userAgent: 'UA-1',
      })
      const rows = await prisma.loginEvent.findMany({ where: { userId: user.id } })
      expect(rows).toHaveLength(1)
      expect(rows[0]?.outcome).toBe('success')
    })

    it('dedupes a device on the same fingerprint and bumps lastSeenAt without changing firstSeenAt', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await telemetry.upsertDevice({
        tenantId: tenant.id,
        userId: user.id,
        userAgent: 'UA-1',
        ipAddress: '10.0.0.1',
      })
      const first = await prisma.userDevice.findMany({ where: { userId: user.id } })
      expect(first).toHaveLength(1)
      const firstSeen = first[0]!.firstSeenAt

      await new Promise((resolve) => setTimeout(resolve, 10))
      await telemetry.upsertDevice({
        tenantId: tenant.id,
        userId: user.id,
        userAgent: 'UA-1',
        ipAddress: '10.0.0.1',
      })
      const second = await prisma.userDevice.findMany({ where: { userId: user.id } })
      expect(second).toHaveLength(1)
      expect(second[0]!.firstSeenAt).toEqual(firstSeen)
      expect(second[0]!.lastSeenAt.getTime()).toBeGreaterThan(firstSeen.getTime())
    })

    it('creates a second row for a different fingerprint (different user agent)', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await telemetry.upsertDevice({ tenantId: tenant.id, userId: user.id, userAgent: 'UA-1', ipAddress: '10.0.0.1' })
      await telemetry.upsertDevice({ tenantId: tenant.id, userId: user.id, userAgent: 'UA-2', ipAddress: '10.0.0.1' })
      const rows = await prisma.userDevice.findMany({ where: { userId: user.id } })
      expect(rows).toHaveLength(2)
    })
  })

  describe('securitySummary', () => {
    it('counts logins/blocked/distinct users in-window and dormant users by lastLoginAt', async () => {
      const tenant = await createTestTenant(prisma)
      const activeRecent = await createTestUser(prisma, tenant.id)
      const activeDormant = await createTestUser(prisma, tenant.id)

      await prisma.user.update({ where: { id: activeRecent.id }, data: { lastLoginAt: new Date() } })
      await telemetry.recordLogin({ tenantId: tenant.id, userId: activeRecent.id, outcome: 'success', method: 'password' })
      await telemetry.recordLogin({ tenantId: tenant.id, userId: activeRecent.id, outcome: 'blocked', method: 'unknown' })
      // activeDormant never logs in — lastLoginAt stays null, so it counts as dormant.
      void activeDormant

      const summary = await service.securitySummary(tenant.id, 7)
      expect(summary.logins).toBe(1)
      expect(summary.blocked).toBe(1)
      expect(summary.distinctUsers).toBe(1)
      expect(summary.dormantUsers30d).toBe(1)
    })

    it('excludes other tenants from the aggregates', async () => {
      const tenant = await createTestTenant(prisma)
      const otherTenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      const otherUser = await createTestUser(prisma, otherTenant.id)

      await telemetry.recordLogin({ tenantId: tenant.id, userId: user.id, outcome: 'success', method: 'password' })
      await telemetry.recordLogin({ tenantId: otherTenant.id, userId: otherUser.id, outcome: 'success', method: 'password' })
      await telemetry.recordLogin({ tenantId: otherTenant.id, userId: otherUser.id, outcome: 'blocked', method: 'unknown' })

      const summary = await service.securitySummary(tenant.id, 7)
      expect(summary.logins).toBe(1)
      expect(summary.blocked).toBe(0)
      expect(summary.distinctUsers).toBe(1)
      expect(summary.dormantUsers30d).toBe(1)

      const otherSummary = await service.securitySummary(otherTenant.id, 7)
      expect(otherSummary.logins).toBe(1)
      expect(otherSummary.blocked).toBe(1)
      expect(otherSummary.distinctUsers).toBe(1)
    })
  })

  describe('signOutAllSessions', () => {
    it('calls the provider and writes a session_revoked audit', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await service.signOutAllSessions({ id: user.id, externalUid: 'ext-1', tenantId: tenant.id })
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(authProvider.revokeUserSessions).toHaveBeenCalledWith('ext-1')
      const audit = await waitForAuditLog(prisma, { action: 'session_revoked', entityId: user.id })
      expect(audit['tenantId']).toBe(tenant.id)
    })
  })

  describe('syncMfaEnrollment (integration)', () => {
    it('writes mfaEnrolledAt and audits mfa_enabled on first enrollment', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      authProvider.getMfaEnrollment = vi
        .fn()
        .mockResolvedValue({ enrolledAt: new Date('2026-07-28T00:00:00.000Z') })

      const result = await service.syncMfaEnrollment({ id: user.id, externalUid: 'ext-1', tenantId: tenant.id })
      expect(result).toEqual({ mfaEnrolledAt: '2026-07-28T00:00:00.000Z' })

      const row = await prisma.user.findUnique({ where: { id: user.id } })
      expect(row?.mfaEnrolledAt).toEqual(new Date('2026-07-28T00:00:00.000Z'))

      const audit = await waitForAuditLog(prisma, { action: 'mfa_enabled', entityId: user.id })
      expect(audit['tenantId']).toBe(tenant.id)
    })

    it('does not re-audit a sync that finds the same enrollment state', async () => {
      const tenant = await createTestTenant(prisma)
      const user = await createTestUser(prisma, tenant.id)
      await prisma.user.update({ where: { id: user.id }, data: { mfaEnrolledAt: new Date('2026-07-01T00:00:00.000Z') } })
      authProvider.getMfaEnrollment = vi
        .fn()
        .mockResolvedValue({ enrolledAt: new Date('2026-07-01T00:00:00.000Z') })

      await service.syncMfaEnrollment({ id: user.id, externalUid: 'ext-1', tenantId: tenant.id })
      const auditCount = await prisma.auditLog.count({ where: { action: 'mfa_enabled', entityId: user.id } })
      expect(auditCount).toBe(0)
    })
  })

  describe('StaffSecurityService (integration)', () => {
    it('aggregates tiles and per-institution buckets/dormant/pending across 2 tenants and 3 days of logins', async () => {
      const tenantA = await createTestTenant(prisma, { name: 'Tenant A', plan: 'clinic' })
      const tenantB = await createTestTenant(prisma, { name: 'Tenant B', plan: 'free' })
      const userA1 = await createTestUser(prisma, tenantA.id)
      const userA2 = await createTestUser(prisma, tenantA.id)
      const userB1 = await createTestUser(prisma, tenantB.id)

      // Logins across 2 tenants / 3 days.
      await prisma.loginEvent.create({
        data: { tenantId: tenantA.id, userId: userA1.id, outcome: 'success', method: 'password', createdAt: new Date() },
      })
      await prisma.loginEvent.create({
        data: {
          tenantId: tenantA.id,
          userId: userA2.id,
          outcome: 'success',
          method: 'password',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      })
      await prisma.loginEvent.create({
        data: {
          tenantId: tenantB.id,
          userId: userB1.id,
          outcome: 'success',
          method: 'password',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      })

      // userA1: logged in and recently -> not dormant, not pending.
      await prisma.user.update({ where: { id: userA1.id }, data: { lastLoginAt: new Date() } })
      // userA2: never logged in, but the account itself is fresh -> pending, not dormant.
      // (createdAt stays at `createTestUser`'s default of "now" — no update needed.)
      // userB1: never logged in AND the account is old -> dormant at both 30d and 60d, and pending.
      await prisma.user.update({
        where: { id: userB1.id },
        data: { createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), lastLoginAt: null },
      })

      const staffSecurity = new StaffSecurityService(repo)
      const result = await staffSecurity.overview()

      expect(result.tiles.activeInstitutions).toBe(2)
      expect(result.tiles.activeUsers30d).toBe(3)
      expect(result.tiles.logins7d).toBe(3)
      expect(result.tiles.dormantAccounts60d).toBe(1) // userB1

      const a = result.institutions.find((i) => i.tenantId === tenantA.id)
      const b = result.institutions.find((i) => i.tenantId === tenantB.id)
      expect(a?.mau30d).toBe(2)
      expect(a?.logins14d.reduce((sum, n) => sum + n, 0)).toBe(2)
      expect(a?.pendingInvites).toBe(1) // userA2
      expect(a?.dormant30d).toBe(0)
      expect(b?.mau30d).toBe(1)
      expect(b?.dormant30d).toBe(1)
      expect(b?.pendingInvites).toBe(1)
    })

    it('excludes deactivated users from dormant/pending counts', async () => {
      const tenant = await createTestTenant(prisma)
      const inactive = await createTestUser(prisma, tenant.id)
      await prisma.user.update({
        where: { id: inactive.id },
        data: { isActive: false, createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      })

      const staffSecurity = new StaffSecurityService(repo)
      const result = await staffSecurity.overview()
      const t = result.institutions.find((i) => i.tenantId === tenant.id)
      expect(t?.dormant30d).toBe(0)
      expect(t?.pendingInvites).toBe(0)
      expect(result.tiles.dormantAccounts60d).toBe(0)
    })
  })
})
