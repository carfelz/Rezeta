/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocationsController } from '../locations.controller.js'
import type { LocationsService } from '../locations.service.js'
import type { Location, AuthUser } from '@rezeta/shared'

const mockUser: AuthUser = { id: 'user-1', tenantId: 'tenant-1', email: 'doc@test.com', role: 'owner' }
const tenantId = 'tenant-1'

function makeLocation(id = 'loc1'): Location {
  return {
    id,
    tenantId,
    name: 'Clínica Central',
    address: null,
    phone: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
  }
}

describe('LocationsController', () => {
  let controller: LocationsController
  let service: LocationsService

  beforeEach(() => {
    service = {
      list: vi.fn(),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    } as unknown as LocationsService
    controller = new LocationsController(service)
  })

  it('list delegates to service', async () => {
    vi.mocked(service.list).mockResolvedValue([makeLocation()])
    const result = await controller.list(tenantId)
    expect(service.list).toHaveBeenCalledWith(tenantId)
    expect(result).toHaveLength(1)
  })

  it('getOne delegates to service', async () => {
    vi.mocked(service.getById).mockResolvedValue(makeLocation())
    const result = await controller.getOne('loc1', tenantId)
    expect(service.getById).toHaveBeenCalledWith('loc1', tenantId)
    expect(result.id).toBe('loc1')
  })

  it('create delegates to service', async () => {
    vi.mocked(service.create).mockResolvedValue(makeLocation())
    const dto = { name: 'Clínica Central' }
    await controller.create(dto as never, tenantId, mockUser)
    expect(service.create).toHaveBeenCalledWith(tenantId, 'user-1', dto)
  })

  it('update delegates to service', async () => {
    vi.mocked(service.update).mockResolvedValue(makeLocation())
    const dto = { name: 'Updated Name' }
    await controller.update('loc1', dto as never, tenantId)
    expect(service.update).toHaveBeenCalledWith('loc1', tenantId, dto)
  })

  it('remove delegates to service', async () => {
    vi.mocked(service.remove).mockResolvedValue(undefined)
    await controller.remove('loc1', tenantId)
    expect(service.remove).toHaveBeenCalledWith('loc1', tenantId)
  })
})
