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
import { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { AuditLogRepository } from '../../../common/audit-log/audit-log.repository.js'
import { IdentityRepository } from '../identity.repository.js'
import { LoginTelemetryService } from '../login-telemetry.service.js'
import { IdentityService } from '../identity.service.js'
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
  } as unknown as IAuthProvider

  beforeAll(() => {
    prisma = new PrismaService()
    repo = new IdentityRepository(prisma)
    telemetry = new LoginTelemetryService(repo)
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
})
