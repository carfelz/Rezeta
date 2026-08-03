import { NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SsoConnectionService } from '../sso-connection.service.js'
import type { SsoConnectionRepository, SsoConnectionRow } from '../sso-connection.repository.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { CreateSsoConnectionDto, UpdateSsoConnectionDto } from '@rezeta/shared'

const mockRepo = {
  listAll: vi.fn(),
  findById: vi.fn(),
  findActiveByDomain: vi.fn(),
  findActiveClaimingDomains: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}
const mockProvider = {
  createOidcProviderConfig: vi.fn(),
  updateOidcProviderConfig: vi.fn(),
  deleteProviderConfig: vi.fn(),
}
const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }

function makeService(): SsoConnectionService {
  return new SsoConnectionService(
    mockRepo as unknown as SsoConnectionRepository,
    mockProvider as unknown as IAuthProvider,
    mockAuditLog as unknown as AuditLogService,
  )
}

beforeEach(() => {
  vi.resetAllMocks()
  mockAuditLog.record.mockResolvedValue(undefined)
})

const rowFixture: SsoConnectionRow = {
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
  tenant: { name: 'Clínica ABC' },
}

const validDto: CreateSsoConnectionDto = {
  tenantId: 't1',
  displayName: 'Clínica ABC',
  issuerUrl: 'https://login.clinica-abc.example.com',
  clientId: 'client-1',
  clientSecret: 'super-secret-value',
  domains: ['clinica-abc.do'],
  allowPassword: true,
}

describe('SsoConnectionService', () => {
  describe('list', () => {
    it('maps repository rows to DTOs without leaking a secret', async () => {
      mockRepo.listAll.mockResolvedValue([rowFixture])
      const result = await makeService().list()
      expect(result).toEqual([
        {
          id: 'c1',
          tenantId: 't1',
          tenantName: 'Clínica ABC',
          type: 'oidc',
          providerId: 'oidc.clinica-abc-x1y2z3',
          displayName: 'Clínica ABC',
          issuerUrl: 'https://login.clinica-abc.example.com',
          clientId: 'client-1',
          domains: ['clinica-abc.do'],
          allowPassword: true,
          status: 'active',
          createdAt: '2026-07-28T00:00:00.000Z',
        },
      ])
      expect('clientSecret' in result[0]!).toBe(false)
    })

    it('falls back to a null tenant name when the row has no tenant relation', async () => {
      const { tenant: _tenant, ...rowWithoutTenant } = rowFixture
      mockRepo.listAll.mockResolvedValue([rowWithoutTenant as SsoConnectionRow])
      const result = await makeService().list()
      expect(result[0]!.tenantName).toBeNull()
    })
  })

  describe('create', () => {
    it('rejects when a domain is already claimed by another active connection', async () => {
      mockRepo.findActiveClaimingDomains.mockResolvedValue([{ id: 'other' }])
      await expect(makeService().create(validDto, 'pu1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SSO_DOMAIN_ALREADY_CLAIMED' }),
      })
      expect(mockProvider.createOidcProviderConfig).not.toHaveBeenCalled()
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('provisions the provider config before the row and passes the secret through', async () => {
      mockRepo.findActiveClaimingDomains.mockResolvedValue([])
      mockRepo.create.mockResolvedValue(rowFixture)
      await makeService().create(validDto, 'pu1')

      expect(mockProvider.createOidcProviderConfig).toHaveBeenCalledWith(
        expect.objectContaining({ clientSecret: validDto.clientSecret, enabled: true }),
      )
      expect(mockProvider.createOidcProviderConfig.mock.invocationCallOrder[0]).toBeLessThan(
        mockRepo.create.mock.invocationCallOrder[0]!,
      )
      const createdData = mockRepo.create.mock.calls[0]?.[0] as Record<string, unknown>
      expect(JSON.stringify(createdData)).not.toContain(validDto.clientSecret)
    })

    it('generates a providerId as oidc. + slugified display name (max 24 chars) + a 6-char base36 suffix', async () => {
      mockRepo.findActiveClaimingDomains.mockResolvedValue([])
      mockRepo.create.mockResolvedValue(rowFixture)
      await makeService().create(validDto, 'pu1')
      const providerId = (
        mockProvider.createOidcProviderConfig.mock.calls[0]?.[0] as { providerId: string }
      ).providerId
      expect(providerId).toMatch(/^oidc\.[a-z0-9-]{1,24}-[0-9a-z]{6}$/)
    })

    it('does not create a row when the provider call throws', async () => {
      mockRepo.findActiveClaimingDomains.mockResolvedValue([])
      mockProvider.createOidcProviderConfig.mockRejectedValue(new Error('provider down'))
      await expect(makeService().create(validDto, 'pu1')).rejects.toThrow('provider down')
      expect(mockRepo.create).not.toHaveBeenCalled()
    })

    it('records a create audit event in the platform-users style', async () => {
      mockRepo.findActiveClaimingDomains.mockResolvedValue([])
      mockRepo.create.mockResolvedValue(rowFixture)
      await makeService().create(validDto, 'pu1')
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'system',
          category: 'entity',
          action: 'create',
          entityType: 'SsoConnection',
          entityId: 'c1',
          metadata: { platformUserId: 'pu1' },
          status: 'success',
        }),
      )
    })
  })

  describe('update', () => {
    const updateDto: UpdateSsoConnectionDto = { displayName: 'Clínica ABC v2' }

    it('throws NotFoundException when the connection does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(makeService().update('missing', updateDto, 'pu1')).rejects.toBeInstanceOf(
        NotFoundException,
      )
      expect(mockProvider.updateOidcProviderConfig).not.toHaveBeenCalled()
    })

    it('re-checks domain uniqueness excluding the current connection when domains change', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.findActiveClaimingDomains.mockResolvedValue([{ id: 'other' }])
      await expect(
        makeService().update('c1', { domains: ['stolen.do'] }, 'pu1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SSO_DOMAIN_ALREADY_CLAIMED' }),
      })
      expect(mockRepo.findActiveClaimingDomains).toHaveBeenCalledWith(['stolen.do'], 'c1')
      expect(mockProvider.updateOidcProviderConfig).not.toHaveBeenCalled()
    })

    it('forwards clientSecret to updateOidcProviderConfig only when present', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue(rowFixture)
      await makeService().update('c1', updateDto, 'pu1')
      const call = mockProvider.updateOidcProviderConfig.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >
      expect('clientSecret' in call).toBe(false)
    })

    it('includes clientSecret when the dto provides one', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue(rowFixture)
      await makeService().update('c1', { ...updateDto, clientSecret: 'new-secret' }, 'pu1')
      expect(mockProvider.updateOidcProviderConfig).toHaveBeenCalledWith(
        expect.objectContaining({ clientSecret: 'new-secret' }),
      )
    })

    it('updates the provider config before the row', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue(rowFixture)
      await makeService().update('c1', updateDto, 'pu1')
      expect(
        mockProvider.updateOidcProviderConfig.mock.invocationCallOrder[0],
      ).toBeLessThan(mockRepo.update.mock.invocationCallOrder[0]!)
    })

    it('records an update audit event', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue(rowFixture)
      await makeService().update('c1', updateDto, 'pu1')
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'system',
          category: 'entity',
          action: 'update',
          entityType: 'SsoConnection',
          entityId: 'c1',
          metadata: { platformUserId: 'pu1' },
          status: 'success',
        }),
      )
    })

    it('keeps the existing values when the dto omits every field', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue(rowFixture)
      await makeService().update('c1', {}, 'pu1')
      expect(mockRepo.findActiveClaimingDomains).not.toHaveBeenCalled()
      expect(mockProvider.updateOidcProviderConfig).toHaveBeenCalledWith({
        providerId: rowFixture.providerId,
        displayName: rowFixture.displayName,
        issuer: rowFixture.issuerUrl,
        clientId: rowFixture.clientId,
        enabled: true,
      })
      expect(mockRepo.update).toHaveBeenCalledWith('c1', {})
    })

    it('forwards every provided field to both the provider config and the row', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.findActiveClaimingDomains.mockResolvedValue([])
      mockRepo.update.mockResolvedValue(rowFixture)
      const fullDto: UpdateSsoConnectionDto = {
        displayName: 'Renamed Clinic',
        issuerUrl: 'https://new-issuer.example.com',
        clientId: 'new-client',
        domains: ['new-domain.do'],
        allowPassword: false,
      }
      await makeService().update('c1', fullDto, 'pu1')
      expect(mockProvider.updateOidcProviderConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Renamed Clinic',
          issuer: 'https://new-issuer.example.com',
          clientId: 'new-client',
        }),
      )
      expect(mockRepo.update).toHaveBeenCalledWith('c1', fullDto)
    })
  })

  describe('setStatus', () => {
    it('disables the provider config then the row when setting disabled', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue({ ...rowFixture, status: 'disabled' })
      await makeService().setStatus('c1', 'disabled', 'pu1')
      expect(mockProvider.updateOidcProviderConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      )
      expect(mockRepo.update).toHaveBeenCalledWith('c1', { status: 'disabled' })
      expect(
        mockProvider.updateOidcProviderConfig.mock.invocationCallOrder[0],
      ).toBeLessThan(mockRepo.update.mock.invocationCallOrder[0]!)
    })

    it('re-checks domain uniqueness before re-activating a disabled connection', async () => {
      const disabledRow = { ...rowFixture, status: 'disabled' }
      mockRepo.findById.mockResolvedValue(disabledRow)
      mockRepo.findActiveClaimingDomains.mockResolvedValue([{ id: 'other' }])
      await expect(makeService().setStatus('c1', 'active', 'pu1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'SSO_DOMAIN_ALREADY_CLAIMED' }),
      })
      expect(mockRepo.findActiveClaimingDomains).toHaveBeenCalledWith(
        disabledRow.domains,
        'c1',
      )
      expect(mockProvider.updateOidcProviderConfig).not.toHaveBeenCalled()
    })

    it('re-activates a disabled connection when its domains are still available', async () => {
      const disabledRow = { ...rowFixture, status: 'disabled' }
      mockRepo.findById.mockResolvedValue(disabledRow)
      mockRepo.findActiveClaimingDomains.mockResolvedValue([])
      mockRepo.update.mockResolvedValue(rowFixture)
      await makeService().setStatus('c1', 'active', 'pu1')
      expect(mockProvider.updateOidcProviderConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true }),
      )
      expect(mockRepo.update).toHaveBeenCalledWith('c1', { status: 'active' })
    })

    it('audits setStatus as an update with a status before/after changes shape', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      mockRepo.update.mockResolvedValue({ ...rowFixture, status: 'disabled' })
      await makeService().setStatus('c1', 'disabled', 'pu1')
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          entityType: 'SsoConnection',
          entityId: 'c1',
          changes: { status: { before: 'active', after: 'disabled' } },
        }),
      )
    })
  })

  describe('remove', () => {
    it('disables the provider config, then soft-deletes without deleting the config', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      await makeService().remove('c1', 'pu1')
      expect(mockProvider.updateOidcProviderConfig).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      )
      expect(mockProvider.deleteProviderConfig).not.toHaveBeenCalled()
      expect(mockRepo.softDelete).toHaveBeenCalledWith('c1')
      expect(
        mockProvider.updateOidcProviderConfig.mock.invocationCallOrder[0],
      ).toBeLessThan(mockRepo.softDelete.mock.invocationCallOrder[0]!)
    })

    it('audits a delete action', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      await makeService().remove('c1', 'pu1')
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorType: 'system',
          category: 'entity',
          action: 'delete',
          entityType: 'SsoConnection',
          entityId: 'c1',
          metadata: { platformUserId: 'pu1' },
          status: 'success',
        }),
      )
    })

    it('throws NotFoundException when the connection does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(makeService().remove('missing', 'pu1')).rejects.toBeInstanceOf(
        NotFoundException,
      )
    })
  })

  describe('testConnection', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    it('succeeds when the discovery document matches the issuer and has both endpoints', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            issuer: rowFixture.issuerUrl,
            authorization_endpoint: 'https://login.clinica-abc.example.com/auth',
            token_endpoint: 'https://login.clinica-abc.example.com/token',
          }),
      } as Response)
      const result = await makeService().testConnection('c1')
      expect(result).toEqual({
        ok: true,
        checked: ['discovery_document', 'issuer_match', 'endpoints_present'],
      })
      expect(fetch).toHaveBeenCalledWith(
        `${rowFixture.issuerUrl}/.well-known/openid-configuration`,
      )
    })

    it('trims a trailing slash from the issuer before comparing and building the URL', async () => {
      mockRepo.findById.mockResolvedValue({
        ...rowFixture,
        issuerUrl: 'https://login.clinica-abc.example.com/',
      })
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            issuer: 'https://login.clinica-abc.example.com',
            authorization_endpoint: 'https://login.clinica-abc.example.com/auth',
            token_endpoint: 'https://login.clinica-abc.example.com/token',
          }),
      } as Response)
      const result = await makeService().testConnection('c1')
      expect(result.ok).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        'https://login.clinica-abc.example.com/.well-known/openid-configuration',
      )
    })

    it('fails with only discovery_document checked when the HTTP status is not 200', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      vi.mocked(fetch).mockResolvedValue({ status: 404, json: () => Promise.resolve({}) } as Response)
      const result = await makeService().testConnection('c1')
      expect(result.ok).toBe(false)
      expect(result.checked).toEqual([])
      expect(result.failure).toBeTruthy()
    })

    it('fails at issuer_match when the discovery document issuer differs', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        json: () => Promise.resolve({ issuer: 'https://not-the-right-issuer.example.com' }),
      } as Response)
      const result = await makeService().testConnection('c1')
      expect(result.ok).toBe(false)
      expect(result.checked).toEqual(['discovery_document'])
      expect(result.failure).toBeTruthy()
    })

    it('fails at endpoints_present when a required endpoint is missing', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            issuer: rowFixture.issuerUrl,
            authorization_endpoint: 'https://login.clinica-abc.example.com/auth',
          }),
      } as Response)
      const result = await makeService().testConnection('c1')
      expect(result.ok).toBe(false)
      expect(result.checked).toEqual(['discovery_document', 'issuer_match'])
      expect(result.failure).toBeTruthy()
    })

    it('fails closed on fetch error without throwing', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'))
      const result = await makeService().testConnection('c1')
      expect(result).toMatchObject({ ok: false, failure: expect.stringContaining('ECONNREFUSED') })
    })

    it('does not verify the client secret as part of the discovery test', async () => {
      mockRepo.findById.mockResolvedValue(rowFixture)
      vi.mocked(fetch).mockResolvedValue({
        status: 200,
        json: () =>
          Promise.resolve({
            issuer: rowFixture.issuerUrl,
            authorization_endpoint: 'https://login.clinica-abc.example.com/auth',
            token_endpoint: 'https://login.clinica-abc.example.com/token',
          }),
      } as Response)
      await makeService().testConnection('c1')
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit | undefined]
      expect(url).not.toContain('secret')
      expect(init).toBeUndefined()
    })
  })
})
