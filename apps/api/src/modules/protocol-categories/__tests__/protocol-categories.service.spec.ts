import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProtocolCategoriesService } from '../protocol-categories.service.js'
import type { ProtocolCategoriesRepository } from '../protocol-categories.repository.js'

const mockRepo = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}

describe('ProtocolCategoriesService', () => {
  let service: ProtocolCategoriesService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProtocolCategoriesService(mockRepo as unknown as ProtocolCategoriesRepository)
  })

  it('findAll delegates to repository', async () => {
    mockRepo.findAll.mockResolvedValue([])
    const result = await service.findAll('tenant-1')
    expect(mockRepo.findAll).toHaveBeenCalledWith('tenant-1')
    expect(result).toEqual([])
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
    expect(result).toEqual(created)
  })

  it('softDelete throws if category is seeded', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'cat-1', isSeeded: true })
    await expect(service.delete('tenant-1', 'cat-1')).rejects.toThrow('Cannot delete a seeded category')
  })

  it('findById throws NotFoundException when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(service.findById('tenant-1', 'cat-999')).rejects.toThrow('Protocol category cat-999 not found')
  })

  it('delete throws NotFoundException when category does not exist', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(service.delete('tenant-1', 'cat-999')).rejects.toThrow('Protocol category cat-999 not found')
  })

  it('update delegates to repository after finding category', async () => {
    const existing = { id: 'cat-1', tenantId: 'tenant-1', name: 'Old', isSeeded: false }
    const updated = { ...existing, name: 'New' }
    mockRepo.findById.mockResolvedValue(existing)
    mockRepo.update.mockResolvedValue(updated)
    const result = await service.update('tenant-1', 'cat-1', { name: 'New' })
    expect(mockRepo.update).toHaveBeenCalledWith('tenant-1', 'cat-1', { name: 'New' })
    expect(result).toEqual(updated)
  })

  it('delete soft-deletes a non-seeded category', async () => {
    const existing = { id: 'cat-1', tenantId: 'tenant-1', name: 'Emergencias', isSeeded: false }
    const deleted = { ...existing, deletedAt: new Date() }
    mockRepo.findById.mockResolvedValue(existing)
    mockRepo.softDelete.mockResolvedValue(deleted)
    const result = await service.delete('tenant-1', 'cat-1')
    expect(mockRepo.softDelete).toHaveBeenCalledWith('tenant-1', 'cat-1')
    expect(result).toEqual(deleted)
  })

  it('findById returns category when found', async () => {
    const cat = { id: 'cat-1', tenantId: 'tenant-1', name: 'Emergencias', isSeeded: false }
    mockRepo.findById.mockResolvedValue(cat)
    const result = await service.findById('tenant-1', 'cat-1')
    expect(result).toEqual(cat)
  })
})
