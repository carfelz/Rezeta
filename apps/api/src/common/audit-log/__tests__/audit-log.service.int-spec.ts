/**
 * Direct integration proof for `AuditLogService`'s `AUDIT_STRICT` contract:
 * a failed insert rethrows instead of being silently logged. This suite runs
 * with `AUDIT_STRICT=1` set via `vitest.integration.config.ts` `test.env`,
 * mirroring how the integration project is configured everywhere else.
 *
 * `permissions.service.int-spec.ts` demonstrates the *practical* effect of
 * this (a real service call-site bug caught as a real DB error) through a
 * fire-and-forget call site; this file isolates the `AuditLogService.record`
 * contract itself with a directly-awaited call, independent of any
 * particular caller's fire-and-forget timing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../lib/prisma.service.js'
import { AuditLogRepository } from '../audit-log.repository.js'
import { AuditLogService } from '../audit-log.service.js'
import { createTestTenant, hasTestDb } from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('AuditLogService.record — AUDIT_STRICT (integration)', () => {
  let prisma: PrismaService
  let service: AuditLogService

  beforeAll(() => {
    prisma = new PrismaService()
    service = new AuditLogService(new AuditLogRepository(prisma))
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('sanity-checks AUDIT_STRICT is actually on for this process', () => {
    expect(process.env['AUDIT_STRICT']).toBe('1')
  })

  it('persists a well-formed event end-to-end', async () => {
    const tenant = await createTestTenant(prisma)

    await service.record({
      tenantId: tenant.id,
      actorType: 'system',
      category: 'system',
      action: 'backup_verified',
      metadata: { job: 'nightly' },
      status: 'success',
    })

    const row = await prisma.auditLog.findFirst({ where: { tenantId: tenant.id } })
    expect(row).not.toBeNull()
    expect(row?.action).toBe('backup_verified')
  })

  it('rethrows when the insert violates a DB constraint (non-UUID entityId)', async () => {
    const tenant = await createTestTenant(prisma)

    await expect(
      service.record({
        tenantId: tenant.id,
        actorType: 'system',
        category: 'system',
        action: 'backup_verified',
        entityType: 'role_permission',
        // Not a UUID — entity_id is a UUID column. This is the exact class of
        // bug AUDIT_STRICT exists to surface loudly instead of swallowing.
        entityId: 'assistant:patients',
        status: 'success',
      }),
    ).rejects.toMatchObject({ code: 'P2023' })

    const row = await prisma.auditLog.findFirst({ where: { tenantId: tenant.id } })
    expect(row).toBeNull()
  })
})
