import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrdersRepository } from '../orders.repository.js'

// ── helpers ────────────────────────────────────────────────────────────────

const now = new Date('2026-01-01T00:00:00Z')

function makeRxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rx1',
    tenantId: 't1',
    patientId: 'p1',
    userId: 'u1',
    consultationId: 'c1',
    groupTitle: null,
    groupOrder: 1,
    status: 'draft',
    items: [],
    prescriptionItems: [],
    pdfUrl: null,
    notes: null,
    signedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeImagingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'img1',
    tenantId: 't1',
    consultationId: 'c1',
    patientId: 'p1',
    userId: 'u1',
    groupTitle: null,
    groupOrder: 1,
    studyType: 'Rx Tórax',
    indication: 'Disnea',
    urgency: 'routine',
    contrast: false,
    fastingRequired: false,
    specialInstructions: null,
    source: null,
    status: 'draft',
    signedAt: null,
    pdfUrl: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeLabRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lab1',
    tenantId: 't1',
    consultationId: 'c1',
    patientId: 'p1',
    userId: 'u1',
    groupTitle: null,
    groupOrder: 1,
    testName: 'Hemograma',
    testCode: 'CBC',
    indication: 'Anemia',
    urgency: 'routine',
    fastingRequired: false,
    sampleType: 'blood',
    specialInstructions: null,
    source: null,
    status: 'draft',
    signedAt: null,
    pdfUrl: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

const mockPrisma = {
  prescription: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  imagingOrder: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  labOrder: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}

describe('OrdersRepository', () => {
  let repo: OrdersRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new OrdersRepository(mockPrisma as never)
  })

  // ── Prescriptions ──────────────────────────────────────────────────────────

  describe('createPrescription', () => {
    it('creates prescription and maps to domain model', async () => {
      const row = makeRxRow({
        prescriptionItems: [
          {
            id: 'item1',
            prescriptionId: 'rx1',
            drug: 'Ibuprofeno',
            dose: '400mg',
            route: 'oral',
            frequency: 'TID',
            duration: '5d',
            notes: null,
            source: null,
            sortOrder: 1,
            createdAt: now,
          },
        ],
      })
      mockPrisma.prescription.create.mockResolvedValue(row)
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        items: [{ drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID', duration: '5d' }],
      }
      const result = await repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result.id).toBe('rx1')
      expect(result.prescriptionItems[0].drug).toBe('Ibuprofeno')
      expect(result.createdAt).toBe(now.toISOString())
    })
  })

  describe('findPrescriptionById', () => {
    it('returns mapped prescription when found', async () => {
      mockPrisma.prescription.findFirst.mockResolvedValue(makeRxRow())
      const result = await repo.findPrescriptionById('rx1', 't1')
      expect(result?.id).toBe('rx1')
    })

    it('returns null when not found', async () => {
      mockPrisma.prescription.findFirst.mockResolvedValue(null)
      expect(await repo.findPrescriptionById('bad', 't1')).toBeNull()
    })
  })

  describe('listPrescriptionsByConsultation', () => {
    it('returns mapped list', async () => {
      mockPrisma.prescription.findMany.mockResolvedValue([makeRxRow()])
      const result = await repo.listPrescriptionsByConsultation('c1', 't1')
      expect(result).toHaveLength(1)
      expect(result[0].consultationId).toBe('c1')
    })
  })

  describe('updatePrescriptionPdfUrl', () => {
    it('calls prisma update', async () => {
      mockPrisma.prescription.update.mockResolvedValue({})
      await repo.updatePrescriptionPdfUrl('rx1', 't1', 'https://example.com/rx.pdf')
      expect(mockPrisma.prescription.update).toHaveBeenCalledWith({
        where: { id: 'rx1' },
        data: { pdfUrl: 'https://example.com/rx.pdf' },
      })
    })
  })

  // ── Imaging Orders ─────────────────────────────────────────────────────────

  describe('createImagingOrder', () => {
    it('creates imaging orders for each order in dto', async () => {
      mockPrisma.imagingOrder.create.mockResolvedValue(makeImagingRow())
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        orders: [
          {
            study_type: 'Rx Tórax',
            indication: 'Disnea',
            urgency: 'routine',
            contrast: false,
            fasting_required: false,
          },
        ],
      }
      const result = await repo.createImagingOrder('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result).toHaveLength(1)
      expect(result[0].studyType).toBe('Rx Tórax')
    })
  })

  describe('findImagingOrderById', () => {
    it('returns mapped imaging order when found', async () => {
      mockPrisma.imagingOrder.findFirst.mockResolvedValue(makeImagingRow())
      const result = await repo.findImagingOrderById('img1', 't1')
      expect(result?.id).toBe('img1')
      expect(result?.urgency).toBe('routine')
    })

    it('returns null when not found', async () => {
      mockPrisma.imagingOrder.findFirst.mockResolvedValue(null)
      expect(await repo.findImagingOrderById('bad', 't1')).toBeNull()
    })
  })

  describe('listImagingOrdersByConsultation', () => {
    it('returns list of mapped imaging orders', async () => {
      mockPrisma.imagingOrder.findMany.mockResolvedValue([makeImagingRow()])
      const result = await repo.listImagingOrdersByConsultation('c1', 't1')
      expect(result).toHaveLength(1)
    })
  })

  // ── Lab Orders ─────────────────────────────────────────────────────────────

  describe('createLabOrder', () => {
    it('creates lab orders for each order in dto', async () => {
      mockPrisma.labOrder.create.mockResolvedValue(makeLabRow())
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        orders: [
          {
            test_name: 'Hemograma',
            test_code: 'CBC',
            indication: 'Anemia',
            urgency: 'routine',
            fasting_required: false,
            sample_type: 'blood',
          },
        ],
      }
      const result = await repo.createLabOrder('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result).toHaveLength(1)
      expect(result[0].testName).toBe('Hemograma')
    })
  })

  describe('findLabOrderById', () => {
    it('returns mapped lab order when found', async () => {
      mockPrisma.labOrder.findFirst.mockResolvedValue(makeLabRow())
      const result = await repo.findLabOrderById('lab1', 't1')
      expect(result?.id).toBe('lab1')
      expect(result?.sampleType).toBe('blood')
    })

    it('returns null when not found', async () => {
      mockPrisma.labOrder.findFirst.mockResolvedValue(null)
      expect(await repo.findLabOrderById('bad', 't1')).toBeNull()
    })
  })

  describe('listLabOrdersByConsultation', () => {
    it('returns list of mapped lab orders', async () => {
      mockPrisma.labOrder.findMany.mockResolvedValue([makeLabRow()])
      const result = await repo.listLabOrdersByConsultation('c1', 't1')
      expect(result).toHaveLength(1)
      expect(result[0].testCode).toBe('CBC')
    })
  })

  // ── mapping edge cases ─────────────────────────────────────────────────────

  describe('field mapping', () => {
    it('maps signedAt date to ISO string for prescriptions', async () => {
      const signed = new Date('2026-03-15T10:00:00Z')
      mockPrisma.prescription.findFirst.mockResolvedValue(makeRxRow({ signedAt: signed }))
      const result = await repo.findPrescriptionById('rx1', 't1')
      expect(result?.signedAt).toBe(signed.toISOString())
    })

    it('maps null optional fields for imaging orders', async () => {
      mockPrisma.imagingOrder.findFirst.mockResolvedValue(
        makeImagingRow({ signedAt: null, pdfUrl: null, groupTitle: null, source: null }),
      )
      const result = await repo.findImagingOrderById('img1', 't1')
      expect(result?.signedAt).toBeNull()
      expect(result?.pdfUrl).toBeNull()
      expect(result?.groupTitle).toBeNull()
    })

    it('maps null testCode for lab orders', async () => {
      mockPrisma.labOrder.findFirst.mockResolvedValue(makeLabRow({ testCode: null }))
      const result = await repo.findLabOrderById('lab1', 't1')
      expect(result?.testCode).toBeNull()
    })

    it('maps non-null deletedAt for imaging orders', async () => {
      const deleted = new Date('2026-06-01T00:00:00Z')
      mockPrisma.imagingOrder.findFirst.mockResolvedValue(makeImagingRow({ deletedAt: deleted }))
      const result = await repo.findImagingOrderById('img1', 't1')
      expect(result?.deletedAt).toBe(deleted.toISOString())
    })

    it('maps non-null signedAt and deletedAt for lab orders', async () => {
      const signed = new Date('2026-03-15T10:00:00Z')
      const deleted = new Date('2026-06-01T00:00:00Z')
      mockPrisma.labOrder.findFirst.mockResolvedValue(
        makeLabRow({ signedAt: signed, deletedAt: deleted }),
      )
      const result = await repo.findLabOrderById('lab1', 't1')
      expect(result?.signedAt).toBe(signed.toISOString())
      expect(result?.deletedAt).toBe(deleted.toISOString())
    })

    it('createLabOrder uses null when test_code is undefined', async () => {
      mockPrisma.labOrder.create.mockResolvedValue(makeLabRow({ testCode: null }))
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        orders: [
          {
            test_name: 'Hemograma',
            indication: 'Anemia',
            urgency: 'routine',
            fasting_required: false,
            sample_type: 'blood',
          },
        ],
      }
      const result = await repo.createLabOrder('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result[0].testCode).toBeNull()
    })
  })
})
