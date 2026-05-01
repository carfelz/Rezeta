import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { AuditLogService } from '../audit-log.service.js'
import type { AuditLogRepository } from '../audit-log.repository.js'

const mockRepo = {
  insert: vi.fn(),
  findByTenant: vi.fn(),
  findById: vi.fn(),
  findForExport: vi.fn(),
  findTenantPlan: vi.fn().mockResolvedValue('clinic'),
}

function makeRow(overrides: Record<string, unknown> = {}) {
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
    createdAt: new Date('2026-04-18T10:00:00Z'),
    actor: { id: 'user-1', fullName: 'Dr. Test', email: 'dr@test.com', role: 'owner' },
    ...overrides,
  }
}

describe('AuditLogService', () => {
  let service: AuditLogService

  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.findTenantPlan.mockResolvedValue('clinic')
    service = new AuditLogService(mockRepo as unknown as AuditLogRepository)
  })

  describe('record', () => {
    it('inserts a basic entity event', async () => {
      mockRepo.insert.mockResolvedValue(undefined)
      await service.record({
        tenantId: 'tenant-1',
        actorUserId: 'user-1',
        actorType: 'user',
        category: 'entity',
        action: 'create',
        entityType: 'Patient',
        entityId: 'patient-1',
        status: 'success',
      })
      expect(mockRepo.insert).toHaveBeenCalledOnce()
      const arg = mockRepo.insert.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['tenantId']).toBe('tenant-1')
      expect(arg['action']).toBe('create')
      expect(arg['category']).toBe('entity')
    })

    it('redacts password fields from changes before insert', async () => {
      mockRepo.insert.mockResolvedValue(undefined)
      await service.record({
        tenantId: 'tenant-1',
        actorType: 'user',
        category: 'entity',
        action: 'update',
        entityType: 'User',
        changes: {
          password: { before: 'old-hash', after: 'new-hash' },
          email: { before: 'a@test.com', after: 'b@test.com' },
        },
        status: 'success',
      })
      const arg = mockRepo.insert.mock.calls[0]?.[0] as Record<string, unknown>
      const changes = arg['changes'] as Record<string, { before: unknown; after: unknown }>
      expect(changes['password']).toEqual({ before: '[REDACTED]', after: '[REDACTED]' })
      expect(changes['email']).toEqual({ before: 'a@test.com', after: 'b@test.com' })
    })

    it('redacts sensitive metadata before insert', async () => {
      mockRepo.insert.mockResolvedValue(undefined)
      await service.record({
        tenantId: 'tenant-1',
        actorType: 'system',
        category: 'auth',
        action: 'login',
        entityType: 'User',
        metadata: { ip: '1.2.3.4', password: 'should-be-gone' },
        status: 'success',
      })
      const arg = mockRepo.insert.mock.calls[0]?.[0] as Record<string, unknown>
      const meta = arg['metadata'] as Record<string, unknown>
      expect(meta['ip']).toBe('1.2.3.4')
      expect(meta['password']).toBe('[REDACTED]')
    })

    it('does not throw when insert fails — logs error silently', async () => {
      mockRepo.insert.mockRejectedValue(new Error('DB down'))
      await expect(
        service.record({
          tenantId: 'tenant-1',
          actorType: 'user',
          category: 'entity',
          action: 'create',
          status: 'success',
        }),
      ).resolves.not.toThrow()
    })

    it('records a system event without entityType', async () => {
      mockRepo.insert.mockResolvedValue(undefined)
      await service.record({
        actorType: 'cron',
        category: 'system',
        action: 'backup_verified',
        metadata: { job: 'nightly-backup', duration_ms: 1200 },
        status: 'success',
      })
      expect(mockRepo.insert).toHaveBeenCalledOnce()
      const arg = mockRepo.insert.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['actorType']).toBe('cron')
      expect(arg['category']).toBe('system')
    })

    it('records a failed event with errorCode', async () => {
      mockRepo.insert.mockResolvedValue(undefined)
      await service.record({
        tenantId: 'tenant-1',
        actorType: 'user',
        category: 'auth',
        action: 'login_failed',
        status: 'failed',
        errorCode: 'INVALID_CREDENTIALS',
      })
      const arg = mockRepo.insert.mock.calls[0]?.[0] as Record<string, unknown>
      expect(arg['status']).toBe('failed')
      expect(arg['errorCode']).toBe('INVALID_CREDENTIALS')
    })
  })

  describe('list', () => {
    it('returns data with hasMore=false when rows <= limit', async () => {
      const rows = [makeRow(), makeRow({ id: 'log-2' })]
      mockRepo.findByTenant.mockResolvedValue(rows)
      const result = await service.list({ tenantId: 'tenant-1', limit: 50 })
      expect(result.data).toHaveLength(2)
      expect(result.pagination.hasMore).toBe(false)
      expect(result.pagination.cursor).toBeNull()
    })

    it('returns hasMore=true and cursor when rows exceed limit', async () => {
      const rows = Array.from({ length: 51 }, (_, i) => makeRow({ id: `row-${i}` }))
      mockRepo.findByTenant.mockResolvedValue(rows)
      const result = await service.list({ tenantId: 'tenant-1', limit: 50 })
      expect(result.data).toHaveLength(50)
      expect(result.pagination.hasMore).toBe(true)
      expect(result.pagination.cursor).toBe('row-49')
    })

    it('passes filters to repository', async () => {
      mockRepo.findByTenant.mockResolvedValue([])
      await service.list({
        tenantId: 'tenant-1',
        actorUserId: 'user-x',
        category: 'auth',
        action: 'login',
      })
      const filters = mockRepo.findByTenant.mock.calls[0]?.[0] as Record<string, unknown>
      expect(filters['tenantId']).toBe('tenant-1')
      expect(filters['actorUserId']).toBe('user-x')
      expect(filters['category']).toBe('auth')
      expect(filters['action']).toBe('login')
    })

    it('applies 30-day cutoff for free plan when no fromDate given', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('free')
      mockRepo.findByTenant.mockResolvedValue([])
      const before = Date.now()
      await service.list({ tenantId: 'tenant-1' })
      const filters = mockRepo.findByTenant.mock.calls[0]?.[0] as Record<string, unknown>
      const fromDate = filters['fromDate'] as Date
      expect(fromDate).toBeInstanceOf(Date)
      const diffMs = before - fromDate.getTime()
      expect(diffMs).toBeGreaterThanOrEqual(29 * 24 * 60 * 60 * 1000)
      expect(diffMs).toBeLessThanOrEqual(31 * 24 * 60 * 60 * 1000)
    })

    it('applies 12-month cutoff for solo plan', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('solo')
      mockRepo.findByTenant.mockResolvedValue([])
      await service.list({ tenantId: 'tenant-1' })
      const filters = mockRepo.findByTenant.mock.calls[0]?.[0] as Record<string, unknown>
      const fromDate = filters['fromDate'] as Date
      expect(fromDate).toBeInstanceOf(Date)
      const diffDays = (Date.now() - fromDate.getTime()) / (24 * 60 * 60 * 1000)
      expect(diffDays).toBeGreaterThanOrEqual(364)
      expect(diffDays).toBeLessThanOrEqual(366)
    })

    it('applies no cutoff for clinic plan', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('clinic')
      mockRepo.findByTenant.mockResolvedValue([])
      await service.list({ tenantId: 'tenant-1' })
      const filters = mockRepo.findByTenant.mock.calls[0]?.[0] as Record<string, unknown>
      expect(filters['fromDate']).toBeUndefined()
    })

    it('respects explicit fromDate over plan cutoff', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('free')
      mockRepo.findByTenant.mockResolvedValue([])
      const explicit = new Date('2020-01-01')
      await service.list({ tenantId: 'tenant-1', fromDate: explicit })
      const filters = mockRepo.findByTenant.mock.calls[0]?.[0] as Record<string, unknown>
      expect(filters['fromDate']).toBe(explicit)
      expect(mockRepo.findTenantPlan).not.toHaveBeenCalled()
    })

    it('maps createdAt Date to ISO string in returned items', async () => {
      mockRepo.findByTenant.mockResolvedValue([makeRow()])
      const result = await service.list({ tenantId: 'tenant-1' })
      expect(typeof result.data[0]?.createdAt).toBe('string')
      expect(result.data[0]?.createdAt).toBe('2026-04-18T10:00:00.000Z')
    })
  })

  describe('getById', () => {
    it('returns the item when found', async () => {
      mockRepo.findById.mockResolvedValue(makeRow())
      const result = await service.getById('log-1', 'tenant-1')
      expect(result.id).toBe('log-1')
      expect(typeof result.createdAt).toBe('string')
    })

    it('throws NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getById('missing', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('enforces tenant isolation (does not expose cross-tenant rows)', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await service.getById('log-1', 'other-tenant').catch(() => {})
      expect(mockRepo.findById).toHaveBeenCalledWith('log-1', 'other-tenant')
    })
  })

  describe('exportCsv', () => {
    it('throws ForbiddenException for non-clinic tenants', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('free')
      await expect(service.exportCsv('tenant-1', {})).rejects.toThrow(ForbiddenException)
      expect(mockRepo.findForExport).not.toHaveBeenCalled()
    })

    it('throws ForbiddenException for solo plan', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('solo')
      await expect(service.exportCsv('tenant-1', {})).rejects.toThrow(ForbiddenException)
    })

    it('returns CSV string for clinic plan', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('clinic')
      mockRepo.findForExport.mockResolvedValue([makeRow()])
      const csv = await service.exportCsv('tenant-1', {})
      expect(csv).toContain('id,createdAt')
      expect(csv).toContain('log-1')
      expect(csv).toContain('create')
    })

    it('CSV header contains expected columns', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('clinic')
      mockRepo.findForExport.mockResolvedValue([])
      const csv = await service.exportCsv('tenant-1', {})
      const header = csv.split('\n')[0]
      expect(header).toContain('id')
      expect(header).toContain('createdAt')
      expect(header).toContain('actorType')
      expect(header).toContain('category')
      expect(header).toContain('action')
      expect(header).toContain('status')
    })

    it('passes tenantId and filters to findForExport', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('clinic')
      mockRepo.findForExport.mockResolvedValue([])
      const from = new Date('2026-01-01')
      await service.exportCsv('tenant-1', { fromDate: from, category: 'auth' })
      expect(mockRepo.findForExport).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1', fromDate: from, category: 'auth' }),
      )
    })

    it('uses actorType as actor name when actor is null (system event)', async () => {
      mockRepo.findTenantPlan.mockResolvedValue('clinic')
      mockRepo.findForExport.mockResolvedValue([
        makeRow({ actorUserId: null, actorType: 'system', actor: null }),
      ])
      const csv = await service.exportCsv('tenant-1', {})
      expect(csv).toContain('system')
    })
  })
})
