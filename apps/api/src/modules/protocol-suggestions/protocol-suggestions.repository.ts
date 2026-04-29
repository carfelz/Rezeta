import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolSuggestion } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

function toSuggestion(row: {
  id: string
  tenantId: string
  protocolId: string
  protocolVersionId: string
  patternType: string
  patternData: unknown
  suggestedChanges: unknown
  impactSummary: string
  occurrenceCount: number
  totalUses: number
  occurrencePercentage: unknown
  status: string
  appliedAt: Date | null
  dismissedAt: Date | null
  createdAt: Date
}): ProtocolSuggestion {
  return {
    id: row.id,
    tenantId: row.tenantId,
    protocolId: row.protocolId,
    protocolVersionId: row.protocolVersionId,
    patternType: row.patternType,
    patternData: row.patternData as Record<string, unknown>,
    suggestedChanges: row.suggestedChanges as Record<string, unknown>,
    impactSummary: row.impactSummary,
    occurrenceCount: row.occurrenceCount,
    totalUses: row.totalUses,
    occurrencePercentage: Number(row.occurrencePercentage),
    status: row.status as ProtocolSuggestion['status'],
    appliedAt: row.appliedAt?.toISOString() ?? null,
    dismissedAt: row.dismissedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

@Injectable()
export class ProtocolSuggestionsRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async listByProtocol(protocolId: string, tenantId: string): Promise<ProtocolSuggestion[]> {
    const rows = await this.prisma.protocolSuggestion.findMany({
      where: { protocolId, tenantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toSuggestion)
  }

  async findById(id: string, tenantId: string): Promise<ProtocolSuggestion | null> {
    const row = await this.prisma.protocolSuggestion.findFirst({
      where: { id, tenantId },
    })
    return row ? toSuggestion(row) : null
  }

  async create(data: {
    tenantId: string
    protocolId: string
    protocolVersionId: string
    patternType: string
    patternData: Record<string, unknown>
    suggestedChanges: Record<string, unknown>
    impactSummary: string
    occurrenceCount: number
    totalUses: number
    occurrencePercentage: number
  }): Promise<ProtocolSuggestion> {
    const row = await this.prisma.protocolSuggestion.create({ data })
    return toSuggestion(row)
  }

  async markApplied(id: string): Promise<ProtocolSuggestion> {
    const row = await this.prisma.protocolSuggestion.update({
      where: { id },
      data: { status: 'applied', appliedAt: new Date() },
    })
    return toSuggestion(row)
  }

  async markDismissed(id: string): Promise<ProtocolSuggestion> {
    const row = await this.prisma.protocolSuggestion.update({
      where: { id },
      data: { status: 'dismissed', dismissedAt: new Date() },
    })
    return toSuggestion(row)
  }

  async listPendingForTenant(tenantId: string): Promise<ProtocolSuggestion[]> {
    const rows = await this.prisma.protocolSuggestion.findMany({
      where: { tenantId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toSuggestion)
  }
}
