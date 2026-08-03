import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginRoutingService } from '../login-routing.service.js'
import type { SsoConnectionRepository, SsoConnectionRow } from '../sso-connection.repository.js'

const mockRepo = {
  findActiveByDomain: vi.fn(),
}

function makeService(): LoginRoutingService {
  return new LoginRoutingService(mockRepo as unknown as SsoConnectionRepository)
}

function ssoRow(overrides: Partial<SsoConnectionRow> = {}): SsoConnectionRow {
  return {
    id: 'c1',
    tenantId: 't1',
    type: 'oidc',
    providerId: 'oidc.clinica-abc-x1y2z3',
    displayName: 'Clínica ABC',
    issuerUrl: 'https://login.clinica-abc.example.com',
    clientId: 'client-1',
    domains: ['clinica-abc.do'],
    allowPassword: true,
    status: 'active',
    createdAt: new Date('2026-07-28T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('LoginRoutingService', () => {
  it('returns the constant password+google shape for a non-SSO domain, without any other repository calls', async () => {
    mockRepo.findActiveByDomain.mockResolvedValue(null)

    const result = await makeService().methodsForEmail('doctor@gmail.com')

    expect(result).toEqual({ methods: ['password', 'google'] })
    expect(Object.keys(result)).toEqual(['methods'])
    expect(mockRepo.findActiveByDomain).toHaveBeenCalledTimes(1)
  })

  it('returns sso-only methods when the connection disallows password', async () => {
    mockRepo.findActiveByDomain.mockResolvedValue(ssoRow({ allowPassword: false }))

    const result = await makeService().methodsForEmail('doctor@clinica-abc.do')

    expect(result).toEqual({
      methods: ['sso'],
      ssoProviderId: 'oidc.clinica-abc-x1y2z3',
      ssoDisplayName: 'Clínica ABC',
    })
  })

  it('returns password+google+sso methods when the connection allows password', async () => {
    mockRepo.findActiveByDomain.mockResolvedValue(ssoRow({ allowPassword: true }))

    const result = await makeService().methodsForEmail('doctor@clinica-abc.do')

    expect(result).toEqual({
      methods: ['password', 'google', 'sso'],
      ssoProviderId: 'oidc.clinica-abc-x1y2z3',
      ssoDisplayName: 'Clínica ABC',
    })
  })

  it('extracts the domain as the substring after the last @, lowercased', async () => {
    mockRepo.findActiveByDomain.mockResolvedValue(null)

    await makeService().methodsForEmail('Doctor.Uno@Clinica-ABC.DO')

    expect(mockRepo.findActiveByDomain).toHaveBeenCalledWith('clinica-abc.do')
  })

  it('delegates to findActiveByDomain with the lowercased domain (disabled/soft-deleted rows are filtered by the repository query)', async () => {
    mockRepo.findActiveByDomain.mockResolvedValue(null)

    await makeService().methodsForEmail('doctor@Clinica-ABC.do')

    expect(mockRepo.findActiveByDomain).toHaveBeenCalledWith('clinica-abc.do')
    expect(mockRepo.findActiveByDomain).toHaveBeenCalledTimes(1)
  })
})
