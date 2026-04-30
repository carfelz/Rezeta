import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolSuggestionsRepository } from '../protocol-suggestions.repository.js'

const now = new Date('2026-01-01')

function makeSuggestionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sug1',
    tenantId: 't1',
    protocolId: 'proto1',
    protocolVersionId: 'ver1',
    patternType: 'medication_dose_change',
    patternData: { field: 'dose', blockId: 'blk1' },
    suggestedChanges: { from: '400mg', to: '200mg' },
    impactSummary: 'Dose changed in 90% of uses',
    occurrenceCount: 9,
    totalUses: 10,
    occurrencePercentage: '90.00',
    status: 'pending',
    appliedAt: null,
    dismissedAt: null,
    createdAt: now,
    ...overrides,
  }
}

const mockPrisma = {
  protocolSuggestion: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}

describe('ProtocolSuggestionsRepository', () => {
  let repo: ProtocolSuggestionsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ProtocolSuggestionsRepository(mockPrisma as never)
  })

  describe('listByProtocol', () => {
    it('returns mapped suggestions for a protocol', async () => {
      mockPrisma.protocolSuggestion.findMany.mockResolvedValue([makeSuggestionRow()])
      const result = await repo.listByProtocol('proto1', 't1')
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('sug1')
      expect(result[0].occurrencePercentage).toBe(90)
    })

    it('returns empty array when none found', async () => {
      mockPrisma.protocolSuggestion.findMany.mockResolvedValue([])
      expect(await repo.listByProtocol('proto1', 't1')).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns mapped suggestion when found', async () => {
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(makeSuggestionRow())
      const result = await repo.findById('sug1', 't1')
      expect(result?.id).toBe('sug1')
      expect(result?.patternType).toBe('medication_dose_change')
    })

    it('returns null when not found', async () => {
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(null)
      expect(await repo.findById('bad', 't1')).toBeNull()
    })
  })

  describe('create', () => {
    it('creates and returns a mapped suggestion', async () => {
      const row = makeSuggestionRow()
      mockPrisma.protocolSuggestion.create.mockResolvedValue(row)
      const input = {
        tenantId: 't1',
        protocolId: 'proto1',
        protocolVersionId: 'ver1',
        patternType: 'medication_dose_change',
        patternData: {},
        suggestedChanges: {},
        impactSummary: 'Test',
        occurrenceCount: 9,
        totalUses: 10,
        occurrencePercentage: 90,
      }
      const result = await repo.create(input)
      expect(result.id).toBe('sug1')
    })
  })

  describe('markApplied', () => {
    it('updates status to applied and returns mapped suggestion', async () => {
      const applied = new Date('2026-04-01')
      mockPrisma.protocolSuggestion.update.mockResolvedValue(
        makeSuggestionRow({ status: 'applied', appliedAt: applied }),
      )
      const result = await repo.markApplied('sug1')
      expect(result.status).toBe('applied')
      expect(result.appliedAt).toBe(applied.toISOString())
    })
  })

  describe('markDismissed', () => {
    it('updates status to dismissed and returns mapped suggestion', async () => {
      const dismissed = new Date('2026-04-02')
      mockPrisma.protocolSuggestion.update.mockResolvedValue(
        makeSuggestionRow({ status: 'dismissed', dismissedAt: dismissed }),
      )
      const result = await repo.markDismissed('sug1')
      expect(result.status).toBe('dismissed')
      expect(result.dismissedAt).toBe(dismissed.toISOString())
    })
  })

  describe('listPendingForTenant', () => {
    it('returns all pending suggestions for a tenant', async () => {
      mockPrisma.protocolSuggestion.findMany.mockResolvedValue([makeSuggestionRow(), makeSuggestionRow({ id: 'sug2' })])
      const result = await repo.listPendingForTenant('t1')
      expect(result).toHaveLength(2)
    })
  })

  describe('field mapping', () => {
    it('converts occurrencePercentage string to number', async () => {
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(
        makeSuggestionRow({ occurrencePercentage: '87.50' }),
      )
      const result = await repo.findById('sug1', 't1')
      expect(result?.occurrencePercentage).toBe(87.5)
    })

    it('maps null timestamps to null', async () => {
      mockPrisma.protocolSuggestion.findFirst.mockResolvedValue(
        makeSuggestionRow({ appliedAt: null, dismissedAt: null }),
      )
      const result = await repo.findById('sug1', 't1')
      expect(result?.appliedAt).toBeNull()
      expect(result?.dismissedAt).toBeNull()
    })
  })
})
