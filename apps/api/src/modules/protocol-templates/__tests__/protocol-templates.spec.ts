import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { ProtocolTemplatesService } from '../protocol-templates.service.js'

// ProtocolType removed in schema reset v2.
// isLocked is always false; blockingTypeIds no longer in DTO.
// Template locking will be re-implemented via ProtocolCategory in Plan 02.

const TENANT_ID = 'tenant-1'
const OTHER_TENANT_ID = 'tenant-other'
const TEMPLATE_ID = 'tmpl-1'
const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }

const makeTemplateRow = (overrides = {}) => ({
  id: TEMPLATE_ID,
  tenantId: TENANT_ID,
  name: 'Fetch Me',
  description: null,
  suggestedSpecialty: null,
  schema: MINIMAL_SCHEMA,
  isSeeded: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  deletedAt: null,
  createdBy: 'user-1',
  ...overrides,
})

const mockRepo = {
  findAllWithLockInfo: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}

describe('ProtocolTemplatesService', () => {
  let service: ProtocolTemplatesService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolTemplatesService(mockRepo as never)
  })

  // ── getTemplates ───────────────────────────────────────────────────────────

  describe('getTemplates', () => {
    it('returns empty array when no templates exist', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([])
      const result = await service.getTemplates(TENANT_ID)
      expect(result).toEqual([])
      expect(mockRepo.findAllWithLockInfo).toHaveBeenCalledWith(TENANT_ID)
    })

    it('returns only this tenant templates (cross-tenant via tenantId)', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([
        makeTemplateRow({ name: 'Template A', isSeeded: true }),
        makeTemplateRow({ id: 'tmpl-2', name: 'Template B', isSeeded: false }),
      ])
      const result = await service.getTemplates(TENANT_ID)
      expect(result).toHaveLength(2)
      expect(result.every((t) => t.tenantId === TENANT_ID)).toBe(true)
    })

    it('maps isLocked=false (ProtocolType removed, locking deferred to Plan 02)', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([makeTemplateRow()])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.isLocked).toBe(false)
    })

    it('returns template with correct name and schema', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([makeTemplateRow({ name: 'My Template' })])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.name).toBe('My Template')
      expect(t!.schema).toEqual(MINIMAL_SCHEMA)
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns template with lock info', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow())
      const t = await service.findById(TEMPLATE_ID, TENANT_ID)
      expect(t.id).toBe(TEMPLATE_ID)
      expect(t.name).toBe('Fetch Me')
      expect(t.isLocked).toBe(false)
    })

    it('throws 404 TEMPLATE_NOT_FOUND for cross-tenant template', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.findById(TEMPLATE_ID, OTHER_TENANT_ID)).rejects.toThrow(
        NotFoundException,
      )
      await expect(service.findById(TEMPLATE_ID, OTHER_TENANT_ID)).rejects.toMatchObject({
        response: { code: 'TEMPLATE_NOT_FOUND' },
      })
    })
  })

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a template and returns dto', async () => {
      const row = makeTemplateRow({ name: 'New Template' })
      mockRepo.create.mockResolvedValue(row)

      const result = await service.create(
        TENANT_ID,
        { name: 'New Template', schema: MINIMAL_SCHEMA },
        'user-1',
      )

      expect(result.name).toBe('New Template')
      expect(result.tenantId).toBe(TENANT_ID)
      expect(result.isLocked).toBe(false)
    })

    it('calls repo.create with correct tenantId and userId', async () => {
      const row = makeTemplateRow()
      mockRepo.create.mockResolvedValue(row)
      await service.create(TENANT_ID, { name: 'T', schema: MINIMAL_SCHEMA }, 'user-99')
      expect(mockRepo.create).toHaveBeenCalledWith(
        TENANT_ID,
        expect.objectContaining({ name: 'T' }),
        'user-99',
      )
    })
  })

  // ── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('renames a template', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow({ name: 'Old Name' }))
      mockRepo.update.mockResolvedValue(makeTemplateRow({ name: 'New Name' }))

      const result = await service.update(TEMPLATE_ID, TENANT_ID, { name: 'New Name' })
      expect(result.name).toBe('New Name')
    })

    it('succeeds even when template has existing types (locking removed in schema reset v2)', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow())
      mockRepo.update.mockResolvedValue(makeTemplateRow({ name: 'Updated' }))

      const result = await service.update(TEMPLATE_ID, TENANT_ID, { name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('throws 404 TEMPLATE_NOT_FOUND for cross-tenant template', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.update(TEMPLATE_ID, OTHER_TENANT_ID, { name: 'Stolen' }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  // ── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes a template', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow())
      mockRepo.softDelete.mockResolvedValue(undefined)

      await service.delete(TEMPLATE_ID, TENANT_ID)
      expect(mockRepo.softDelete).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_ID)
    })

    it('succeeds even when template has existing types (locking removed in schema reset v2)', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow())
      mockRepo.softDelete.mockResolvedValue(undefined)

      await service.delete(TEMPLATE_ID, TENANT_ID)
      expect(mockRepo.softDelete).toHaveBeenCalled()
    })

    it('throws 404 TEMPLATE_NOT_FOUND for cross-tenant template', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.delete(TEMPLATE_ID, OTHER_TENANT_ID)).rejects.toThrow(NotFoundException)
    })
  })

  // ── isLocked always false (schema reset v2) ───────────────────────────────

  describe('isLocked flag in list response', () => {
    it('isLocked=false for all templates (ProtocolType removed, deferred to Plan 02)', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([
        makeTemplateRow({ name: 'Template A' }),
        makeTemplateRow({ id: 'tmpl-2', name: 'Template B' }),
      ])
      const result = await service.getTemplates(TENANT_ID)
      expect(result.every((t) => t.isLocked === false)).toBe(true)
    })
  })
})
