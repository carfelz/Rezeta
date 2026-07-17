import { ForbiddenException, Injectable, Inject } from '@nestjs/common'
import type { Prisma } from '@rezeta/db'
import {
  ACCESS_LEVEL_RANK,
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

/**
 * In-process cache TTL for resolved capability maps. This API runs on Cloud
 * Run, where multiple instances serve traffic concurrently: instance A's
 * `updateModule`/`seedDefaults` invalidate only instance A's in-memory map, so
 * instance B can keep serving a stale entry until it independently observes
 * the write. The TTL bounds that cross-instance staleness window; it is not a
 * substitute for the explicit invalidation below, which keeps same-instance
 * reads consistent immediately after a write.
 */
const CAPABILITIES_CACHE_TTL_MS = 60_000

interface CapabilitiesCacheEntry {
  value: CapabilityMap
  expiresAt: number
}

@Injectable()
export class PermissionsService {
  /** Keyed by `${tenantId}:${role}` — see resolveCapabilities. */
  private readonly capabilitiesCache = new Map<string, CapabilitiesCacheEntry>()

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
   *
   * Fronted by an in-process cache (see `capabilitiesCache`) because this runs
   * on every authenticated request via `AuthGuard`. A cache hit returns a copy
   * of the cached map so callers never share a mutable reference. `getMatrix`
   * calls this once per role and is cache-backed too: the permissions matrix
   * UI refetches after a `PATCH /v1/permissions/...`, and `updateModule`
   * invalidates the edited (tenant, role) entry on the instance that served
   * the write before returning, so that refetch is consistent there.
   */
  async resolveCapabilities(tenantId: string, role: UserRole): Promise<CapabilityMap> {
    const key = this.cacheKey(tenantId, role)
    const cached = this.capabilitiesCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value }
    }

    const caps = defaultCapabilitiesFor(role)
    const stored = await this.repo.findByTenantAndRole(tenantId, role)
    for (const row of stored) {
      if (isModuleKey(row.moduleKey) && isAccessLevel(row.accessLevel)) {
        caps[row.moduleKey] = row.accessLevel
      }
    }
    this.capabilitiesCache.set(key, { value: caps, expiresAt: Date.now() + CAPABILITIES_CACHE_TTL_MS })
    return { ...caps }
  }

  private cacheKey(tenantId: string, role: UserRole): string {
    return `${tenantId}:${role}`
  }

  /** Drop the cached entry for one (tenant, role) pair, e.g. after a write. */
  private invalidateRole(tenantId: string, role: UserRole): void {
    this.capabilitiesCache.delete(this.cacheKey(tenantId, role))
  }

  /** Drop cached entries for every role of one tenant, e.g. after (re)seeding. */
  private invalidateTenant(tenantId: string): void {
    for (const role of ALL_ROLES) {
      this.invalidateRole(tenantId, role)
    }
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
    this.invalidateTenant(tenantId)
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
   * and `changes.accessLevel.before/after`.
   *
   * The audit action is derived from the before/after *rank* comparison via
   * `ACCESS_LEVEL_RANK` — not from the new level in isolation — so a
   * `manage -> view` downgrade correctly audits `permission_revoked` instead
   * of `permission_granted` (the new level alone can't distinguish a downgrade
   * from an upgrade). A no-op write (`before === after`, e.g. `manage ->
   * manage`) skips the repository upsert, the cache invalidation, and the
   * audit event entirely: there is nothing to persist, nothing to invalidate,
   * and nothing that happened to log. Returns the target role's refreshed
   * capability map either way.
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
    if (ACCESS_LEVEL_RANK[level] === ACCESS_LEVEL_RANK[before]) {
      return this.resolveCapabilities(tenantId, targetRole)
    }

    await this.repo.upsertModule(tenantId, targetRole, moduleKey, level)
    this.invalidateRole(tenantId, targetRole)
    void this.auditLog.record({
      tenantId,
      actorUserId,
      actorType: 'user',
      category: 'auth',
      action:
        ACCESS_LEVEL_RANK[level] > ACCESS_LEVEL_RANK[before]
          ? 'permission_granted'
          : 'permission_revoked',
      entityType: 'role_permission',
      // No entityId: a (role, module) permission has no UUID identity, and
      // audit_log.entity_id is a UUID column — a composite `role:module` string
      // fails Prisma UUID validation (P2023) and the fire-and-forget write is
      // lost. The target is fully identified by metadata.role + metadata.moduleKey.
      metadata: { role: targetRole, moduleKey, accessLevel: level },
      changes: { accessLevel: { before, after: level } },
    })
    return this.resolveCapabilities(tenantId, targetRole)
  }
}
