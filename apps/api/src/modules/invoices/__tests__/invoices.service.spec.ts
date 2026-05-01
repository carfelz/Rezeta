/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, BadRequestException } from '@nestjs/common'
import { InvoicesService } from '../invoices.service.js'
import type { InvoicesRepository, InvoiceRow } from '../invoices.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'
import { Prisma } from '@rezeta/db'
const { Decimal } = Prisma

vi.mock('../../../lib/pdf.service.js', () => ({
  PdfService: class {
    generatePrescription = vi.fn().mockResolvedValue(Buffer.from([]))
    generateInvoice = vi.fn().mockResolvedValue(Buffer.from([]))
  },
}))

function makeRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
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
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-15'),
    deletedAt: null,
    patient: { firstName: 'Ana', lastName: 'Reyes' },
    location: { name: 'Centro Médico Real' },
    items: [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        description: 'Consulta general',
        quantity: 1,
        unitPrice: new Decimal(1000),
        total: new Decimal(1000),
      },
    ],
    ...overrides,
  } as InvoiceRow
}

describe('InvoicesService', () => {
  let repo: InvoicesRepository
  let prisma: PrismaService
  let service: InvoicesService

  beforeEach(() => {
    repo = {
      findMany: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      softDelete: vi.fn(),
    } as unknown as InvoicesRepository

    prisma = {
      location: { findFirst: vi.fn() },
      user: { findFirst: vi.fn() },
    } as unknown as PrismaService

    const pdfService = {
      generatePrescription: vi.fn(),
      generateInvoice: vi.fn().mockResolvedValue(Buffer.from([])),
    }

    service = new InvoicesService(repo, prisma, pdfService as never)
  })

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns items and hasMore: false when results fit within limit', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([makeRow(), makeRow({ id: 'inv-2' })])
      const result = await service.list({ tenantId: 'tenant-1', userId: 'user-1', limit: 50 })
      expect(result.items).toHaveLength(2)
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeUndefined()
    })

    it('returns hasMore: true and nextCursor when results exceed limit', async () => {
      const rows = ['inv-1', 'inv-2', 'inv-3'].map((id) => makeRow({ id }))
      vi.mocked(repo.findMany).mockResolvedValue(rows)
      const result = await service.list({ tenantId: 'tenant-1', userId: 'user-1', limit: 2 })
      expect(result.hasMore).toBe(true)
      expect(result.items).toHaveLength(2)
      expect(result.nextCursor).toBe('inv-2')
    })

    it('applies default limit of 50', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([])
      await service.list({ tenantId: 'tenant-1', userId: 'user-1' })
      expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }))
    })

    it('maps Decimal fields to numbers in DTO', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([makeRow()])
      const result = await service.list({ tenantId: 'tenant-1', userId: 'user-1' })
      expect(typeof result.items[0]?.subtotal).toBe('number')
      expect(result.items[0]?.subtotal).toBe(1000)
      expect(result.items[0]?.netToDoctor).toBe(900)
    })

    it('includes patient name and location name in DTO', async () => {
      vi.mocked(repo.findMany).mockResolvedValue([makeRow()])
      const result = await service.list({ tenantId: 'tenant-1', userId: 'user-1' })
      expect(result.items[0]?.patientName).toBe('Ana Reyes')
      expect(result.items[0]?.locationName).toBe('Centro Médico Real')
    })
  })

  // ── getById ─────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns DTO when invoice found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow())
      const result = await service.getById('inv-1', 'tenant-1')
      expect(result.id).toBe('inv-1')
      expect(result.invoiceNumber).toBe('F-2026-00001')
    })

    it('throws NotFoundException when invoice not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.getById('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
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

    it('creates and returns invoice DTO', async () => {
      vi.mocked(prisma.location.findFirst).mockResolvedValue({
        commissionPercent: new Decimal(10),
      } as never)
      vi.mocked(repo.create).mockResolvedValue(makeRow())
      const result = await service.create('tenant-1', 'user-1', dto)
      expect(result.id).toBe('inv-1')
      expect(repo.create).toHaveBeenCalledWith('tenant-1', 'user-1', dto, 10)
    })

    it('throws NotFoundException when location not found', async () => {
      vi.mocked(prisma.location.findFirst).mockResolvedValue(null)
      await expect(service.create('tenant-1', 'user-1', dto)).rejects.toThrow(NotFoundException)
    })

    it('does not call repo.create when location not found', async () => {
      vi.mocked(prisma.location.findFirst).mockResolvedValue(null)
      await service.create('tenant-1', 'user-1', dto).catch(() => {})
      expect(repo.create).not.toHaveBeenCalled()
    })
  })

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns DTO for draft invoices', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'draft' }))
      vi.mocked(repo.update).mockResolvedValue(makeRow({ currency: 'USD' }))
      const result = await service.update('inv-1', 'tenant-1', { currency: 'USD' })
      expect(result.currency).toBe('USD')
    })

    it('throws NotFoundException when invoice not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.update('bad', 'tenant-1', {})).rejects.toThrow(NotFoundException)
    })

    it('throws BadRequestException when invoice is not draft', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'issued' }))
      await expect(service.update('inv-1', 'tenant-1', {})).rejects.toThrow(BadRequestException)
    })
  })

  // ── updateStatus ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('allows draft → issued transition', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'draft' }))
      vi.mocked(repo.updateStatus).mockResolvedValue(makeRow({ status: 'issued' }))
      const result = await service.updateStatus('inv-1', 'tenant-1', { status: 'issued' })
      expect(result.status).toBe('issued')
    })

    it('allows draft → cancelled transition', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'draft' }))
      vi.mocked(repo.updateStatus).mockResolvedValue(makeRow({ status: 'cancelled' }))
      const result = await service.updateStatus('inv-1', 'tenant-1', { status: 'cancelled' })
      expect(result.status).toBe('cancelled')
    })

    it('allows issued → paid transition', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'issued' }))
      vi.mocked(repo.updateStatus).mockResolvedValue(
        makeRow({ status: 'paid', paymentMethod: 'cash' }),
      )
      const result = await service.updateStatus('inv-1', 'tenant-1', {
        status: 'paid',
        paymentMethod: 'cash',
      })
      expect(result.status).toBe('paid')
    })

    it('rejects issued → draft transition', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'issued' }))
      await expect(
        service.updateStatus('inv-1', 'tenant-1', { status: 'draft' as 'issued' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects paid → any transition', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'paid' }))
      await expect(
        service.updateStatus('inv-1', 'tenant-1', { status: 'cancelled' }),
      ).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when invoice not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.updateStatus('bad', 'tenant-1', { status: 'issued' })).rejects.toThrow(
        NotFoundException,
      )
    })

    it('passes paymentMethod to repo.updateStatus', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'issued' }))
      vi.mocked(repo.updateStatus).mockResolvedValue(
        makeRow({ status: 'paid', paymentMethod: 'card' }),
      )
      await service.updateStatus('inv-1', 'tenant-1', { status: 'paid', paymentMethod: 'card' })
      expect(repo.updateStatus).toHaveBeenCalledWith('inv-1', 'tenant-1', 'paid', 'card')
    })
  })

  // ── getInvoicePdf ────────────────────────────────────────────────────────────

  describe('getInvoicePdf', () => {
    it('returns PDF buffer for valid invoice', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow())
      vi.mocked(prisma.user.findFirst).mockResolvedValue({
        fullName: 'Dr. Test',
        specialty: 'Cardiology',
        licenseNumber: 'MED-001',
      } as never)
      const result = await service.getInvoicePdf('inv-1', 'tenant-1')
      expect(Buffer.isBuffer(result)).toBe(true)
    })

    it('throws NotFoundException when invoice not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.getInvoicePdf('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('soft-deletes draft invoice', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'draft' }))
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.delete('inv-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalledWith('inv-1', 'tenant-1')
    })

    it('soft-deletes cancelled invoice', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'cancelled' }))
      vi.mocked(repo.softDelete).mockResolvedValue(undefined)
      await service.delete('inv-1', 'tenant-1')
      expect(repo.softDelete).toHaveBeenCalled()
    })

    it('throws BadRequestException for issued invoices', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'issued' }))
      await expect(service.delete('inv-1', 'tenant-1')).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException for paid invoices', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeRow({ status: 'paid' }))
      await expect(service.delete('inv-1', 'tenant-1')).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when invoice not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await expect(service.delete('bad', 'tenant-1')).rejects.toThrow(NotFoundException)
    })

    it('does not call softDelete when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null)
      await service.delete('bad', 'tenant-1').catch(() => {})
      expect(repo.softDelete).not.toHaveBeenCalled()
    })
  })
})
