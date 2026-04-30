/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PatientsController } from '../patients.controller.js'
import type { PatientsService } from '../patients.service.js'
import type { Patient } from '@rezeta/db'
import type { AuthUser } from '@rezeta/shared'

const mockUser: AuthUser = { id: 'user-1', tenantId: 'tenant-1', email: 'doc@test.com', role: 'owner' }
const tenantId = 'tenant-1'

function makePatient(id = 'p1'): Patient {
  return {
    id,
    tenantId,
    ownerUserId: 'user-1',
    firstName: 'Ana',
    lastName: 'Reyes',
    dateOfBirth: null,
    sex: null,
    documentType: null,
    documentNumber: null,
    phone: null,
    email: null,
    allergies: null,
    medicalHistory: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  }
}

describe('PatientsController', () => {
  let controller: PatientsController
  let service: PatientsService

  beforeEach(() => {
    service = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as unknown as PatientsService
    controller = new PatientsController(service)
  })

  it('list delegates to service without optional params', async () => {
    vi.mocked(service.list).mockResolvedValue({ items: [makePatient()], hasMore: false })
    const result = await controller.list(tenantId, mockUser)
    expect(service.list).toHaveBeenCalledWith({ tenantId, ownerId: 'user-1' })
    expect(result.items).toHaveLength(1)
  })

  it('list passes search, cursor, and limit when provided', async () => {
    vi.mocked(service.list).mockResolvedValue({ items: [], hasMore: false })
    await controller.list(tenantId, mockUser, 'Ana', 'cursor123', '25')
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'Ana', cursor: 'cursor123', limit: 25 }),
    )
  })

  it('getOne delegates to service', async () => {
    vi.mocked(service.getById).mockResolvedValue(makePatient())
    const result = await controller.getOne('p1', tenantId)
    expect(service.getById).toHaveBeenCalledWith('p1', tenantId)
    expect(result.id).toBe('p1')
  })

  it('create delegates to service', async () => {
    vi.mocked(service.create).mockResolvedValue(makePatient())
    const dto = { firstName: 'Ana', lastName: 'Reyes' }
    await controller.create(dto as never, tenantId, mockUser)
    expect(service.create).toHaveBeenCalledWith(tenantId, 'user-1', dto)
  })

  it('update delegates to service', async () => {
    vi.mocked(service.update).mockResolvedValue(makePatient())
    const dto = { phone: '+1-809-555-1234' }
    await controller.update('p1', dto as never, tenantId)
    expect(service.update).toHaveBeenCalledWith('p1', tenantId, dto)
  })

  it('remove delegates to service', async () => {
    vi.mocked(service.remove).mockResolvedValue(undefined)
    await controller.remove('p1', tenantId)
    expect(service.remove).toHaveBeenCalledWith('p1', tenantId)
  })
})
