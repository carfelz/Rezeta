/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import type { PlatformPrincipal } from '@rezeta/shared'
import { StaffPlatformUsersController } from '../staff-platform-users.controller.js'
import type { PlatformUsersService } from '../platform-users.service.js'

function principal(): PlatformPrincipal {
  return { id: 'platform-1', externalUid: 'ext-1', email: 'staff@rezeta.do', fullName: 'Staff One' }
}

describe('StaffPlatformUsersController', () => {
  it('list delegates to the service', async () => {
    const service = { listUsers: vi.fn().mockResolvedValue([]) } as unknown as PlatformUsersService
    await new StaffPlatformUsersController(service).list()
    expect(service.listUsers).toHaveBeenCalledOnce()
  })

  it('create passes the acting principal id and dto', async () => {
    const service = { createUser: vi.fn().mockResolvedValue({}) } as unknown as PlatformUsersService
    const dto = { email: 'laura@rezeta.do', fullName: 'Laura Medina' }
    await new StaffPlatformUsersController(service).create(principal(), dto)
    expect(service.createUser).toHaveBeenCalledWith('platform-1', dto)
  })

  it('setActive passes actor, target id and dto', async () => {
    const service = { setActive: vi.fn().mockResolvedValue({}) } as unknown as PlatformUsersService
    await new StaffPlatformUsersController(service).setActive(principal(), 'pu-2', { isActive: false })
    expect(service.setActive).toHaveBeenCalledWith('platform-1', 'pu-2', { isActive: false })
  })

  it('resendInvite passes actor and target id', async () => {
    const service = { resendInvite: vi.fn().mockResolvedValue({}) } as unknown as PlatformUsersService
    await new StaffPlatformUsersController(service).resendInvite(principal(), 'pu-2')
    expect(service.resendInvite).toHaveBeenCalledWith('platform-1', 'pu-2')
  })
})
