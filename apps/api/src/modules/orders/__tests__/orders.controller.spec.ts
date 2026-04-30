/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OrdersController } from '../orders.controller.js'
import type { OrdersService } from '../orders.service.js'
import type { AuthUser } from '@rezeta/shared'

const mockUser: AuthUser = { id: 'user-1', tenantId: 'tenant-1', email: 'doc@test.com', role: 'owner' }
const tenantId = 'tenant-1'
const consultationId = 'c1'

const mockPrescription = { id: 'presc1', tenantId, consultationId, patientId: 'p1', groupTitle: null, groupOrder: 1, status: 'draft', signedAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null, items: [] }
const mockImagingOrder = { id: 'img1', tenantId, consultationId, patientId: 'p1', groupTitle: null, groupOrder: 1, studyType: 'Rx Tórax', indication: 'Test', urgency: 'routine', contrast: false, fastingRequired: false, specialInstructions: null, source: null, status: 'draft', signedAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }
const mockLabOrder = { id: 'lab1', tenantId, consultationId, patientId: 'p1', groupTitle: null, groupOrder: 1, testName: 'CBC', testCode: null, indication: 'Test', urgency: 'routine', fastingRequired: false, sampleType: 'blood', specialInstructions: null, source: null, status: 'draft', signedAt: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }

describe('OrdersController', () => {
  let controller: OrdersController
  let svc: OrdersService

  beforeEach(() => {
    svc = {
      listPrescriptions: vi.fn(),
      getPrescription: vi.fn(),
      createPrescription: vi.fn(),
      listImagingOrders: vi.fn(),
      getImagingOrder: vi.fn(),
      createImagingOrder: vi.fn(),
      listLabOrders: vi.fn(),
      getLabOrder: vi.fn(),
      createLabOrder: vi.fn(),
      generateAll: vi.fn(),
    } as unknown as OrdersService
    controller = new OrdersController(svc)
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

  it('generateAll delegates to service', async () => {
    const expected = { prescriptions: [], imagingOrders: [], labOrders: [] }
    vi.mocked(svc.generateAll).mockResolvedValue(expected)
    const dto = { prescriptions: [], imagingOrders: [], labOrders: [] }
    const result = await controller.generateAll(tenantId, mockUser, consultationId, dto as never)
    expect(svc.generateAll).toHaveBeenCalledWith(consultationId, tenantId, 'user-1', dto)
    expect(result).toEqual(expected)
  })
})
