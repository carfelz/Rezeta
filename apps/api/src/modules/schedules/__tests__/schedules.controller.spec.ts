import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SchedulesController } from '../schedules.controller.js'
import type { AuthUser, ScheduleBlock, ScheduleException } from '@rezeta/shared'

const mockService = {
  listBlocks: vi.fn(),
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  listExceptions: vi.fn(),
  createException: vi.fn(),
  updateException: vi.fn(),
  deleteException: vi.fn(),
}

const mockUser: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'dr@test.com',
  role: 'owner',
}

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

describe('SchedulesController', () => {
  let controller: SchedulesController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new SchedulesController(mockService as never)
  })

  // ── Blocks ───────────────────────────────────────────────────────────────────

  describe('listBlocks', () => {
    it('delegates to service with userId', async () => {
      mockService.listBlocks.mockResolvedValue([makeBlock()])
      const result = await controller.listBlocks(mockUser)
      expect(mockService.listBlocks).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(result).toHaveLength(1)
    })

    it('passes locationId filter when provided', async () => {
      mockService.listBlocks.mockResolvedValue([])
      await controller.listBlocks(mockUser, 'loc-2')
      expect(mockService.listBlocks).toHaveBeenCalledWith({ userId: 'user-1', locationId: 'loc-2' })
    })
  })

  describe('createBlock', () => {
    it('delegates to service with userId and dto', async () => {
      const dto = {
        locationId: 'loc-1',
        dayOfWeek: 1,
        startTime: '08:00:00',
        endTime: '12:00:00',
        slotDurationMin: 30,
      }
      mockService.createBlock.mockResolvedValue(makeBlock())
      const result = await controller.createBlock(mockUser, dto)
      expect(mockService.createBlock).toHaveBeenCalledWith('user-1', dto)
      expect(result.id).toBe('block-1')
    })
  })

  describe('updateBlock', () => {
    it('delegates to service with id, userId, and dto', async () => {
      const dto = { endTime: '13:00:00' }
      mockService.updateBlock.mockResolvedValue(makeBlock({ endTime: '13:00:00' }))
      const result = await controller.updateBlock(mockUser, 'block-1', dto)
      expect(mockService.updateBlock).toHaveBeenCalledWith('block-1', 'user-1', dto)
      expect(result.endTime).toBe('13:00:00')
    })
  })

  describe('deleteBlock', () => {
    it('delegates to service and returns void', async () => {
      mockService.deleteBlock.mockResolvedValue(undefined)
      await controller.deleteBlock(mockUser, 'block-1')
      expect(mockService.deleteBlock).toHaveBeenCalledWith('block-1', 'user-1')
    })
  })

  // ── Exceptions ───────────────────────────────────────────────────────────────

  describe('listExceptions', () => {
    it('delegates to service with userId', async () => {
      mockService.listExceptions.mockResolvedValue([makeException()])
      const result = await controller.listExceptions(mockUser)
      expect(mockService.listExceptions).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(result).toHaveLength(1)
    })

    it('passes all optional filters when provided', async () => {
      mockService.listExceptions.mockResolvedValue([])
      await controller.listExceptions(mockUser, 'loc-1', '2026-05-01', '2026-05-31')
      expect(mockService.listExceptions).toHaveBeenCalledWith({
        userId: 'user-1',
        locationId: 'loc-1',
        from: '2026-05-01',
        to: '2026-05-31',
      })
    })
  })

  describe('createException', () => {
    it('delegates to service with userId and dto', async () => {
      const dto = { locationId: 'loc-1', date: '2026-05-15', type: 'blocked' as const }
      mockService.createException.mockResolvedValue(makeException())
      const result = await controller.createException(mockUser, dto)
      expect(mockService.createException).toHaveBeenCalledWith('user-1', dto)
      expect(result.id).toBe('exc-1')
    })
  })

  describe('updateException', () => {
    it('delegates to service with id, userId, and dto', async () => {
      const dto = { reason: 'Día festivo' }
      mockService.updateException.mockResolvedValue(makeException({ reason: 'Día festivo' }))
      const result = await controller.updateException(mockUser, 'exc-1', dto)
      expect(mockService.updateException).toHaveBeenCalledWith('exc-1', 'user-1', dto)
      expect(result.reason).toBe('Día festivo')
    })
  })

  describe('deleteException', () => {
    it('delegates to service and returns void', async () => {
      mockService.deleteException.mockResolvedValue(undefined)
      await controller.deleteException(mockUser, 'exc-1')
      expect(mockService.deleteException).toHaveBeenCalledWith('exc-1', 'user-1')
    })
  })
})
