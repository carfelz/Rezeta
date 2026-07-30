/**
 * Real-Postgres integration coverage for `StaffService.listInstitutions`.
 *
 * Only the DB is real here — `TenantSeedingService`, `UsersService`, and
 * `AuditLogService` are unrelated to this read-only roster query (it only
 * touches `this.prisma`), so they are faked with `vi.fn()` objects.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffService } from '../staff.service.js'
import { PrismaService } from '../../../lib/prisma.service.js'
import type { TenantSeedingService } from '../../tenant-seeding/tenant-seeding.service.js'
import type { UsersService } from '../../users/users.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { createTestTenant, createTestUser, hasTestDb, truncateAll } from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('StaffService.listInstitutions (integration)', () => {
  let prisma: PrismaService
  const tenantSeeding = { seedDefault: vi.fn() } as unknown as TenantSeedingService
  const users = { createUser: vi.fn() } as unknown as UsersService
  const auditLog = { record: vi.fn() } as unknown as AuditLogService

  beforeAll(() => {
    prisma = new PrismaService()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function makeService(): StaffService {
    return new StaffService(prisma, tenantSeeding, users, auditLog)
  }

  beforeEach(async () => {
    await truncateAll(prisma)
  })

  it('returns tenants newest-first with active/total counts', async () => {
    const t1 = await createTestTenant(prisma)
    await prisma.tenant.update({
      where: { id: t1.id },
      data: { createdAt: new Date(Date.now() - 60_000) },
    })
    const t2 = await createTestTenant(prisma)
    await createTestUser(prisma, t2.id)
    const inactive = await createTestUser(prisma, t2.id)
    await prisma.user.update({
      where: { id: inactive.id },
      data: { isActive: false },
    })

    const rows = await makeService().listInstitutions()

    const ids = rows.map((r) => r.id)
    expect(ids.indexOf(t2.id)).toBeLessThan(ids.indexOf(t1.id))

    const r2 = rows.find((r) => r.id === t2.id)!
    expect(r2.userCount).toBe(2)
    expect(r2.activeUserCount).toBe(1)

    expect(rows.find((r) => r.id === t1.id)).toMatchObject({ userCount: 0, activeUserCount: 0 })
  })
})
