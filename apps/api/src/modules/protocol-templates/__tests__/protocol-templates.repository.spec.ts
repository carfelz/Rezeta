import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolTemplatesRepository } from '../protocol-templates.repository.js'

// ProtocolType removed in schema reset v2.
// isLocked and getBlockingTypeIds are stubs (always return false / []).
// findAllWithLockInfo and findById no longer include protocolTypes.
// categoryId is now REQUIRED on create — the fallback shim has been removed.

const TENANT_ID = 'tenant-1'
const TEMPLATE_ID = 'tmpl-1'
const USER_ID = 'user-1'
const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }

const CATEGORY_ID = 'cat-1'
const CATEGORY_ROW = { id: CATEGORY_ID, name: 'Emergencias', color: '#EF4444' }

const mockPrisma = {
  protocolTemplate: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  protocolCategory: {
    findFirst: vi.fn(),
  },
}

const makeTemplateRow = (overrides = {}) => ({
  id: TEMPLATE_ID,
  tenantId: TENANT_ID,
  name: 'Intervención de emergencia',
  description: null,
  suggestedSpecialty: null,
  categoryId: CATEGORY_ID,
  category: CATEGORY_ROW,
  schema: MINIMAL_SCHEMA,
  isSeeded: false,
  createdBy: USER_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  ...overrides,
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
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([makeTemplateRow()])
      await repo.findAllWithLockInfo(TENANT_ID)
      expect(mockPrisma.protocolTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: TENANT_ID, deletedAt: null }),
          include: { category: true },
        }),
      )
    })

    it('returns array of templates', async () => {
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([makeTemplateRow()])
      const result = await repo.findAllWithLockInfo(TENANT_ID)
      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe(TEMPLATE_ID)
    })

    it('returns empty array when no templates', async () => {
      mockPrisma.protocolTemplate.findMany.mockResolvedValue([])
      const result = await repo.findAllWithLockInfo(TENANT_ID)
      expect(result).toEqual([])
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('calls findFirst with id, tenantId, deletedAt null, and category include', async () => {
      mockPrisma.protocolTemplate.findFirst.mockResolvedValue(makeTemplateRow())
      await repo.findById(TEMPLATE_ID, TENANT_ID)
      expect(mockPrisma.protocolTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: TEMPLATE_ID, tenantId: TENANT_ID, deletedAt: null }),
          include: { category: true },
        }),
      )
    })

    it('returns null when template not found', async () => {
      mockPrisma.protocolTemplate.findFirst.mockResolvedValue(null)
      const result = await repo.findById('nonexistent', TENANT_ID)
      expect(result).toBeNull()
    })

    it('returns template when found', async () => {
      mockPrisma.protocolTemplate.findFirst.mockResolvedValue(makeTemplateRow())
      const result = await repo.findById(TEMPLATE_ID, TENANT_ID)
      expect(result).not.toBeNull()
      expect(result!.id).toBe(TEMPLATE_ID)
    })
  })

  // ── findCategory ───────────────────────────────────────────────────────────

  describe('findCategory', () => {
    it('calls protocolCategory.findFirst with id and tenantId', async () => {
      mockPrisma.protocolCategory.findFirst.mockResolvedValue(CATEGORY_ROW)
      await repo.findCategory(CATEGORY_ID, TENANT_ID)
      expect(mockPrisma.protocolCategory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: CATEGORY_ID, tenantId: TENANT_ID, deletedAt: null }),
        }),
      )
    })

    it('returns category when found', async () => {
      mockPrisma.protocolCategory.findFirst.mockResolvedValue(CATEGORY_ROW)
      const result = await repo.findCategory(CATEGORY_ID, TENANT_ID)
      expect(result).toEqual(CATEGORY_ROW)
    })

    it('returns null when category not found', async () => {
      mockPrisma.protocolCategory.findFirst.mockResolvedValue(null)
      const result = await repo.findCategory('nonexistent', TENANT_ID)
      expect(result).toBeNull()
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('calls prisma.create with required categoryId and category include', async () => {
      const created = makeTemplateRow({ name: 'My Template' })
      mockPrisma.protocolTemplate.create.mockResolvedValue(created)
      await repo.create(TENANT_ID, { name: 'My Template', categoryId: CATEGORY_ID, schema: MINIMAL_SCHEMA }, USER_ID)
      expect(mockPrisma.protocolTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            name: 'My Template',
            categoryId: CATEGORY_ID,
            schema: MINIMAL_SCHEMA,
            isSeeded: false,
            createdBy: USER_ID,
          }),
          include: { category: true },
        }),
      )
    })

    it('sets suggestedSpecialty from data', async () => {
      mockPrisma.protocolTemplate.create.mockResolvedValue(makeTemplateRow())
      await repo.create(
        TENANT_ID,
        { name: 'T', categoryId: CATEGORY_ID, schema: MINIMAL_SCHEMA, suggestedSpecialty: 'cardiology' },
        USER_ID,
      )
      const call = mockPrisma.protocolTemplate.create.mock.calls[0][0] as {
        data: { suggestedSpecialty: string }
      }
      expect(call.data.suggestedSpecialty).toBe('cardiology')
    })

    it('defaults suggestedSpecialty to null when not provided', async () => {
      mockPrisma.protocolTemplate.create.mockResolvedValue(makeTemplateRow())
      await repo.create(TENANT_ID, { name: 'T', categoryId: CATEGORY_ID, schema: MINIMAL_SCHEMA }, USER_ID)
      const call = mockPrisma.protocolTemplate.create.mock.calls[0][0] as {
        data: { suggestedSpecialty: null }
      }
      expect(call.data.suggestedSpecialty).toBeNull()
    })

    it('returns created template row with category', async () => {
      const row = makeTemplateRow({ name: 'New' })
      mockPrisma.protocolTemplate.create.mockResolvedValue(row)
      const result = await repo.create(TENANT_ID, { name: 'New', categoryId: CATEGORY_ID, schema: MINIMAL_SCHEMA }, USER_ID)
      expect(result.name).toBe('New')
      expect(result.category).toEqual(CATEGORY_ROW)
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('calls prisma.update with correct id and category include', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow({ name: 'Updated' }))
      await repo.update(TEMPLATE_ID, TENANT_ID, { name: 'Updated' })
      expect(mockPrisma.protocolTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEMPLATE_ID },
          include: { category: true },
        }),
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

    it('includes categoryId in update data when provided', async () => {
      mockPrisma.protocolTemplate.update.mockResolvedValue(makeTemplateRow())
      await repo.update(TEMPLATE_ID, TENANT_ID, { categoryId: CATEGORY_ID })
      const call = mockPrisma.protocolTemplate.update.mock.calls[0][0] as {
        data: { categoryId: string }
      }
      expect(call.data.categoryId).toBe(CATEGORY_ID)
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
})
