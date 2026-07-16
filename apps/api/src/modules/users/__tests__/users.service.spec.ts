import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException, ForbiddenException } from '@nestjs/common'
import { UsersService } from '../users.service.js'

const mockRepo = {
  findById: vi.fn(),
  updateProfile: vi.fn(),
  updatePreferences: vi.fn(),
  listByTenant: vi.fn(),
  createProvisionedUser: vi.fn(),
  updateRole: vi.fn(),
  setActive: vi.fn(),
}
const mockProvider = {
  createUser: vi.fn(),
  generatePasswordResetLink: vi.fn(),
}
const mockAudit = { record: vi.fn().mockResolvedValue(undefined) }
const mockMailer = { sendSetPasswordEmail: vi.fn().mockResolvedValue(undefined) }

function makeService(): UsersService {
  return new UsersService(
    mockRepo as never,
    mockProvider as never,
    mockAudit as never,
    mockMailer as never,
  )
}

describe('UsersService', () => {
  let service: UsersService

  beforeEach(() => {
    vi.clearAllMocks()
    service = makeService()
  })

  describe('listUsers', () => {
    it('maps the tenant roster to ManagedUserDto', async () => {
      mockRepo.listByTenant.mockResolvedValue([
        {
          id: 'u1',
          email: 'a@b.do',
          fullName: 'Ana',
          role: 'doctor',
          isActive: true,
          createdAt: new Date('2026-07-15'),
          lastLoginAt: new Date('2026-07-16'),
        },
      ])
      const result = await service.listUsers('t1')
      expect(mockRepo.listByTenant).toHaveBeenCalledWith('t1')
      expect(result).toEqual([
        expect.objectContaining({ id: 'u1', role: 'doctor', status: 'active' }),
      ])
    })
  })

  describe('getById', () => {
    it('returns user when found', async () => {
      const user = { id: 'u1', tenantId: 't1', preferences: {} }
      mockRepo.findById.mockResolvedValue(user)
      const result = await service.getById('u1', 't1')
      expect(result).toEqual(user)
      expect(mockRepo.findById).toHaveBeenCalledWith('u1', 't1')
    })

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getById('missing', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updateProfile', () => {
    it('delegates to repository after verifying user exists', async () => {
      const existingUser = { id: 'u1', tenantId: 't1', preferences: {} }
      mockRepo.findById.mockResolvedValue(existingUser)
      mockRepo.updateProfile.mockResolvedValue(undefined)

      await service.updateProfile('u1', 't1', {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
        licenseNumber: '1234',
      })

      expect(mockRepo.updateProfile).toHaveBeenCalledWith('u1', 't1', {
        fullName: 'Dr. García',
        specialty: 'Cardiología',
        licenseNumber: '1234',
      })
    })

    it('throws NotFoundException when user not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.updateProfile('missing', 't1', {
          fullName: 'Dr. García',
          specialty: null,
          licenseNumber: null,
        }),
      ).rejects.toThrow(NotFoundException)
    })
  })

  describe('getPreferences', () => {
    it('returns parsed preferences', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: { consultationViewMode: 'canvas' },
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({ consultationViewMode: 'canvas' })
    })

    it('returns empty object when preferences malformed', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: { consultationViewMode: 'invalid-value' },
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({})
    })

    it('handles missing preferences (null/undefined) by returning empty object', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: null,
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({})
    })

    it('handles undefined preferences field by returning empty object', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
      })
      const result = await service.getPreferences('u1', 't1')
      expect(result).toEqual({})
    })

    it('throws NotFoundException when user missing', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(service.getPreferences('u1', 't1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('updatePreferences', () => {
    it('merges patch with existing preferences and persists', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        preferences: { consultationViewMode: 'soap' },
      })
      const result = await service.updatePreferences('u1', 't1', {
        consultationViewMode: 'canvas',
      })
      expect(result).toEqual({ consultationViewMode: 'canvas' })
      expect(mockRepo.updatePreferences).toHaveBeenCalledWith('u1', 't1', {
        consultationViewMode: 'canvas',
      })
    })

    it('throws NotFoundException when user missing', async () => {
      mockRepo.findById.mockResolvedValue(null)
      await expect(
        service.updatePreferences('u1', 't1', { consultationViewMode: 'canvas' }),
      ).rejects.toThrow(NotFoundException)
    })
  })
})

describe('UsersService.createUser — rank rule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProvider.createUser.mockResolvedValue({ externalUid: 'fb-new' })
    mockProvider.generatePasswordResetLink.mockResolvedValue('https://reset/abc')
    mockRepo.createProvisionedUser.mockResolvedValue({
      id: 'u2',
      email: 'nurse@clinic.do',
      fullName: 'Ana Reyes',
      role: 'assistant',
      isActive: true,
      createdAt: new Date('2026-07-15'),
      lastLoginAt: null,
    })
  })

  it('admin can create a doctor (below admin)', async () => {
    const svc = makeService()
    await svc.createUser('t1', 'admin', 'actor', {
      email: 'doc@clinic.do',
      fullName: 'Dr. Nuevo',
      role: 'doctor',
    })
    expect(mockProvider.createUser).toHaveBeenCalledWith('doc@clinic.do')
    expect(mockRepo.createProvisionedUser).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', externalUid: 'fb-new', role: 'doctor' }),
    )
    expect(mockMailer.sendSetPasswordEmail).toHaveBeenCalledWith('doc@clinic.do', 'https://reset/abc')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_invited', category: 'auth', tenantId: 't1' }),
    )
  })

  it('admin CANNOT create another admin (same rank)', async () => {
    const svc = makeService()
    await expect(
      svc.createUser('t1', 'admin', 'actor', {
        email: 'a@b.do',
        fullName: 'Same Rank',
        role: 'admin',
      }),
    ).rejects.toThrow(ForbiddenException)
    expect(mockProvider.createUser).not.toHaveBeenCalled()
  })

  it('admin CANNOT create a super_admin (higher rank)', async () => {
    const svc = makeService()
    await expect(
      svc.createUser('t1', 'admin', 'actor', {
        email: 'a@b.do',
        fullName: 'Higher',
        role: 'super_admin',
      }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('super_admin can create an admin', async () => {
    const svc = makeService()
    await svc.createUser('t1', 'super_admin', 'actor', {
      email: 'admin@clinic.do',
      fullName: 'New Admin',
      role: 'admin',
    })
    expect(mockRepo.createProvisionedUser).toHaveBeenCalled()
  })
})

describe('UsersService.changeRole — rank rule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'assistant' })
    mockRepo.updateRole.mockResolvedValue(undefined)
  })

  it('admin can promote an assistant to doctor', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValueOnce({ id: 'u2', role: 'assistant' })
    mockRepo.findById.mockResolvedValueOnce({
      id: 'u2',
      email: 'a@b.do',
      fullName: 'A',
      role: 'doctor',
      isActive: true,
      createdAt: new Date('2026-07-15'),
      lastLoginAt: null,
    })
    await svc.changeRole('t1', 'admin', 'actor', 'u2', { role: 'doctor' })
    expect(mockRepo.updateRole).toHaveBeenCalledWith('u2', 't1', 'doctor')
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role_changed' }),
    )
  })

  it('admin CANNOT change an admin peer', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'admin' })
    await expect(
      svc.changeRole('t1', 'admin', 'actor', 'u2', { role: 'doctor' }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('admin CANNOT promote an assistant to admin (target new role too high)', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'assistant' })
    await expect(
      svc.changeRole('t1', 'admin', 'actor', 'u2', { role: 'admin' }),
    ).rejects.toThrow(ForbiddenException)
  })
})

describe('UsersService.setActive — rank rule', () => {
  beforeEach(() => vi.clearAllMocks())

  it('super_admin can deactivate an admin and audits it', async () => {
    const svc = makeService()
    // setActive reads the target once and returns it merged with the new
    // isActive value (no re-fetch), so the single mock must be a full row.
    mockRepo.findById.mockResolvedValue({
      id: 'u2',
      email: 'a@b.do',
      fullName: 'A',
      role: 'admin',
      isActive: true,
      createdAt: new Date('2026-07-15'),
      lastLoginAt: null,
    })
    mockRepo.setActive.mockResolvedValue(undefined)
    await svc.setActive('t1', 'super_admin', 'actor', 'u2', { isActive: false })
    expect(mockRepo.setActive).toHaveBeenCalledWith('u2', 't1', false)
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user_deactivated' }),
    )
  })

  it('admin CANNOT deactivate a super_admin', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue({ id: 'u2', role: 'super_admin' })
    await expect(
      svc.setActive('t1', 'admin', 'actor', 'u2', { isActive: false }),
    ).rejects.toThrow(ForbiddenException)
  })

  it('throws NotFound when the target user is absent', async () => {
    const svc = makeService()
    mockRepo.findById.mockResolvedValue(null)
    await expect(
      svc.setActive('t1', 'super_admin', 'actor', 'missing', { isActive: false }),
    ).rejects.toThrow()
  })
})
