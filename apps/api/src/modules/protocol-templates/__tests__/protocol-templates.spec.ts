import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { ProtocolTemplatesService } from '../protocol-templates.service.js'

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
  protocolTypes: [] as { id: string }[],
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

    it('maps isLocked=false and blockingTypeIds=[] when no types reference template', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([makeTemplateRow({ protocolTypes: [] })])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.isLocked).toBe(false)
      expect(t!.blockingTypeIds).toEqual([])
    })

    it('maps isLocked=true and blockingTypeIds when types reference template', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([
        makeTemplateRow({ protocolTypes: [{ id: 'type-a' }] }),
      ])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.isLocked).toBe(true)
      expect(t!.blockingTypeIds).toHaveLength(1)
      expect(Array.isArray(t!.blockingTypeIds)).toBe(true)
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
      expect(result.blockingTypeIds).toEqual([])
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

    it('throws 409 TEMPLATE_LOCKED when type references it', async () => {
      mockRepo.findById.mockResolvedValue(
        makeTemplateRow({ protocolTypes: [{ id: 'type-blocking' }] }),
      )

      await expect(service.update(TEMPLATE_ID, TENANT_ID, { name: 'New Name' })).rejects.toThrow(
        ConflictException,
      )
      const err = await service
        .update(TEMPLATE_ID, TENANT_ID, { name: 'x' })
        .catch((e: { response: unknown }) => e)
      expect((err as { response: { code: string; blockingTypeIds: string[] } }).response.code).toBe(
        'TEMPLATE_LOCKED',
      )
      expect(
        (err as { response: { code: string; blockingTypeIds: string[] } }).response.blockingTypeIds,
      ).toContain('type-blocking')
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
      mockRepo.findById.mockResolvedValue(makeTemplateRow({ protocolTypes: [] }))
      mockRepo.softDelete.mockResolvedValue(undefined)

      await service.delete(TEMPLATE_ID, TENANT_ID)
      expect(mockRepo.softDelete).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_ID)
    })

    it('throws 409 TEMPLATE_LOCKED when type references it', async () => {
      mockRepo.findById.mockResolvedValue(
        makeTemplateRow({ protocolTypes: [{ id: 'type-locking' }] }),
      )

      await expect(service.delete(TEMPLATE_ID, TENANT_ID)).rejects.toThrow(ConflictException)
      await expect(service.delete(TEMPLATE_ID, TENANT_ID)).rejects.toMatchObject({
        response: { code: 'TEMPLATE_LOCKED' },
      })
      expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })

    it('throws 404 TEMPLATE_NOT_FOUND for cross-tenant template', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.delete(TEMPLATE_ID, OTHER_TENANT_ID)).rejects.toThrow(NotFoundException)
    })
  })

  // ── isLocked flag in list response ─────────────────────────────────────────

  describe('isLocked flag in list response', () => {
    it('isLocked=true when a type references template, with correct blockingTypeIds', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([
        makeTemplateRow({ name: 'Will Be Locked', protocolTypes: [{ id: 'type-lock-1' }] }),
      ])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.isLocked).toBe(true)
      expect(t!.blockingTypeIds).toHaveLength(1)
      expect(t!.blockingTypeIds).toContain('type-lock-1')
    })

    it('isLocked=false when no types reference template', async () => {
      mockRepo.findAllWithLockInfo.mockResolvedValue([makeTemplateRow({ protocolTypes: [] })])
      const [t] = await service.getTemplates(TENANT_ID)
      expect(t!.isLocked).toBe(false)
      expect(t!.blockingTypeIds).toEqual([])
    })
  })
})
