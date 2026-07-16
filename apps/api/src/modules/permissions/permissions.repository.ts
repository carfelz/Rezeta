import { Injectable, Inject } from '@nestjs/common'
import type { AccessLevel, ModuleKey, UserRole } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

export interface StoredRolePermission {
  role: string
  moduleKey: string
  accessLevel: string
}

@Injectable()
export class PermissionsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /** All stored permission overrides for one tenant + role. */
  async findByTenantAndRole(tenantId: string, role: string): Promise<StoredRolePermission[]> {
    return this.prisma.rolePermission.findMany({
      where: { tenantId, role },
      select: { role: true, moduleKey: true, accessLevel: true },
    })
  }

  /** Upsert one tenant/role/module row (compound unique is [tenantId, role, moduleKey]). */
  async upsertModule(
    tenantId: string,
    role: UserRole,
    moduleKey: ModuleKey,
    accessLevel: AccessLevel,
  ): Promise<void> {
    await this.prisma.rolePermission.upsert({
      where: { tenantId_role_moduleKey: { tenantId, role, moduleKey } },
      update: { accessLevel },
      create: { tenantId, role, moduleKey, accessLevel },
    })
  }
}
