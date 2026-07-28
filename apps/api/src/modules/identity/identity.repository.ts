import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

export interface InsertLoginEventInput {
  tenantId: string | null
  userId: string | null
  platformUserId: string | null
  outcome: string
  method: string
  mfaUsed: boolean
  ipAddress: string | null
  userAgent: string | null
}

export interface UpsertDeviceInput {
  tenantId: string | null
  userId: string | null
  platformUserId: string | null
  fingerprint: string
  userAgent: string | null
}

export interface UserDeviceRow {
  id: string
  fingerprint: string
  userAgent: string | null
  firstSeenAt: Date
  lastSeenAt: Date
}

export interface LoginEventRow {
  id: string
  userId: string | null
  outcome: string
  method: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface SecuritySummaryRow {
  logins: number
  distinctUsers: number
  blocked: number
  dormantUsers30d: number
  mfaAdoptionPct: number | null
}

export interface StaffSecurityTenantRow {
  id: string
  name: string | null
  plan: string
}

export interface StaffSecurityLoginRow {
  tenantId: string | null
  userId: string | null
  createdAt: Date
}

export interface StaffSecurityUserRow {
  tenantId: string
  lastLoginAt: Date | null
  createdAt: Date
  mfaEnrolledAt: Date | null
}

/**
 * Prisma access for LoginEvent (write-heavy, from LoginTelemetryService) and
 * UserDevice + the tenant security reads (IdentityService, Task 3). Both
 * tables are intentionally FK-less telemetry (see schema.prisma model
 * comments) — no tenant filter is baked in here; every write/read caller
 * passes tenantId explicitly.
 */
@Injectable()
export class IdentityRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async insertLoginEvent(input: InsertLoginEventInput): Promise<void> {
    await this.prisma.loginEvent.create({ data: input })
  }

  /** Current mirrored MFA-enrollment timestamp for a user — read before a sync write so the caller can detect an enable transition (identity slice 4). */
  async getMfaEnrolledAt(userId: string): Promise<Date | null> {
    const row = await this.prisma.user.findUnique({ where: { id: userId }, select: { mfaEnrolledAt: true } })
    return row?.mfaEnrolledAt ?? null
  }

  /** Writes the mirrored MFA-enrollment timestamp — called by IdentityService.syncMfaEnrollment after reading the provider's current state. */
  async updateMfaEnrolledAt(userId: string, mfaEnrolledAt: Date | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnrolledAt },
      select: { id: true, mfaEnrolledAt: true },
    })
  }

  /** null when the tenant has never written a policy — caller defaults to 'off' (identity slice 4). */
  async getPolicy(tenantId: string): Promise<{ mfaRequirement: string } | null> {
    return this.prisma.identityPolicy.findUnique({
      where: { tenantId },
      select: { mfaRequirement: true },
    })
  }

  /** Upsert semantics — the tenant's first PATCH creates the row lazily. */
  async upsertPolicy(tenantId: string, mfaRequirement: string): Promise<{ mfaRequirement: string }> {
    return this.prisma.identityPolicy.upsert({
      where: { tenantId },
      update: { mfaRequirement },
      create: { tenantId, mfaRequirement },
      select: { mfaRequirement: true },
    })
  }

  /**
   * Keys on the [userId, fingerprint] compound unique. Every current caller
   * supplies a non-null userId (device tracking only runs for a successfully
   * authenticated institution user); the schema still allows a null userId
   * for future platform-staff device tracking (out of scope this slice).
   * Returns the upserted row — `LoginTelemetryService.upsertDevice` compares
   * `firstSeenAt`/`lastSeenAt` on it to tell a brand-new device from a
   * bumped one (identity slice 5 new-device email).
   */
  async upsertDevice(input: UpsertDeviceInput): Promise<UserDeviceRow> {
    const now = new Date()
    return this.prisma.userDevice.upsert({
      where: {
        userId_fingerprint: { userId: input.userId as string, fingerprint: input.fingerprint },
      },
      create: { ...input, firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now, userAgent: input.userAgent },
    })
  }

  async listDevicesForUser(userId: string): Promise<UserDeviceRow[]> {
    return this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    })
  }

  async listLoginsForTenant(
    tenantId: string,
    filters: { since: Date; userId?: string; limit: number },
  ): Promise<LoginEventRow[]> {
    return this.prisma.loginEvent.findMany({
      where: {
        tenantId,
        createdAt: { gte: filters.since },
        ...(filters.userId ? { userId: filters.userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
    })
  }

  /** Batch name resolution — one query for every distinct userId on a page of login events. */
  async findUserNames(ids: string[]): Promise<Map<string, string | null>> {
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true, email: true },
    })
    return new Map(rows.map((r) => [r.id, r.fullName ?? r.email]))
  }

  /**
   * dormantUsers30d reads User.lastLoginAt (already stamped by AuthGuard)
   * rather than LoginEvent — LoginEvent is purged after 12 months (identity
   * design §4) but dormancy needs a stable no-login signal independent of
   * that retention window. Fixed 30-day window regardless of the `since`
   * argument used for the other three counts (identity design §6 screen 3
   * shows "Sin acceso 30d" as a fixed tile, not filtered by the days range).
   * mfaAdoptionPct (identity slice 4) is active users with a synced
   * User.mfaEnrolledAt divided by all active users, rounded to the nearest
   * whole percent; null when the tenant has zero active users (avoids a
   * 0/0 NaN reaching the DTO).
   */
  async securitySummary(tenantId: string, since: Date): Promise<SecuritySummaryRow> {
    const dormantCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [logins, blocked, distinctUserRows, dormantUsers30d, activeUsersTotal, mfaEnrolledActive] =
      await Promise.all([
        this.prisma.loginEvent.count({
          where: { tenantId, createdAt: { gte: since }, outcome: 'success' },
        }),
        this.prisma.loginEvent.count({
          where: { tenantId, createdAt: { gte: since }, outcome: 'blocked' },
        }),
        this.prisma.loginEvent.findMany({
          where: { tenantId, createdAt: { gte: since }, outcome: 'success', userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        }),
        this.prisma.user.count({
          where: {
            tenantId,
            deletedAt: null,
            isActive: true,
            OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: dormantCutoff } }],
          },
        }),
        this.prisma.user.count({ where: { tenantId, deletedAt: null, isActive: true } }),
        this.prisma.user.count({
          where: { tenantId, deletedAt: null, isActive: true, mfaEnrolledAt: { not: null } },
        }),
      ])
    return {
      logins,
      blocked,
      distinctUsers: distinctUserRows.length,
      dormantUsers30d,
      mfaAdoptionPct:
        activeUsersTotal === 0 ? null : Math.round((mfaEnrolledActive / activeUsersTotal) * 100),
    }
  }

  /**
   * Every tenant on the platform — backs the staff security dashboard's
   * institution roster (identity design §6 screen 4). Mirrors
   * `StaffService.listInstitutions`'s tenant query
   * (`apps/api/src/modules/staff/staff.service.ts`); unlike that method this
   * repository does not compute per-tenant counts itself —
   * `StaffSecurityService` joins this against `listSuccessfulLoginsSince`/
   * `listActiveUsersForDormancy` in memory (three total queries back the
   * whole dashboard — no N+1 across tenants).
   */
  async listAllTenants(): Promise<StaffSecurityTenantRow[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, plan: true },
    })
  }

  /**
   * Successful LoginEvent rows since `since`, across every tenant. Selects
   * only the three columns StaffSecurityService needs (tenantId/userId/
   * createdAt) — no IP/user-agent, no clinical data (control-plane isolation
   * invariant, identity design §2 decision 5). Callers pass a 30-day
   * `since` so a single query backs the 7-day, 14-day, and 30-day staff
   * metrics — see `StaffSecurityService.overview` for the in-memory
   * bucketing.
   */
  async listSuccessfulLoginsSince(since: Date): Promise<StaffSecurityLoginRow[]> {
    return this.prisma.loginEvent.findMany({
      where: { outcome: 'success', createdAt: { gte: since } },
      select: { tenantId: true, userId: true, createdAt: true },
    })
  }

  /**
   * Every active, non-deleted institution user across every tenant, with
   * just enough columns (tenantId/lastLoginAt/createdAt) to compute the
   * global dormant-accounts tile and the per-tenant dormant/pending-invite
   * counts in memory — one query, not one per tenant.
   */
  async listActiveUsersForDormancy(): Promise<StaffSecurityUserRow[]> {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      select: { tenantId: true, lastLoginAt: true, createdAt: true, mfaEnrolledAt: true },
    })
  }
}
