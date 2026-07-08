import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrdersRepository } from '../orders.repository.js'

// ── helpers ────────────────────────────────────────────────────────────────

const now = new Date('2026-01-01T00:00:00Z')

function makeRxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rx1',
    tenantId: 't1',
    patientId: 'p1',
    doctorId: 'u1',
    consultationId: 'c1',
    groupTitle: null,
    groupOrder: 1,
    status: 'queued',
    prescriptionItems: [],
    pdfUrl: null,
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
    doctorId: 'u1',
    groupTitle: null,
    groupOrder: 1,
    status: 'queued',
    signedAt: null,
    pdfUrl: null,
    items: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeImagingItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'iitem1',
    imagingOrderId: 'img1',
    studyType: 'Rx Tórax',
    indication: 'Disnea',
    urgency: 'routine',
    contrast: false,
    fastingRequired: false,
    specialInstructions: null,
    source: null,
    createdAt: now,
    ...overrides,
  }
}

function makeLabRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lab1',
    tenantId: 't1',
    consultationId: 'c1',
    patientId: 'p1',
    doctorId: 'u1',
    groupTitle: null,
    groupOrder: 1,
    status: 'queued',
    signedAt: null,
    pdfUrl: null,
    items: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

function makeLabItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'litem1',
    labOrderId: 'lab1',
    testName: 'Hemograma',
    indication: 'Anemia',
    urgency: 'routine',
    fastingRequired: false,
    sampleType: 'blood',
    specialInstructions: null,
    source: null,
    createdAt: now,
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
        items: [
          { drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID', duration: '5d' },
        ],
      }
      const result = await repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result.id).toBe('rx1')
      expect(result.prescriptionItems[0].drug).toBe('Ibuprofeno')
      expect(result.createdAt).toBe(now.toISOString())
    })

    it('passes clientRequestId through to the create call', async () => {
      mockPrisma.prescription.create.mockResolvedValue(makeRxRow())
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID' }],
      }
      await repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)
      expect(mockPrisma.prescription.create.mock.calls[0][0].data).toMatchObject({
        clientRequestId: 'req_abc12345',
      })
    })

    it('on P2002 unique-constraint violation, re-fetches and returns the existing row', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      mockPrisma.prescription.create.mockRejectedValueOnce(p2002)
      const existing = makeRxRow({ id: 'rx-existing' })
      mockPrisma.prescription.findFirst.mockResolvedValueOnce(existing)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID' }],
      }
      const result = await repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)

      expect(result.id).toBe('rx-existing')
      expect(mockPrisma.prescription.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultationId: 'c1',
            clientRequestId: 'req_abc12345',
            tenantId: 't1',
          }),
        }),
      )
    })

    it('re-throws non-P2002 errors', async () => {
      const dbError = new Error('DB connection lost')
      mockPrisma.prescription.create.mockRejectedValueOnce(dbError)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID' }],
      }
      await expect(repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)).rejects.toThrow(
        'DB connection lost',
      )
      expect(mockPrisma.prescription.findFirst).not.toHaveBeenCalled()
    })

    it('re-throws P2002 when no clientRequestId was sent (no dedup key to refetch by)', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      mockPrisma.prescription.create.mockRejectedValueOnce(p2002)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        items: [{ drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID' }],
      }
      await expect(repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)).rejects.toBe(
        p2002,
      )
      expect(mockPrisma.prescription.findFirst).not.toHaveBeenCalled()
    })

    it('re-throws P2002 if the re-fetch finds nothing (extreme edge case)', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      mockPrisma.prescription.create.mockRejectedValueOnce(p2002)
      mockPrisma.prescription.findFirst.mockResolvedValueOnce(null)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ drug: 'Ibuprofeno', dose: '400mg', route: 'oral', frequency: 'TID' }],
      }
      await expect(repo.createPrescription('t1', 'c1', 'p1', 'u1', dto as never)).rejects.toBe(
        p2002,
      )
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
        where: { id: 'rx1', tenantId: 't1' },
        data: { pdfUrl: 'https://example.com/rx.pdf' },
      })
    })
  })

  // ── Imaging Orders ─────────────────────────────────────────────────────────

  describe('createImagingOrder', () => {
    it('creates imaging orders for each item in dto', async () => {
      mockPrisma.imagingOrder.create.mockResolvedValue(
        makeImagingRow({ items: [makeImagingItem()] }),
      )
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        items: [
          {
            studyType: 'Rx Tórax',
            indication: 'Disnea',
            urgency: 'routine',
            contrast: false,
            fastingRequired: false,
          },
        ],
      }
      const result = await repo.createImagingOrder('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result).toHaveLength(1)
      expect(result[0].items[0].studyType).toBe('Rx Tórax')
    })

    it('on P2002 unique-constraint violation, re-fetches and returns the existing group', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      mockPrisma.imagingOrder.create.mockRejectedValueOnce(p2002)
      const existing = makeImagingRow({ id: 'img-existing', items: [makeImagingItem()] })
      mockPrisma.imagingOrder.findFirst.mockResolvedValueOnce(existing)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ studyType: 'Rx Tórax', indication: 'Disnea', urgency: 'routine' }],
      }
      const result = await repo.createImagingOrder('t1', 'c1', 'p1', 'u1', dto as never)

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('img-existing')
      expect(mockPrisma.imagingOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultationId: 'c1',
            clientRequestId: 'req_abc12345',
            tenantId: 't1',
          }),
        }),
      )
    })

    it('re-throws non-P2002 errors', async () => {
      const dbError = new Error('DB connection lost')
      mockPrisma.imagingOrder.create.mockRejectedValueOnce(dbError)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ studyType: 'Rx Tórax', indication: 'Disnea', urgency: 'routine' }],
      }
      await expect(repo.createImagingOrder('t1', 'c1', 'p1', 'u1', dto as never)).rejects.toThrow(
        'DB connection lost',
      )
      expect(mockPrisma.imagingOrder.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('findImagingOrderById', () => {
    it('returns mapped imaging order when found', async () => {
      mockPrisma.imagingOrder.findFirst.mockResolvedValue(
        makeImagingRow({ items: [makeImagingItem()] }),
      )
      const result = await repo.findImagingOrderById('img1', 't1')
      expect(result?.id).toBe('img1')
      expect(result?.items[0].urgency).toBe('routine')
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
    it('creates lab orders for each item in dto', async () => {
      mockPrisma.labOrder.create.mockResolvedValue(makeLabRow({ items: [makeLabItem()] }))
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        items: [
          {
            testName: 'Hemograma',
            testCode: 'CBC',
            indication: 'Anemia',
            urgency: 'routine',
            fastingRequired: false,
            sampleType: 'blood',
          },
        ],
      }
      const result = await repo.createLabOrder('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result).toHaveLength(1)
      expect(result[0].items[0].testName).toBe('Hemograma')
    })

    it('on P2002 unique-constraint violation, re-fetches and returns the existing group', async () => {
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
      mockPrisma.labOrder.create.mockRejectedValueOnce(p2002)
      const existing = makeLabRow({ id: 'lab-existing', items: [makeLabItem()] })
      mockPrisma.labOrder.findFirst.mockResolvedValueOnce(existing)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ testName: 'Hemograma', indication: 'Anemia', urgency: 'routine' }],
      }
      const result = await repo.createLabOrder('t1', 'c1', 'p1', 'u1', dto as never)

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('lab-existing')
      expect(mockPrisma.labOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            consultationId: 'c1',
            clientRequestId: 'req_abc12345',
            tenantId: 't1',
          }),
        }),
      )
    })

    it('re-throws non-P2002 errors', async () => {
      const dbError = new Error('DB connection lost')
      mockPrisma.labOrder.create.mockRejectedValueOnce(dbError)

      const dto = {
        groupTitle: null,
        groupOrder: 1,
        clientRequestId: 'req_abc12345',
        items: [{ testName: 'Hemograma', indication: 'Anemia', urgency: 'routine' }],
      }
      await expect(repo.createLabOrder('t1', 'c1', 'p1', 'u1', dto as never)).rejects.toThrow(
        'DB connection lost',
      )
      expect(mockPrisma.labOrder.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('findLabOrderById', () => {
    it('returns mapped lab order when found', async () => {
      mockPrisma.labOrder.findFirst.mockResolvedValue(makeLabRow({ items: [makeLabItem()] }))
      const result = await repo.findLabOrderById('lab1', 't1')
      expect(result?.id).toBe('lab1')
      expect(result?.items[0].sampleType).toBe('blood')
    })

    it('returns null when not found', async () => {
      mockPrisma.labOrder.findFirst.mockResolvedValue(null)
      expect(await repo.findLabOrderById('bad', 't1')).toBeNull()
    })
  })

  describe('listLabOrdersByConsultation', () => {
    it('returns list of mapped lab orders', async () => {
      mockPrisma.labOrder.findMany.mockResolvedValue([makeLabRow({ items: [makeLabItem()] })])
      const result = await repo.listLabOrdersByConsultation('c1', 't1')
      expect(result).toHaveLength(1)
      expect(result[0].items[0].testName).toBe('Hemograma')
    })
  })

  // ── getOrdersForConsultation ───────────────────────────────────────────────

  describe('getOrdersForConsultation', () => {
    it('returns combined prescriptions, imaging orders, and lab orders', async () => {
      mockPrisma.prescription.findMany.mockResolvedValue([makeRxRow()])
      mockPrisma.imagingOrder.findMany.mockResolvedValue([makeImagingRow({ items: [makeImagingItem()] })])
      mockPrisma.labOrder.findMany.mockResolvedValue([makeLabRow({ items: [makeLabItem()] })])
      const result = await repo.getOrdersForConsultation('c1', 't1')
      expect(result.prescriptions).toHaveLength(1)
      expect(result.imagingOrders).toHaveLength(1)
      expect(result.labOrders).toHaveLength(1)
    })

    it('filters by consultationId and tenantId for all order types', async () => {
      mockPrisma.prescription.findMany.mockResolvedValue([])
      mockPrisma.imagingOrder.findMany.mockResolvedValue([])
      mockPrisma.labOrder.findMany.mockResolvedValue([])
      await repo.getOrdersForConsultation('c1', 't1')
      const rxWhere = mockPrisma.prescription.findMany.mock.calls[0][0].where
      expect(rxWhere).toMatchObject({ consultationId: 'c1', tenantId: 't1', deletedAt: null })
      const imgWhere = mockPrisma.imagingOrder.findMany.mock.calls[0][0].where
      expect(imgWhere).toMatchObject({ consultationId: 'c1', tenantId: 't1', deletedAt: null })
      const labWhere = mockPrisma.labOrder.findMany.mock.calls[0][0].where
      expect(labWhere).toMatchObject({ consultationId: 'c1', tenantId: 't1', deletedAt: null })
    })

    it('returns empty arrays when no orders exist', async () => {
      mockPrisma.prescription.findMany.mockResolvedValue([])
      mockPrisma.imagingOrder.findMany.mockResolvedValue([])
      mockPrisma.labOrder.findMany.mockResolvedValue([])
      const result = await repo.getOrdersForConsultation('c1', 't1')
      expect(result.prescriptions).toHaveLength(0)
      expect(result.imagingOrders).toHaveLength(0)
      expect(result.labOrders).toHaveLength(0)
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
        makeImagingRow({ signedAt: null, pdfUrl: null, groupTitle: null }),
      )
      const result = await repo.findImagingOrderById('img1', 't1')
      expect(result?.signedAt).toBeNull()
      expect(result?.pdfUrl).toBeNull()
      expect(result?.groupTitle).toBeNull()
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

    it('createLabOrder maps all required item fields', async () => {
      mockPrisma.labOrder.create.mockResolvedValue(makeLabRow({ items: [makeLabItem()] }))
      const dto = {
        groupTitle: null,
        groupOrder: 1,
        items: [
          {
            testName: 'Hemograma',
            indication: 'Anemia',
            urgency: 'routine',
            fastingRequired: false,
            sampleType: 'blood',
          },
        ],
      }
      const result = await repo.createLabOrder('t1', 'c1', 'p1', 'u1', dto as never)
      expect(result[0].items[0].testName).toBe('Hemograma')
      expect(result[0].items[0].sampleType).toBe('blood')
    })
  })
})
