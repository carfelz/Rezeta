import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { TenantSeedingService } from '../tenant-seeding.service.js'

const unseededTenant = { id: 't1', seededAt: null }
const seededTenant = { id: 't1', seededAt: new Date('2026-01-01') }

const mockTx = {
  $queryRaw: vi.fn(),
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  protocolTemplate: { create: vi.fn() },
  protocolCategory: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  rolePermission: { createMany: vi.fn() },
}

const mockPermissions = { seedDefaults: vi.fn().mockResolvedValue(undefined) }

const mockPrisma = {
  tenant: { findUnique: vi.fn() },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

describe('TenantSeedingService (unit)', () => {
  let service: TenantSeedingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TenantSeedingService(mockPrisma as never, mockPermissions as never)

    // Default: unseeded tenant, transaction re-check also unseeded
    mockPrisma.tenant.findUnique.mockResolvedValue(unseededTenant)
    mockTx.$queryRaw.mockResolvedValue([{ id: 't1' }])
    mockTx.tenant.findUnique.mockResolvedValue({ seededAt: null })
    mockTx.tenant.update.mockResolvedValue({})
    // Template creates return objects with sequential IDs
    mockTx.protocolTemplate.create.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `tmpl-${data.name}` }),
    )
    mockTx.protocolCategory.create.mockImplementation(
      ({ data }: { data: { name: string } }) =>
        Promise.resolve({ id: `cat-${data.name}`, name: data.name }),
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

    it('throws Error when a fixture references a category not in the seeded set', async () => {
      // Return a category with a name that does NOT match any fixture's categoryName
      mockTx.protocolCategory.create.mockResolvedValue({ id: 'cat-unknown', name: 'Unknown' })
      await expect(service.seedDefault('t1', 'es')).rejects.toThrow(
        /references unknown category/,
      )
    })

    it('creates 2 templates for es locale', async () => {
      await service.seedDefault('t1', 'es')
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(2)
    })

    it('creates 2 templates for en locale', async () => {
      await service.seedDefault('t1', 'en')
      expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(2)
    })

    it('sets isSeeded=true on all template rows', async () => {
      await service.seedDefault('t1')
      for (const call of mockTx.protocolTemplate.create.mock.calls) {
        expect((call[0] as { data: { isSeeded: boolean } }).data.isSeeded).toBe(true)
      }
    })

    it('seeds 2 protocol categories for es locale', async () => {
      await service.seedDefault('t1', 'es')
      expect(mockTx.protocolCategory.create).toHaveBeenCalledTimes(2)
      const categoryData = mockTx.protocolCategory.create.mock.calls.map(
        (call) => (call[0] as { data: { name: string; color: string; isSeeded: boolean } }).data,
      )
      expect(categoryData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Emergencias', color: '#EF4444', isSeeded: true }),
          expect.objectContaining({ name: 'Diagnóstico', color: '#3B82F6', isSeeded: true }),
        ]),
      )
    })

    it('seeds 2 protocol categories for en locale', async () => {
      await service.seedDefault('t1', 'en')
      expect(mockTx.protocolCategory.create).toHaveBeenCalledTimes(2)
      const names = mockTx.protocolCategory.create.mock.calls.map(
        (call) => (call[0] as { data: { name: string } }).data.name,
      )
      expect(names).toContain('Emergencies')
      expect(names).toContain('Diagnosis')
    })

    it('each template is linked to its matching category', async () => {
      await service.seedDefault('t1', 'es')
      const templateCalls = mockTx.protocolTemplate.create.mock.calls.map(
        (call) => (call[0] as { data: { name: string; categoryId: string } }).data,
      )
      // emergency template -> cat-Emergencias
      const emergencyTemplate = templateCalls.find((d) => d.name === 'Intervención de emergencia')
      expect(emergencyTemplate?.categoryId).toBe('cat-Emergencias')
      // diagnostic template -> cat-Diagnóstico
      const diagnosticTemplate = templateCalls.find((d) => d.name === 'Algoritmo diagnóstico')
      expect(diagnosticTemplate?.categoryId).toBe('cat-Diagnóstico')
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

    it('seeds RolePermission defaults inside the transaction', async () => {
      await service.seedDefault('t1')
      expect(mockPermissions.seedDefaults).toHaveBeenCalledWith(mockTx, 't1')
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

    it('creates a default Diagnóstico category for custom templates', async () => {
      await service.seedCustom('t1', templates, types)
      expect(mockTx.protocolCategory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Diagnóstico', color: '#3B82F6', isSeeded: true }),
        }),
      )
    })

    it('links custom templates to the seeded default category', async () => {
      await service.seedCustom('t1', templates, types)
      const tmplCall = (
        mockTx.protocolTemplate.create.mock.calls[0] as [{ data: { categoryId: string } }]
      )[0]
      expect(tmplCall.data.categoryId).toBe('cat-Diagnóstico')
    })

    it('sets tenant.seededAt inside the transaction', async () => {
      await service.seedCustom('t1', templates, types)
      expect(mockTx.tenant.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 't1' } }),
      )
    })

    it('seeds RolePermission defaults inside the transaction', async () => {
      await service.seedCustom('t1', templates, types)
      expect(mockPermissions.seedDefaults).toHaveBeenCalledWith(mockTx, 't1')
    })
  })
})
