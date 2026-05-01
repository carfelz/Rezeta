import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { ProtocolTypesService } from '../protocol-types.service.js'

const TENANT_ID = 'tenant-1'
const OTHER_TENANT_ID = 'tenant-other'
const TYPE_ID = 'type-1'
const TEMPLATE_ID = 'tmpl-1'

const makeTypeRow = (overrides = {}) => ({
  id: TYPE_ID,
  tenantId: TENANT_ID,
  templateId: TEMPLATE_ID,
  template: { name: 'Fixture Template' },
  name: 'Our Type',
  isSeeded: false,
  _count: { protocols: 0 },
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
})

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  existsByName: vi.fn(),
  templateBelongsToTenant: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}

describe('ProtocolTypesService', () => {
  let service: ProtocolTypesService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolTypesService(mockRepo as never)
  })

  // ── Auth (guard-level, covered by controller spec) ────────────────────────

  // ── getTypes ───────────────────────────────────────────────────────────────

  describe('getTypes', () => {
    it('returns empty array when no types exist', async () => {
      mockRepo.findAll.mockResolvedValue([])
      const result = await service.getTypes(TENANT_ID)
      expect(result).toEqual([])
      expect(mockRepo.findAll).toHaveBeenCalledWith(TENANT_ID)
    })

    it('returns only this tenant types (cross-tenant isolation via tenantId filter)', async () => {
      const row = makeTypeRow()
      mockRepo.findAll.mockResolvedValue([row])
      const result = await service.getTypes(TENANT_ID)
      expect(result).toHaveLength(1)
      expect(result[0]!.tenantId).toBe(TENANT_ID)
      expect(result[0]!.name).toBe('Our Type')
      expect(result[0]!.templateId).toBe(TEMPLATE_ID)
    })

    it('maps isLocked=false when no protocols reference type', async () => {
      mockRepo.findAll.mockResolvedValue([makeTypeRow({ _count: { protocols: 0 } })])
      const [t] = await service.getTypes(TENANT_ID)
      expect(t!.isLocked).toBe(false)
      expect(t!.protocolCount).toBe(0)
    })

    it('maps isLocked=true and protocolCount when protocols reference type', async () => {
      mockRepo.findAll.mockResolvedValue([makeTypeRow({ _count: { protocols: 2 } })])
      const [t] = await service.getTypes(TENANT_ID)
      expect(t!.isLocked).toBe(true)
      expect(t!.protocolCount).toBe(2)
    })

    it('includes templateName in returned items', async () => {
      mockRepo.findAll.mockResolvedValue([makeTypeRow()])
      const [t] = await service.getTypes(TENANT_ID)
      expect(t!.templateName).toBe('Fixture Template')
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the type with templateName and lock info', async () => {
      mockRepo.findById.mockResolvedValue(makeTypeRow())
      const t = await service.findById(TYPE_ID, TENANT_ID)
      expect(t.id).toBe(TYPE_ID)
      expect(t.name).toBe('Our Type')
      expect(t.templateName).toBe('Fixture Template')
      expect(t.isLocked).toBe(false)
      expect(t.protocolCount).toBe(0)
    })

    it('throws TYPE_NOT_FOUND when type does not exist in tenant', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.findById('nonexistent', TENANT_ID)).rejects.toThrow(NotFoundException)
      await expect(service.findById('nonexistent', TENANT_ID)).rejects.toMatchObject({
        response: { code: 'TYPE_NOT_FOUND' },
      })
    })

    it('404 for cross-tenant type (repo returns null)', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.findById(TYPE_ID, OTHER_TENANT_ID)).rejects.toThrow(NotFoundException)
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a type and returns dto', async () => {
      mockRepo.templateBelongsToTenant.mockResolvedValue(true)
      mockRepo.existsByName.mockResolvedValue(false)
      const row = makeTypeRow({ name: 'New Type' })
      mockRepo.create.mockResolvedValue(row)

      const result = await service.create(TENANT_ID, { name: 'New Type', templateId: TEMPLATE_ID })

      expect(result.name).toBe('New Type')
      expect(result.templateId).toBe(TEMPLATE_ID)
      expect(result.isLocked).toBe(false)
      expect(result.protocolCount).toBe(0)
      expect(result.isSeeded).toBe(false)
    })

    it('throws 400 TEMPLATE_NOT_FOUND_FOR_TYPE for cross-tenant templateId', async () => {
      mockRepo.templateBelongsToTenant.mockResolvedValue(false)
      await expect(
        service.create(TENANT_ID, { name: 'Bad Type', templateId: 'other-tenant-tmpl' }),
      ).rejects.toThrow(BadRequestException)
      await expect(
        service.create(TENANT_ID, { name: 'Bad Type', templateId: 'other-tenant-tmpl' }),
      ).rejects.toMatchObject({ response: { code: 'TEMPLATE_NOT_FOUND_FOR_TYPE' } })
    })

    it('throws 409 TYPE_NAME_CONFLICT for duplicate name within tenant', async () => {
      mockRepo.templateBelongsToTenant.mockResolvedValue(true)
      mockRepo.existsByName.mockResolvedValue(true)
      await expect(
        service.create(TENANT_ID, { name: 'Duplicate', templateId: TEMPLATE_ID }),
      ).rejects.toThrow(ConflictException)
      await expect(
        service.create(TENANT_ID, { name: 'Duplicate', templateId: TEMPLATE_ID }),
      ).rejects.toMatchObject({ response: { code: 'TYPE_NAME_CONFLICT' } })
    })

    it('throws 400 for missing required fields (no templateId)', async () => {
      mockRepo.templateBelongsToTenant.mockResolvedValue(false)
      await expect(
        service.create(TENANT_ID, { name: 'No Template', templateId: '' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('renames the type', async () => {
      mockRepo.findById.mockResolvedValue(makeTypeRow({ name: 'Old Name' }))
      mockRepo.existsByName.mockResolvedValue(false)
      mockRepo.update.mockResolvedValue(makeTypeRow({ name: 'New Name' }))

      const result = await service.update(TYPE_ID, TENANT_ID, { name: 'New Name' })
      expect(result.name).toBe('New Name')
      expect(result.templateId).toBe(TEMPLATE_ID)
    })

    it('throws 409 TYPE_NAME_CONFLICT if name already taken', async () => {
      mockRepo.findById.mockResolvedValue(makeTypeRow())
      mockRepo.existsByName.mockResolvedValue(true)

      await expect(service.update(TYPE_ID, TENANT_ID, { name: 'Taken' })).rejects.toThrow(
        ConflictException,
      )
      await expect(service.update(TYPE_ID, TENANT_ID, { name: 'Taken' })).rejects.toMatchObject({
        response: { code: 'TYPE_NAME_CONFLICT' },
      })
    })

    it('throws 404 for cross-tenant type', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.update(TYPE_ID, OTHER_TENANT_ID, { name: 'Hacked' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('passes excludeId to existsByName to allow same-name update without conflict', async () => {
      mockRepo.findById.mockResolvedValue(makeTypeRow())
      mockRepo.existsByName.mockResolvedValue(false)
      mockRepo.update.mockResolvedValue(makeTypeRow())
      await service.update(TYPE_ID, TENANT_ID, { name: 'Same Name' })
      expect(mockRepo.existsByName).toHaveBeenCalledWith('Same Name', TENANT_ID, TYPE_ID)
    })
  })

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes the type', async () => {
      mockRepo.findById.mockResolvedValue(makeTypeRow({ _count: { protocols: 0 } }))
      mockRepo.softDelete.mockResolvedValue(undefined)

      await service.delete(TYPE_ID, TENANT_ID)
      expect(mockRepo.softDelete).toHaveBeenCalledWith(TYPE_ID, TENANT_ID)
    })

    it('throws 409 TYPE_LOCKED when protocols reference the type', async () => {
      mockRepo.findById.mockResolvedValue(makeTypeRow({ _count: { protocols: 1 } }))

      await expect(service.delete(TYPE_ID, TENANT_ID)).rejects.toThrow(ConflictException)
      await expect(service.delete(TYPE_ID, TENANT_ID)).rejects.toMatchObject({
        response: { code: 'TYPE_LOCKED' },
      })
      expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })

    it('throws 404 for cross-tenant type', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.delete(TYPE_ID, OTHER_TENANT_ID)).rejects.toThrow(NotFoundException)
    })
  })

  // ── isLocked and protocolCount in list ─────────────────────────────────────

  describe('isLocked flag in list response', () => {
    it('isLocked=true and protocolCount=2 when 2 protocols reference type', async () => {
      mockRepo.findAll.mockResolvedValue([makeTypeRow({ _count: { protocols: 2 } })])
      const [t] = await service.getTypes(TENANT_ID)
      expect(t!.isLocked).toBe(true)
      expect(t!.protocolCount).toBe(2)
    })

    it('isLocked=false and protocolCount=0 when no protocols reference type', async () => {
      mockRepo.findAll.mockResolvedValue([makeTypeRow({ _count: { protocols: 0 } })])
      const [t] = await service.getTypes(TENANT_ID)
      expect(t!.isLocked).toBe(false)
      expect(t!.protocolCount).toBe(0)
    })
  })
})
