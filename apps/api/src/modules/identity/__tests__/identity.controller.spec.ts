/* eslint-disable @typescript-eslint/unbound-method */
import { describe, expect, it, vi } from 'vitest'
import type { AuthUser } from '@rezeta/shared'
import { IdentityController } from '../identity.controller.js'
import type { IdentityService } from '../identity.service.js'

function user(): AuthUser {
  return {
    id: 'u1',
    externalUid: 'ext-1',
    tenantId: 't1',
    email: 'dr@rezeta.do',
    fullName: 'Dr. Test',
    role: 'doctor',
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: null,
    tenantPlan: 'free',
    preferences: {},
    capabilities: {},
  } as AuthUser
}

describe('IdentityController', () => {
  it('myDevices delegates with the current user id', async () => {
    const service = { myDevices: vi.fn().mockResolvedValue([]) } as unknown as IdentityService
    await new IdentityController(service).myDevices(user())
    expect(service.myDevices).toHaveBeenCalledWith('u1')
  })

  it('signOutAll delegates with the current user', async () => {
    const service = { signOutAllSessions: vi.fn().mockResolvedValue(undefined) } as unknown as IdentityService
    await new IdentityController(service).signOutAll(user())
    expect(service.signOutAllSessions).toHaveBeenCalledWith(user())
  })

  it('summary parses days and delegates with tenantId', async () => {
    const service = { securitySummary: vi.fn().mockResolvedValue({}) } as unknown as IdentityService
    await new IdentityController(service).summary('t1', '30')
    expect(service.securitySummary).toHaveBeenCalledWith('t1', 30)
  })

  it('summary passes undefined days when the query param is omitted', async () => {
    const service = { securitySummary: vi.fn().mockResolvedValue({}) } as unknown as IdentityService
    await new IdentityController(service).summary('t1', undefined)
    expect(service.securitySummary).toHaveBeenCalledWith('t1', undefined)
  })

  it('logins passes parsed filters', async () => {
    const service = { listLogins: vi.fn().mockResolvedValue([]) } as unknown as IdentityService
    await new IdentityController(service).logins('t1', '30', 'u2', '10')
    expect(service.listLogins).toHaveBeenCalledWith('t1', { days: 30, userId: 'u2', limit: 10 })
  })

  it('logins defaults limit to 50 when omitted', async () => {
    const service = { listLogins: vi.fn().mockResolvedValue([]) } as unknown as IdentityService
    await new IdentityController(service).logins('t1', undefined, undefined, undefined)
    expect(service.listLogins).toHaveBeenCalledWith('t1', { limit: 50 })
  })

  it('exportCsv sets CSV headers and writes the body', async () => {
    const service = { exportLoginsCsv: vi.fn().mockResolvedValue('created_at,user\n') } as unknown as IdentityService
    const res = { set: vi.fn(), end: vi.fn() }
    await new IdentityController(service).exportCsv('t1', '7', undefined, res as never)
    expect(service.exportLoginsCsv).toHaveBeenCalledWith('t1', { days: 7, limit: 1000 })
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'text/csv; charset=utf-8' }),
    )
    expect(res.end).toHaveBeenCalledWith('created_at,user\n')
  })

  it('exportCsv includes userId filter when provided', async () => {
    const service = { exportLoginsCsv: vi.fn().mockResolvedValue('') } as unknown as IdentityService
    const res = { set: vi.fn(), end: vi.fn() }
    await new IdentityController(service).exportCsv('t1', '30', 'u2', res as never)
    expect(service.exportLoginsCsv).toHaveBeenCalledWith('t1', { days: 30, userId: 'u2', limit: 1000 })
  })

  it('exportCsv omits days and userId filters when not provided', async () => {
    const service = { exportLoginsCsv: vi.fn().mockResolvedValue('') } as unknown as IdentityService
    const res = { set: vi.fn(), end: vi.fn() }
    await new IdentityController(service).exportCsv('t1', undefined, undefined, res as never)
    expect(service.exportLoginsCsv).toHaveBeenCalledWith('t1', { limit: 1000 })
  })
})
