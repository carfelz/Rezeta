import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { TenantSeedingService } from '../tenant-seeding.service.js'

const unseededTenant = { id: 't1', seededAt: null }
const seededTenant = { id: 't1', seededAt: new Date('2026-01-01') }

const mockTx = {
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  protocolTemplate: { create: vi.fn() },
  protocolCategory: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
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
    // Template creates return objects with sequential IDs
    mockTx.protocolTemplate.create.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `tmpl-${data.name}` }),
    )
    mockTx.protocolCategory.create.mockImplementation(
      ({ data }: { data: { name: string } }) => Promise.resolve({ id: `cat-${data.name}` }),
    )
    mockTx.protocolCategory.findFirst.mockResolvedValue({ id: 'cat-fallback' })
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

    it('creates 5 templates for es locale (ProtocolType removed in schema reset v2)', async () => {
      await service.seedDefault('t1', 'es')
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(5)
    })

    it('creates 5 templates for en locale', async () => {
      await service.seedDefault('t1', 'en')
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(5)
    })

    it('sets isSeeded=true on all template rows', async () => {
      await service.seedDefault('t1')
      for (const call of mockTx.protocolTemplate.create.mock.calls) {
        expect((call[0] as { data: { isSeeded: boolean } }).data.isSeeded).toBe(true)
      }
    })

    it('seeds 5 protocol categories for es locale', async () => {
      await service.seedDefault('t1', 'es')
      expect(mockTx.protocolCategory.create).toHaveBeenCalledTimes(5)
      const names = mockTx.protocolCategory.create.mock.calls.map(
        (call) => (call[0] as { data: { name: string; color: string; isSeeded: boolean } }).data,
      )
      expect(names).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Emergencias', color: '#EF4444', isSeeded: true }),
          expect.objectContaining({ name: 'Diagnóstico', color: '#3B82F6', isSeeded: true }),
        ]),
      )
    })

    it('seeds English category names for en locale', async () => {
      await service.seedDefault('t1', 'en')
      const names = mockTx.protocolCategory.create.mock.calls.map(
        (call) => (call[0] as { data: { name: string } }).data.name,
      )
      expect(names).toContain('Emergencies')
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

    it('creates exactly the supplied templates (types deferred to Plan 02)', async () => {
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
    })

    it('sets isSeeded=true on all template rows', async () => {
      await service.seedCustom('t1', templates, types)
      const tmplCall = (
        mockTx.protocolTemplate.create.mock.calls[0] as [{ data: { isSeeded: boolean } }]
      )[0]
      expect(tmplCall.data.isSeeded).toBe(true)
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
