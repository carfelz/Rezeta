/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InvoicesController } from '../invoices.controller.js'
import type { InvoicesService } from '../invoices.service.js'
import type { AuthUser, InvoiceWithDetails } from '@rezeta/shared'

const mockUser: AuthUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'doc@test.com',
  role: 'owner',
}
const tenantId = 'tenant-1'

function makeInvoice(overrides: Partial<InvoiceWithDetails> = {}): InvoiceWithDetails {
  return {
    id: 'inv-1',
    tenantId: 'tenant-1',
    patientId: 'patient-1',
    doctorUserId: 'user-1',
    locationId: 'loc-1',
    consultationId: null,
    invoiceNumber: 'F-2026-00001',
    status: 'draft',
    currency: 'DOP',
    subtotal: 1000,
    tax: 0,
    commissionAmount: 100,
    commissionPercent: 10,
    netToDoctor: 900,
    total: 1000,
    paymentMethod: null,
    issuedAt: null,
    paidAt: null,
    dueDate: null,
    notes: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    deletedAt: null,
    items: [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        description: 'Consulta',
        quantity: 1,
        unitPrice: 1000,
        total: 1000,
      },
    ],
    patientName: 'Ana Reyes',
    locationName: 'Centro Médico Real',
    ...overrides,
  }
}

describe('InvoicesController', () => {
  let controller: InvoicesController
  let service: InvoicesService

  beforeEach(() => {
    service = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      delete: vi.fn(),
    } as unknown as InvoicesService
    controller = new InvoicesController(service)
  })

  // ── list ────────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('delegates to service with tenant and user id', async () => {
      vi.mocked(service.list).mockResolvedValue({
        items: [makeInvoice()],
        hasMore: false,
        nextCursor: undefined,
      })
      const result = await controller.list(tenantId, mockUser)
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, userId: 'user-1' }),
      )
      expect(result.items).toHaveLength(1)
    })

    it('passes optional query params when provided', async () => {
      vi.mocked(service.list).mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: undefined,
      })
      await controller.list(tenantId, mockUser, 'issued', 'patient-1', 'loc-1', 'cursor-x', '25')
      expect(service.list).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'issued',
          patientId: 'patient-1',
          locationId: 'loc-1',
          cursor: 'cursor-x',
          limit: 25,
        }),
      )
    })

    it('passes undefined limit when limit param is absent', async () => {
      vi.mocked(service.list).mockResolvedValue({
        items: [],
        hasMore: false,
        nextCursor: undefined,
      })
      await controller.list(
        tenantId,
        mockUser,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      )
      expect(service.list).toHaveBeenCalledWith(expect.objectContaining({ limit: undefined }))
    })
  })

  // ── getById ─────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('delegates to service and returns invoice', async () => {
      vi.mocked(service.getById).mockResolvedValue(makeInvoice())
      const result = await controller.getById(tenantId, 'inv-1')
      expect(service.getById).toHaveBeenCalledWith('inv-1', tenantId)
      expect(result.id).toBe('inv-1')
    })
  })

  // ── create ──────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('delegates to service with tenant and user id', async () => {
      vi.mocked(service.create).mockResolvedValue(makeInvoice())
      const dto = {
        patientId: 'patient-1',
        locationId: 'loc-1',
        currency: 'DOP' as const,
        items: [{ description: 'Consulta', quantity: 1, unitPrice: 1000, total: 1000 }],
      }
      const result = await controller.create(tenantId, mockUser, dto)
      expect(service.create).toHaveBeenCalledWith(tenantId, 'user-1', dto)
      expect(result.id).toBe('inv-1')
    })
  })

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('delegates to service', async () => {
      vi.mocked(service.update).mockResolvedValue(makeInvoice({ currency: 'USD' }))
      const result = await controller.update(tenantId, 'inv-1', { currency: 'USD' })
      expect(service.update).toHaveBeenCalledWith('inv-1', tenantId, { currency: 'USD' })
      expect(result.currency).toBe('USD')
    })
  })

  // ── updateStatus ─────────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('delegates to service with status transition', async () => {
      vi.mocked(service.updateStatus).mockResolvedValue(makeInvoice({ status: 'issued' }))
      const result = await controller.updateStatus(tenantId, 'inv-1', { status: 'issued' })
      expect(service.updateStatus).toHaveBeenCalledWith('inv-1', tenantId, { status: 'issued' })
      expect(result.status).toBe('issued')
    })
  })

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('delegates to service', async () => {
      vi.mocked(service.delete).mockResolvedValue(undefined)
      await controller.delete(tenantId, 'inv-1')
      expect(service.delete).toHaveBeenCalledWith('inv-1', tenantId)
    })
  })
})
