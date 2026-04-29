import { Injectable, Inject, Logger } from '@nestjs/common'
import type { ProtocolUsageModifications } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'
import { ProtocolSuggestionsRepository } from './protocol-suggestions.repository.js'

interface DetectedPattern {
  patternType: string
  patternData: Record<string, unknown>
  suggestedChanges: Record<string, unknown>
  impactSummary: string
  occurrenceCount: number
  totalUses: number
  occurrencePercentage: number
}

@Injectable()
export class PatternDetectionService {
  private readonly logger = new Logger(PatternDetectionService.name)

  constructor(
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(ProtocolSuggestionsRepository) private suggestionsRepo: ProtocolSuggestionsRepository,
  ) {}

  async runWeeklyDetection(): Promise<void> {
    this.logger.log('Starting weekly pattern detection')

    const protocols = await this.prisma.protocol.findMany({
      where: { deletedAt: null },
      select: { id: true, tenantId: true, currentVersionId: true },
    })

    let totalVariants = 0
    let totalSuggestions = 0

    for (const protocol of protocols) {
      if (!protocol.currentVersionId) continue

      try {
        const result = await this.analyzeProtocol(
          protocol.id,
          protocol.tenantId,
          protocol.currentVersionId,
        )
        totalVariants += result.variantsCreated
        totalSuggestions += result.suggestionsCreated
      } catch (err) {
        this.logger.error(`Failed to analyze protocol ${protocol.id}: ${String(err)}`)
      }
    }

    this.logger.log(
      `Pattern detection complete: ${totalVariants} variants, ${totalSuggestions} suggestions`,
    )
  }

  private async analyzeProtocol(
    protocolId: string,
    tenantId: string,
    currentVersionId: string,
  ): Promise<{ variantsCreated: number; suggestionsCreated: number }> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)

    const usages = await this.prisma.protocolUsage.findMany({
      where: {
        protocolId,
        tenantId,
        status: 'completed',
        deletedAt: null,
        startedAt: { gte: cutoff },
      },
      select: { id: true, modifications: true },
    })

    if (usages.length < 3) return { variantsCreated: 0, suggestionsCreated: 0 }

    const totalUses = usages.length
    const modsList = usages.map((u) => u.modifications as unknown as ProtocolUsageModifications)

    const patterns = [
      ...this.detectMedicationDosePatterns(modsList, totalUses),
      ...this.detectMedicationsAddedPatterns(modsList, totalUses),
      ...this.detectMedicationsRemovedPatterns(modsList, totalUses),
      ...this.detectStepsSkippedPatterns(modsList, totalUses),
    ]

    let variantsCreated = 0
    let suggestionsCreated = 0

    for (const pattern of patterns) {
      if (pattern.occurrencePercentage >= 90) {
        await this.createVariant(protocolId, tenantId, currentVersionId, pattern)
        variantsCreated++
      } else if (pattern.occurrencePercentage >= 75) {
        await this.createSuggestion(protocolId, tenantId, currentVersionId, pattern)
        suggestionsCreated++
      }
    }

    return { variantsCreated, suggestionsCreated }
  }

  private detectMedicationDosePatterns(
    modsList: ProtocolUsageModifications[],
    totalUses: number,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const changeMap = new Map<string, { count: number; value: string }>()

    for (const mods of modsList) {
      const seen = new Set<string>()
      for (const change of mods.medication_changes ?? []) {
        const key = `${change.block_id}:${change.row_id}:${change.field}:${change.modified_value}`
        if (!seen.has(key)) {
          seen.add(key)
          const existing = changeMap.get(key) ?? { count: 0, value: change.modified_value }
          changeMap.set(key, { count: existing.count + 1, value: change.modified_value })
        }
      }
    }

    for (const [key, { count, value }] of changeMap.entries()) {
      const [blockId, rowId, field] = key.split(':')
      const pct = (count / totalUses) * 100
      if (pct >= 75) {
        patterns.push({
          patternType: 'medication_dose_change',
          patternData: { blockId, rowId, field, modifiedValue: value },
          suggestedChanges: { type: 'medication_field_update', blockId, rowId, field, value },
          impactSummary: `${field} for medication in block ${blockId} changed to "${value}" in ${count}/${totalUses} uses`,
          occurrenceCount: count,
          totalUses,
          occurrencePercentage: pct,
        })
      }
    }

    return patterns
  }

  private detectMedicationsAddedPatterns(
    modsList: ProtocolUsageModifications[],
    totalUses: number,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const addMap = new Map<string, { count: number; med: Record<string, unknown> }>()

    for (const mods of modsList) {
      const seen = new Set<string>()
      for (const added of mods.medications_added ?? []) {
        const key = `${added.block_id}:${added.drug}`
        if (!seen.has(key)) {
          seen.add(key)
          const existing = addMap.get(key)
          addMap.set(key, {
            count: (existing?.count ?? 0) + 1,
            med: {
              drug: added.drug,
              dose: added.dose,
              route: added.route,
              frequency: added.frequency,
            },
          })
        }
      }
    }

    for (const [key, { count, med }] of addMap.entries()) {
      const [blockId] = key.split(':')
      const pct = (count / totalUses) * 100
      if (pct >= 75) {
        patterns.push({
          patternType: 'medication_added',
          patternData: { blockId, medication: med },
          suggestedChanges: { type: 'add_medication_row', blockId, medication: med },
          impactSummary: `"${String(med.drug)}" added to dosage table in ${count}/${totalUses} uses`,
          occurrenceCount: count,
          totalUses,
          occurrencePercentage: pct,
        })
      }
    }

    return patterns
  }

  private detectMedicationsRemovedPatterns(
    modsList: ProtocolUsageModifications[],
    totalUses: number,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const removeMap = new Map<string, { count: number; drug: string; rowId: string }>()

    for (const mods of modsList) {
      const seen = new Set<string>()
      for (const removed of mods.medications_removed ?? []) {
        const key = `${removed.block_id}:${removed.row_id}`
        if (!seen.has(key)) {
          seen.add(key)
          const existing = removeMap.get(key)
          removeMap.set(key, {
            count: (existing?.count ?? 0) + 1,
            drug: removed.drug,
            rowId: removed.row_id,
          })
        }
      }
    }

    for (const [key, { count, drug, rowId }] of removeMap.entries()) {
      const [blockId] = key.split(':')
      const pct = (count / totalUses) * 100
      if (pct >= 75) {
        patterns.push({
          patternType: 'medication_removed',
          patternData: { blockId, rowId, drug },
          suggestedChanges: { type: 'remove_medication_row', blockId, rowId },
          impactSummary: `"${drug}" removed from dosage table in ${count}/${totalUses} uses`,
          occurrenceCount: count,
          totalUses,
          occurrencePercentage: pct,
        })
      }
    }

    return patterns
  }

  private detectStepsSkippedPatterns(
    modsList: ProtocolUsageModifications[],
    totalUses: number,
  ): DetectedPattern[] {
    const patterns: DetectedPattern[] = []
    const skipMap = new Map<string, number>()

    for (const mods of modsList) {
      const seen = new Set<string>()
      for (const skipped of mods.steps_skipped ?? []) {
        if (!seen.has(skipped.step_id)) {
          seen.add(skipped.step_id)
          skipMap.set(skipped.step_id, (skipMap.get(skipped.step_id) ?? 0) + 1)
        }
      }
    }

    for (const [stepId, count] of skipMap.entries()) {
      const pct = (count / totalUses) * 100
      if (pct >= 75) {
        patterns.push({
          patternType: 'step_consistently_skipped',
          patternData: { stepId },
          suggestedChanges: { type: 'mark_step_optional', stepId },
          impactSummary: `Step ${stepId} skipped in ${count}/${totalUses} uses`,
          occurrenceCount: count,
          totalUses,
          occurrencePercentage: pct,
        })
      }
    }

    return patterns
  }

  private async createSuggestion(
    protocolId: string,
    tenantId: string,
    protocolVersionId: string,
    pattern: DetectedPattern,
  ): Promise<void> {
    const existing = await this.prisma.protocolSuggestion.findFirst({
      where: {
        protocolId,
        tenantId,
        patternType: pattern.patternType,
        status: 'pending',
        patternData: { equals: pattern.patternData },
      },
    })
    if (existing) return

    await this.suggestionsRepo.create({
      tenantId,
      protocolId,
      protocolVersionId,
      ...pattern,
    })
    this.logger.log(`Created suggestion for protocol ${protocolId}: ${pattern.patternType}`)
  }

  private async createVariant(
    protocolId: string,
    tenantId: string,
    currentVersionId: string,
    pattern: DetectedPattern,
  ): Promise<void> {
    const [originalProtocol, currentVersion] = await Promise.all([
      this.prisma.protocol.findUnique({
        where: { id: protocolId },
        select: { title: true, typeId: true, ownerUserId: true },
      }),
      this.prisma.protocolVersion.findUnique({
        where: { id: currentVersionId },
        select: { content: true },
      }),
    ])

    if (!originalProtocol || !currentVersion) return

    const { typeId, ownerUserId, title } = originalProtocol
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    await this.prisma.$transaction(async (tx) => {
      const variant = await tx.protocol.create({
        data: {
          tenantId,
          typeId,
          ownerUserId,
          title: `${title} - Variante Optimizada`,
          status: 'draft',
          metadata: {
            autoGenerated: true,
            sourceProtocolId: protocolId,
            patternType: pattern.patternType,
          },
        },
      })

      const version = await tx.protocolVersion.create({
        data: {
          protocolId: variant.id,
          tenantId,
          versionNumber: 1,
          content: currentVersion.content as object,
          changeSummary: `Auto-generated from pattern: ${pattern.impactSummary}`,
          status: 'draft',
          createdBy: ownerUserId,
        },
      })
      /* eslint-enable @typescript-eslint/no-unsafe-assignment */

      await tx.protocol.update({
        where: { id: variant.id },
        data: { currentVersionId: version.id },
      })
    })

    this.logger.log(`Created auto-variant for protocol ${protocolId}: ${pattern.patternType}`)
  }
}
