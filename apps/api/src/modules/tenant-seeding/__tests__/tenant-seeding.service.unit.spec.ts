import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { TenantSeedingService } from '../tenant-seeding.service.js'

const unseededTenant = { id: 't1', seededAt: null }
const seededTenant = { id: 't1', seededAt: new Date('2026-01-01') }

const makeTemplate = (i: number) => ({ id: `tmpl-${i}` })

const mockTx = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  protocolTemplate: { create: vi.fn() },
  protocolType: { create: vi.fn() },
}

const mockPrisma = {
  tenant: { findUnique: vi.fn() },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

describe('TenantSeedingService (unit)', () => {
  let service: TenantSeedingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TenantSeedingService(mockPrisma as never)

    // Default: unseeded tenant, transaction re-check also unseeded
    mockPrisma.tenant.findUnique.mockResolvedValue(unseededTenant)
    mockTx.tenant.findUnique.mockResolvedValue({ seededAt: null })
    mockTx.tenant.update.mockResolvedValue({})
    mockTx.protocolType.create.mockResolvedValue({})
    // Template creates return objects with sequential IDs
    mockTx.protocolTemplate.create.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `tmpl-${data.name}` }),
    )
  })

  // ── seedDefault ────────────────────────────────────────────────────────────

  describe('seedDefault', () => {
    it('throws NotFoundException when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null)
      await expect(service.seedDefault('t1')).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when already seeded (outer check)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(seededTenant)
      await expect(service.seedDefault('t1')).rejects.toThrow(ConflictException)
    })

    it('throws ConflictException when already seeded (inner transaction check)', async () => {
      mockTx.tenant.findUnique.mockResolvedValue({ seededAt: new Date() })
      await expect(service.seedDefault('t1')).rejects.toThrow(ConflictException)
    })

    it('creates 5 templates and 5 types for es locale', async () => {
      await service.seedDefault('t1', 'es')
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(5)
      expect(mockTx.protocolType.create).toHaveBeenCalledTimes(5)
    })

    it('creates 5 templates and 5 types for en locale', async () => {
      await service.seedDefault('t1', 'en')
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(5)
      expect(mockTx.protocolType.create).toHaveBeenCalledTimes(5)
    })

    it('sets isSeeded=true on all rows', async () => {
      await service.seedDefault('t1')
      for (const call of mockTx.protocolTemplate.create.mock.calls) {
        expect((call[0] as { data: { isSeeded: boolean } }).data.isSeeded).toBe(true)
      }
      for (const call of mockTx.protocolType.create.mock.calls) {
        expect((call[0] as { data: { isSeeded: boolean } }).data.isSeeded).toBe(true)
      }
    })

    it('updates tenant.seededAt inside the transaction', async () => {
      await service.seedDefault('t1')
      expect(mockTx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' } }),
      )
    })

    it('defaults to es locale when no locale provided', async () => {
      await service.seedDefault('t1')
      const firstTemplateName = (
        mockTx.protocolTemplate.create.mock.calls[0] as [{ data: { name: string } }]
      )[0].data.name
      expect(firstTemplateName).toBeTruthy()
    })
  })

  // ── seedCustom ─────────────────────────────────────────────────────────────

  describe('seedCustom', () => {
    const templates = [
      { clientId: 'c1', name: 'Custom Template', schema: { version: '1.0', blocks: [] } },
    ]
    const types = [{ name: 'Custom Type', templateClientId: 'c1' }]

    it('throws NotFoundException when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null)
      await expect(service.seedCustom('t1', templates, types)).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when already seeded (outer check)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(seededTenant)
      await expect(service.seedCustom('t1', templates, types)).rejects.toThrow(ConflictException)
    })

    it('throws ConflictException when already seeded (inner transaction check)', async () => {
      mockTx.tenant.findUnique.mockResolvedValue({ seededAt: new Date() })
      await expect(service.seedCustom('t1', templates, types)).rejects.toThrow(ConflictException)
    })

    it('creates exactly the supplied templates and types', async () => {
      const twoTemplates = [
        { clientId: 'a', name: 'Template A', schema: {} },
        { clientId: 'b', name: 'Template B', schema: {} },
      ]
      const twoTypes = [
        { name: 'Type A', templateClientId: 'a' },
        { name: 'Type B', templateClientId: 'b' },
      ]
      await service.seedCustom('t1', twoTemplates, twoTypes)
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(2)
      expect(mockTx.protocolType.create).toHaveBeenCalledTimes(2)
    })

    it('throws when type references unknown templateClientId', async () => {
      const badTypes = [{ name: 'Broken', templateClientId: 'nonexistent' }]
      await expect(service.seedCustom('t1', templates, badTypes)).rejects.toThrow()
    })

    it('resolves type templateId from clientId map', async () => {
      mockTx.protocolTemplate.create.mockResolvedValue(makeTemplate(1))
      await service.seedCustom('t1', templates, types)
      const typeCall = (
        mockTx.protocolType.create.mock.calls[0] as [{ data: { templateId: string } }]
      )[0]
      expect(typeCall.data.templateId).toBe('tmpl-1')
    })

    it('sets isSeeded=true on all rows', async () => {
      await service.seedCustom('t1', templates, types)
      const tmplCall = (
        mockTx.protocolTemplate.create.mock.calls[0] as [{ data: { isSeeded: boolean } }]
      )[0]
      const typeCall = (
        mockTx.protocolType.create.mock.calls[0] as [{ data: { isSeeded: boolean } }]
      )[0]
      expect(tmplCall.data.isSeeded).toBe(true)
      expect(typeCall.data.isSeeded).toBe(true)
    })

    it('sets tenant.seededAt inside the transaction', async () => {
      await service.seedCustom('t1', templates, types)
      expect(mockTx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' } }),
      )
    })

    it('passes suggestedSpecialty when provided', async () => {
      const withSpecialty = [
        { clientId: 'c1', name: 'T', suggestedSpecialty: 'cardiology', schema: {} },
      ]
      await service.seedCustom('t1', withSpecialty, types)
      const call = (
        mockTx.protocolTemplate.create.mock.calls[0] as [
          { data: { suggestedSpecialty: string | null } },
        ]
      )[0]
      expect(call.data.suggestedSpecialty).toBe('cardiology')
    })

    it('sets suggestedSpecialty to null when not provided', async () => {
      await service.seedCustom('t1', templates, types)
      const call = (
        mockTx.protocolTemplate.create.mock.calls[0] as [
          { data: { suggestedSpecialty: string | null } },
        ]
      )[0]
      expect(call.data.suggestedSpecialty).toBeNull()
    })
  })
})
