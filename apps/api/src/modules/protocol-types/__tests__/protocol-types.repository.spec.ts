import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolTypesRepository } from '../protocol-types.repository.js'

const TENANT_ID = 'tenant-1'
const TYPE_ID = 'type-1'
const TEMPLATE_ID = 'tmpl-1'

const mockPrisma = {
  protocolType: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  protocolTemplate: {
    count: vi.fn(),
  },
}

const makeTypeRow = (overrides = {}) => ({
  id: TYPE_ID,
  tenantId: TENANT_ID,
  templateId: TEMPLATE_ID,
  name: 'Emergencia',
  isSeeded: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  template: { id: TEMPLATE_ID, name: 'Intervención de emergencia' },
  _count: { protocols: 0 },
  ...overrides,
})

describe('ProtocolTypesRepository', () => {
  let repo: ProtocolTypesRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ProtocolTypesRepository(mockPrisma as never)
  })

  // ── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('calls findMany with tenantId and deletedAt null', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([makeTypeRow()])
      await repo.findAll(TENANT_ID)
      expect(mockPrisma.protocolType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, deletedAt: null }),
        }),
      )
    })

    it('includes template and _count in query', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([])
      await repo.findAll(TENANT_ID)
      const call = mockPrisma.protocolType.findMany.mock.calls[0][0] as {
        include: { template: unknown; _count: unknown }
      }
      expect(call.include).toHaveProperty('template')
      expect(call.include).toHaveProperty('_count')
    })

    it('returns array of types with template and _count', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([
        makeTypeRow({ _count: { protocols: 2 } }),
      ])
      const result = await repo.findAll(TENANT_ID)
      expect(result).toHaveLength(1)
      expect(result[0]!._count.protocols).toBe(2)
      expect(result[0]!.template.name).toBe('Intervención de emergencia')
    })

    it('returns empty array when no types', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([])
      const result = await repo.findAll(TENANT_ID)
      expect(result).toEqual([])
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('calls findFirst with id, tenantId, deletedAt null', async () => {
      mockPrisma.protocolType.findFirst.mockResolvedValue(makeTypeRow())
      await repo.findById(TYPE_ID, TENANT_ID)
      expect(mockPrisma.protocolType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: TYPE_ID, tenantId: TENANT_ID, deletedAt: null }),
        }),
      )
    })

    it('returns null when type not found', async () => {
      mockPrisma.protocolType.findFirst.mockResolvedValue(null)
      const result = await repo.findById('nonexistent', TENANT_ID)
      expect(result).toBeNull()
    })

    it('returns type row when found', async () => {
      mockPrisma.protocolType.findFirst.mockResolvedValue(makeTypeRow())
      const result = await repo.findById(TYPE_ID, TENANT_ID)
      expect(result).not.toBeNull()
      expect(result!.id).toBe(TYPE_ID)
    })
  })

  // ── findByIdWithTemplate ───────────────────────────────────────────────────

  describe('findByIdWithTemplate', () => {
    it('calls findFirst with id, tenantId, deletedAt null', async () => {
      const row = { ...makeTypeRow(), template: { id: TEMPLATE_ID, name: 'T', schema: {} } }
      mockPrisma.protocolType.findFirst.mockResolvedValue(row)
      await repo.findByIdWithTemplate(TYPE_ID, TENANT_ID)
      expect(mockPrisma.protocolType.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: TYPE_ID, tenantId: TENANT_ID, deletedAt: null }),
        }),
      )
    })

    it('includes schema in template select', async () => {
      const row = { ...makeTypeRow(), template: { id: TEMPLATE_ID, name: 'T', schema: {} } }
      mockPrisma.protocolType.findFirst.mockResolvedValue(row)
      const result = await repo.findByIdWithTemplate(TYPE_ID, TENANT_ID)
      expect(result).not.toBeNull()
      expect(result!.template).toHaveProperty('schema')
    })

    it('returns null when type not found', async () => {
      mockPrisma.protocolType.findFirst.mockResolvedValue(null)
      const result = await repo.findByIdWithTemplate('bad', TENANT_ID)
      expect(result).toBeNull()
    })
  })

  // ── existsByName ───────────────────────────────────────────────────────────

  describe('existsByName', () => {
    it('returns false when count is 0', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(0)
      const result = await repo.existsByName('Emergencia', TENANT_ID)
      expect(result).toBe(false)
    })

    it('returns true when count > 0', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(1)
      const result = await repo.existsByName('Emergencia', TENANT_ID)
      expect(result).toBe(true)
    })

    it('queries with name, tenantId, deletedAt null', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(0)
      await repo.existsByName('Emergencia', TENANT_ID)
      expect(mockPrisma.protocolType.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: 'Emergencia',
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
        }),
      )
    })

    it('excludes id from count when excludeId provided', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(0)
      await repo.existsByName('Emergencia', TENANT_ID, TYPE_ID)
      const call = mockPrisma.protocolType.count.mock.calls[0][0] as {
        where: { id: { not: string } }
      }
      expect(call.where.id).toEqual({ not: TYPE_ID })
    })

    it('does not include id exclusion when excludeId not provided', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(0)
      await repo.existsByName('Emergencia', TENANT_ID)
      const call = mockPrisma.protocolType.count.mock.calls[0][0] as {
        where: Record<string, unknown>
      }
      expect(call.where).not.toHaveProperty('id')
    })
  })

  // ── templateBelongsToTenant ────────────────────────────────────────────────

  describe('templateBelongsToTenant', () => {
    it('returns false when count is 0', async () => {
      mockPrisma.protocolTemplate.count.mockResolvedValue(0)
      const result = await repo.templateBelongsToTenant(TEMPLATE_ID, TENANT_ID)
      expect(result).toBe(false)
    })

    it('returns true when count > 0', async () => {
      mockPrisma.protocolTemplate.count.mockResolvedValue(1)
      const result = await repo.templateBelongsToTenant(TEMPLATE_ID, TENANT_ID)
      expect(result).toBe(true)
    })

    it('queries protocolTemplate with id, tenantId, deletedAt null', async () => {
      mockPrisma.protocolTemplate.count.mockResolvedValue(0)
      await repo.templateBelongsToTenant(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolTemplate.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: TEMPLATE_ID,
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
        }),
      )
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('calls prisma.create with correct data', async () => {
      mockPrisma.protocolType.create.mockResolvedValue(makeTypeRow())
      await repo.create(TENANT_ID, 'Emergencia', TEMPLATE_ID)
      expect(mockPrisma.protocolType.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            name: 'Emergencia',
            templateId: TEMPLATE_ID,
            isSeeded: false,
          }),
        }),
      )
    })

    it('returns created type with template and _count', async () => {
      mockPrisma.protocolType.create.mockResolvedValue(makeTypeRow({ name: 'Emergencia' }))
      const result = await repo.create(TENANT_ID, 'Emergencia', TEMPLATE_ID)
      expect(result.name).toBe('Emergencia')
      expect(result.template).toBeDefined()
      expect(result._count).toBeDefined()
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('calls prisma.update with id, tenantId, and new name', async () => {
      mockPrisma.protocolType.update.mockResolvedValue(makeTypeRow({ name: 'Urgencias' }))
      await repo.update(TYPE_ID, TENANT_ID, 'Urgencias')
      expect(mockPrisma.protocolType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TYPE_ID, tenantId: TENANT_ID },
          data: { name: 'Urgencias' },
        }),
      )
    })

    it('returns updated type row', async () => {
      mockPrisma.protocolType.update.mockResolvedValue(makeTypeRow({ name: 'Urgencias' }))
      const result = await repo.update(TYPE_ID, TENANT_ID, 'Urgencias')
      expect(result.name).toBe('Urgencias')
    })
  })

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('calls prisma.update with id, tenantId, and sets deletedAt', async () => {
      mockPrisma.protocolType.update.mockResolvedValue(makeTypeRow())
      await repo.softDelete(TYPE_ID, TENANT_ID)
      expect(mockPrisma.protocolType.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TYPE_ID, tenantId: TENANT_ID },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      )
    })

    it('resolves to void (returns undefined)', async () => {
      mockPrisma.protocolType.update.mockResolvedValue(makeTypeRow())
      const result = await repo.softDelete(TYPE_ID, TENANT_ID)
      expect(result).toBeUndefined()
    })
  })
})
