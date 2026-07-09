/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrdersController } from '../orders.controller.js'
import type { OrdersService } from '../orders.service.js'
import type { AuthUser } from '@rezeta/shared'

vi.mock('../../../lib/pdf.service.js', () => ({
  PdfService: class {
    generatePrescription = vi.fn().mockResolvedValue(Buffer.from([]))
    generateInvoice = vi.fn().mockResolvedValue(Buffer.from([]))
    generateImagingOrderGroup = vi.fn().mockResolvedValue(Buffer.from([]))
    generateLabOrderGroup = vi.fn().mockResolvedValue(Buffer.from([]))
  },
}))

const mockUser: AuthUser = {
  id: 'user-1',
  externalUid: 'ext-1',
  tenantId: 'tenant-1',
  email: 'doc@test.com',
  fullName: 'Dr. Test',
  role: 'owner',
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: '2026-01-01T00:00:00Z',
  preferences: {},
}
const tenantId = 'tenant-1'
const consultationId = 'c1'

const mockPrescription = {
  id: 'presc1',
  tenantId,
  consultationId,
  patientId: 'p1',
  groupTitle: null,
  groupOrder: 1,
  status: 'draft',
  signedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  items: [],
}
const mockImagingOrder = {
  id: 'img1',
  tenantId,
  consultationId,
  patientId: 'p1',
  groupTitle: null,
  groupOrder: 1,
  studyType: 'Rx Tórax',
  indication: 'Test',
  urgency: 'routine',
  contrast: false,
  fastingRequired: false,
  specialInstructions: null,
  source: null,
  status: 'draft',
  signedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}
const mockLabOrder = {
  id: 'lab1',
  tenantId,
  consultationId,
  patientId: 'p1',
  groupTitle: null,
  groupOrder: 1,
  testName: 'CBC',
  testCode: null,
  indication: 'Test',
  urgency: 'routine',
  fastingRequired: false,
  sampleType: 'blood',
  specialInstructions: null,
  source: null,
  status: 'draft',
  signedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
}

describe('OrdersController', () => {
  let controller: OrdersController
  let svc: OrdersService

  beforeEach(() => {
    svc = {
      listPrescriptions: vi.fn(),
      getPrescription: vi.fn(),
      createPrescription: vi.fn(),
      deletePrescription: vi.fn(),
      getPrescriptionPdf: vi.fn(),
      listImagingOrders: vi.fn(),
      getImagingOrder: vi.fn(),
      createImagingOrder: vi.fn(),
      deleteImagingOrder: vi.fn(),
      patchImagingOrder: vi.fn(),
      renameImagingOrderGroup: vi.fn(),
      getImagingOrderGroupPdf: vi.fn(),
      listLabOrders: vi.fn(),
      getLabOrder: vi.fn(),
      createLabOrder: vi.fn(),
      deleteLabOrder: vi.fn(),
      patchLabOrder: vi.fn(),
      renameLabOrderGroup: vi.fn(),
      getLabOrderGroupPdf: vi.fn(),
      generateAll: vi.fn(),
      getOrdersForConsultation: vi.fn(),
    } as unknown as OrdersService
    controller = new OrdersController(svc)
  })

  it('getOrders delegates to service', async () => {
    const combined = { prescriptions: [], imagingOrders: [], labOrders: [] }
    vi.mocked(svc.getOrdersForConsultation).mockResolvedValue(combined)
    const result = await controller.getOrders(tenantId, consultationId)
    expect(svc.getOrdersForConsultation).toHaveBeenCalledWith(consultationId, tenantId)
    expect(result).toEqual(combined)
  })

  it('downloadPrescriptionPdf streams PDF buffer', async () => {
    const buf = Buffer.from([1, 2, 3])
    vi.mocked(svc.getPrescriptionPdf).mockResolvedValue(buf)
    const res = { set: vi.fn(), end: vi.fn() }
    await controller.downloadPrescriptionPdf(tenantId, consultationId, 'presc1', res as never)
    expect(svc.getPrescriptionPdf).toHaveBeenCalledWith(consultationId, 'presc1', tenantId)
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/pdf' }),
    )
    expect(res.end).toHaveBeenCalledWith(buf)
  })

  it('listPrescriptions delegates to service', async () => {
    vi.mocked(svc.listPrescriptions).mockResolvedValue([mockPrescription as never])
    const result = await controller.listPrescriptions(tenantId, consultationId)
    expect(svc.listPrescriptions).toHaveBeenCalledWith(consultationId, tenantId)
    expect(result).toHaveLength(1)
  })

  it('getPrescription delegates to service', async () => {
    vi.mocked(svc.getPrescription).mockResolvedValue(mockPrescription as never)
    await controller.getPrescription(tenantId, consultationId, 'presc1')
    expect(svc.getPrescription).toHaveBeenCalledWith(consultationId, 'presc1', tenantId)
  })

  it('createPrescription delegates to service', async () => {
    vi.mocked(svc.createPrescription).mockResolvedValue(mockPrescription as never)
    const dto = { items: [], groupOrder: 1 }
    await controller.createPrescription(tenantId, mockUser, consultationId, dto as never)
    expect(svc.createPrescription).toHaveBeenCalledWith(consultationId, tenantId, 'user-1', dto)
  })

  it('deletePrescription delegates to service', async () => {
    vi.mocked(svc.deletePrescription).mockResolvedValue(undefined)
    await controller.deletePrescription(tenantId, consultationId, 'presc1')
    expect(svc.deletePrescription).toHaveBeenCalledWith(consultationId, 'presc1', tenantId)
  })

  it('listImagingOrders delegates to service', async () => {
    vi.mocked(svc.listImagingOrders).mockResolvedValue([mockImagingOrder as never])
    const result = await controller.listImagingOrders(tenantId, consultationId)
    expect(svc.listImagingOrders).toHaveBeenCalledWith(consultationId, tenantId)
    expect(result).toHaveLength(1)
  })

  it('getImagingOrder delegates to service', async () => {
    vi.mocked(svc.getImagingOrder).mockResolvedValue(mockImagingOrder as never)
    await controller.getImagingOrder(tenantId, consultationId, 'img1')
    expect(svc.getImagingOrder).toHaveBeenCalledWith(consultationId, 'img1', tenantId)
  })

  it('createImagingOrder delegates to service', async () => {
    vi.mocked(svc.createImagingOrder).mockResolvedValue([mockImagingOrder as never])
    const dto = { orders: [], groupOrder: 1 }
    await controller.createImagingOrder(tenantId, mockUser, consultationId, dto as never)
    expect(svc.createImagingOrder).toHaveBeenCalledWith(consultationId, tenantId, 'user-1', dto)
  })

  it('deleteImagingOrder delegates to service', async () => {
    vi.mocked(svc.deleteImagingOrder).mockResolvedValue(undefined)
    await controller.deleteImagingOrder(tenantId, consultationId, 'img1')
    expect(svc.deleteImagingOrder).toHaveBeenCalledWith(consultationId, 'img1', tenantId)
  })

  it('listLabOrders delegates to service', async () => {
    vi.mocked(svc.listLabOrders).mockResolvedValue([mockLabOrder as never])
    const result = await controller.listLabOrders(tenantId, consultationId)
    expect(svc.listLabOrders).toHaveBeenCalledWith(consultationId, tenantId)
    expect(result).toHaveLength(1)
  })

  it('getLabOrder delegates to service', async () => {
    vi.mocked(svc.getLabOrder).mockResolvedValue(mockLabOrder as never)
    await controller.getLabOrder(tenantId, consultationId, 'lab1')
    expect(svc.getLabOrder).toHaveBeenCalledWith(consultationId, 'lab1', tenantId)
  })

  it('createLabOrder delegates to service', async () => {
    vi.mocked(svc.createLabOrder).mockResolvedValue([mockLabOrder as never])
    const dto = { orders: [], groupOrder: 1 }
    await controller.createLabOrder(tenantId, mockUser, consultationId, dto as never)
    expect(svc.createLabOrder).toHaveBeenCalledWith(consultationId, tenantId, 'user-1', dto)
  })

  it('deleteLabOrder delegates to service', async () => {
    vi.mocked(svc.deleteLabOrder).mockResolvedValue(undefined)
    await controller.deleteLabOrder(tenantId, consultationId, 'lab1')
    expect(svc.deleteLabOrder).toHaveBeenCalledWith(consultationId, 'lab1', tenantId)
  })

  it('generateAll delegates to service', async () => {
    const expected = { prescriptions: [], imagingOrders: [], labOrders: [] }
    vi.mocked(svc.generateAll).mockResolvedValue(expected)
    const dto = { prescriptions: [], imagingOrders: [], labOrders: [] }
    const result = await controller.generateAll(tenantId, mockUser, consultationId, dto as never)
    expect(svc.generateAll).toHaveBeenCalledWith(consultationId, tenantId, 'user-1', dto)
    expect(result).toEqual(expected)
  })

  it('downloadImagingOrderGroupPdf streams PDF buffer', async () => {
    const buf = Buffer.from([4, 5, 6])
    vi.mocked(svc.getImagingOrderGroupPdf).mockResolvedValue(buf)
    const res = { set: vi.fn(), end: vi.fn() }
    await controller.downloadImagingOrderGroupPdf(
      tenantId,
      mockUser,
      consultationId,
      1,
      res as never,
    )
    expect(svc.getImagingOrderGroupPdf).toHaveBeenCalledWith(consultationId, 1, tenantId, 'user-1')
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/pdf' }),
    )
    expect(res.end).toHaveBeenCalledWith(buf)
  })

  it('renameImagingOrderGroup delegates to service', async () => {
    vi.mocked(svc.renameImagingOrderGroup).mockResolvedValue([mockImagingOrder as never])
    const dto = { groupTitle: 'Nuevo nombre' }
    await controller.renameImagingOrderGroup(tenantId, consultationId, 1, dto)
    expect(svc.renameImagingOrderGroup).toHaveBeenCalledWith(consultationId, 1, tenantId, dto)
  })

  it('patchImagingOrder delegates to service', async () => {
    vi.mocked(svc.patchImagingOrder).mockResolvedValue(mockImagingOrder as never)
    const dto = { groupOrder: 2 }
    await controller.patchImagingOrder(tenantId, consultationId, 'img1', dto)
    expect(svc.patchImagingOrder).toHaveBeenCalledWith(consultationId, 'img1', tenantId, dto)
  })

  it('downloadLabOrderGroupPdf streams PDF buffer', async () => {
    const buf = Buffer.from([7, 8, 9])
    vi.mocked(svc.getLabOrderGroupPdf).mockResolvedValue(buf)
    const res = { set: vi.fn(), end: vi.fn() }
    await controller.downloadLabOrderGroupPdf(tenantId, mockUser, consultationId, 1, res as never)
    expect(svc.getLabOrderGroupPdf).toHaveBeenCalledWith(consultationId, 1, tenantId, 'user-1')
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/pdf' }),
    )
    expect(res.end).toHaveBeenCalledWith(buf)
  })

  it('renameLabOrderGroup delegates to service', async () => {
    vi.mocked(svc.renameLabOrderGroup).mockResolvedValue([mockLabOrder as never])
    const dto = { groupTitle: 'Resultados CBC' }
    await controller.renameLabOrderGroup(tenantId, consultationId, 1, dto)
    expect(svc.renameLabOrderGroup).toHaveBeenCalledWith(consultationId, 1, tenantId, dto)
  })

  it('patchLabOrder delegates to service', async () => {
    vi.mocked(svc.patchLabOrder).mockResolvedValue(mockLabOrder as never)
    const dto = { groupOrder: 2 }
    await controller.patchLabOrder(tenantId, consultationId, 'lab1', dto)
    expect(svc.patchLabOrder).toHaveBeenCalledWith(consultationId, 'lab1', tenantId, dto)
  })
})
