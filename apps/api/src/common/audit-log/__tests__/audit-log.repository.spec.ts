import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditLogRepository } from '../audit-log.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const mockPrisma = {
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
}

const baseEvent = {
  tenantId: 'tenant-1',
  actorUserId: 'user-1',
  actorType: 'user' as const,
  category: 'entity' as const,
  action: 'create' as const,
  entityType: 'Patient',
  entityId: 'patient-1',
  status: 'success' as const,
}

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new AuditLogRepository(mockPrisma as unknown as PrismaService)
  })

  describe('insert', () => {
    it('creates an audit log row with all provided fields', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({})
      await repo.insert({ ...baseEvent, requestId: 'req-xyz', ipAddress: '1.2.3.4' })
      expect(mockPrisma.auditLog.create).toHaveBeenCalledOnce()
      const data = mockPrisma.auditLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>
      expect(data['tenantId']).toBe('tenant-1')
      expect(data['actorUserId']).toBe('user-1')
      expect(data['actorType']).toBe('user')
      expect(data['category']).toBe('entity')
      expect(data['action']).toBe('create')
      expect(data['entityType']).toBe('Patient')
      expect(data['entityId']).toBe('patient-1')
      expect(data['requestId']).toBe('req-xyz')
      expect(data['ipAddress']).toBe('1.2.3.4')
    })

    it('inserts null for optional fields when not provided', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({})
      await repo.insert({
        actorType: 'cron',
        category: 'system',
        action: 'backup_verified',
        status: 'success',
      })
      const data = mockPrisma.auditLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>
      expect(data['tenantId']).toBeNull()
      expect(data['actorUserId']).toBeNull()
      expect(data['entityType']).toBeNull()
      expect(data['entityId']).toBeNull()
      expect(data['requestId']).toBeNull()
      expect(data['ipAddress']).toBeNull()
      expect(data['userAgent']).toBeNull()
      expect(data['errorCode']).toBeNull()
    })

    it('defaults status to "success" when not specified', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({})
      const { status: _s, ...rest } = baseEvent
      await repo.insert(rest as typeof baseEvent)
      const data = mockPrisma.auditLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>
      expect(data['status']).toBe('success')
    })

    it('stores changes and metadata as JSONB objects', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({})
      await repo.insert({
        ...baseEvent,
        changes: { email: { before: 'a@test.com', after: 'b@test.com' } },
        metadata: { ip: '1.2.3.4' },
      })
      const data = mockPrisma.auditLog.create.mock.calls[0]?.[0]?.data as Record<string, unknown>
      expect(data['changes']).toEqual({ email: { before: 'a@test.com', after: 'b@test.com' } })
      expect(data['metadata']).toEqual({ ip: '1.2.3.4' })
    })
  })

  describe('findByTenant', () => {
    it('queries with tenantId filter and returns rows', async () => {
      const rows = [{ id: 'log-1', tenantId: 'tenant-1' }]
      mockPrisma.auditLog.findMany.mockResolvedValue(rows)
      const result = await repo.findByTenant({ tenantId: 'tenant-1' })
      expect(result).toEqual(rows)
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      const where = args['where'] as Record<string, unknown>
      expect(where['tenantId']).toBe('tenant-1')
    })

    it('applies actorUserId filter when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await repo.findByTenant({ tenantId: 'tenant-1', actorUserId: 'user-1' })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      const where = args['where'] as Record<string, unknown>
      expect(where['actorUserId']).toBe('user-1')
    })

    it('applies category and action filters when provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await repo.findByTenant({ tenantId: 'tenant-1', category: 'auth', action: 'login' })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      const where = args['where'] as Record<string, unknown>
      expect(where['category']).toBe('auth')
      expect(where['action']).toBe('login')
    })

    it('applies date range filter when fromDate and toDate provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      const from = new Date('2026-01-01')
      const to = new Date('2026-01-31')
      await repo.findByTenant({ tenantId: 'tenant-1', fromDate: from, toDate: to })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      const where = args['where'] as Record<string, unknown>
      const createdAt = where['createdAt'] as Record<string, unknown>
      expect(createdAt['gte']).toBe(from)
      expect(createdAt['lte']).toBe(to)
    })

    it('applies cursor-based pagination when cursor is provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await repo.findByTenant({ tenantId: 'tenant-1', cursor: 'cursor-id', limit: 20 })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      expect(args['cursor']).toEqual({ id: 'cursor-id' })
      expect(args['skip']).toBe(1)
      expect(args['take']).toBe(21)
    })

    it('uses default limit of 50 when not specified', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await repo.findByTenant({ tenantId: 'tenant-1' })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      expect(args['take']).toBe(51)
    })
  })

  describe('findById', () => {
    it('returns row when found for tenant', async () => {
      const row = { id: 'log-1', tenantId: 'tenant-1', createdAt: new Date() }
      mockPrisma.auditLog.findFirst.mockResolvedValue(row)
      const result = await repo.findById('log-1', 'tenant-1')
      expect(result).toBe(row)
      const args = mockPrisma.auditLog.findFirst.mock.calls[0]?.[0] as Record<string, unknown>
      const where = args['where'] as Record<string, unknown>
      expect(where['id']).toBe('log-1')
      expect(where['tenantId']).toBe('tenant-1')
    })

    it('returns null when not found', async () => {
      mockPrisma.auditLog.findFirst.mockResolvedValue(null)
      const result = await repo.findById('missing', 'tenant-1')
      expect(result).toBeNull()
    })
  })

  describe('findForExport', () => {
    it('queries with tenantId and applies take limit of 10000', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await repo.findForExport({ tenantId: 'tenant-1' })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      expect(args['take']).toBe(10_000)
      const where = args['where'] as Record<string, unknown>
      expect(where['tenantId']).toBe('tenant-1')
    })

    it('applies date range filter when fromDate and toDate provided', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      const from = new Date('2026-01-01')
      const to = new Date('2026-12-31')
      await repo.findForExport({ tenantId: 'tenant-1', fromDate: from, toDate: to })
      const args = mockPrisma.auditLog.findMany.mock.calls[0]?.[0] as Record<string, unknown>
      const where = args['where'] as Record<string, unknown>
      const createdAt = where['createdAt'] as Record<string, unknown>
      expect(createdAt['gte']).toBe(from)
      expect(createdAt['lte']).toBe(to)
    })
  })

  describe('findTenantPlan', () => {
    it('returns plan for existing tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ plan: 'clinic' })
      const plan = await repo.findTenantPlan('tenant-1')
      expect(plan).toBe('clinic')
    })

    it('returns "free" when tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null)
      const plan = await repo.findTenantPlan('missing')
      expect(plan).toBe('free')
    })
  })
})
