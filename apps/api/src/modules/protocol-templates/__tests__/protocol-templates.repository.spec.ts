import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolTemplatesRepository } from '../protocol-templates.repository.js'

const TENANT_ID = 'tenant-1'
const TEMPLATE_ID = 'tmpl-1'
const USER_ID = 'user-1'
const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }

const mockPrisma = {
  protocolTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  protocolType: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}

const makeTemplateRow = (overrides = {}) => ({
  id: TEMPLATE_ID,
  tenantId: TENANT_ID,
  name: 'Intervención de emergencia',
  description: null,
  suggestedSpecialty: null,
  schema: MINIMAL_SCHEMA,
  isSeeded: false,
  createdBy: USER_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  ...overrides,
})

const makeTemplateWithTypes = (typeIds: string[] = []) => ({
  ...makeTemplateRow(),
  protocolTypes: typeIds.map((id) => ({ id })),
})

describe('ProtocolTemplatesRepository', () => {
  let repo: ProtocolTemplatesRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ProtocolTemplatesRepository(mockPrisma as never)
  })

  // ── findAllWithLockInfo ────────────────────────────────────────────────────

  describe('findAllWithLockInfo', () => {
    it('calls findMany with tenantId filter and deletedAt null', async () => {
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([makeTemplateWithTypes()])
      await repo.findAllWithLockInfo(TENANT_ID)
      expect(mockPrisma.protocolTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, deletedAt: null }),
        }),
      )
    })

    it('includes protocolTypes in query', async () => {
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([])
      await repo.findAllWithLockInfo(TENANT_ID)
      const call = mockPrisma.protocolTemplate.findMany.mock.calls[0][0] as {
        include: { protocolTypes: unknown }
      }
      expect(call.include).toHaveProperty('protocolTypes')
    })

    it('returns array of templates with protocolTypes', async () => {
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([makeTemplateWithTypes(['type-a'])])
      const result = await repo.findAllWithLockInfo(TENANT_ID)
      expect(result).toHaveLength(1)
      expect(result[0]!.protocolTypes).toEqual([{ id: 'type-a' }])
    })

    it('returns empty array when no templates', async () => {
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([])
      const result = await repo.findAllWithLockInfo(TENANT_ID)
      expect(result).toEqual([])
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('calls findFirst with id, tenantId, and deletedAt null', async () => {
      mockPrisma.protocolTemplate.findFirst.mockResolvedValue(makeTemplateWithTypes())
      await repo.findById(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: TEMPLATE_ID, tenantId: TENANT_ID, deletedAt: null }),
        }),
      )
    })

    it('returns null when template not found', async () => {
      mockPrisma.protocolTemplate.findFirst.mockResolvedValue(null)
      const result = await repo.findById('nonexistent', TENANT_ID)
      expect(result).toBeNull()
    })

    it('returns template with protocolTypes when found', async () => {
      mockPrisma.protocolTemplate.findFirst.mockResolvedValue(makeTemplateWithTypes(['type-1']))
      const result = await repo.findById(TEMPLATE_ID, TENANT_ID)
      expect(result).not.toBeNull()
      expect(result!.protocolTypes).toEqual([{ id: 'type-1' }])
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('calls prisma.create with correct data', async () => {
      const created = makeTemplateRow({ name: 'My Template' })
      mockPrisma.protocolTemplate.create.mockResolvedValue(created)
      await repo.create(TENANT_ID, { name: 'My Template', schema: MINIMAL_SCHEMA }, USER_ID)
      expect(mockPrisma.protocolTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            name: 'My Template',
            schema: MINIMAL_SCHEMA,
            isSeeded: false,
            createdBy: USER_ID,
          }),
        }),
      )
    })

    it('sets suggestedSpecialty from data', async () => {
      mockPrisma.protocolTemplate.create.mockResolvedValue(makeTemplateRow())
      await repo.create(
        TENANT_ID,
        { name: 'T', schema: MINIMAL_SCHEMA, suggestedSpecialty: 'cardiology' },
        USER_ID,
      )
      const call = mockPrisma.protocolTemplate.create.mock.calls[0][0] as {
        data: { suggestedSpecialty: string }
      }
      expect(call.data.suggestedSpecialty).toBe('cardiology')
    })

    it('defaults suggestedSpecialty to null when not provided', async () => {
      mockPrisma.protocolTemplate.create.mockResolvedValue(makeTemplateRow())
      await repo.create(TENANT_ID, { name: 'T', schema: MINIMAL_SCHEMA }, USER_ID)
      const call = mockPrisma.protocolTemplate.create.mock.calls[0][0] as {
        data: { suggestedSpecialty: null }
      }
      expect(call.data.suggestedSpecialty).toBeNull()
    })

    it('returns created template row', async () => {
      const row = makeTemplateRow({ name: 'New' })
      mockPrisma.protocolTemplate.create.mockResolvedValue(row)
      const result = await repo.create(TENANT_ID, { name: 'New', schema: MINIMAL_SCHEMA }, USER_ID)
      expect(result.name).toBe('New')
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('calls prisma.update with correct id', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow({ name: 'Updated' }))
      await repo.update(TEMPLATE_ID, TENANT_ID, { name: 'Updated' })
      expect(mockPrisma.protocolTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEMPLATE_ID } }),
      )
    })

    it('includes name in update data when provided', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow())
      await repo.update(TEMPLATE_ID, TENANT_ID, { name: 'New Name' })
      const call = mockPrisma.protocolTemplate.update.mock.calls[0][0] as {
        data: { name: string }
      }
      expect(call.data.name).toBe('New Name')
    })

    it('omits name from data when not provided', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow())
      await repo.update(TEMPLATE_ID, TENANT_ID, { schema: MINIMAL_SCHEMA })
      const call = mockPrisma.protocolTemplate.update.mock.calls[0][0] as {
        data: Record<string, unknown>
      }
      expect(call.data).not.toHaveProperty('name')
    })

    it('includes schema in update data when provided', async () => {
      const newSchema = { version: '2.0', blocks: [] }
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow())
      await repo.update(TEMPLATE_ID, TENANT_ID, { schema: newSchema })
      const call = mockPrisma.protocolTemplate.update.mock.calls[0][0] as {
        data: { schema: object }
      }
      expect(call.data.schema).toEqual(newSchema)
    })

    it('returns updated template row', async () => {
      const updated = makeTemplateRow({ name: 'Updated Name' })
      mockPrisma.protocolTemplate.update.mockResolvedValue(updated)
      const result = await repo.update(TEMPLATE_ID, TENANT_ID, { name: 'Updated Name' })
      expect(result.name).toBe('Updated Name')
    })
  })

  // ── softDelete ─────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('calls prisma.update with id and sets deletedAt', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow())
      await repo.softDelete(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEMPLATE_ID },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      )
    })

    it('resolves to void (returns undefined)', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow())
      const result = await repo.softDelete(TEMPLATE_ID, TENANT_ID)
      expect(result).toBeUndefined()
    })
  })

  // ── isLocked ───────────────────────────────────────────────────────────────

  describe('isLocked', () => {
    it('returns false when count is 0', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(0)
      const result = await repo.isLocked(TEMPLATE_ID, TENANT_ID)
      expect(result).toBe(false)
    })

    it('returns true when count > 0', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(2)
      const result = await repo.isLocked(TEMPLATE_ID, TENANT_ID)
      expect(result).toBe(true)
    })

    it('queries by templateId, tenantId, and deletedAt null', async () => {
      mockPrisma.protocolType.count.mockResolvedValue(0)
      await repo.isLocked(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolType.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateId: TEMPLATE_ID,
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
        }),
      )
    })
  })

  // ── getBlockingTypeIds ─────────────────────────────────────────────────────

  describe('getBlockingTypeIds', () => {
    it('returns empty array when no types reference template', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([])
      const result = await repo.getBlockingTypeIds(TEMPLATE_ID, TENANT_ID)
      expect(result).toEqual([])
    })

    it('returns array of type IDs when types reference template', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([{ id: 'type-a' }, { id: 'type-b' }])
      const result = await repo.getBlockingTypeIds(TEMPLATE_ID, TENANT_ID)
      expect(result).toEqual(['type-a', 'type-b'])
    })

    it('queries by templateId, tenantId, and deletedAt null', async () => {
      mockPrisma.protocolType.findMany.mockResolvedValue([])
      await repo.getBlockingTypeIds(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            templateId: TEMPLATE_ID,
            tenantId: TENANT_ID,
            deletedAt: null,
          }),
        }),
      )
    })
  })
})
