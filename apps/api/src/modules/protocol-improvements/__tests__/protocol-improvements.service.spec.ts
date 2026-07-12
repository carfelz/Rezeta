import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ProtocolImprovementsService } from '../protocol-improvements.service.js'

const mockRepo = {
  listByProtocol: vi.fn(),
  findById: vi.fn(),
  markApplied: vi.fn(),
  markDismissed: vi.fn(),
}

const mockTx = {
  protocol: { create: vi.fn(), update: vi.fn() },
  protocolVersion: { create: vi.fn(), aggregate: vi.fn() },
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

describe('ProtocolImprovementsService', () => {
  let service: ProtocolImprovementsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolImprovementsService(mockRepo as never, mockPrisma as never)
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
      mockTx.protocolVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 2 } })
      mockTx.protocolVersion.create.mockResolvedValue({ id: 'ver2' })
      mockTx.protocol.update.mockResolvedValue({})
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
    })

    it('creates new version and marks suggestion applied', async () => {
      const result = await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(result.status).toBe('applied')
      expect(mockTx.protocolVersion.create).toHaveBeenCalled()
    })

    it('performs both writes atomically on the transaction client', async () => {
      await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockTx.protocolVersion.create).toHaveBeenCalledTimes(1)
      expect(mockTx.protocol.update).toHaveBeenCalledTimes(1)
      // Never touches the non-transactional client for the writes.
      expect(mockPrisma.protocolVersion.create).not.toHaveBeenCalled()
      expect(mockPrisma.protocol.update).not.toHaveBeenCalled()
    })

    it('points currentVersionId at the freshly created version', async () => {
      mockTx.protocolVersion.create.mockResolvedValue({ id: 'ver-new' })
      await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(mockTx.protocol.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentVersionId: 'ver-new' }) }),
      )
    })

    it('skips version creation when currentVersion is null', async () => {
      mockPrisma.protocolVersion.findUnique.mockResolvedValue(null)
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
      const result = await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(result.status).toBe('applied')
      expect(mockTx.protocolVersion.create).not.toHaveBeenCalled()
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
      expect(mockTx.protocolVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3 }) }),
      )
    })

    it('uses version 1 when max version is null (first version)', async () => {
      mockTx.protocolVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } })
      await service.apply('proto1', 'sug1', 't1', 'u1')
      expect(mockTx.protocolVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 1 }) }),
      )
    })

    it('retries once with a recomputed version number on a P2002 race', async () => {
      mockTx.protocolVersion.aggregate
        .mockResolvedValueOnce({ _max: { versionNumber: 2 } })
        .mockResolvedValueOnce({ _max: { versionNumber: 3 } })
      mockTx.protocolVersion.create
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ id: 'ver4' })

      const result = await service.apply('proto1', 'sug1', 't1', 'u1')

      expect(result.status).toBe('applied')
      expect(mockTx.protocolVersion.create).toHaveBeenCalledTimes(2)
      expect(mockTx.protocolVersion.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 4 }) }),
      )
      expect(mockTx.protocol.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ currentVersionId: 'ver4' }) }),
      )
    })

    it('rethrows a non-P2002 error from the version create without retrying', async () => {
      mockTx.protocolVersion.create.mockRejectedValue({ code: 'P2003' })
      await expect(service.apply('proto1', 'sug1', 't1', 'u1')).rejects.toEqual({ code: 'P2003' })
      expect(mockTx.protocolVersion.create).toHaveBeenCalledTimes(1)
    })

    it('rethrows when the retried version create also fails with P2002', async () => {
      mockTx.protocolVersion.create.mockRejectedValue({ code: 'P2002' })
      await expect(service.apply('proto1', 'sug1', 't1', 'u1')).rejects.toEqual({ code: 'P2002' })
      expect(mockTx.protocolVersion.create).toHaveBeenCalledTimes(2)
    })
  })

  // ── createVariant ──────────────────────────────────────────────────────────

  describe('createVariant', () => {
    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(suggestion)
      mockPrisma.protocol.findUnique.mockResolvedValue({ title: 'Anaphylaxis', categoryId: 'cat1' })
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

    it('includes categoryId in variant when originalProtocol has categoryId', async () => {
      await service.createVariant('proto1', 'sug1', 't1', 'u1')
      expect(mockTx.protocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: 'cat1' }),
        }),
      )
    })

    it('omits categoryId when originalProtocol has undefined categoryId', async () => {
      mockPrisma.protocol.findUnique.mockResolvedValue({ title: 'Anaphylaxis', categoryId: undefined })
      await service.createVariant('proto1', 'sug1', 't1', 'u1')
      const call = mockTx.protocol.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }
      expect(call?.data).not.toHaveProperty('categoryId')
    })

    it('skips variant creation when originalProtocol is null', async () => {
      mockPrisma.protocol.findUnique.mockResolvedValue(null)
      mockRepo.markApplied.mockResolvedValue({ ...suggestion, status: 'applied' })
      await service.createVariant('proto1', 'sug1', 't1', 'u1')
      expect(mockTx.protocol.create).not.toHaveBeenCalled()
    })

    it('throws NotFoundException when protocol not found', async () => {
      mockPrisma.protocol.findFirst.mockResolvedValue(null)
      await expect(service.createVariant('bad', 'sug1', 't1', 'u1')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── dismiss ────────────────────────────────────────────────────────────────

  describe('dismiss', () => {
    it('marks suggestion dismissed', async () => {
      mockRepo.findById.mockResolvedValue(suggestion)
      mockRepo.markDismissed.mockResolvedValue({ ...suggestion, status: 'dismissed' })
      await service.dismiss('proto1', 'sug1', 't1')
      expect(mockRepo.markDismissed).toHaveBeenCalledWith('sug1', 't1')
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
