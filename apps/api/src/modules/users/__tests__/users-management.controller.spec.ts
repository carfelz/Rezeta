import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import type { AuthUser } from '@rezeta/shared'
import { UsersManagementController } from '../users-management.controller.js'

const mockSvc = {
  listUsers: vi.fn(),
  createUser: vi.fn(),
  changeRole: vi.fn(),
  setActive: vi.fn(),
}

const admin: AuthUser = {
  id: 'actor',
  externalUid: 'ext',
  tenantId: 't1',
  email: 'admin@clinic.do',
  fullName: 'Admin',
  role: 'admin',
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
  preferences: {},
} as never

describe('UsersManagementController', () => {
  let controller: UsersManagementController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new UsersManagementController(mockSvc as never)
  })

  it('GET /v1/users lists the tenant roster', async () => {
    mockSvc.listUsers.mockResolvedValue([{ id: 'u2' }])
    const result = await controller.list(admin)
    expect(mockSvc.listUsers).toHaveBeenCalledWith('t1')
    expect(result).toEqual([{ id: 'u2' }])
  })

  it('POST /v1/users forwards actor role + tenant to the service', async () => {
    mockSvc.createUser.mockResolvedValue({ id: 'u2' })
    const dto = { email: 'doc@clinic.do', fullName: 'Dr. Nuevo', role: 'doctor' as const }
    await controller.create(admin, dto)
    expect(mockSvc.createUser).toHaveBeenCalledWith('t1', 'admin', 'actor', dto)
  })

  it('propagates FORBIDDEN when the service rejects an under-privileged actor', async () => {
    mockSvc.createUser.mockRejectedValue(new ForbiddenException({ code: 'FORBIDDEN' }))
    await expect(
      controller.create(admin, { email: 'a@b.do', fullName: 'Same', role: 'admin' as const }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('PATCH /v1/users/:id/role forwards ids and body', async () => {
    mockSvc.changeRole.mockResolvedValue({ id: 'u2' })
    await controller.changeRole(admin, 'u2', { role: 'doctor' as const })
    expect(mockSvc.changeRole).toHaveBeenCalledWith('t1', 'admin', 'actor', 'u2', { role: 'doctor' })
  })

  it('PATCH /v1/users/:id/active forwards ids and body', async () => {
    mockSvc.setActive.mockResolvedValue({ id: 'u2' })
    await controller.setActive(admin, 'u2', { isActive: false })
    expect(mockSvc.setActive).toHaveBeenCalledWith('t1', 'admin', 'actor', 'u2', { isActive: false })
  })
})
