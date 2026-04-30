import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ProtocolSuggestionsService } from '../protocol-suggestions.service.js'

const mockRepo = {
  listByProtocol: vi.fn(),
  findById: vi.fn(),
  markApplied: vi.fn(),
  markDismissed: vi.fn(),
}

const mockTx = {
  protocol: { create: vi.fn(), update: vi.fn() },
  protocolVersion: { create: vi.fn() },
}

const mockPrisma = {
  protocol: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  protocolVersion: {
    findUnique: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

const suggestion = {
  id: 'sug1',
  protocolId: 'proto1',
  protocolVersionId: 'ver1',
  impactSummary: 'Dose changed in 90% of uses',
  status: 'pending',
  tenantId: 't1',
}

describe('ProtocolSuggestionsService', () => {
  let service: ProtocolSuggestionsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolSuggestionsService(mockRepo as never, mockPrisma as never)
    // Default: protocol exists
    mockPrisma.protocol.findFirst.mockResolvedValue({ id: 'proto1' })
  })

  // ── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns suggestions for valid protocol', async () => {
      mockRepo.listByProtocol.mockResolvedValue([suggestion])
      const result = await service.list('proto1', 't1')
      expect(result).toHaveLength(1)
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      await expect(service.list('bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── apply ──────────────────────────────────────────────────────────────────

  describe('apply', () => {
    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(suggestion)
      mockPrisma.protocolVersion.findUnique.mockResolvedValue({
        content: { blocks: [] },
        versionNumber: 2,
      })
      mockPrisma.protocolVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } })
      mockPrisma.protocolVersion.create.mockResolvedValue({ id: 'ver2' })
      mockPrisma.protocol.update.mockResolvedValue({})
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
    })

    it('creates new version and marks suggestion applied', async () => {
      const result = await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(result.status).toBe('applied')
      expect(mockPrisma.protocolVersion.create).toHaveBeenCalled()
    })

    it('skips version creation when currentVersion is null', async () => {
      mockPrisma.protocolVersion.findUnique.mockResolvedValue(null)
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
      const result = await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(result.status).toBe('applied')
      expect(mockPrisma.protocolVersion.create).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      await expect(service.apply('bad', 'sug1', 't1', 'u1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when suggestion not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.apply('proto1', 'bad', 't1', 'u1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when suggestion belongs to different protocol', async () => {
      mockRepo.findById.mockResolvedValue({ ...suggestion, protocolId: 'other' })
      await expect(service.apply('proto1', 'sug1', 't1', 'u1')).rejects.toThrow(NotFoundException)
    })

    it('uses max version + 1 when max exists', async () => {
      await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(mockPrisma.protocolVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3 }) }),
      )
    })
  })

  // ── createVariant ──────────────────────────────────────────────────────────

  describe('createVariant', () => {
    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(suggestion)
      mockPrisma.protocol.findUnique.mockResolvedValue({ title: 'Anaphylaxis', typeId: 'type1' })
      mockPrisma.protocolVersion.findUnique.mockResolvedValue({ content: { blocks: [] } })
      mockTx.protocol.create.mockResolvedValue({ id: 'variant1' })
      mockTx.protocolVersion.create.mockResolvedValue({ id: 'ver-v1' })
      mockTx.protocol.update.mockResolvedValue({})
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
    })

    it('creates variant protocol and marks suggestion applied', async () => {
      const result = await service.createVariant('proto1', 'sug1', 't1', 'u1')
      expect(result.status).toBe('applied')
      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Anaphylaxis - Variante' }),
        }),
      )
    })

    it('skips variant creation when originalProtocol is null', async () => {
      mockPrisma.protocol.findUnique.mockResolvedValue(null)
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
      await service.createVariant('proto1', 'sug1', 't1', 'u1')
      expect(mockTx.protocol.create).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      await expect(service.createVariant('bad', 'sug1', 't1', 'u1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── dismiss ────────────────────────────────────────────────────────────────

  describe('dismiss', () => {
    it('marks suggestion dismissed', async () => {
      mockRepo.findById.mockResolvedValue(suggestion)
      mockRepo.markDismissed.mockResolvedValue({ ...suggestion, status: 'dismissed' })
      await service.dismiss('proto1', 'sug1', 't1')
      expect(mockRepo.markDismissed).toHaveBeenCalledWith('sug1')
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      await expect(service.dismiss('bad', 'sug1', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when suggestion not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.dismiss('proto1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })
})
