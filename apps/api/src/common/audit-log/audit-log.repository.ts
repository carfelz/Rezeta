import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import type { RecordAuditEventInput, AuditLogFilters } from './audit-log.types.js'

export interface AuditLogRow {
  id: string
  tenantId: string | null
  actorUserId: string | null
  actorType: 'user' | 'system' | 'webhook' | 'cron'
  category: 'entity' | 'auth' | 'communication' | 'system'
  action: string
  entityType: string | null
  entityId: string | null
  changes: Record<string, { before: unknown; after: unknown }> | null
  metadata: Record<string, unknown> | null
  requestId: string | null
  ipAddress: string | null
  status: 'success' | 'failed'
  errorCode: string | null
  createdAt: Date
  actor: { id: string; fullName: string | null; email: string; role: string } | null
}

@Injectable()
export class AuditLogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async insert(event: RecordAuditEventInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: event.tenantId ?? null,
        actorUserId: event.actorUserId ?? null,
        actorType: event.actorType,
        onBehalfOfId: event.onBehalfOfId ?? null,
        category: event.category,
        action: event.action,
        entityType: event.entityType ?? null,
        entityId: event.entityId ?? null,
        changes: (event.changes as object) ?? null,
        metadata: (event.metadata as object) ?? null,
        requestId: event.requestId ?? null,
        ipAddress: event.ipAddress ?? null,
        userAgent: event.userAgent ?? null,
        status: event.status ?? 'success',
        errorCode: event.errorCode ?? null,
      },
    })
  }

  async findByTenant(filters: AuditLogFilters): Promise<AuditLogRow[]> {
    const {
      tenantId,
      actorUserId,
      category,
      action,
      entityType,
      entityId,
      status,
      fromDate,
      toDate,
      limit = 50,
      cursor,
    } = filters

    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(actorUserId ? { actorUserId } : {}),
        ...(category ? { category } : {}),
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(status ? { status } : {}),
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        actorType: true,
        category: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        metadata: true,
        requestId: true,
        ipAddress: true,
        status: true,
        errorCode: true,
        createdAt: true,
        actor: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    }) as Promise<AuditLogRow[]>
  }

  async findById(id: string, tenantId: string): Promise<AuditLogRow | null> {
    return this.prisma.auditLog.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        actorType: true,
        category: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        metadata: true,
        requestId: true,
        ipAddress: true,
        status: true,
        errorCode: true,
        createdAt: true,
        actor: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    }) as Promise<AuditLogRow | null>
  }

  async findForExport(filters: Omit<AuditLogFilters, 'limit' | 'cursor'>): Promise<AuditLogRow[]> {
    const {
      tenantId,
      actorUserId,
      category,
      action,
      entityType,
      entityId,
      status,
      fromDate,
      toDate,
    } = filters

    return this.prisma.auditLog.findMany({
      where: {
        tenantId,
        ...(actorUserId ? { actorUserId } : {}),
        ...(category ? { category } : {}),
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(status ? { status } : {}),
        ...(fromDate || toDate
          ? {
              createdAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 10_000,
      select: {
        id: true,
        tenantId: true,
        actorUserId: true,
        actorType: true,
        category: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        metadata: true,
        requestId: true,
        ipAddress: true,
        status: true,
        errorCode: true,
        createdAt: true,
        actor: {
          select: { id: true, fullName: true, email: true, role: true },
        },
      },
    }) as Promise<AuditLogRow[]>
  }

  async findTenantPlan(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    })
    return tenant?.plan ?? 'free'
  }
}
