import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'

export interface InsertLoginEventInput {
  tenantId: string | null
  userId: string | null
  platformUserId: string | null
  outcome: string
  method: string
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

  /**
   * Keys on the [userId, fingerprint] compound unique. Every current caller
   * supplies a non-null userId (device tracking only runs for a successfully
   * authenticated institution user); the schema still allows a null userId
   * for future platform-staff device tracking (out of scope this slice).
   */
  async upsertDevice(input: UpsertDeviceInput): Promise<void> {
    const now = new Date()
    await this.prisma.userDevice.upsert({
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
   */
  async securitySummary(tenantId: string, since: Date): Promise<SecuritySummaryRow> {
    const dormantCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [logins, blocked, distinctUserRows, dormantUsers30d] = await Promise.all([
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
    ])
    return { logins, blocked, distinctUsers: distinctUserRows.length, dormantUsers30d }
  }
}
