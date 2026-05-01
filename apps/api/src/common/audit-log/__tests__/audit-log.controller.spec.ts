import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { AuditLogController } from '../audit-log.controller.js'
import type { AuditLogService } from '../audit-log.service.js'

const mockSvc = {
  list: vi.fn(),
  getById: vi.fn(),
  exportCsv: vi.fn(),
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    tenantId: 'tenant-1',
    actorUserId: 'user-1',
    actorType: 'user',
    category: 'entity',
    action: 'create',
    entityType: 'Patient',
    entityId: 'patient-1',
    changes: null,
    metadata: null,
    requestId: null,
    ipAddress: '127.0.0.1',
    status: 'success',
    errorCode: null,
    createdAt: '2026-04-18T10:00:00.000Z',
    actor: { id: 'user-1', fullName: 'Dr. Test', email: 'dr@test.com', role: 'owner' },
    ...overrides,
  }
}

const listResponse = {
  data: [makeItem()],
  pagination: { cursor: null, hasMore: false, limit: 50 },
}

describe('AuditLogController', () => {
  let controller: AuditLogController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new AuditLogController(mockSvc as unknown as AuditLogService)
    mockSvc.list.mockResolvedValue(listResponse)
    mockSvc.getById.mockResolvedValue(makeItem())
    mockSvc.exportCsv.mockResolvedValue('id,createdAt\nlog-1,2026-04-18')
  })

  describe('list', () => {
    it('delegates to service.list with tenantId', async () => {
      const result = await controller.list('tenant-1')
      expect(mockSvc.list).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1' }))
      expect(result).toBe(listResponse)
    })

    it('parses limit string to number', async () => {
      mockSvc.list.mockResolvedValue(listResponse)
      await controller.list('tenant-1', undefined, '25')
      expect(mockSvc.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }))
    })

    it('parses dateFrom string to Date', async () => {
      await controller.list('tenant-1', undefined, undefined, '2026-01-01T00:00:00Z')
      const filters = mockSvc.list.mock.calls[0]?.[0] as Record<string, unknown>
      expect(filters['fromDate']).toBeInstanceOf(Date)
    })

    it('parses dateTo string to Date', async () => {
      await controller.list('tenant-1', undefined, undefined, undefined, '2026-12-31T23:59:59Z')
      const filters = mockSvc.list.mock.calls[0]?.[0] as Record<string, unknown>
      expect(filters['toDate']).toBeInstanceOf(Date)
    })

    it('passes category and action filters through', async () => {
      await controller.list(
        'tenant-1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'auth',
        'login',
      )
      expect(mockSvc.list).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'auth', action: 'login' }),
      )
    })

    it('passes cursor through for pagination', async () => {
      await controller.list('tenant-1', 'cursor-abc')
      expect(mockSvc.list).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'cursor-abc' }))
    })
  })

  describe('getById', () => {
    it('delegates to service.getById', async () => {
      const result = await controller.getById('tenant-1', 'log-1')
      expect(mockSvc.getById).toHaveBeenCalledWith('log-1', 'tenant-1')
      expect(result).toMatchObject({ id: 'log-1' })
    })

    it('propagates NotFoundException from service', async () => {
      mockSvc.getById.mockRejectedValue(new NotFoundException())
      await expect(controller.getById('tenant-1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('exportCsv', () => {
    function makeRes() {
      return {
        set: vi.fn(),
        end: vi.fn(),
      }
    }

    it('delegates to service.exportCsv and streams response', async () => {
      const res = makeRes()
      await controller.exportCsv(
        'tenant-1',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        res as never,
      )
      expect(mockSvc.exportCsv).toHaveBeenCalledWith('tenant-1', expect.any(Object))
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'text/csv; charset=utf-8' }),
      )
      expect(res.end).toHaveBeenCalledWith('id,createdAt\nlog-1,2026-04-18')
    })

    it('propagates ForbiddenException for non-clinic plan', async () => {
      mockSvc.exportCsv.mockRejectedValue(new ForbiddenException())
      const res = makeRes()
      await expect(
        controller.exportCsv(
          'tenant-1',
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          res as never,
        ),
      ).rejects.toThrow(ForbiddenException)
    })

    it('passes dateFrom filter to exportCsv', async () => {
      const res = makeRes()
      await controller.exportCsv(
        'tenant-1',
        '2026-01-01T00:00:00Z',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        res as never,
      )
      const filters = mockSvc.exportCsv.mock.calls[0]?.[1] as Record<string, unknown>
      expect(filters['fromDate']).toBeInstanceOf(Date)
    })

    it('passes dateTo filter to exportCsv', async () => {
      const res = makeRes()
      await controller.exportCsv(
        'tenant-1',
        undefined,
        '2026-12-31T23:59:59Z',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        res as never,
      )
      const filters = mockSvc.exportCsv.mock.calls[0]?.[1] as Record<string, unknown>
      expect(filters['toDate']).toBeInstanceOf(Date)
    })
  })
})
