import { Inject, Injectable } from '@nestjs/common'
import type { LoginEventItemDto, SecuritySummaryDto, UserDeviceItemDto } from '@rezeta/shared'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../../lib/auth/index.js'
import { IdentityRepository } from './identity.repository.js'

const DEFAULT_DAYS = 7

export interface ListLoginsFilters {
  days?: number
  userId?: string
  limit: number
}

/**
 * Tenant-scoped security reads (summary/logins/CSV) + self-service devices
 * and sign-out-all over IdentityRepository. Self-service endpoints
 * (myDevices, signOutAllSessions) require only an authenticated user — no
 * permission gate (identity design §5 "Self-service (any user)"); the
 * tenant-scoped reads are gated at the controller via
 * @RequirePermission('users', ...).
 */
@Injectable()
export class IdentityService {
  constructor(
    @Inject(IdentityRepository) private repository: IdentityRepository,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async securitySummary(tenantId: string, days: number | undefined): Promise<SecuritySummaryDto> {
    return this.repository.securitySummary(tenantId, sinceFor(days))
  }

  async listLogins(tenantId: string, filters: ListLoginsFilters): Promise<LoginEventItemDto[]> {
    const events = await this.repository.listLoginsForTenant(tenantId, {
      since: sinceFor(filters.days),
      ...(filters.userId ? { userId: filters.userId } : {}),
      limit: filters.limit,
    })
    const ids = [...new Set(events.map((e) => e.userId).filter((id): id is string => id !== null))]
    const names =
      ids.length > 0 ? await this.repository.findUserNames(ids) : new Map<string, string | null>()
    return events.map((e) => ({
      id: e.id,
      userId: e.userId,
      userName: e.userId ? (names.get(e.userId) ?? null) : null,
      outcome: e.outcome as LoginEventItemDto['outcome'],
      method: e.method as LoginEventItemDto['method'],
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    }))
  }

  async exportLoginsCsv(tenantId: string, filters: ListLoginsFilters): Promise<string> {
    const rows = await this.listLogins(tenantId, filters)
    const header = 'created_at,user,outcome,method,ip_address,user_agent'
    const lines = rows.map((r) =>
      [
        r.createdAt,
        csvEscape(r.userName ?? ''),
        r.outcome,
        r.method,
        r.ipAddress ?? '',
        csvEscape(r.userAgent ?? ''),
      ].join(','),
    )
    return [header, ...lines].join('\n')
  }

  async myDevices(userId: string): Promise<UserDeviceItemDto[]> {
    const rows = await this.repository.listDevicesForUser(userId)
    return rows.map((d) => ({
      id: d.id,
      fingerprint: d.fingerprint,
      userAgent: d.userAgent,
      firstSeenAt: d.firstSeenAt.toISOString(),
      lastSeenAt: d.lastSeenAt.toISOString(),
    }))
  }

  async signOutAllSessions(user: { id: string; externalUid: string; tenantId: string }): Promise<void> {
    await this.authProvider.revokeUserSessions(user.externalUid)
    void this.auditLog.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      actorType: 'user',
      category: 'auth',
      action: 'session_revoked',
      entityType: 'User',
      entityId: user.id,
      status: 'success',
    })
  }
}

function sinceFor(days: number | undefined): Date {
  const n = days && days > 0 ? days : DEFAULT_DAYS
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
