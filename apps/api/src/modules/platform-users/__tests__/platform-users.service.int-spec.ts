/* eslint-disable @typescript-eslint/unbound-method */
/**
 * Real-Postgres integration coverage for `PlatformUsersService`.
 *
 * Only the DB is real here — `IAuthProvider` and `InvitationMailerService`
 * are external dependencies (Firebase/whatever auth provider, an email
 * sender) and are faked with `vi.fn()`. `AuditLogService` is real, wired to
 * the test Prisma client, so audit writes exercise the actual repository +
 * schema (see `permissions.service.int-spec.ts`, which caught a real
 * `entityId` UUID-column bug this way).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsersService } from '../platform-users.service.js'
import { PlatformUsersRepository } from '../platform-users.repository.js'
import { PrismaService } from '../../../lib/prisma.service.js'
import { AuditLogRepository } from '../../../common/audit-log/audit-log.repository.js'
import { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { InvitationMailerService } from '../../users/invitation-mailer.service.js'
import { createTestPlatformUser, hasTestDb, truncateAll, waitForAuditLog } from '../../../test/db-test-utils.js'

describe.skipIf(!hasTestDb())('PlatformUsersService (integration)', () => {
  let prisma: PrismaService
  let auditLog: AuditLogService
  const provider = {
    createUser: vi.fn(),
    generatePasswordResetLink: vi.fn().mockResolvedValue('https://link'),
    deleteUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as IAuthProvider
  const mailer = {
    sendSetPasswordEmail: vi.fn().mockResolvedValue(undefined),
  } as unknown as InvitationMailerService

  beforeAll(() => {
    prisma = new PrismaService()
    auditLog = new AuditLogService(new AuditLogRepository(prisma))
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function makeService(): PlatformUsersService {
    const repo = new PlatformUsersRepository(prisma)
    return new PlatformUsersService(repo, provider, auditLog, mailer)
  }

  beforeEach(async () => {
    await truncateAll(prisma)
    vi.mocked(provider.createUser).mockResolvedValue({ externalUid: `ext-${Date.now()}` })
  })

  it('createUser persists a row and writes a user_invited audit', async () => {
    const actor = await createTestPlatformUser(prisma, { email: 'actor@rezeta.do' })
    const created = await makeService().createUser(actor.id, {
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })

    const row = await prisma.platformUser.findUnique({ where: { id: created.id } })
    expect(row?.email).toBe('laura@rezeta.do')
    expect(row?.isActive).toBe(true)

    const audit = await waitForAuditLog(prisma, {
      action: 'user_invited',
      entityId: created.id,
    })
    expect(audit['metadata']).toMatchObject({ platformUserId: actor.id })
    expect(audit['tenantId']).toBeNull()
  })

  it('deactivate soft-deletes, blocks auth-path lookup, and reactivate restores', async () => {
    const actor = await createTestPlatformUser(prisma, { email: 'actor@rezeta.do' })
    const target = await createTestPlatformUser(prisma, { email: 'target@rezeta.do' })
    const service = makeService()
    const repo = new PlatformUsersRepository(prisma)

    const deactivated = await service.setActive(actor.id, target.id, { isActive: false })
    expect(deactivated.isActive).toBe(false)
    await expect(repo.findByExternalUid(target.externalUid)).resolves.toBeNull()
    await waitForAuditLog(prisma, { action: 'user_deactivated', entityId: target.id })

    const reactivated = await service.setActive(actor.id, target.id, { isActive: true })
    expect(reactivated.isActive).toBe(true)
    await expect(repo.findByExternalUid(target.externalUid)).resolves.not.toBeNull()
  })

  it('self-deactivation is rejected and leaves the row untouched', async () => {
    const actor = await createTestPlatformUser(prisma, { email: 'actor@rezeta.do' })
    await expect(
      makeService().setActive(actor.id, actor.id, { isActive: false }),
    ).rejects.toMatchObject({ status: 403 })
    const row = await prisma.platformUser.findUnique({ where: { id: actor.id } })
    expect(row?.isActive).toBe(true)
  })
})
