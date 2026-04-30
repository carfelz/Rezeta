/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationsController } from '../consultations.controller.js'
import type { ConsultationsService } from '../consultations.service.js'
import type { AuthUser, ConsultationWithDetails, ConsultationProtocolUsage } from '@rezeta/shared'

const mockUser: AuthUser = { id: 'user-1', tenantId: 'tenant-1', email: 'doc@test.com', role: 'owner' }
const tenantId = 'tenant-1'

function makeConsultation(id = 'c1'): ConsultationWithDetails {
  return {
    id,
    tenantId: 'tenant-1',
    patientId: 'p1',
    locationId: 'l1',
    doctorUserId: 'user-1',
    appointmentId: null,
    status: 'draft',
    chiefComplaint: null,
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    vitals: null,
    diagnoses: [],
    contentHash: null,
    signedAt: null,
    signedBy: null,
    consultedAt: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    patientName: 'Ana Reyes',
    locationName: 'Clínica Central',
    amendments: [],
    protocolUsages: [],
  }
}

function makeUsage(): ConsultationProtocolUsage {
  return {
    id: 'usage-1',
    consultationId: 'c1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    protocolId: 'proto-1',
    protocolVersionId: 'ver-1',
    content: {},
    parentUsageId: null,
    triggerBlockId: null,
    depth: 0,
    status: 'in_progress',
    checkedState: {},
    completedAt: null,
    notes: null,
    modifications: null,
    modificationSummary: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

describe('ConsultationsController', () => {
  let controller: ConsultationsController
  let svc: ConsultationsService

  beforeEach(() => {
    svc = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      sign: vi.fn(),
      amend: vi.fn(),
      remove: vi.fn(),
      addProtocolUsage: vi.fn(),
      getProtocolUsage: vi.fn(),
      updateProtocolUsage: vi.fn(),
      updateCheckedState: vi.fn(),
      removeProtocolUsage: vi.fn(),
    } as unknown as ConsultationsService
    controller = new ConsultationsController(svc)
  })

  it('list delegates to service with tenantId and userId', async () => {
    vi.mocked(svc.list).mockResolvedValue([makeConsultation()])
    const result = await controller.list(tenantId, mockUser)
    expect(svc.list).toHaveBeenCalledWith({ tenantId, userId: 'user-1' })
    expect(result).toHaveLength(1)
  })

  it('list passes optional query params', async () => {
    vi.mocked(svc.list).mockResolvedValue([])
    await controller.list(tenantId, mockUser, 'p1', 'l1', '2026-01-01', '2026-12-31')
    expect(svc.list).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1', locationId: 'l1' }),
    )
  })

  it('getById delegates to service', async () => {
    vi.mocked(svc.getById).mockResolvedValue(makeConsultation())
    const result = await controller.getById(tenantId, 'c1')
    expect(svc.getById).toHaveBeenCalledWith('c1', tenantId)
    expect(result.id).toBe('c1')
  })

  it('create delegates to service', async () => {
    vi.mocked(svc.create).mockResolvedValue(makeConsultation())
    const dto = { patientId: 'p1', locationId: 'l1', diagnoses: [] }
    const result = await controller.create(tenantId, mockUser, dto as never)
    expect(svc.create).toHaveBeenCalledWith(tenantId, 'user-1', dto)
    expect(result.id).toBe('c1')
  })

  it('update delegates to service', async () => {
    vi.mocked(svc.update).mockResolvedValue(makeConsultation('c1'))
    const result = await controller.update(tenantId, 'c1', { plan: 'Rest' } as never)
    expect(svc.update).toHaveBeenCalledWith('c1', tenantId, { plan: 'Rest' })
    expect(result.id).toBe('c1')
  })

  it('sign delegates to service', async () => {
    vi.mocked(svc.sign).mockResolvedValue(makeConsultation())
    await controller.sign(tenantId, mockUser, 'c1')
    expect(svc.sign).toHaveBeenCalledWith('c1', tenantId, 'user-1')
  })

  it('amend delegates to service', async () => {
    vi.mocked(svc.amend).mockResolvedValue(makeConsultation())
    const dto = { reason: 'Fix typo.' }
    await controller.amend(tenantId, mockUser, 'c1', dto as never)
    expect(svc.amend).toHaveBeenCalledWith('c1', tenantId, 'user-1', dto)
  })

  it('remove delegates to service', async () => {
    vi.mocked(svc.remove).mockResolvedValue(undefined)
    await controller.remove(tenantId, 'c1')
    expect(svc.remove).toHaveBeenCalledWith('c1', tenantId)
  })

  it('addProtocol delegates to service', async () => {
    vi.mocked(svc.addProtocolUsage).mockResolvedValue(makeUsage())
    const dto = { protocolId: 'proto-1' }
    await controller.addProtocol(tenantId, mockUser, 'c1', dto as never)
    expect(svc.addProtocolUsage).toHaveBeenCalledWith('c1', tenantId, 'user-1', dto)
  })

  it('getProtocolUsage delegates to service', async () => {
    vi.mocked(svc.getProtocolUsage).mockResolvedValue(makeUsage())
    await controller.getProtocolUsage(tenantId, 'c1', 'usage-1')
    expect(svc.getProtocolUsage).toHaveBeenCalledWith('c1', 'usage-1', tenantId)
  })

  it('updateProtocolUsage delegates to service', async () => {
    vi.mocked(svc.updateProtocolUsage).mockResolvedValue(makeUsage())
    const dto = { content: {}, modifications: {} }
    await controller.updateProtocolUsage(tenantId, 'c1', 'usage-1', dto as never)
    expect(svc.updateProtocolUsage).toHaveBeenCalledWith('c1', 'usage-1', tenantId, dto)
  })

  it('updateCheckedState delegates to service', async () => {
    vi.mocked(svc.updateCheckedState).mockResolvedValue(makeUsage())
    const dto = { checkedState: {} }
    await controller.updateCheckedState(tenantId, 'c1', 'usage-1', dto as never)
    expect(svc.updateCheckedState).toHaveBeenCalledWith('c1', 'usage-1', tenantId, dto)
  })

  it('removeProtocol delegates to service', async () => {
    vi.mocked(svc.removeProtocolUsage).mockResolvedValue(undefined)
    await controller.removeProtocol(tenantId, 'c1', 'usage-1')
    expect(svc.removeProtocolUsage).toHaveBeenCalledWith('c1', 'usage-1', tenantId)
  })
})
