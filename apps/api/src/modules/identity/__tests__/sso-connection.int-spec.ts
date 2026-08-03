/**
 * Real-Postgres integration coverage for the SSO connection control plane
 * (`SsoConnectionService.create/setStatus/remove`) and the public login
 * routing lookup (`LoginRoutingService.methodsForEmail`).
 *
 * Only `IAuthProvider` is faked — `SsoConnectionRepository`,
 * `SsoConnectionService`, `LoginRoutingService`, and the audit log stack are
 * real, wired to the test Prisma instance. Construction copied from
 * `identity.service.int-spec.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CreateSsoConnectionDto } from '@rezeta/shared'
import { PrismaService } from '../../../lib/prisma.service.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import { AuditLogRepository } from '../../../common/audit-log/audit-log.repository.js'
import { SsoConnectionRepository } from '../sso-connection.repository.js'
import { SsoConnectionService } from '../sso-connection.service.js'
import { LoginRoutingService } from '../login-routing.service.js'
import { createTestTenant, hasTestDb, truncateAll, waitForAuditLog } from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('SSO connections (integration)', () => {
  let prisma: PrismaService
  let repo: SsoConnectionRepository
  let service: SsoConnectionService
  let loginRouting: LoginRoutingService
  const authProvider = {
    createOidcProviderConfig: vi.fn().mockResolvedValue(undefined),
    updateOidcProviderConfig: vi.fn().mockResolvedValue(undefined),
    deleteProviderConfig: vi.fn().mockResolvedValue(undefined),
  } as unknown as IAuthProvider

  beforeAll(() => {
    prisma = new PrismaService()
    repo = new SsoConnectionRepository(prisma)
    const auditLog = new AuditLogService(new AuditLogRepository(prisma))
    service = new SsoConnectionService(repo, authProvider, auditLog)
    loginRouting = new LoginRoutingService(repo)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await truncateAll(prisma)
    vi.clearAllMocks()
  })

  function makeDto(overrides: Partial<CreateSsoConnectionDto> = {}, tenantId: string): CreateSsoConnectionDto {
    return {
      tenantId,
      displayName: 'Clinica ABC',
      issuerUrl: 'https://login.clinica-abc.example.com',
      clientId: 'client-1',
      clientSecret: 'super-secret-value',
      domains: ['clinica-abc.do'],
      allowPassword: true,
      ...overrides,
    }
  }

  describe('create', () => {
    it('persists a row with a generated oidc. providerId, no secret anywhere, and audits the create', async () => {
      const tenant = await createTestTenant(prisma)
      const dto = makeDto({}, tenant.id)

      const result = await service.create(dto, 'platform-user-1')

      expect(result.providerId).toMatch(/^oidc\./)
      expect(JSON.stringify(result)).not.toContain(dto.clientSecret)

      const row = await prisma.ssoConnection.findUnique({ where: { id: result.id } })
      expect(row).not.toBeNull()
      expect(row?.providerId).toMatch(/^oidc\./)
      expect(row?.tenantId).toBe(tenant.id)
      expect(JSON.stringify(row)).not.toContain(dto.clientSecret)

      const audit = await waitForAuditLog(prisma, { action: 'create', entityId: result.id })
      expect(audit['entityType']).toBe('SsoConnection')
      expect((audit['metadata'] as Record<string, unknown>)['platformUserId']).toBe('platform-user-1')
    })

    it('rejects with SSO_DOMAIN_ALREADY_CLAIMED when the domain is already active on another tenant, and creates no row', async () => {
      const tenantA = await createTestTenant(prisma)
      const tenantB = await createTestTenant(prisma)
      await service.create(makeDto({ domains: ['shared.do'] }, tenantA.id), 'platform-user-1')

      await expect(
        service.create(makeDto({ domains: ['shared.do'] }, tenantB.id), 'platform-user-1'),
      ).rejects.toMatchObject({
        response: { code: 'SSO_DOMAIN_ALREADY_CLAIMED' },
      })

      const rowsForTenantB = await prisma.ssoConnection.findMany({ where: { tenantId: tenantB.id } })
      expect(rowsForTenantB).toHaveLength(0)
    })
  })

  describe('methodsForEmail end-to-end', () => {
    it('returns the sso response for an active connection domain, then falls back to password+google once disabled', async () => {
      const tenant = await createTestTenant(prisma)
      const dto = makeDto({ domains: ['clinica-abc.do'], allowPassword: true }, tenant.id)
      const created = await service.create(dto, 'platform-user-1')

      const activeResult = await loginRouting.methodsForEmail('doctor@clinica-abc.do')
      expect(activeResult).toEqual({
        methods: ['password', 'google', 'sso'],
        ssoProviderId: created.providerId,
        ssoDisplayName: created.displayName,
      })

      await service.setStatus(created.id, 'disabled', 'platform-user-1')

      const disabledResult = await loginRouting.methodsForEmail('doctor@clinica-abc.do')
      expect(disabledResult).toEqual({ methods: ['password', 'google'] })
    })
  })

  describe('remove (soft delete)', () => {
    it('keeps the row with deletedAt set and excludes it from listAll', async () => {
      const tenant = await createTestTenant(prisma)
      const created = await service.create(makeDto({}, tenant.id), 'platform-user-1')

      await service.remove(created.id, 'platform-user-1')

      const row = await prisma.ssoConnection.findUnique({ where: { id: created.id } })
      expect(row).not.toBeNull()
      expect(row?.deletedAt).not.toBeNull()

      const listed = await service.list()
      expect(listed.find((c) => c.id === created.id)).toBeUndefined()
    })
  })
})
