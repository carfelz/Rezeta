import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ProtocolTemplatesService } from '../protocol-templates.service.js'

// ProtocolType removed in schema reset v2 (Plan 01).
// Templates are freely editable; seeded templates cannot be deleted (Plan 02).

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
  findAll: vi.fn(),
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
      mockRepo.findAll.mockResolvedValue([])
      const result = await service.getTemplates(TENANT_ID)
      expect(result).toEqual([])
      expect(mockRepo.findAll).toHaveBeenCalledWith(TENANT_ID)
    })

    it('returns only this tenant templates (cross-tenant via tenantId)', async () => {
      mockRepo.findAll.mockResolvedValue([
        makeTemplateRow({ name: 'Template A', isSeeded: true }),
        makeTemplateRow({ id: 'tmpl-2', name: 'Template B', isSeeded: false }),
      ])
      const result = await service.getTemplates(TENANT_ID)
      expect(result).toHaveLength(2)
      expect(result.every((t) => t.tenantId === TENANT_ID)).toBe(true)
    })

    it('maps template fields correctly (ProtocolType removed in schema reset v2)', async () => {
      mockRepo.findAll.mockResolvedValue([makeTemplateRow()])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.id).toBe(TEMPLATE_ID)
      expect(t!.tenantId).toBe(TENANT_ID)
    })

    it('returns template with correct name and schema', async () => {
      mockRepo.findAll.mockResolvedValue([makeTemplateRow({ name: 'My Template' })])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.name).toBe('My Template')
      expect(t!.schema).toEqual(MINIMAL_SCHEMA)
    })
  })

  // ── findById ───────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns template with correct fields', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow())
      const t = await service.findById(TEMPLATE_ID, TENANT_ID)
      expect(t.id).toBe(TEMPLATE_ID)
      expect(t.name).toBe('Fetch Me')
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
    it('soft-deletes a non-seeded template', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow({ isSeeded: false }))
      mockRepo.softDelete.mockResolvedValue(undefined)

      await service.delete(TEMPLATE_ID, TENANT_ID)
      expect(mockRepo.softDelete).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_ID)
    })

    it('throws BadRequestException when deleting a seeded template', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow({ isSeeded: true }))
      await expect(service.delete(TEMPLATE_ID, TENANT_ID)).rejects.toThrow(BadRequestException)
      expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })

    it('update does not throw when template is referenced by protocols', async () => {
      mockRepo.findById.mockResolvedValue(makeTemplateRow())
      mockRepo.update.mockResolvedValue(makeTemplateRow({ name: 'Updated' }))
      await expect(service.update(TEMPLATE_ID, TENANT_ID, { name: 'Updated' })).resolves.not.toThrow()
    })

    it('throws 404 TEMPLATE_NOT_FOUND for cross-tenant template', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.delete(TEMPLATE_ID, OTHER_TENANT_ID)).rejects.toThrow(NotFoundException)
    })
  })

  // ── list returns correct fields (schema reset v2 — Plan 02) ────────────────

  describe('template list response fields', () => {
    it('returns all templates with correct isSeeded values', async () => {
      mockRepo.findAll.mockResolvedValue([
        makeTemplateRow({ name: 'Template A', isSeeded: true }),
        makeTemplateRow({ id: 'tmpl-2', name: 'Template B', isSeeded: false }),
      ])
      const result = await service.getTemplates(TENANT_ID)
      expect(result[0]!.isSeeded).toBe(true)
      expect(result[1]!.isSeeded).toBe(false)
    })
  })
})
