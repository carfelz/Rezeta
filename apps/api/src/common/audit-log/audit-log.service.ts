import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { AuditLogRepository, type AuditLogRow } from './audit-log.repository.js'
import { redactChangesForAudit, redactForAudit } from './redact.js'
import type { RecordAuditEventInput, AuditLogFilters } from './audit-log.types.js'
import type { AuditLogItem, AuditLogListResponse } from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'

function rowToItem(row: AuditLogRow): AuditLogItem {
  return { ...row, createdAt: row.createdAt.toISOString() }
}

function getPlanDateCutoff(plan: string): Date | undefined {
  const now = Date.now()
  if (plan === 'free') return new Date(now - 30 * 24 * 60 * 60 * 1000)
  if (plan === 'clinic') return undefined
  // solo, practice → 12 months
  return new Date(now - 365 * 24 * 60 * 60 * 1000)
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  constructor(@Inject(AuditLogRepository) readonly repo: AuditLogRepository) {}

  async record(event: RecordAuditEventInput): Promise<void> {
    try {
      const sanitized: RecordAuditEventInput = { ...event }
      if (sanitized.changes && sanitized.entityType) {
        sanitized.changes = redactChangesForAudit(sanitized.entityType, sanitized.changes)
      }
      if (sanitized.metadata && sanitized.entityType) {
        sanitized.metadata = redactForAudit(sanitized.entityType, sanitized.metadata)
      }
      await this.repo.insert(sanitized)
    } catch (err) {
      this.logger.error('Failed to write audit log entry', { error: err, event })
    }
  }

  async list(filters: AuditLogFilters): Promise<AuditLogListResponse> {
    const limit = filters.limit ?? 50

    // Apply plan-aware date cutoff when no explicit fromDate is provided
    let fromDate = filters.fromDate
    if (!fromDate && filters.tenantId) {
      const plan = await this.repo.findTenantPlan(filters.tenantId)
      fromDate = getPlanDateCutoff(plan)
    }

    const rows = await this.repo.findByTenant({ ...filters, fromDate, limit })
    const hasMore = rows.length > limit
    const data = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null

    return {
      data: data.map(rowToItem),
      pagination: { cursor: nextCursor, hasMore, limit },
    }
  }

  async getById(id: string, tenantId: string): Promise<AuditLogItem> {
    const row = await this.repo.findById(id, tenantId)
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.AUDIT_LOG_NOT_FOUND,
        message: 'Audit log entry not found',
      })
    }
    return rowToItem(row)
  }

  async exportCsv(
    tenantId: string,
    filters: Omit<AuditLogFilters, 'limit' | 'cursor' | 'tenantId'>,
  ): Promise<string> {
    const plan = await this.repo.findTenantPlan(tenantId)
    if (plan !== 'clinic') {
      throw new ForbiddenException({
        code: ErrorCode.AUDIT_EXPORT_REQUIRES_CLINIC_PLAN,
        message: 'CSV export requires Clinic plan',
      })
    }

    const rows = await this.repo.findForExport({ tenantId, ...filters })
    const items = rows.map(rowToItem)

    const header =
      'id,createdAt,actorType,actorName,category,action,entityType,entityId,status,errorCode,ipAddress'
    const lines = items.map((r) => {
      const actorName = r.actor?.fullName ?? r.actorType
      return [
        r.id,
        r.createdAt,
        r.actorType,
        `"${actorName.replace(/"/g, '""')}"`,
        r.category,
        r.action,
        r.entityType ?? '',
        r.entityId ?? '',
        r.status,
        r.errorCode ?? '',
        r.ipAddress ?? '',
      ].join(',')
    })

    return [header, ...lines].join('\n')
  }
}
