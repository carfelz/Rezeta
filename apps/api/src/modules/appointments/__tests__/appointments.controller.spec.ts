import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppointmentsController } from '../appointments.controller.js'

const mockService = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  remove: vi.fn(),
}

const now = new Date('2026-01-01T10:00:00Z')

const user = {
  id: 'u1',
  firebaseUid: 'fb1',
  tenantId: 't1',
  email: 'dr@test.com',
  fullName: 'Dr. Test',
  role: 'owner' as const,
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
}

const appointment = {
  id: 'a1',
  tenantId: 't1',
  patientId: 'p1',
  locationId: 'l1',
  userId: 'u1',
  startsAt: now.toISOString(),
  endsAt: new Date('2026-01-01T11:00:00Z').toISOString(),
  status: 'scheduled',
  reason: null,
  notes: null,
  patient: { id: 'p1', fullName: 'Test Patient' },
  location: { id: 'l1', name: 'Test Location' },
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}

describe('AppointmentsController', () => {
  let controller: AppointmentsController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new AppointmentsController(mockService as never)
  })

  // ── list ───────────────────────────────────────────────────────────────────

  it('list: delegates to service.list with tenantId and userId', async () => {
    mockService.list.mockResolvedValue([appointment])
    const result = await controller.list('t1', user)
    expect(mockService.list).toHaveBeenCalledWith({ tenantId: 't1', userId: 'u1' })
    expect(result).toEqual([appointment])
  })

  it('list: passes optional filters when provided', async () => {
    mockService.list.mockResolvedValue([appointment])
    await controller.list(
      't1',
      user,
      'l1',
      '2026-01-01T00:00:00Z',
      '2026-01-02T00:00:00Z',
      'scheduled',
    )
    expect(mockService.list).toHaveBeenCalledWith({
      tenantId: 't1',
      userId: 'u1',
      locationId: 'l1',
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
      status: 'scheduled',
    })
  })

  // ── getById ────────────────────────────────────────────────────────────────

  it('getById: delegates to service.getById with id and tenantId', async () => {
    mockService.getById.mockResolvedValue(appointment)
    const result = await controller.getById('t1', 'a1')
    expect(mockService.getById).toHaveBeenCalledWith('a1', 't1')
    expect(result).toEqual(appointment)
  })

  // ── create ─────────────────────────────────────────────────────────────────

  it('create: delegates to service.create with tenantId, userId, and dto', async () => {
    mockService.create.mockResolvedValue(appointment)
    const dto = {
      patientId: 'p1',
      locationId: 'l1',
      startsAt: now.toISOString(),
      endsAt: new Date('2026-01-01T11:00:00Z').toISOString(),
    }
    const result = await controller.create('t1', user, dto as never)
    expect(mockService.create).toHaveBeenCalledWith('t1', 'u1', dto)
    expect(result).toEqual(appointment)
  })

  // ── update ─────────────────────────────────────────────────────────────────

  it('update: delegates to service.update with id, tenantId, userId, and dto', async () => {
    const updated = { ...appointment, notes: 'Updated notes' }
    mockService.update.mockResolvedValue(updated)
    const dto = { notes: 'Updated notes' }
    const result = await controller.update('t1', user, 'a1', dto as never)
    expect(mockService.update).toHaveBeenCalledWith('a1', 't1', 'u1', dto)
    expect(result).toEqual(updated)
  })

  // ── updateStatus ───────────────────────────────────────────────────────────

  it('updateStatus: delegates to service.updateStatus with id, tenantId, and dto', async () => {
    const completed = { ...appointment, status: 'completed' }
    mockService.updateStatus.mockResolvedValue(completed)
    const dto = { status: 'completed' as const }
    const result = await controller.updateStatus('t1', 'a1', dto)
    expect(mockService.updateStatus).toHaveBeenCalledWith('a1', 't1', dto)
    expect(result).toEqual(completed)
  })

  // ── remove ─────────────────────────────────────────────────────────────────

  it('remove: delegates to service.remove with id and tenantId', async () => {
    mockService.remove.mockResolvedValue(undefined)
    await controller.remove('t1', 'a1')
    expect(mockService.remove).toHaveBeenCalledWith('a1', 't1')
  })
})
