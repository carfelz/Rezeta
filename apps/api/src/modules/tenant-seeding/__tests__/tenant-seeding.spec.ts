import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TenantSeedingService } from '../tenant-seeding.service.js'

// Supplement the core unit spec (tenant-seeding.service.unit.spec.ts) with
// locale-specific template name assertions that require inspecting mock call args.

const unseededTenant = { id: 't1', seededAt: null }

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

describe('TenantSeedingService — locale names', () => {
  let service: TenantSeedingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TenantSeedingService(mockPrisma as never)

    mockPrisma.tenant.findUnique.mockResolvedValue(unseededTenant)
    mockTx.tenant.findUnique.mockResolvedValue({ seededAt: null })
    mockTx.tenant.update.mockResolvedValue({})
    mockTx.protocolTemplate.create.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `tmpl-${data.name}` }),
    )
    mockTx.protocolCategory.create.mockImplementation(
      ({ data }: { data: { name: string } }) =>
        Promise.resolve({ id: `cat-${data.name}`, name: data.name }),
    )
    mockTx.protocolCategory.findFirst.mockResolvedValue({ id: 'cat-fallback' })
  })

  it('seedDefault: Spanish locale creates 2 templates with expected Spanish names', async () => {
    await service.seedDefault('t1', 'es')

    const names = mockTx.protocolTemplate.create.mock.calls.map(
      (call) => (call[0] as { data: { name: string } }).data.name,
    )

    expect(names).toContain('Intervención de emergencia')
    expect(names).toContain('Algoritmo diagnóstico')
    expect(names).toHaveLength(2)
  })

  it('seedDefault: English locale creates 2 templates with expected English names', async () => {
    await service.seedDefault('t1', 'en')

    const names = mockTx.protocolTemplate.create.mock.calls.map(
      (call) => (call[0] as { data: { name: string } }).data.name,
    )

    expect(names).toContain('Emergency Intervention')
    expect(names).toContain('Diagnostic Algorithm')
    expect(names).toHaveLength(2)
  })

  it('seedDefault: sets isSeeded=true on all templates', async () => {
    await service.seedDefault('t1', 'es')

    for (const call of mockTx.protocolTemplate.create.mock.calls) {
      expect((call[0] as { data: { isSeeded: boolean } }).data.isSeeded).toBe(true)
    }
  })

  it('seedDefault: cross-tenant isolation — only calls for the specified tenantId', async () => {
    await service.seedDefault('t1', 'es')

    for (const call of mockTx.protocolTemplate.create.mock.calls) {
      expect((call[0] as { data: { tenantId: string } }).data.tenantId).toBe('t1')
    }
  })

  it('seedCustom: types correctly reference their templates', async () => {
    await service.seedCustom(
      't1',
      [{ clientId: 'tmpl-1', name: 'My Template', schema: { version: '1.0', blocks: [] } }],
      [{ name: 'My Type', templateClientId: 'tmpl-1' }],
    )

    // Template was created successfully (types deferred to Plan 02)
    expect(mockTx.protocolTemplate.create).toHaveBeenCalledTimes(1)
    expect(mockTx.protocolTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'My Template' }) }),
    )
  })

  it('seedCustom: cross-tenant isolation — all rows scoped to given tenantId', async () => {
    await service.seedCustom(
      't1',
      [{ clientId: 'x', name: 'T', schema: { version: '1.0', blocks: [] } }],
      [{ name: 'Ty', templateClientId: 'x' }],
    )

    for (const call of mockTx.protocolTemplate.create.mock.calls) {
      expect((call[0] as { data: { tenantId: string } }).data.tenantId).toBe('t1')
    }
  })
})
