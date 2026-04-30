import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ConflictException } from '@nestjs/common'
import { LocationsService } from '../locations.service.js'

const mockRepo = {
  findMany: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  hasFutureAppointments: vi.fn(),
  softDelete: vi.fn(),
}

const location = { id: 'loc1', tenantId: 't1', name: 'Clínica Central' }

describe('LocationsService', () => {
  let service: LocationsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new LocationsService(mockRepo as never)
  })

  describe('list', () => {
    it('returns locations from repo', async () => {
      mockRepo.findMany.mockResolvedValue([location])
      const result = await service.list('t1')
      expect(result).toEqual([location])
      expect(mockRepo.findMany).toHaveBeenCalledWith('t1')
    })
  })

  describe('getById', () => {
    it('returns location when found', async () => {
      mockRepo.findById.mockResolvedValue(location)
      const result = await service.getById('loc1', 't1')
      expect(result).toEqual(location)
    })

    it('throws NotFoundException when location not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getById('missing', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('delegates to repo and returns created location', async () => {
      const dto = { name: 'New Clinic', address: '123 Main' }
      mockRepo.create.mockResolvedValue(location)
      const result = await service.create('t1', 'u1', dto as never)
      expect(result).toEqual(location)
      expect(mockRepo.create).toHaveBeenCalledWith('t1', 'u1', dto)
    })
  })

  describe('update', () => {
    it('updates location when found', async () => {
      const dto = { name: 'Updated' }
      const updated = { ...location, name: 'Updated' }
      mockRepo.findById.mockResolvedValue(location)
      mockRepo.update.mockResolvedValue(updated)
      const result = await service.update('loc1', 't1', dto as never)
      expect(result).toEqual(updated)
      expect(mockRepo.update).toHaveBeenCalledWith('loc1', 't1', dto)
    })

    it('throws NotFoundException when location not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.update('missing', 't1', {} as never)).rejects.toThrow(NotFoundException)
    })
  })

  describe('remove', () => {
    it('soft-deletes when found and no future appointments', async () => {
      mockRepo.findById.mockResolvedValue(location)
      mockRepo.hasFutureAppointments.mockResolvedValue(false)
      await service.remove('loc1', 't1')
      expect(mockRepo.softDelete).toHaveBeenCalledWith('loc1', 't1')
    })

    it('throws NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.remove('missing', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException when location has future appointments', async () => {
      mockRepo.findById.mockResolvedValue(location)
      mockRepo.hasFutureAppointments.mockResolvedValue(true)
      await expect(service.remove('loc1', 't1')).rejects.toThrow(ConflictException)
      expect(mockRepo.softDelete).not.toHaveBeenCalled()
    })
  })
})
