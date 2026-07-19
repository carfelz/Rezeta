/**
 * Real-Postgres integration coverage for `PermissionsService.updateModule`.
 *
 * This is the file that caught the original bug: `updateModule` used to pass
 * a composite `${role}:${moduleKey}` string as `entityId`, which is a UUID
 * column — Prisma rejected it with P2023, and because the audit write is
 * fire-and-forget (`void this.auditLog.record(...)`), the failure was only
 * ever visible in a log line nobody was watching. The fix (see
 * `permissions.service.ts`) omits `entityId` entirely for this event: a
 * (role, module) pair has no UUID identity, and the target is already fully
 * identified by `metadata.role` + `metadata.moduleKey`.
 *
 * Red/green proof (see the task report for the transcript): with the bug
 * temporarily reintroduced, `waitForAuditLog` below times out — no row is
 * ever written, because the P2023 raises before the INSERT reaches Postgres.
 * With the fix in place, the row appears immediately.
 *
 * Only the DB is real here — no external deps to mock (`updateModule` has
 * none).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../lib/prisma.service.js'
import { AuditLogRepository } from '../../../common/audit-log/audit-log.repository.js'
import { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { PermissionsRepository } from '../permissions.repository.js'
import { PermissionsService } from '../permissions.service.js'
import { createTestTenant, createTestUser, hasTestDb, waitForAuditLog } from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('PermissionsService.updateModule (integration)', () => {
  let prisma: PrismaService
  let service: PermissionsService

  beforeAll(() => {
    prisma = new PrismaService()
    const repo = new PermissionsRepository(prisma)
    const auditLog = new AuditLogService(new AuditLogRepository(prisma))
    service = new PermissionsService(repo, auditLog)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('grants a module: persists a permission_granted row with a null entityId', async () => {
    const tenant = await createTestTenant(prisma)
    const actor = await createTestUser(prisma, tenant.id, { role: 'super_admin' })

    // assistant/patients defaults to 'view' in the catalog — moving it to
    // 'manage' is a grant.
    await service.updateModule(tenant.id, 'super_admin', actor.id, 'assistant', 'patients', 'manage')

    const row = await waitForAuditLog(prisma, { tenantId: tenant.id, action: 'permission_granted' })
    expect(row['entityId']).toBeNull()
    expect(row['entityType']).toBe('role_permission')
    expect(row['actorUserId']).toBe(actor.id)
    expect(row['actorType']).toBe('user')
    expect(row['category']).toBe('auth')
    expect(row['changes']).toEqual({ accessLevel: { before: 'view', after: 'manage' } })
    expect(row['metadata']).toEqual({ role: 'assistant', moduleKey: 'patients', accessLevel: 'manage' })
  })

  it('revokes a module: persists a permission_revoked row with a null entityId', async () => {
    const tenant = await createTestTenant(prisma)
    const actor = await createTestUser(prisma, tenant.id, { role: 'super_admin' })

    // assistant/patients defaults to 'view' — moving it to 'none' is a revoke.
    await service.updateModule(tenant.id, 'super_admin', actor.id, 'assistant', 'patients', 'none')

    const row = await waitForAuditLog(prisma, { tenantId: tenant.id, action: 'permission_revoked' })
    expect(row['entityId']).toBeNull()
    expect(row['entityType']).toBe('role_permission')
    expect(row['changes']).toEqual({ accessLevel: { before: 'view', after: 'none' } })
    expect(row['metadata']).toEqual({ role: 'assistant', moduleKey: 'patients', accessLevel: 'none' })
  })

  it('a no-op write (same access level) never reaches the audit log', async () => {
    const tenant = await createTestTenant(prisma)
    const actor = await createTestUser(prisma, tenant.id, { role: 'super_admin' })

    // assistant/patients already defaults to 'view' — this is a no-op.
    await service.updateModule(tenant.id, 'super_admin', actor.id, 'assistant', 'patients', 'view')

    await expect(
      waitForAuditLog(prisma, { tenantId: tenant.id }, { timeoutMs: 300, intervalMs: 50 }),
    ).rejects.toThrow(/no audit_logs row matched/)
  })
})
