import { Injectable, Inject } from '@nestjs/common'
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
}
