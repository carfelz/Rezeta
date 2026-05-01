import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolTypesController } from '../protocol-types.controller.js'

const TENANT_ID = 'tenant-1'
const TYPE_ID = 'type-1'
const TEMPLATE_ID = 'tmpl-1'

const mockService = {
  getTypes: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const typeDto = {
  id: TYPE_ID,
  tenantId: TENANT_ID,
  name: 'Emergencia',
  templateId: TEMPLATE_ID,
  templateName: 'Intervención de emergencia',
  isSeeded: false,
  isLocked: false,
  protocolCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('ProtocolTypesController', () => {
  let controller: ProtocolTypesController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new ProtocolTypesController(mockService as never)
  })

  // ── getTypes ───────────────────────────────────────────────────────────────

  it('getTypes: delegates to service.getTypes with tenantId', async () => {
    mockService.getTypes.mockResolvedValue([typeDto])
    const result = await controller.getTypes(TENANT_ID)
    expect(mockService.getTypes).toHaveBeenCalledWith(TENANT_ID)
    expect(result).toEqual([typeDto])
  })

  it('getTypes: returns empty array when no types', async () => {
    mockService.getTypes.mockResolvedValue([])
    const result = await controller.getTypes(TENANT_ID)
    expect(result).toEqual([])
  })

  // ── getType ────────────────────────────────────────────────────────────────

  it('getType: delegates to service.findById with id and tenantId', async () => {
    mockService.findById.mockResolvedValue(typeDto)
    const result = await controller.getType(TYPE_ID, TENANT_ID)
    expect(mockService.findById).toHaveBeenCalledWith(TYPE_ID, TENANT_ID)
    expect(result).toEqual(typeDto)
  })

  it('getType: propagates NotFoundException from service', async () => {
    mockService.findById.mockRejectedValue(new Error('Not found'))
    await expect(controller.getType('bad-id', TENANT_ID)).rejects.toThrow('Not found')
  })

  // ── createType ─────────────────────────────────────────────────────────────

  it('createType: delegates to service.create with tenantId and dto', async () => {
    const dto = { name: 'Emergencia', templateId: TEMPLATE_ID }
    mockService.create.mockResolvedValue(typeDto)
    const result = await controller.createType(dto, TENANT_ID)
    expect(mockService.create).toHaveBeenCalledWith(TENANT_ID, dto)
    expect(result).toEqual(typeDto)
  })

  it('createType: propagates TYPE_NAME_CONFLICT from service', async () => {
    mockService.create.mockRejectedValue(new Error('Conflict'))
    await expect(
      controller.createType({ name: 'Duplicate', templateId: TEMPLATE_ID }, TENANT_ID),
    ).rejects.toThrow('Conflict')
  })

  // ── updateType ─────────────────────────────────────────────────────────────

  it('updateType: delegates to service.update with id, tenantId, dto', async () => {
    const dto = { name: 'Urgencias' }
    mockService.update.mockResolvedValue({ ...typeDto, name: 'Urgencias' })
    const result = await controller.updateType(TYPE_ID, dto, TENANT_ID)
    expect(mockService.update).toHaveBeenCalledWith(TYPE_ID, TENANT_ID, dto)
    expect(result.name).toBe('Urgencias')
  })

  it('updateType: propagates service errors', async () => {
    mockService.update.mockRejectedValue(new Error('Not found'))
    await expect(controller.updateType(TYPE_ID, { name: 'X' }, TENANT_ID)).rejects.toThrow(
      'Not found',
    )
  })

  // ── deleteType ─────────────────────────────────────────────────────────────

  it('deleteType: delegates to service.delete with id and tenantId', async () => {
    mockService.delete.mockResolvedValue(undefined)
    await controller.deleteType(TYPE_ID, TENANT_ID)
    expect(mockService.delete).toHaveBeenCalledWith(TYPE_ID, TENANT_ID)
  })

  it('deleteType: propagates TYPE_LOCKED from service', async () => {
    mockService.delete.mockRejectedValue(new Error('Locked'))
    await expect(controller.deleteType(TYPE_ID, TENANT_ID)).rejects.toThrow('Locked')
  })

  it('deleteType: returns undefined on success', async () => {
    mockService.delete.mockResolvedValue(undefined)
    const result = await controller.deleteType(TYPE_ID, TENANT_ID)
    expect(result).toBeUndefined()
  })
})
