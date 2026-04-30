import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatternDetectionService } from '../pattern-detection.service.js'

const now = new Date('2026-01-01T00:00:00Z')

const mockTx = {
  protocol: { create: vi.fn(), update: vi.fn() },
  protocolVersion: { create: vi.fn() },
}

const mockPrisma = {
  protocol: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  protocolVersion: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  protocolUsage: {
    findMany: vi.fn(),
  },
  protocolSuggestion: {
    findFirst: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

const mockSuggestionsRepo = {
  create: vi.fn(),
}

function makeUsage(modifications: Record<string, unknown> = {}) {
  return { id: 'u1', modifications }
}

describe('PatternDetectionService', () => {
  let service: PatternDetectionService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PatternDetectionService(mockPrisma as never, mockSuggestionsRepo as never)
  })

  // ── runWeeklyDetection ─────────────────────────────────────────────────────

  describe('runWeeklyDetection', () => {
    it('skips protocols with no currentVersionId', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: null },
      ])
      await service.runWeeklyDetection()
      expect(mockPrisma.protocolUsage.findMany).not.toHaveBeenCalled()
    })

    it('processes protocols with currentVersionId', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
      mockPrisma.protocolUsage.findMany.mockResolvedValue([])
      await service.runWeeklyDetection()
      expect(mockPrisma.protocolUsage.findMany).toHaveBeenCalledOnce()
    })

    it('handles errors from analyzeProtocol without throwing', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
      mockPrisma.protocolUsage.findMany.mockRejectedValue(new Error('DB error'))
      await expect(service.runWeeklyDetection()).resolves.toBeUndefined()
    })

    it('processes multiple protocols and accumulates counts', async () => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
        { id: 'p2', tenantId: 't1', currentVersionId: 'v2' },
      ])
      mockPrisma.protocolUsage.findMany.mockResolvedValue([])
      await service.runWeeklyDetection()
      expect(mockPrisma.protocolUsage.findMany).toHaveBeenCalledTimes(2)
    })
  })

  // ── analyzeProtocol via runWeeklyDetection ────────────────────────────────

  describe('analyzeProtocol (via runWeeklyDetection)', () => {
    beforeEach(() => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
    })

    it('returns early when fewer than 3 usages', async () => {
      mockPrisma.protocolUsage.findMany.mockResolvedValue([makeUsage(), makeUsage()])
      await service.runWeeklyDetection()
      expect(mockPrisma.protocolSuggestion.findFirst).not.toHaveBeenCalled()
    })

    it('creates suggestion for pattern at 75-89%', async () => {
      // 3 of 4 usages (75%) have the same medication dose change
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(null)
      mockSuggestionsRepo.create.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).toHaveBeenCalledOnce()
    })

    it('creates variant for pattern at >=90%', async () => {
      // 9 of 10 usages (90%) have the same medication dose change
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      const usages = Array.from({ length: 9 }, () => makeUsage(mods))
      usages.push(makeUsage({}))
      mockPrisma.protocolUsage.findMany.mockResolvedValue(usages)
      mockPrisma.protocol.findUnique.mockResolvedValue({
        title: 'Anaphylaxis',
        typeId: 'type1',
        ownerUserId: 'u1',
      })
      mockPrisma.protocolVersion.findUnique.mockResolvedValue({ content: { blocks: [] } })
      mockTx.protocol.create.mockResolvedValue({ id: 'variant1' })
      mockTx.protocolVersion.create.mockResolvedValue({ id: 'ver-v1' })
      mockTx.protocol.update.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Anaphylaxis - Variante Optimizada' }),
        }),
      )
    })

    it('skips variant creation when originalProtocol is null', async () => {
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      const usages = Array.from({ length: 10 }, () => makeUsage(mods))
      mockPrisma.protocolUsage.findMany.mockResolvedValue(usages)
      mockPrisma.protocol.findUnique.mockResolvedValue(null)
      mockPrisma.protocolVersion.findUnique.mockResolvedValue({ content: { blocks: [] } })
      await service.runWeeklyDetection()
      expect(mockTx.protocol.create).not.toHaveBeenCalled()
    })

    it('skips variant creation when currentVersion is null', async () => {
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      const usages = Array.from({ length: 10 }, () => makeUsage(mods))
      mockPrisma.protocolUsage.findMany.mockResolvedValue(usages)
      mockPrisma.protocol.findUnique.mockResolvedValue({
        title: 'Test',
        typeId: 't1',
        ownerUserId: 'u1',
      })
      mockPrisma.protocolVersion.findUnique.mockResolvedValue(null)
      await service.runWeeklyDetection()
      expect(mockTx.protocol.create).not.toHaveBeenCalled()
    })

    it('skips suggestion creation when pattern below 75%', async () => {
      // 2 of 4 usages (50%) — below threshold
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
        makeUsage({}),
      ])
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })

    it('skips suggestion when existing pending suggestion exists', async () => {
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue({ id: 'existing' })
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── medication_dose_change patterns ───────────────────────────────────────

  describe('detectMedicationDosePatterns (via runWeeklyDetection)', () => {
    beforeEach(() => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
    })

    it('deduplicates same change within a single usage', async () => {
      const mods = {
        medication_changes: [
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
          { block_id: 'blk1', row_id: 'row1', field: 'dose', modified_value: '200mg' },
        ],
      }
      // 2 usages with same change (100%) but second change is duplicate within same usage
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(null)
      mockSuggestionsRepo.create.mockResolvedValue({})
      await service.runWeeklyDetection()
      // 2/3 = 66.7%, below 75%, no suggestion
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })

    it('handles empty medication_changes array', async () => {
      const mods = { medication_changes: [] }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage(mods),
      ])
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })

    it('handles missing medication_changes field', async () => {
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage({}),
        makeUsage({}),
        makeUsage({}),
      ])
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── medications_added patterns ────────────────────────────────────────────

  describe('detectMedicationsAddedPatterns (via runWeeklyDetection)', () => {
    beforeEach(() => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
    })

    it('detects medication added pattern at 75%', async () => {
      const mods = {
        medications_added: [
          {
            block_id: 'blk1',
            row_id: 'row_new',
            drug: 'Diphenhydramine',
            dose: '50mg',
            route: 'IV',
            frequency: 'once',
          },
        ],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(null)
      mockSuggestionsRepo.create.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ patternType: 'medication_added' }),
      )
    })

    it('deduplicates same drug addition within single usage', async () => {
      const mods = {
        medications_added: [
          {
            block_id: 'blk1',
            row_id: 'row_new',
            drug: 'Diphenhydramine',
            dose: '50mg',
            route: 'IV',
            frequency: 'once',
          },
          {
            block_id: 'blk1',
            row_id: 'row_new2',
            drug: 'Diphenhydramine',
            dose: '50mg',
            route: 'IV',
            frequency: 'once',
          },
        ],
      }
      // Even with 2 entries per usage, deduplication by "blockId:drug" means only first counts
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      await service.runWeeklyDetection()
      // 2/3 = 66.7% — below threshold
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── medications_removed patterns ──────────────────────────────────────────

  describe('detectMedicationsRemovedPatterns (via runWeeklyDetection)', () => {
    beforeEach(() => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
    })

    it('detects medication removed pattern at 75%', async () => {
      const mods = {
        medications_removed: [
          { block_id: 'blk1', row_id: 'row1', drug: 'Epinephrine' },
        ],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(null)
      mockSuggestionsRepo.create.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ patternType: 'medication_removed' }),
      )
    })

    it('deduplicates same removal within single usage', async () => {
      const mods = {
        medications_removed: [
          { block_id: 'blk1', row_id: 'row1', drug: 'Epinephrine' },
          { block_id: 'blk1', row_id: 'row1', drug: 'Epinephrine' },
        ],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      // 2/3 = 66.7% — below threshold
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })

    it('handles missing medications_removed field', async () => {
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage({}),
        makeUsage({}),
        makeUsage({}),
      ])
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── steps_skipped patterns ────────────────────────────────────────────────

  describe('detectStepsSkippedPatterns (via runWeeklyDetection)', () => {
    beforeEach(() => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
    })

    it('detects step skipped pattern at 75%', async () => {
      const mods = { steps_skipped: [{ step_id: 'stp_01' }] }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(null)
      mockSuggestionsRepo.create.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ patternType: 'step_consistently_skipped' }),
      )
    })

    it('detects step skipped pattern at exactly 90% and creates variant', async () => {
      const mods = { steps_skipped: [{ step_id: 'stp_01' }] }
      const usages = Array.from({ length: 9 }, () => makeUsage(mods))
      usages.push(makeUsage({}))
      mockPrisma.protocolUsage.findMany.mockResolvedValue(usages)
      mockPrisma.protocol.findUnique.mockResolvedValue({
        title: 'Procedure',
        typeId: 'type1',
        ownerUserId: 'u1',
      })
      mockPrisma.protocolVersion.findUnique.mockResolvedValue({ content: { blocks: [] } })
      mockTx.protocol.create.mockResolvedValue({ id: 'variant1' })
      mockTx.protocolVersion.create.mockResolvedValue({ id: 'ver-v1' })
      mockTx.protocol.update.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Procedure - Variante Optimizada' }),
        }),
      )
    })

    it('deduplicates same step_id skip within single usage', async () => {
      const mods = {
        steps_skipped: [{ step_id: 'stp_01' }, { step_id: 'stp_01' }],
      }
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage(mods),
        makeUsage(mods),
        makeUsage({}),
      ])
      // 2/3 = 66.7% — below threshold
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })

    it('handles missing steps_skipped field', async () => {
      mockPrisma.protocolUsage.findMany.mockResolvedValue([
        makeUsage({}),
        makeUsage({}),
        makeUsage({}),
      ])
      await service.runWeeklyDetection()
      expect(mockSuggestionsRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── createVariant ─────────────────────────────────────────────────────────

  describe('createVariant (via runWeeklyDetection)', () => {
    beforeEach(() => {
      mockPrisma.protocol.findMany.mockResolvedValue([
        { id: 'p1', tenantId: 't1', currentVersionId: 'v1' },
      ])
    })

    it('creates variant with correct metadata fields', async () => {
      const mods = {
        steps_skipped: [{ step_id: 'stp_01' }],
      }
      const usages = Array.from({ length: 10 }, () => makeUsage(mods))
      mockPrisma.protocolUsage.findMany.mockResolvedValue(usages)
      mockPrisma.protocol.findUnique.mockResolvedValue({
        title: 'Protocol X',
        typeId: 'type1',
        ownerUserId: 'owner1',
      })
      mockPrisma.protocolVersion.findUnique.mockResolvedValue({ content: { blocks: [] } })
      mockTx.protocol.create.mockResolvedValue({ id: 'variant1' })
      mockTx.protocolVersion.create.mockResolvedValue({ id: 'ver-v1' })
      mockTx.protocol.update.mockResolvedValue({})
      await service.runWeeklyDetection()
      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              autoGenerated: true,
              sourceProtocolId: 'p1',
              patternType: 'step_consistently_skipped',
            }),
          }),
        }),
      )
      expect(mockTx.protocolVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 1,
            createdBy: 'owner1',
            protocolId: 'variant1',
          }),
        }),
      )
    })
  })
})
