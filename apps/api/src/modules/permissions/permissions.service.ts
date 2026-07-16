import { Injectable, Inject } from '@nestjs/common'
import type { Prisma } from '@rezeta/db'
import {
  MODULE_KEYS,
  PERMISSION_CATALOG,
  defaultCapabilitiesFor,
  type AccessLevel,
  type CapabilityMap,
  type ModuleKey,
  type UserRole,
} from '@rezeta/shared'
import { PermissionsRepository } from './permissions.repository.js'

const MODULE_KEY_SET = new Set<string>(MODULE_KEYS)

function isModuleKey(value: string): value is ModuleKey {
  return MODULE_KEY_SET.has(value)
}

function isAccessLevel(value: string): value is AccessLevel {
  return value === 'none' || value === 'view' || value === 'manage'
}

@Injectable()
export class PermissionsService {
  constructor(@Inject(PermissionsRepository) private repo: PermissionsRepository) {}

  /**
   * Resolve a role's effective capabilities for a tenant: start from the code
   * catalog defaults, then overlay stored `RolePermission` rows (stored wins). A
   * module with no stored row keeps its catalog default, so tenants seeded before
   * a module existed still resolve it. Rows whose key or level are unrecognized
   * (e.g. a module removed from the catalog) are ignored.
   */
  async resolveCapabilities(tenantId: string, role: UserRole): Promise<CapabilityMap> {
    const caps = defaultCapabilitiesFor(role)
    const stored = await this.repo.findByTenantAndRole(tenantId, role)
    for (const row of stored) {
      if (isModuleKey(row.moduleKey) && isAccessLevel(row.accessLevel)) {
        caps[row.moduleKey] = row.accessLevel
      }
    }
    return caps
  }

  /**
   * Insert the full default role x module matrix for a freshly created tenant.
   * Runs inside the caller's seeding transaction so it commits atomically with the
   * rest of the tenant bootstrap.
   */
  async seedDefaults(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
    const data = MODULE_KEYS.flatMap((moduleKey) => {
      const defaults = PERMISSION_CATALOG[moduleKey].defaults
      return (Object.keys(defaults) as UserRole[]).map((role) => ({
        tenantId,
        role,
        moduleKey,
        accessLevel: defaults[role],
      }))
    })
    await tx.rolePermission.createMany({ data })
  }
}
