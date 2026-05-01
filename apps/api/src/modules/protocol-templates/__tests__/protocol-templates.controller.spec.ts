import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolTemplatesController } from '../protocol-templates.controller.js'

const TENANT_ID = 'tenant-1'
const TEMPLATE_ID = 'tmpl-1'
const MINIMAL_SCHEMA = { version: '1.0', blocks: [] }

const mockService = {
  getTemplates: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const user = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: TENANT_ID,
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner' as const,
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
}

const templateDto = {
  id: TEMPLATE_ID,
  tenantId: TENANT_ID,
  name: 'Intervención de emergencia',
  description: null,
  suggestedSpecialty: null,
  schema: MINIMAL_SCHEMA,
  isSeeded: false,
  isLocked: false,
  blockingTypeIds: [] as string[],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  createdBy: 'u1',
}

describe('ProtocolTemplatesController', () => {
  let controller: ProtocolTemplatesController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new ProtocolTemplatesController(mockService as never)
  })

  // ── getTemplates ───────────────────────────────────────────────────────────

  it('getTemplates: delegates to service.getTemplates with tenantId', async () => {
    mockService.getTemplates.mockResolvedValue([templateDto])
    const result = await controller.getTemplates(TENANT_ID)
    expect(mockService.getTemplates).toHaveBeenCalledWith(TENANT_ID)
    expect(result).toEqual([templateDto])
  })

  it('getTemplates: returns empty array when no templates', async () => {
    mockService.getTemplates.mockResolvedValue([])
    const result = await controller.getTemplates(TENANT_ID)
    expect(result).toEqual([])
  })

  // ── getTemplate ────────────────────────────────────────────────────────────

  it('getTemplate: delegates to service.findById with id and tenantId', async () => {
    mockService.findById.mockResolvedValue(templateDto)
    const result = await controller.getTemplate(TEMPLATE_ID, TENANT_ID)
    expect(mockService.findById).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_ID)
    expect(result).toEqual(templateDto)
  })

  it('getTemplate: propagates NotFoundException from service', async () => {
    mockService.findById.mockRejectedValue(new Error('Not found'))
    await expect(controller.getTemplate('bad-id', TENANT_ID)).rejects.toThrow('Not found')
  })

  // ── createTemplate ─────────────────────────────────────────────────────────

  it('createTemplate: delegates to service.create with tenantId and userId', async () => {
    const dto = { name: 'My Template', schema: MINIMAL_SCHEMA }
    mockService.create.mockResolvedValue(templateDto)
    const result = await controller.createTemplate(dto, TENANT_ID, user)
    expect(mockService.create).toHaveBeenCalledWith(TENANT_ID, dto, user.id)
    expect(result).toEqual(templateDto)
  })

  it('createTemplate: propagates service errors', async () => {
    mockService.create.mockRejectedValue(new Error('Conflict'))
    await expect(
      controller.createTemplate({ name: 'T', schema: MINIMAL_SCHEMA }, TENANT_ID, user),
    ).rejects.toThrow('Conflict')
  })

  // ── updateTemplate ─────────────────────────────────────────────────────────

  it('updateTemplate: delegates to service.update with id, tenantId, dto', async () => {
    const dto = { name: 'Updated Name' }
    mockService.update.mockResolvedValue({ ...templateDto, name: 'Updated Name' })
    const result = await controller.updateTemplate(TEMPLATE_ID, dto, TENANT_ID)
    expect(mockService.update).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_ID, dto)
    expect(result.name).toBe('Updated Name')
  })

  it('updateTemplate: propagates TEMPLATE_LOCKED from service', async () => {
    mockService.update.mockRejectedValue(new Error('Locked'))
    await expect(controller.updateTemplate(TEMPLATE_ID, { name: 'X' }, TENANT_ID)).rejects.toThrow(
      'Locked',
    )
  })

  // ── deleteTemplate ─────────────────────────────────────────────────────────

  it('deleteTemplate: delegates to service.delete with id and tenantId', async () => {
    mockService.delete.mockResolvedValue(undefined)
    await controller.deleteTemplate(TEMPLATE_ID, TENANT_ID)
    expect(mockService.delete).toHaveBeenCalledWith(TEMPLATE_ID, TENANT_ID)
  })

  it('deleteTemplate: propagates TEMPLATE_LOCKED from service', async () => {
    mockService.delete.mockRejectedValue(new Error('Locked'))
    await expect(controller.deleteTemplate(TEMPLATE_ID, TENANT_ID)).rejects.toThrow('Locked')
  })

  it('deleteTemplate: returns undefined on success', async () => {
    mockService.delete.mockResolvedValue(undefined)
    const result = await controller.deleteTemplate(TEMPLATE_ID, TENANT_ID)
    expect(result).toBeUndefined()
  })
})
