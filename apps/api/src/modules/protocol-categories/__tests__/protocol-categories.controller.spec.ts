import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolCategoriesController } from '../protocol-categories.controller.js'
import type { ProtocolCategoriesService } from '../protocol-categories.service.js'

const mockService = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}

const makeController = () =>
  new ProtocolCategoriesController(mockService as unknown as ProtocolCategoriesService)

describe('ProtocolCategoriesController', () => {
  let controller: ProtocolCategoriesController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = makeController()
  })

  it('findAll delegates to service with tenantId', async () => {
    mockService.findAll.mockResolvedValue([{ id: 'c1' }])
    const result = await controller.findAll('t1')
    expect(mockService.findAll).toHaveBeenCalledWith('t1')
    expect(result).toEqual([{ id: 'c1' }])
  })

  it('findOne delegates to service', async () => {
    mockService.findById.mockResolvedValue({ id: 'c1' })
    const result = await controller.findOne('t1', 'c1')
    expect(mockService.findById).toHaveBeenCalledWith('t1', 'c1')
    expect(result).toEqual({ id: 'c1' })
  })

  it('create delegates to service with the validated body', async () => {
    const dto = { name: 'Emergencias', color: '#EF4444' }
    mockService.create.mockResolvedValue({ id: 'c1', ...dto })
    const result = await controller.create('t1', dto)
    expect(mockService.create).toHaveBeenCalledWith('t1', dto)
    expect(result).toEqual({ id: 'c1', ...dto })
  })

  it('update delegates to service', async () => {
    const dto = { name: 'Renamed' }
    mockService.update.mockResolvedValue({ id: 'c1', name: 'Renamed' })
    const result = await controller.update('t1', 'c1', dto)
    expect(mockService.update).toHaveBeenCalledWith('t1', 'c1', dto)
    expect(result.name).toBe('Renamed')
  })

  it('delete delegates to service and resolves void', async () => {
    mockService.delete.mockResolvedValue({ id: 'c1' })
    await expect(controller.delete('t1', 'c1')).resolves.toBeUndefined()
    expect(mockService.delete).toHaveBeenCalledWith('t1', 'c1')
  })
})
