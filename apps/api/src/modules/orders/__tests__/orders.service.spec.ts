import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { OrdersService } from '../orders.service.js'

vi.mock('../../../lib/pdf.service.js', () => ({
  PdfService: class {
    generatePrescription = vi.fn().mockResolvedValue(Buffer.from([]))
    generateInvoice = vi.fn().mockResolvedValue(Buffer.from([]))
  },
}))

const consultation = { patientId: 'patient-1' }

const mockRepo = {
  createPrescription: vi.fn(),
  listPrescriptionsByConsultation: vi.fn(),
  findPrescriptionById: vi.fn(),
  softDeletePrescription: vi.fn(),
  createImagingOrder: vi.fn(),
  listImagingOrdersByConsultation: vi.fn(),
  findImagingOrderById: vi.fn(),
  softDeleteImagingOrder: vi.fn(),
  createLabOrder: vi.fn(),
  listLabOrdersByConsultation: vi.fn(),
  findLabOrderById: vi.fn(),
  softDeleteLabOrder: vi.fn(),
}

const mockPrisma = {
  consultation: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  patient: { findFirst: vi.fn() },
  location: { findFirst: vi.fn() },
}

const mockPdf = {
  generatePrescription: vi.fn().mockResolvedValue(Buffer.from([])),
  generateInvoice: vi.fn().mockResolvedValue(Buffer.from([])),
}

describe('OrdersService', () => {
  let service: OrdersService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new OrdersService(mockRepo as never, mockPrisma as never, mockPdf as never)
    mockPrisma.consultation.findFirst.mockResolvedValue(consultation)
  })

  // ── shared: getConsultationPatient ─────────────────────────────────────────

  it('throws NotFoundException when consultation not found', async () => {
    mockPrisma.consultation.findFirst.mockResolvedValue(null)
    await expect(service.createPrescription('bad-c', 't1', 'u1', {} as never)).rejects.toThrow(
      NotFoundException,
    )
  })

  // ── Prescriptions ──────────────────────────────────────────────────────────

  describe('createPrescription', () => {
    it('creates prescription for valid consultation', async () => {
      const rx = { id: 'rx1', consultationId: 'c1' }
      mockRepo.createPrescription.mockResolvedValue(rx)
      const result = await service.createPrescription('c1', 't1', 'u1', { items: [] } as never)
      expect(result).toEqual(rx)
      expect(mockRepo.createPrescription).toHaveBeenCalledWith('t1', 'c1', 'patient-1', 'u1', {
        items: [],
      })
    })
  })

  describe('listPrescriptions', () => {
    it('returns prescriptions for valid consultation', async () => {
      const rxList = [{ id: 'rx1' }]
      mockRepo.listPrescriptionsByConsultation.mockResolvedValue(rxList)
      const result = await service.listPrescriptions('c1', 't1')
      expect(result).toEqual(rxList)
    })

    it('throws NotFoundException when consultation not found', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null)
      await expect(service.listPrescriptions('bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getPrescription', () => {
    it('returns prescription when found and matches consultation', async () => {
      const rx = { id: 'rx1', consultationId: 'c1' }
      mockRepo.findPrescriptionById.mockResolvedValue(rx)
      const result = await service.getPrescription('c1', 'rx1', 't1')
      expect(result).toEqual(rx)
    })

    it('throws NotFoundException when prescription not found', async () => {
      mockRepo.findPrescriptionById.mockResolvedValue(null)
      await expect(service.getPrescription('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when prescription belongs to different consultation', async () => {
      mockRepo.findPrescriptionById.mockResolvedValue({ id: 'rx1', consultationId: 'other-c' })
      await expect(service.getPrescription('c1', 'rx1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('deletePrescription', () => {
    it('soft-deletes prescription when found and matches consultation', async () => {
      mockRepo.findPrescriptionById.mockResolvedValue({ id: 'rx1', consultationId: 'c1' })
      mockRepo.softDeletePrescription.mockResolvedValue(undefined)
      await service.deletePrescription('c1', 'rx1', 't1')
      expect(mockRepo.softDeletePrescription).toHaveBeenCalledWith('rx1', 't1')
    })

    it('throws NotFoundException when prescription not found', async () => {
      mockRepo.findPrescriptionById.mockResolvedValue(null)
      await expect(service.deletePrescription('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when prescription belongs to different consultation', async () => {
      mockRepo.findPrescriptionById.mockResolvedValue({ id: 'rx1', consultationId: 'other' })
      await expect(service.deletePrescription('c1', 'rx1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── Imaging orders ─────────────────────────────────────────────────────────

  describe('createImagingOrder', () => {
    it('creates imaging orders for valid consultation', async () => {
      const orders = [{ id: 'img1', consultationId: 'c1' }]
      mockRepo.createImagingOrder.mockResolvedValue(orders)
      const result = await service.createImagingOrder('c1', 't1', 'u1', {} as never)
      expect(result).toEqual(orders)
    })
  })

  describe('listImagingOrders', () => {
    it('returns imaging orders', async () => {
      const orders = [{ id: 'img1' }]
      mockRepo.listImagingOrdersByConsultation.mockResolvedValue(orders)
      expect(await service.listImagingOrders('c1', 't1')).toEqual(orders)
    })
  })

  describe('getImagingOrder', () => {
    it('returns imaging order when found', async () => {
      const order = { id: 'img1', consultationId: 'c1' }
      mockRepo.findImagingOrderById.mockResolvedValue(order)
      expect(await service.getImagingOrder('c1', 'img1', 't1')).toEqual(order)
    })

    it('throws NotFoundException when not found', async () => {
      mockRepo.findImagingOrderById.mockResolvedValue(null)
      await expect(service.getImagingOrder('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when belongs to different consultation', async () => {
      mockRepo.findImagingOrderById.mockResolvedValue({ id: 'img1', consultationId: 'c2' })
      await expect(service.getImagingOrder('c1', 'img1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteImagingOrder', () => {
    it('soft-deletes imaging order when found and matches consultation', async () => {
      mockRepo.findImagingOrderById.mockResolvedValue({ id: 'img1', consultationId: 'c1' })
      mockRepo.softDeleteImagingOrder.mockResolvedValue(undefined)
      await service.deleteImagingOrder('c1', 'img1', 't1')
      expect(mockRepo.softDeleteImagingOrder).toHaveBeenCalledWith('img1', 't1')
    })

    it('throws NotFoundException when imaging order not found', async () => {
      mockRepo.findImagingOrderById.mockResolvedValue(null)
      await expect(service.deleteImagingOrder('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when imaging order belongs to different consultation', async () => {
      mockRepo.findImagingOrderById.mockResolvedValue({ id: 'img1', consultationId: 'other' })
      await expect(service.deleteImagingOrder('c1', 'img1', 't1')).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  // ── Lab orders ─────────────────────────────────────────────────────────────

  describe('createLabOrder', () => {
    it('creates lab orders for valid consultation', async () => {
      const orders = [{ id: 'lab1' }]
      mockRepo.createLabOrder.mockResolvedValue(orders)
      const result = await service.createLabOrder('c1', 't1', 'u1', {} as never)
      expect(result).toEqual(orders)
    })
  })

  describe('listLabOrders', () => {
    it('returns lab orders', async () => {
      mockRepo.listLabOrdersByConsultation.mockResolvedValue([{ id: 'lab1' }])
      expect(await service.listLabOrders('c1', 't1')).toHaveLength(1)
    })
  })

  describe('getLabOrder', () => {
    it('returns lab order when found', async () => {
      const order = { id: 'lab1', consultationId: 'c1' }
      mockRepo.findLabOrderById.mockResolvedValue(order)
      expect(await service.getLabOrder('c1', 'lab1', 't1')).toEqual(order)
    })

    it('throws NotFoundException when not found', async () => {
      mockRepo.findLabOrderById.mockResolvedValue(null)
      await expect(service.getLabOrder('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when belongs to different consultation', async () => {
      mockRepo.findLabOrderById.mockResolvedValue({ id: 'lab1', consultationId: 'c2' })
      await expect(service.getLabOrder('c1', 'lab1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('deleteLabOrder', () => {
    it('soft-deletes lab order when found and matches consultation', async () => {
      mockRepo.findLabOrderById.mockResolvedValue({ id: 'lab1', consultationId: 'c1' })
      mockRepo.softDeleteLabOrder.mockResolvedValue(undefined)
      await service.deleteLabOrder('c1', 'lab1', 't1')
      expect(mockRepo.softDeleteLabOrder).toHaveBeenCalledWith('lab1', 't1')
    })

    it('throws NotFoundException when lab order not found', async () => {
      mockRepo.findLabOrderById.mockResolvedValue(null)
      await expect(service.deleteLabOrder('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when lab order belongs to different consultation', async () => {
      mockRepo.findLabOrderById.mockResolvedValue({ id: 'lab1', consultationId: 'other' })
      await expect(service.deleteLabOrder('c1', 'lab1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── getPrescriptionPdf ─────────────────────────────────────────────────────

  describe('getPrescriptionPdf', () => {
    it('returns PDF buffer for valid prescription', async () => {
      const rx = {
        id: 'rx1',
        consultationId: 'c1',
        patientId: 'patient-1',
        doctorUserId: 'user-1',
        prescriptionItems: [],
        notes: null,
      }
      mockRepo.findPrescriptionById.mockResolvedValue(rx)
      mockPrisma.user.findFirst.mockResolvedValue({
        fullName: 'Dr. Test',
        specialty: 'Cardiology',
        licenseNumber: 'MED-001',
      })
      mockPrisma.patient.findFirst.mockResolvedValue({
        firstName: 'Ana',
        lastName: 'Reyes',
        dateOfBirth: null,
        documentNumber: '001',
        documentType: 'cedula',
      })
      mockPrisma.consultation.findFirst
        .mockResolvedValueOnce(consultation)
        .mockResolvedValueOnce({ locationId: 'loc-1' })
      mockPrisma.location.findFirst.mockResolvedValue({ name: 'Centro Médico', address: null })
      const buf = Buffer.from([1, 2, 3])
      mockPdf.generatePrescription.mockResolvedValue(buf)

      const result = await service.getPrescriptionPdf('c1', 'rx1', 't1')
      expect(result).toBe(buf)
      expect(mockPdf.generatePrescription).toHaveBeenCalledOnce()
    })

    it('throws NotFoundException when prescription not found', async () => {
      mockRepo.findPrescriptionById.mockResolvedValue(null)
      await expect(service.getPrescriptionPdf('c1', 'bad', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  // ── generateAll ────────────────────────────────────────────────────────────

  describe('generateAll', () => {
    it('generates all order types in parallel', async () => {
      const rx = { id: 'rx1' }
      const imgOrders = [{ id: 'img1' }]
      const labOrders = [{ id: 'lab1' }]
      mockRepo.createPrescription.mockResolvedValue(rx)
      mockRepo.createImagingOrder.mockResolvedValue(imgOrders)
      mockRepo.createLabOrder.mockResolvedValue(labOrders)

      const dto = {
        prescriptions: [{ items: [] }],
        imagingOrders: [{ orders: [] }],
        labOrders: [{ orders: [] }],
      }
      const result = await service.generateAll('c1', 't1', 'u1', dto as never)
      expect(result.prescriptions).toHaveLength(1)
      expect(result.imagingOrders).toHaveLength(1)
      expect(result.labOrders).toHaveLength(1)
    })

    it('handles empty order lists', async () => {
      const dto = { prescriptions: [], imagingOrders: [], labOrders: [] }
      const result = await service.generateAll('c1', 't1', 'u1', dto as never)
      expect(result.prescriptions).toHaveLength(0)
      expect(result.imagingOrders).toHaveLength(0)
      expect(result.labOrders).toHaveLength(0)
    })

    it('throws NotFoundException when consultation not found', async () => {
      mockPrisma.consultation.findFirst.mockResolvedValue(null)
      await expect(
        service.generateAll('bad', 't1', 'u1', {
          prescriptions: [],
          imagingOrders: [],
          labOrders: [],
        } as never),
      ).rejects.toThrow(NotFoundException)
    })
  })
})
