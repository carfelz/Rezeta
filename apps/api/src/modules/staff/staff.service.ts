import { Inject, Injectable } from '@nestjs/common'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'
import { TenantSeedingService } from '../tenant-seeding/tenant-seeding.service.js'
import { UsersService } from '../users/users.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'

/**
 * StaffService — the staff platform's create-institution orchestration.
 *
 * There is no self-service signup, so this is the only path that mints a new
 * Tenant. The actor is a PlatformUser (control plane), NOT an institution user,
 * so no institution actorUserId is threaded into the tenant's data; the audit
 * records actorType 'system' with the acting PlatformUser id in metadata.
 *
 * It reuses the same building blocks the rest of the app uses:
 *   1. Tenant row (plain insert — RolePermission defaults are NOT seeded here;
 *      see step 2).
 *   2. TenantSeedingService.seedDefault, which atomically seeds RolePermission
 *      defaults (via PermissionsService.seedDefaults) AND starter
 *      categories/templates, then stamps tenant.seededAt. Do not call
 *      PermissionsService.seedDefaults directly here — seedDefault already
 *      does it, and role_permissions has a (tenantId, role, moduleKey) unique
 *      constraint, so a second seed would throw a unique-violation error.
 *   3. Initial super_admin via the Slice-5 users flow (Admin SDK + set-password
 *      email), with actorUserId=null + a rank-check bypass because bootstrapping
 *      the first super_admin sits above the institution rank rule.
 */
@Injectable()
export class StaffService {
  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(TenantSeedingService) private tenantSeeding: TenantSeedingService,
    @Inject(UsersService) private users: UsersService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async createInstitution(
    dto: CreateInstitutionDto,
    actorPlatformUserId: string | null,
  ): Promise<InstitutionCreatedDto> {
    // 1. Tenant row.
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.institutionName,
        type: dto.type,
        plan: dto.plan,
        country: 'DO',
        language: 'es',
        timezone: 'America/Santo_Domingo',
      },
    })

    // 2. RolePermission defaults + starter templates/categories, atomically
    //    (own locked transaction inside TenantSeedingService).
    await this.tenantSeeding.seedDefault(tenant.id, 'es')

    // 3. Initial super_admin. The actor is a PlatformUser (not an institution
    //    user), so actorUserId is null; bypassRankCheck because this bootstrap
    //    is above the institution rank rule.
    const user = await this.users.createUser(
      tenant.id,
      'super_admin',
      null,
      { email: dto.adminEmail, fullName: dto.adminFullName, role: 'super_admin' },
      { bypassRankCheck: true },
    )

    // 4. Audit — actorType 'system' (no institution actor); acting PlatformUser
    //    id (if any) recorded in metadata.
    await this.auditLog.record({
      tenantId: tenant.id,
      actorType: 'system',
      category: 'entity',
      action: 'create',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: {
        institutionName: dto.institutionName,
        adminEmail: dto.adminEmail,
        initialUserId: user.id,
        ...(actorPlatformUserId ? { platformUserId: actorPlatformUserId } : {}),
      },
    })

    return { tenantId: tenant.id, userId: user.id, email: user.email }
  }
}
