/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import type { PlatformPrincipal } from '@rezeta/shared'
import { StaffSsoConnectionsController } from '../staff-sso.controller.js'
import type { SsoConnectionService } from '../sso-connection.service.js'

function principal(): PlatformPrincipal {
  return { id: 'platform-1', externalUid: 'ext-1', email: 'staff@rezeta.do', fullName: 'Staff One' }
}

describe('StaffSsoConnectionsController', () => {
  it('list delegates to the service', async () => {
    const service = { list: vi.fn().mockResolvedValue([]) } as unknown as SsoConnectionService
    const result = await new StaffSsoConnectionsController(service).list()
    expect(service.list).toHaveBeenCalledWith()
    expect(result).toEqual([])
  })

  it('create passes the parsed dto and acting platform user id', async () => {
    const created = { id: 'sso-1' }
    const service = { create: vi.fn().mockResolvedValue(created) } as unknown as SsoConnectionService
    const dto = {
      tenantId: '018e3f2a-6666-7000-8000-000000000001',
      displayName: 'Clinica Uno',
      issuerUrl: 'https://idp.clinica.do',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      domains: ['clinica.do'],
      allowPassword: true,
    }
    const result = await new StaffSsoConnectionsController(service).create(principal(), dto)
    expect(service.create).toHaveBeenCalledWith(dto, 'platform-1')
    expect(result).toBe(created)
  })

  it('update passes id, parsed dto and acting platform user id', async () => {
    const updated = { id: 'sso-1' }
    const service = { update: vi.fn().mockResolvedValue(updated) } as unknown as SsoConnectionService
    const dto = { displayName: 'Clinica Dos' }
    const result = await new StaffSsoConnectionsController(service).update(principal(), 'sso-1', dto)
    expect(service.update).toHaveBeenCalledWith('sso-1', dto, 'platform-1')
    expect(result).toBe(updated)
  })

  it('setStatus passes id, status and acting platform user id', async () => {
    const updated = { id: 'sso-1', status: 'disabled' }
    const service = { setStatus: vi.fn().mockResolvedValue(updated) } as unknown as SsoConnectionService
    const result = await new StaffSsoConnectionsController(service).setStatus(principal(), 'sso-1', {
      status: 'disabled',
    })
    expect(service.setStatus).toHaveBeenCalledWith('sso-1', 'disabled', 'platform-1')
    expect(result).toBe(updated)
  })

  it('test delegates to the service with the connection id', async () => {
    const testResult = { ok: true, checked: ['discovery_document'] }
    const service = { testConnection: vi.fn().mockResolvedValue(testResult) } as unknown as SsoConnectionService
    const result = await new StaffSsoConnectionsController(service).test('sso-1')
    expect(service.testConnection).toHaveBeenCalledWith('sso-1')
    expect(result).toBe(testResult)
  })

  it('remove passes id and acting platform user id', async () => {
    const service = { remove: vi.fn().mockResolvedValue(undefined) } as unknown as SsoConnectionService
    await new StaffSsoConnectionsController(service).remove(principal(), 'sso-1')
    expect(service.remove).toHaveBeenCalledWith('sso-1', 'platform-1')
  })
})
