import { Inject, Injectable } from '@nestjs/common'
import type { IdentityPolicyDto, LoginEventItemDto, MfaSyncResultDto, SecuritySummaryDto, UserDeviceItemDto } from '@rezeta/shared'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { csvEscape } from '../../common/csv/csv.js'
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

  /**
   * Reads the current TOTP enrollment state from the auth provider and
   * mirrors it onto User.mfaEnrolledAt (identity design §4 — no separate
   * MfaEnrollment table this slice). Audits `mfa_enabled` only on a null ->
   * enrolled transition — there is no `mfa_disabled` AuditAction yet, so an
   * enrolled -> not-enrolled sync (the user removed their factor) is not
   * audited this slice (see identity slice 4 plan §Out of scope).
   */
  async syncMfaEnrollment(user: { id: string; externalUid: string; tenantId: string }): Promise<MfaSyncResultDto> {
    const before = await this.repository.getMfaEnrolledAt(user.id)
    const { enrolledAt } = await this.authProvider.getMfaEnrollment(user.externalUid)
    await this.repository.updateMfaEnrolledAt(user.id, enrolledAt)

    if (before === null && enrolledAt !== null) {
      void this.auditLog.record({
        tenantId: user.tenantId,
        actorUserId: user.id,
        actorType: 'user',
        category: 'auth',
        action: 'mfa_enabled',
        entityType: 'User',
        entityId: user.id,
        status: 'success',
      })
    }

    return { mfaEnrolledAt: enrolledAt ? enrolledAt.toISOString() : null }
  }

  /** No stored row defaults to 'off' — matches IdentityPolicy's DB column default, so a tenant that never opens the policy card still reads a valid, correct value. */
  async getPolicy(tenantId: string): Promise<IdentityPolicyDto> {
    const row = await this.repository.getPolicy(tenantId)
    return { mfaRequirement: (row?.mfaRequirement ?? 'off') as IdentityPolicyDto['mfaRequirement'] }
  }

  async updatePolicy(tenantId: string, mfaRequirement: IdentityPolicyDto['mfaRequirement']): Promise<IdentityPolicyDto> {
    const row = await this.repository.upsertPolicy(tenantId, mfaRequirement)
    return { mfaRequirement: row.mfaRequirement as IdentityPolicyDto['mfaRequirement'] }
  }
}

function sinceFor(days: number | undefined): Date {
  const n = days && days > 0 ? days : DEFAULT_DAYS
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000)
}
