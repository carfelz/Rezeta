import { ForbiddenException, Injectable, Inject } from '@nestjs/common'
import type { Prisma } from '@rezeta/db'
import {
  MODULE_KEYS,
  PERMISSION_CATALOG,
  canManageRole,
  defaultCapabilitiesFor,
  ErrorCode,
  type AccessLevel,
  type CapabilityMap,
  type ModuleKey,
  type UserRole,
} from '@rezeta/shared'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { PermissionsRepository } from './permissions.repository.js'

const ALL_ROLES: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']

const MODULE_KEY_SET = new Set<string>(MODULE_KEYS)

function isModuleKey(value: string): value is ModuleKey {
  return MODULE_KEY_SET.has(value)
}

function isAccessLevel(value: string): value is AccessLevel {
  return value === 'none' || value === 'view' || value === 'manage'
}

@Injectable()
export class PermissionsService {
  constructor(
    @Inject(PermissionsRepository) private repo: PermissionsRepository,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

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

  /** Resolve the tenant's full role x module capability matrix. */
  async getMatrix(tenantId: string): Promise<Record<UserRole, CapabilityMap>> {
    const entries = await Promise.all(
      ALL_ROLES.map(async (role) => [role, await this.resolveCapabilities(tenantId, role)] as const),
    )
    return Object.fromEntries(entries) as Record<UserRole, CapabilityMap>
  }

  /**
   * Update one role/module access level. Only an actor whose rank is strictly
   * above the target role's rank may edit it (own-rank and higher are rejected).
   * Captures the effective access level for (targetRole, moduleKey) before the
   * write so the audit event records "who, when, what changed": `actorUserId`
   * and `changes.accessLevel.before/after`. Emits a `permission_granted`/
   * `permission_revoked` audit event based on the new level, then returns the
   * target role's refreshed capability map.
   */
  async updateModule(
    tenantId: string,
    actorRole: UserRole,
    actorUserId: string,
    targetRole: UserRole,
    moduleKey: ModuleKey,
    level: AccessLevel,
  ): Promise<CapabilityMap> {
    if (!canManageRole(actorRole, targetRole)) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Cannot edit permissions for a role at or above your own',
      })
    }
    const before = (await this.resolveCapabilities(tenantId, targetRole))[moduleKey]
    await this.repo.upsertModule(tenantId, targetRole, moduleKey, level)
    void this.auditLog.record({
      tenantId,
      actorUserId,
      actorType: 'user',
      category: 'auth',
      action: level === 'none' ? 'permission_revoked' : 'permission_granted',
      entityType: 'role_permission',
      entityId: `${targetRole}:${moduleKey}`,
      metadata: { role: targetRole, moduleKey, accessLevel: level },
      changes: { accessLevel: { before, after: level } },
    })
    return this.resolveCapabilities(tenantId, targetRole)
  }
}
