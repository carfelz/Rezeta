/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { SchedulesService } from '../schedules.service.js'
import type { SchedulesRepository } from '../schedules.repository.js'
import type { ScheduleBlock, ScheduleException } from '@rezeta/shared'

function makeBlock(overrides: Partial<ScheduleBlock> = {}): ScheduleBlock {
  return {
    id: 'block-1',
    userId: 'user-1',
    locationId: 'loc-1',
    locationName: 'Centro Médico Real',
    dayOfWeek: 1,
    startTime: '08:00:00',
    endTime: '12:00:00',
    slotDurationMin: 30,
    createdAt: new Date('2026-01-01').toISOString(),
    ...overrides,
  }
}

function makeException(overrides: Partial<ScheduleException> = {}): ScheduleException {
  return {
    id: 'exc-1',
    userId: 'user-1',
    locationId: 'loc-1',
    locationName: 'Centro Médico Real',
    date: '2026-05-15',
    type: 'blocked',
    startTime: null,
    endTime: null,
    reason: null,
    createdAt: new Date('2026-01-01').toISOString(),
    ...overrides,
  }
}

describe('SchedulesService', () => {
  let repo: SchedulesRepository
  let service: SchedulesService

  beforeEach(() => {
    repo = {
      findManyBlocks: vi.fn(),
      findBlockById: vi.fn(),
      createBlock: vi.fn(),
      updateBlock: vi.fn(),
      deleteBlock: vi.fn(),
      findOverlappingBlocks: vi.fn(),
      findManyExceptions: vi.fn(),
      findExceptionById: vi.fn(),
      createException: vi.fn(),
      updateException: vi.fn(),
      deleteException: vi.fn(),
    } as unknown as SchedulesRepository

    service = new SchedulesService(repo)
  })

  // ── Blocks ───────────────────────────────────────────────────────────────────

  describe('listBlocks', () => {
    it('delegates to repo.findManyBlocks', async () => {
      const blocks = [makeBlock()]
      vi.mocked(repo.findManyBlocks).mockResolvedValue(blocks)

      const result = await service.listBlocks({ userId: 'user-1' })

      expect(repo.findManyBlocks).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(result).toEqual(blocks)
    })

    it('passes locationId filter when provided', async () => {
      vi.mocked(repo.findManyBlocks).mockResolvedValue([])

      await service.listBlocks({ userId: 'user-1', locationId: 'loc-2' })

      expect(repo.findManyBlocks).toHaveBeenCalledWith({ userId: 'user-1', locationId: 'loc-2' })
    })
  })

  describe('createBlock', () => {
    const dto = {
      locationId: 'loc-1',
      dayOfWeek: 1,
      startTime: '08:00:00',
      endTime: '12:00:00',
      slotDurationMin: 30,
    }

    it('creates a block when valid and no overlap', async () => {
      vi.mocked(repo.findOverlappingBlocks).mockResolvedValue([])
      const created = makeBlock()
      vi.mocked(repo.createBlock).mockResolvedValue(created)

      const result = await service.createBlock('user-1', dto)

      expect(repo.findOverlappingBlocks).toHaveBeenCalledWith({
        userId: 'user-1',
        locationId: dto.locationId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
      })
      expect(repo.createBlock).toHaveBeenCalledWith('user-1', dto)
      expect(result).toEqual(created)
    })

    it('throws SCHEDULE_BLOCK_TIME_INVALID when startTime >= endTime', async () => {
      await expect(
        service.createBlock('user-1', { ...dto, startTime: '12:00:00', endTime: '08:00:00' }),
      ).rejects.toThrow(BadRequestException)

      await expect(
        service.createBlock('user-1', { ...dto, startTime: '10:00:00', endTime: '10:00:00' }),
      ).rejects.toThrow(BadRequestException)

      expect(repo.findOverlappingBlocks).not.toHaveBeenCalled()
    })

    it('throws SCHEDULE_BLOCK_OVERLAP when overlapping block exists', async () => {
      vi.mocked(repo.findOverlappingBlocks).mockResolvedValue([makeBlock()])

      await expect(service.createBlock('user-1', dto)).rejects.toThrow(ConflictException)
      expect(repo.createBlock).not.toHaveBeenCalled()
    })
  })

  describe('updateBlock', () => {
    const existing = makeBlock()
    const dto = { endTime: '13:00:00' }

    it('updates a block when valid and no overlap', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(existing)
      vi.mocked(repo.findOverlappingBlocks).mockResolvedValue([])
      const updated = makeBlock({ endTime: '13:00:00' })
      vi.mocked(repo.updateBlock).mockResolvedValue(updated)

      const result = await service.updateBlock('block-1', 'user-1', dto)

      expect(repo.findBlockById).toHaveBeenCalledWith('block-1', 'user-1')
      expect(repo.findOverlappingBlocks).toHaveBeenCalledWith(
        expect.objectContaining({ excludeId: 'block-1' }),
      )
      expect(result).toEqual(updated)
    })

    it('throws NOT_FOUND when block does not belong to user', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(null)

      await expect(service.updateBlock('block-1', 'user-2', dto)).rejects.toThrow(NotFoundException)
      expect(repo.updateBlock).not.toHaveBeenCalled()
    })

    it('excludes self from overlap check', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(existing)
      vi.mocked(repo.findOverlappingBlocks).mockResolvedValue([])
      vi.mocked(repo.updateBlock).mockResolvedValue(makeBlock())

      await service.updateBlock('block-1', 'user-1', dto)

      expect(repo.findOverlappingBlocks).toHaveBeenCalledWith(
        expect.objectContaining({ excludeId: 'block-1' }),
      )
    })

    it('throws TIME_INVALID when merged times are invalid', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(existing)

      await expect(
        service.updateBlock('block-1', 'user-1', { startTime: '14:00:00', endTime: '08:00:00' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws OVERLAP when updated block conflicts', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(existing)
      vi.mocked(repo.findOverlappingBlocks).mockResolvedValue([makeBlock({ id: 'block-2' })])

      await expect(service.updateBlock('block-1', 'user-1', dto)).rejects.toThrow(ConflictException)
      expect(repo.updateBlock).not.toHaveBeenCalled()
    })
  })

  describe('deleteBlock', () => {
    it('deletes an existing block', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(makeBlock())
      vi.mocked(repo.deleteBlock).mockResolvedValue()

      await service.deleteBlock('block-1', 'user-1')

      expect(repo.deleteBlock).toHaveBeenCalledWith('block-1', 'user-1')
    })

    it('throws NOT_FOUND when block does not exist for user', async () => {
      vi.mocked(repo.findBlockById).mockResolvedValue(null)

      await expect(service.deleteBlock('block-1', 'user-2')).rejects.toThrow(NotFoundException)
      expect(repo.deleteBlock).not.toHaveBeenCalled()
    })
  })

  // ── Exceptions ───────────────────────────────────────────────────────────────

  describe('listExceptions', () => {
    it('delegates to repo.findManyExceptions', async () => {
      const exceptions = [makeException()]
      vi.mocked(repo.findManyExceptions).mockResolvedValue(exceptions)

      const result = await service.listExceptions({ userId: 'user-1' })

      expect(repo.findManyExceptions).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(result).toEqual(exceptions)
    })
  })

  describe('createException', () => {
    it('creates a full-day blocked exception', async () => {
      const dto = { locationId: 'loc-1', date: '2026-05-15', type: 'blocked' as const }
      const created = makeException()
      vi.mocked(repo.createException).mockResolvedValue(created)

      const result = await service.createException('user-1', dto)

      expect(repo.createException).toHaveBeenCalledWith('user-1', dto)
      expect(result).toEqual(created)
    })

    it('creates an exception with valid time range', async () => {
      const dto = {
        locationId: 'loc-1',
        date: '2026-05-15',
        type: 'available' as const,
        startTime: '09:00:00',
        endTime: '13:00:00',
      }
      const created = makeException(dto)
      vi.mocked(repo.createException).mockResolvedValue(created)

      await service.createException('user-1', dto)

      expect(repo.createException).toHaveBeenCalledWith('user-1', dto)
    })

    it('throws TIME_INVALID when only startTime provided', async () => {
      const dto = {
        locationId: 'loc-1',
        date: '2026-05-15',
        type: 'available' as const,
        startTime: '09:00:00',
      }

      await expect(service.createException('user-1', dto)).rejects.toThrow(BadRequestException)
      expect(repo.createException).not.toHaveBeenCalled()
    })

    it('throws TIME_INVALID when only endTime provided', async () => {
      const dto = {
        locationId: 'loc-1',
        date: '2026-05-15',
        type: 'available' as const,
        endTime: '13:00:00',
      }

      await expect(service.createException('user-1', dto)).rejects.toThrow(BadRequestException)
    })

    it('throws TIME_INVALID when startTime >= endTime', async () => {
      const dto = {
        locationId: 'loc-1',
        date: '2026-05-15',
        type: 'available' as const,
        startTime: '14:00:00',
        endTime: '09:00:00',
      }

      await expect(service.createException('user-1', dto)).rejects.toThrow(BadRequestException)
    })
  })

  describe('updateException', () => {
    const existing = makeException({ startTime: '08:00:00', endTime: '12:00:00' })

    it('updates an exception with new reason', async () => {
      vi.mocked(repo.findExceptionById).mockResolvedValue(existing)
      const updated = makeException({ reason: 'Día festivo' })
      vi.mocked(repo.updateException).mockResolvedValue(updated)

      const result = await service.updateException('exc-1', 'user-1', { reason: 'Día festivo' })

      expect(repo.updateException).toHaveBeenCalledWith('exc-1', 'user-1', {
        reason: 'Día festivo',
      })
      expect(result).toEqual(updated)
    })

    it('throws NOT_FOUND when exception does not exist for user', async () => {
      vi.mocked(repo.findExceptionById).mockResolvedValue(null)

      await expect(service.updateException('exc-1', 'user-2', {})).rejects.toThrow(
        NotFoundException,
      )
    })

    it('throws TIME_INVALID when merged times are invalid order', async () => {
      vi.mocked(repo.findExceptionById).mockResolvedValue(existing)

      await expect(
        service.updateException('exc-1', 'user-1', { startTime: '16:00:00' }),
      ).rejects.toThrow(BadRequestException)
    })
  })

  describe('deleteException', () => {
    it('deletes an existing exception', async () => {
      vi.mocked(repo.findExceptionById).mockResolvedValue(makeException())
      vi.mocked(repo.deleteException).mockResolvedValue()

      await service.deleteException('exc-1', 'user-1')

      expect(repo.deleteException).toHaveBeenCalledWith('exc-1', 'user-1')
    })

    it('throws NOT_FOUND when exception does not exist for user', async () => {
      vi.mocked(repo.findExceptionById).mockResolvedValue(null)

      await expect(service.deleteException('exc-1', 'user-2')).rejects.toThrow(NotFoundException)
      expect(repo.deleteException).not.toHaveBeenCalled()
    })
  })
})
