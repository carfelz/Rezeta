import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InvoicesRepository } from '../invoices.repository.js'
import { Prisma } from '@rezeta/db'

const { Decimal } = Prisma

const BASE_INCLUDE = {
  items: true,
  patient: { select: { firstName: true, lastName: true } },
  location: { select: { name: true } },
}

const now = new Date('2026-01-15')

function makeRow(overrides = {}) {
  return {
    id: 'inv-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    userId: 'user-1',
    locationId: 'loc-1',
    consultationId: null,
    invoiceNumber: 'F-2026-00001',
    status: 'draft',
    currency: 'DOP',
    subtotal: new Decimal(1000),
    tax: new Decimal(0),
    commissionAmount: new Decimal(100),
    commissionPercent: new Decimal(10),
    netToDoctor: new Decimal(900),
    total: new Decimal(1000),
    paymentMethod: null,
    issuedAt: null,
    paidAt: null,
    dueDate: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    patient: { firstName: 'Ana', lastName: 'Reyes' },
    location: { name: 'Centro Médico' },
    items: [],
    ...overrides,
  }
}

const mockPrisma = {
  invoice: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  invoiceItem: {
    deleteMany: vi.fn(),
  },
}

describe('InvoicesRepository', () => {
  let repo: InvoicesRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new InvoicesRepository(mockPrisma as never)
  })

  // ── findMany ────────────────────────────────────────────────────────────────

  describe('findMany', () => {
    it('filters by tenantId, userId, and deletedAt null', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([makeRow()])
      await repo.findMany({ tenantId: 'tenant-1', userId: 'user-1' })
      const args = mockPrisma.invoice.findMany.mock.calls[0][0]
      expect(args.where).toMatchObject({ tenantId: 'tenant-1', userId: 'user-1', deletedAt: null })
    })

    it('includes status filter when provided', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', status: 'issued' })
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where
      expect(where.status).toBe('issued')
    })

    it('includes patientId filter when provided', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', patientId: 'patient-99' })
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where
      expect(where.patientId).toBe('patient-99')
    })

    it('includes locationId filter when provided', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', locationId: 'loc-99' })
      const where = mockPrisma.invoice.findMany.mock.calls[0][0].where
      expect(where.locationId).toBe('loc-99')
    })

    it('uses cursor pagination when cursor provided', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', cursor: 'cursor-x', limit: 10 })
      const args = mockPrisma.invoice.findMany.mock.calls[0][0]
      expect(args.cursor).toEqual({ id: 'cursor-x' })
      expect(args.skip).toBe(1)
    })

    it('requests limit + 1 rows', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1', limit: 20 })
      expect(mockPrisma.invoice.findMany.mock.calls[0][0].take).toBe(21)
    })

    it('uses default limit of 51 (50 + 1)', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1' })
      expect(mockPrisma.invoice.findMany.mock.calls[0][0].take).toBe(51)
    })

    it('includes BASE_INCLUDE relations', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      await repo.findMany({ tenantId: 't1', userId: 'u1' })
      expect(mockPrisma.invoice.findMany.mock.calls[0][0].include).toEqual(BASE_INCLUDE)
    })
  })

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns invoice when found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(makeRow())
      const result = await repo.findById('inv-1', 'tenant-1')
      expect(result?.id).toBe('inv-1')
    })

    it('returns null when not found', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null)
      expect(await repo.findById('bad', 'tenant-1')).toBeNull()
    })

    it('filters by id, tenantId, and deletedAt null', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null)
      await repo.findById('inv-1', 'tenant-1')
      expect(mockPrisma.invoice.findFirst.mock.calls[0][0].where).toMatchObject({
        id: 'inv-1',
        tenantId: 'tenant-1',
        deletedAt: null,
      })
    })
  })

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      patientId: 'patient-1',
      locationId: 'loc-1',
      currency: 'DOP' as const,
      items: [{ description: 'Consulta', quantity: 1, unitPrice: 1000, total: 1000 }],
    }

    beforeEach(() => {
      mockPrisma.invoice.count.mockResolvedValue(0)
      mockPrisma.invoice.create.mockResolvedValue(makeRow())
    })

    it('generates invoice number using count', async () => {
      mockPrisma.invoice.count.mockResolvedValue(4)
      await repo.create('tenant-1', 'user-1', dto, 10)
      const data = mockPrisma.invoice.create.mock.calls[0][0].data
      const year = new Date().getFullYear()
      expect(data.invoiceNumber).toBe(`F-${year}-00005`)
    })

    it('calculates commission amount from subtotal and percent', async () => {
      await repo.create('tenant-1', 'user-1', dto, 10)
      const data = mockPrisma.invoice.create.mock.calls[0][0].data
      expect(data.commissionAmount).toBe(100)
      expect(data.netToDoctor).toBe(900)
    })

    it('sets status to draft', async () => {
      await repo.create('tenant-1', 'user-1', dto, 10)
      expect(mockPrisma.invoice.create.mock.calls[0][0].data.status).toBe('draft')
    })

    it('sets tax to 0', async () => {
      await repo.create('tenant-1', 'user-1', dto, 10)
      expect(mockPrisma.invoice.create.mock.calls[0][0].data.tax).toBe(0)
    })

    it('includes BASE_INCLUDE relations', async () => {
      await repo.create('tenant-1', 'user-1', dto, 10)
      expect(mockPrisma.invoice.create.mock.calls[0][0].include).toEqual(BASE_INCLUDE)
    })

    it('maps items to create data', async () => {
      await repo.create('tenant-1', 'user-1', dto, 10)
      const items = mockPrisma.invoice.create.mock.calls[0][0].data.items.create
      expect(items).toHaveLength(1)
      expect(items[0].description).toBe('Consulta')
    })
  })

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates currency when provided', async () => {
      mockPrisma.invoice.update.mockResolvedValue(makeRow({ currency: 'USD' }))
      await repo.update('inv-1', 'tenant-1', { currency: 'USD' })
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.currency).toBe('USD')
    })

    it('updates notes when provided', async () => {
      mockPrisma.invoice.update.mockResolvedValue(makeRow({ notes: 'Updated notes' }))
      await repo.update('inv-1', 'tenant-1', { notes: 'Updated notes' })
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.notes).toBe('Updated notes')
    })

    it('sets notes to null when explicitly null', async () => {
      mockPrisma.invoice.update.mockResolvedValue(makeRow({ notes: null }))
      await repo.update('inv-1', 'tenant-1', { notes: null })
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.notes).toBeNull()
    })

    it('recalculates totals and deletes old items when items provided', async () => {
      mockPrisma.invoice.findFirstOrThrow.mockResolvedValue({ commissionPercent: new Decimal(10) })
      mockPrisma.invoiceItem.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.invoice.update.mockResolvedValue(makeRow())
      await repo.update('inv-1', 'tenant-1', {
        items: [{ description: 'Nuevo servicio', quantity: 1, unitPrice: 2000, total: 2000 }],
      })
      expect(mockPrisma.invoiceItem.deleteMany).toHaveBeenCalledWith({
        where: { invoiceId: 'inv-1' },
      })
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.subtotal).toBe(2000)
      expect(data.commissionAmount).toBe(200)
      expect(data.netToDoctor).toBe(1800)
    })
  })

  // ── updateStatus ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('sets status on update', async () => {
      mockPrisma.invoice.update.mockResolvedValue(makeRow({ status: 'issued' }))
      await repo.updateStatus('inv-1', 'tenant-1', 'issued')
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.status).toBe('issued')
    })

    it('sets issuedAt when transitioning to issued', async () => {
      mockPrisma.invoice.update.mockResolvedValue(makeRow({ status: 'issued' }))
      await repo.updateStatus('inv-1', 'tenant-1', 'issued')
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.issuedAt).toBeInstanceOf(Date)
    })

    it('sets paidAt and paymentMethod when transitioning to paid', async () => {
      mockPrisma.invoice.update.mockResolvedValue(
        makeRow({ status: 'paid', paymentMethod: 'cash' }),
      )
      await repo.updateStatus('inv-1', 'tenant-1', 'paid', 'cash')
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.paidAt).toBeInstanceOf(Date)
      expect(data.paymentMethod).toBe('cash')
    })

    it('does not set issuedAt when transitioning to cancelled', async () => {
      mockPrisma.invoice.update.mockResolvedValue(makeRow({ status: 'cancelled' }))
      await repo.updateStatus('inv-1', 'tenant-1', 'cancelled')
      const data = mockPrisma.invoice.update.mock.calls[0][0].data
      expect(data.issuedAt).toBeUndefined()
    })
  })

  // ── softDelete ───────────────────────────────────────────────────────────────

  describe('softDelete', () => {
    it('sets deletedAt with tenantId scoping', async () => {
      mockPrisma.invoice.update.mockResolvedValue({})
      await repo.softDelete('inv-1', 'tenant-1')
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1', tenantId: 'tenant-1' },
        data: { deletedAt: expect.any(Date) as Date },
      })
    })
  })
})
