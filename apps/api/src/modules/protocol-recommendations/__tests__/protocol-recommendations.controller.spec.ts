import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProtocolRecommendationsController } from '../protocol-recommendations.controller.js'
import type { ProtocolRecommendationsService } from '../protocol-recommendations.service.js'
import { defaultCapabilitiesFor, type AuthUser } from '@rezeta/shared'

const user: AuthUser = {
  id: 'doc-1',
  tenantId: 'tenant-1',
  externalUid: 'fb-1',
  email: 'doc@example.com',
  fullName: 'Dr. Test',
  role: 'doctor',
  specialty: null,
  licenseNumber: null,
  tenantSeededAt: null,
  preferences: {},
  capabilities: defaultCapabilitiesFor('doctor'),
}

describe('ProtocolRecommendationsController', () => {
  let svc: { getForPatient: ReturnType<typeof vi.fn> }
  let ctrl: ProtocolRecommendationsController

  beforeEach(() => {
    svc = { getForPatient: vi.fn().mockResolvedValue([]) }
    ctrl = new ProtocolRecommendationsController(svc as unknown as ProtocolRecommendationsService)
  })

  it('uses default limit 6 when none given', async () => {
    await ctrl.list('tenant-1', user, 'pat-1')
    expect(svc.getForPatient).toHaveBeenCalledWith('tenant-1', 'doc-1', 'pat-1', 6)
  })

  it('passes parsed limit to service', async () => {
    await ctrl.list('tenant-1', user, 'pat-1', '8')
    expect(svc.getForPatient).toHaveBeenCalledWith('tenant-1', 'doc-1', 'pat-1', 8)
  })

  it('clamps limit to 20 max', async () => {
    await ctrl.list('tenant-1', user, 'pat-1', '999')
    expect(svc.getForPatient).toHaveBeenCalledWith('tenant-1', 'doc-1', 'pat-1', 20)
  })

  it('clamps limit to 1 min', async () => {
    await ctrl.list('tenant-1', user, 'pat-1', '0')
    expect(svc.getForPatient).toHaveBeenCalledWith('tenant-1', 'doc-1', 'pat-1', 1)
  })

  it('falls back to 6 when limit is non-numeric', async () => {
    await ctrl.list('tenant-1', user, 'pat-1', 'abc')
    expect(svc.getForPatient).toHaveBeenCalledWith('tenant-1', 'doc-1', 'pat-1', 6)
  })
})
