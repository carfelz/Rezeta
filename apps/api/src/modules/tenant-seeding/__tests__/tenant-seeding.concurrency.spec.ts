import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import { TenantSeedingService } from '../tenant-seeding.service.js'

// Two concurrent onboarding requests used to both pass the `seededAt IS NULL`
// re-check inside their transactions: under READ COMMITTED a plain findUnique
// takes no row lock and cannot see the other transaction's uncommitted update.
// The loser then collided with the (tenant_id, name) partial unique index and
// leaked a raw P2002 to the client. See tenant-seeding.service.ts.

const unseededTenant = { id: 't1', seededAt: null }

const uniqueViolation = (): Error =>
  Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target: ['tenant_id', 'name'] },
  })

const mockTx = {
  $queryRaw: vi.fn(),
  tenant: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  protocolTemplate: { create: vi.fn() },
  protocolCategory: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
}

const mockPrisma = {
  tenant: { findUnique: vi.fn() },
  $transaction: vi.fn((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
}

const customTemplates = [{ clientId: 'c1', name: 'Custom Template', schema: {} }]
const customTypes = [{ name: 'Custom Type', templateClientId: 'c1' }]

describe('TenantSeedingService — concurrent seeding', () => {
  let service: TenantSeedingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new TenantSeedingService(mockPrisma as never)

    mockPrisma.tenant.findUnique.mockResolvedValue(unseededTenant)
    mockTx.$queryRaw.mockResolvedValue([{ id: 't1' }])
    mockTx.tenant.findUnique.mockResolvedValue({ seededAt: null })
    mockTx.tenant.update.mockResolvedValue({})
    mockTx.protocolTemplate.create.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `tmpl-${data.name}` }),
    )
    mockTx.protocolCategory.create.mockImplementation(({ data }: { data: { name: string } }) =>
      Promise.resolve({ id: `cat-${data.name}`, name: data.name }),
    )
  })

  describe('seedDefault', () => {
    it('locks the tenant row before re-reading seededAt', async () => {
      await service.seedDefault('t1')

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1)
      const lockSql = String(mockTx.$queryRaw.mock.calls[0]?.[0])
      expect(lockSql).toMatch(/FOR UPDATE/i)
      expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockTx.tenant.findUnique.mock.invocationCallOrder[0] as number,
      )
    })

    it('maps a concurrent unique violation to TENANT_ALREADY_SEEDED', async () => {
      mockTx.protocolCategory.create.mockRejectedValue(uniqueViolation())

      await expect(service.seedDefault('t1')).rejects.toMatchObject({
        response: { code: ErrorCode.TENANT_ALREADY_SEEDED },
      })
      await expect(service.seedDefault('t1')).rejects.toThrow(ConflictException)
    })

    it('does not swallow non-P2002 failures', async () => {
      mockTx.protocolCategory.create.mockRejectedValue(new Error('connection reset'))

      await expect(service.seedDefault('t1')).rejects.toThrow(/connection reset/)
    })
  })

  describe('seedCustom', () => {
    it('locks the tenant row before re-reading seededAt', async () => {
      await service.seedCustom('t1', customTemplates, customTypes)

      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1)
      const lockSql = String(mockTx.$queryRaw.mock.calls[0]?.[0])
      expect(lockSql).toMatch(/FOR UPDATE/i)
      expect(mockTx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        mockTx.tenant.findUnique.mock.invocationCallOrder[0] as number,
      )
    })

    it('maps a concurrent unique violation to TENANT_ALREADY_SEEDED', async () => {
      mockTx.protocolCategory.create.mockRejectedValue(uniqueViolation())

      await expect(service.seedCustom('t1', customTemplates, customTypes)).rejects.toMatchObject({
        response: { code: ErrorCode.TENANT_ALREADY_SEEDED },
      })
    })

    it('does not swallow non-P2002 failures', async () => {
      mockTx.protocolCategory.create.mockRejectedValue(new Error('connection reset'))

      await expect(service.seedCustom('t1', customTemplates, customTypes)).rejects.toThrow(
        /connection reset/,
      )
    })
  })
})
