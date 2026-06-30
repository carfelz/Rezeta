import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import { ProtocolCategoriesService } from '../protocol-categories.service.js'
import type { ProtocolCategoriesRepository } from '../protocol-categories.repository.js'

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  countTemplates: vi.fn(),
}

const makeService = () =>
  new ProtocolCategoriesService(mockRepo as unknown as ProtocolCategoriesRepository)

describe('ProtocolCategoriesService', () => {
  let service: ProtocolCategoriesService

  beforeEach(() => {
    vi.clearAllMocks()
    service = makeService()
  })

  it('findAll delegates to repository', async () => {
    mockRepo.findAll.mockResolvedValue([])
    const result = await service.findAll('tenant-1')
    expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual([])
  })

  it('findById returns the category when found', async () => {
    const cat = { id: 'cat-1', tenantId: 'tenant-1', name: 'Emergencias' }
    mockRepo.findById.mockResolvedValue(cat)
    await expect(service.findById('tenant-1', 'cat-1')).resolves.toEqual(cat)
    expect(mockRepo.findById).toHaveBeenCalledWith('tenant-1', 'cat-1')
  })

  it('findById throws NotFound when missing', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(service.findById('tenant-1', 'nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('create returns new category', async () => {
    const created = {
      id: 'cat-1',
      tenantId: 'tenant-1',
      name: 'Emergencias',
      color: '#EF4444',
      isSeeded: false,
    }
    mockRepo.create.mockResolvedValue(created)
    const result = await service.create('tenant-1', { name: 'Emergencias', color: '#EF4444' })
    expect(mockRepo.create).toHaveBeenCalledWith('tenant-1', {
      name: 'Emergencias',
      color: '#EF4444',
    })
    expect(result).toEqual(created)
  })

  it('update checks existence then delegates', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: false })
    mockRepo.update.mockResolvedValue({ id: 'cat-1', name: 'Renamed' })
    const result = await service.update('tenant-1', 'cat-1', { name: 'Renamed' })
    expect(mockRepo.update).toHaveBeenCalledWith('cat-1', { name: 'Renamed' })
    expect(result.name).toBe('Renamed')
  })

  it('update throws NotFound when category missing', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(service.update('tenant-1', 'cat-1', { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('delete soft-deletes a non-seeded category', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: false })
    mockRepo.countTemplates.mockResolvedValue(0)
    mockRepo.softDelete.mockResolvedValue({ id: 'cat-1', deletedAt: new Date() })
    await service.delete('tenant-1', 'cat-1')
    expect(mockRepo.softDelete).toHaveBeenCalledWith('cat-1')
  })

  it('delete throws if category is seeded', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: true })
    await expect(service.delete('tenant-1', 'cat-1')).rejects.toBeInstanceOf(BadRequestException)
    expect(mockRepo.softDelete).not.toHaveBeenCalled()
  })

  it('blocks deletion when active templates reference the category', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: false })
    mockRepo.countTemplates.mockResolvedValue(2)
    await expect(service.delete('tenant', 'cat-1')).rejects.toMatchObject({
      response: { code: ErrorCode.CATEGORY_IN_USE_BY_TEMPLATES, details: { count: 2 } },
    })
    expect(mockRepo.softDelete).not.toHaveBeenCalled()
  })

  it('deletes when no templates reference the category', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: false })
    mockRepo.countTemplates.mockResolvedValue(0)
    mockRepo.softDelete.mockResolvedValue({ id: 'cat-1' })
    await expect(service.delete('tenant', 'cat-1')).resolves.toEqual({ id: 'cat-1' })
  })
})
