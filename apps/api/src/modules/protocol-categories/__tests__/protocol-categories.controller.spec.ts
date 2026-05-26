import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolCategoriesController } from '../protocol-categories.controller.js'

const mockService = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const cat = {
  id: 'cat-1',
  tenantId: 'tenant-1',
  name: 'Emergencias',
  color: '#EF4444',
  isSeeded: false,
  deletedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

describe('ProtocolCategoriesController', () => {
  let controller: ProtocolCategoriesController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new ProtocolCategoriesController(mockService as never)
  })

  it('findAll: delegates to service.findAll', async () => {
    mockService.findAll.mockResolvedValue([cat])
    const result = await controller.findAll('tenant-1')
    expect(mockService.findAll).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual([cat])
  })

  it('findOne: delegates to service.findById', async () => {
    mockService.findById.mockResolvedValue(cat)
    const result = await controller.findOne('tenant-1', 'cat-1')
    expect(mockService.findById).toHaveBeenCalledWith('tenant-1', 'cat-1')
    expect(result).toEqual(cat)
  })

  it('create: delegates to service.create', async () => {
    mockService.create.mockResolvedValue(cat)
    const dto = { name: 'Emergencias', color: '#EF4444' }
    const result = await controller.create('tenant-1', dto)
    expect(mockService.create).toHaveBeenCalledWith('tenant-1', dto)
    expect(result).toEqual(cat)
  })

  it('update: delegates to service.update', async () => {
    const updated = { ...cat, name: 'Urgencias' }
    mockService.update.mockResolvedValue(updated)
    const result = await controller.update('tenant-1', 'cat-1', { name: 'Urgencias' })
    expect(mockService.update).toHaveBeenCalledWith('tenant-1', 'cat-1', { name: 'Urgencias' })
    expect(result).toEqual(updated)
  })

  it('delete: delegates to service.delete', async () => {
    const deleted = { ...cat, deletedAt: new Date() }
    mockService.delete.mockResolvedValue(deleted)
    const result = await controller.delete('tenant-1', 'cat-1')
    expect(mockService.delete).toHaveBeenCalledWith('tenant-1', 'cat-1')
    expect(result).toEqual(deleted)
  })
})
