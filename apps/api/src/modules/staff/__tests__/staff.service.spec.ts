/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StaffService } from '../staff.service.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import type { TenantSeedingService } from '../../tenant-seeding/tenant-seeding.service.js'
import type { UsersService } from '../../users/users.service.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { CreateInstitutionDto } from '@rezeta/shared'

const dto: CreateInstitutionDto = {
  institutionName: 'Clínica Norte',
  type: 'clinic',
  plan: 'free',
  adminFullName: 'Dra. Ana Reyes',
  adminEmail: 'ana@clinica.com',
}

describe('StaffService.createInstitution', () => {
  let prisma: PrismaService
  let tenantSeeding: TenantSeedingService
  let users: UsersService
  let auditLog: AuditLogService
  let service: StaffService

  beforeEach(() => {
    prisma = {
      tenant: { create: vi.fn().mockResolvedValue({ id: 'new-tenant' }) },
    } as unknown as PrismaService
    tenantSeeding = { seedDefault: vi.fn().mockResolvedValue(undefined) } as unknown as TenantSeedingService
    users = {
      createUser: vi.fn().mockResolvedValue({ id: 'new-user', email: 'ana@clinica.com' }),
    } as unknown as UsersService
    auditLog = { record: vi.fn().mockResolvedValue(undefined) } as unknown as AuditLogService
    service = new StaffService(prisma, tenantSeeding, users, auditLog)
  })

  it('creates the tenant with the submitted name, type, and plan', async () => {
    await service.createInstitution(dto, 'platform-1')
    expect(prisma.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Clínica Norte', type: 'clinic', plan: 'free' }),
    })
  })

  it('seeds RolePermission defaults + starter data for the new tenant via tenantSeeding.seedDefault', async () => {
    // TenantSeedingService.seedDefault already seeds RolePermission defaults
    // (via PermissionsService.seedDefaults) internally as part of its own
    // locked transaction, alongside starter categories/templates + seededAt.
    // StaffService must NOT call PermissionsService.seedDefaults a second
    // time — role_permissions has a (tenantId, role, moduleKey) unique
    // constraint, so a second seed would throw a unique-violation error.
    await service.createInstitution(dto, 'platform-1')
    expect(tenantSeeding.seedDefault).toHaveBeenCalledWith('new-tenant', 'es')
    expect(tenantSeeding.seedDefault).toHaveBeenCalledTimes(1)
  })

  it('creates the initial super_admin via the users flow with a null actor + rank bypass', async () => {
    await service.createInstitution(dto, 'platform-1')
    expect(users.createUser).toHaveBeenCalledWith(
      'new-tenant',
      'super_admin',
      null,
      { email: 'ana@clinica.com', fullName: 'Dra. Ana Reyes', role: 'super_admin' },
      { bypassRankCheck: true },
    )
  })

  it('audits the institution creation as system with the acting platform user in metadata', async () => {
    await service.createInstitution(dto, 'platform-1')
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'new-tenant',
        actorType: 'system',
        category: 'entity',
        action: 'create',
        entityType: 'tenant',
        entityId: 'new-tenant',
        metadata: expect.objectContaining({ platformUserId: 'platform-1' }),
      }),
    )
  })

  it('audits as system with no platformUserId when there is no platform actor (CLI)', async () => {
    await service.createInstitution(dto, null)
    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: 'system', tenantId: 'new-tenant' }),
    )
    const call = (auditLog.record as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
      metadata: Record<string, unknown>
    }
    expect(call.metadata.platformUserId).toBeUndefined()
  })

  it('returns the created tenant, user id, and email', async () => {
    const result = await service.createInstitution(dto, 'platform-1')
    expect(result).toEqual({ tenantId: 'new-tenant', userId: 'new-user', email: 'ana@clinica.com' })
  })
})
