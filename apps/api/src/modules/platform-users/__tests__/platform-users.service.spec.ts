import { ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsersService } from '../platform-users.service.js'
import type { PlatformUsersRepository } from '../platform-users.repository.js'
import type { IAuthProvider } from '../../../lib/auth/index.js'
import type { AuditLogService } from '../../../common/audit-log/audit-log.service.js'
import type { InvitationMailerService } from '../../users/invitation-mailer.service.js'

const row = {
  id: 'pu-1',
  externalUid: 'ext-1',
  email: 'laura@rezeta.do',
  fullName: 'Laura Medina',
  isActive: true,
  createdAt: new Date('2026-07-20T12:00:00Z'),
  updatedAt: new Date('2026-07-20T12:00:00Z'),
  deletedAt: null,
  lastLoginAt: null,
}

const mockRepo = {
  list: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  setActive: vi.fn(),
}
const mockProvider = {
  createUser: vi.fn(),
  generatePasswordResetLink: vi.fn(),
  deleteUser: vi.fn(),
}
const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }
const mockMailer = { sendSetPasswordEmail: vi.fn() }

function makeService(): PlatformUsersService {
  return new PlatformUsersService(
    mockRepo as unknown as PlatformUsersRepository,
    mockProvider as unknown as IAuthProvider,
    mockAudit as unknown as AuditLogService,
    mockMailer as unknown as InvitationMailerService,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('listUsers', () => {
  it('maps rows to DTOs with derived status', async () => {
    mockRepo.list.mockResolvedValue([
      row,
      { ...row, id: 'pu-2', lastLoginAt: new Date('2026-07-20T13:00:00Z') },
    ])
    const result = await makeService().listUsers()
    expect(result[0]).toMatchObject({ id: 'pu-1', status: 'invited', lastLoginAt: null })
    expect(result[1]).toMatchObject({ id: 'pu-2', status: 'active' })
    expect(result[1]!.lastLoginAt).toBe('2026-07-20T13:00:00.000Z')
  })
})

describe('createUser', () => {
  beforeEach(() => {
    mockProvider.createUser.mockResolvedValue({ externalUid: 'ext-1' })
    mockProvider.generatePasswordResetLink.mockResolvedValue('https://link')
    mockMailer.sendSetPasswordEmail.mockResolvedValue(undefined)
    mockRepo.create.mockResolvedValue(row)
  })

  it('creates identity, row, sends the set-password link, audits', async () => {
    const result = await makeService().createUser('actor-1', {
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(mockProvider.createUser).toHaveBeenCalledWith('laura@rezeta.do')
    expect(mockRepo.create).toHaveBeenCalledWith({
      externalUid: 'ext-1',
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(mockMailer.sendSetPasswordEmail).toHaveBeenCalledWith('laura@rezeta.do', 'https://link')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorType: 'system',
        category: 'auth',
        action: 'user_invited',
        entityType: 'PlatformUser',
        entityId: 'pu-1',
        metadata: { platformUserId: 'actor-1' },
        status: 'success',
      }),
    )
    expect(result.status).toBe('invited')
  })

  it('deletes the orphaned identity and rethrows when the DB write fails', async () => {
    const dbErr = new Error('db down')
    mockRepo.create.mockRejectedValue(dbErr)
    mockProvider.deleteUser.mockResolvedValue(undefined)
    await expect(
      makeService().createUser('actor-1', { email: 'laura@rezeta.do', fullName: 'Laura Medina' }),
    ).rejects.toBe(dbErr)
    expect(mockProvider.deleteUser).toHaveBeenCalledWith('ext-1')
  })

  it('maps a unique violation to USER_ALREADY_EXISTS', async () => {
    mockRepo.create.mockRejectedValue({ code: 'P2002' })
    mockProvider.deleteUser.mockResolvedValue(undefined)
    await expect(
      makeService().createUser('actor-1', { email: 'laura@rezeta.do', fullName: 'Laura Medina' }),
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('still returns the user when the set-password email step fails', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    mockProvider.generatePasswordResetLink.mockRejectedValue(new Error('smtp down'))
    const result = await makeService().createUser('actor-1', {
      email: 'laura@rezeta.do',
      fullName: 'Laura Medina',
    })
    expect(result.id).toBe('pu-1')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('setActive', () => {
  it('rejects self-deactivation and touches nothing', async () => {
    await expect(
      makeService().setActive('pu-1', 'pu-1', { isActive: false }),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(mockRepo.setActive).not.toHaveBeenCalled()
  })

  it('allows self-reactivation guard to pass through for other targets', async () => {
    mockRepo.findById.mockResolvedValue({ ...row, id: 'pu-2' })
    mockRepo.setActive.mockResolvedValue({ ...row, id: 'pu-2', isActive: false, deletedAt: new Date() })
    const result = await makeService().setActive('pu-1', 'pu-2', { isActive: false })
    expect(mockRepo.setActive).toHaveBeenCalledWith('pu-2', false)
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_deactivated', entityId: 'pu-2' }),
    )
    expect(result.isActive).toBe(false)
  })

  it('audits reactivation as user_reactivated', async () => {
    mockRepo.findById.mockResolvedValue({ ...row, id: 'pu-2', isActive: false })
    mockRepo.setActive.mockResolvedValue({ ...row, id: 'pu-2', isActive: true })
    await makeService().setActive('pu-1', 'pu-2', { isActive: true })
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_reactivated' }),
    )
  })

  it('404s on an unknown target', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(
      makeService().setActive('pu-1', 'missing', { isActive: false }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })
})

describe('resendInvite', () => {
  it('regenerates the link, emails it, audits with resend flag', async () => {
    mockRepo.findById.mockResolvedValue({ ...row, id: 'pu-2' })
    mockProvider.generatePasswordResetLink.mockResolvedValue('https://link2')
    mockMailer.sendSetPasswordEmail.mockResolvedValue(undefined)
    await makeService().resendInvite('pu-1', 'pu-2')
    expect(mockMailer.sendSetPasswordEmail).toHaveBeenCalledWith('laura@rezeta.do', 'https://link2')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user_invited',
        metadata: { platformUserId: 'pu-1', resend: true },
      }),
    )
  })

  it('404s on an unknown target', async () => {
    mockRepo.findById.mockResolvedValue(null)
    await expect(makeService().resendInvite('pu-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })
})
