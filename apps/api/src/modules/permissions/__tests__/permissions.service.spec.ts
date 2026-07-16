import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { PermissionsService } from '../permissions.service.js'

const mockRepo = { findByTenantAndRole: vi.fn(), upsertModule: vi.fn() }
const mockAuditLog = { record: vi.fn().mockResolvedValue(undefined) }

describe('PermissionsService', () => {
  let service: PermissionsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PermissionsService(mockRepo as never, mockAuditLog as never)
  })

  describe('resolveCapabilities', () => {
    it('returns catalog defaults when there are no stored rows', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([])
      const caps = await service.resolveCapabilities('t1', 'assistant')
      expect(caps).toEqual(defaultCapabilitiesFor('assistant'))
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledWith('t1', 'assistant')
    })

    it('lets a stored row override the catalog default (stored wins)', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'assistant', moduleKey: 'protocols', accessLevel: 'manage' },
      ])
      const caps = await service.resolveCapabilities('t1', 'assistant')
      expect(caps.protocols).toBe('manage') // default is 'none'
      expect(caps.patients).toBe('view') // untouched default
    })

    it('ignores a stored row whose module key is not in the catalog', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'doctor', moduleKey: 'legacy_module', accessLevel: 'manage' },
      ])
      const caps = await service.resolveCapabilities('t1', 'doctor')
      expect(caps).toEqual(defaultCapabilitiesFor('doctor'))
      expect((caps as Record<string, unknown>).legacy_module).toBeUndefined()
    })

    it('ignores a stored row whose access level is invalid', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'doctor', moduleKey: 'patients', accessLevel: 'god_mode' },
      ])
      const caps = await service.resolveCapabilities('t1', 'doctor')
      expect(caps.patients).toBe('manage') // falls back to the catalog default
    })
  })

  describe('seedDefaults', () => {
    it('inserts one row per module per role (13 x 4 = 52)', async () => {
      const tx = { rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 52 }) } }
      await service.seedDefaults(tx as never, 't1')
      expect(tx.rolePermission.createMany).toHaveBeenCalledTimes(1)
      const arg = tx.rolePermission.createMany.mock.calls[0]![0] as {
        data: { tenantId: string; role: string; moduleKey: string; accessLevel: string }[]
      }
      expect(arg.data).toHaveLength(52)
    })

    it('stamps the tenant id and uses catalog default levels', async () => {
      const tx = { rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 52 }) } }
      await service.seedDefaults(tx as never, 't1')
      const arg = tx.rolePermission.createMany.mock.calls[0]![0] as {
        data: { tenantId: string; role: string; moduleKey: string; accessLevel: string }[]
      }
      expect(arg.data.every((r) => r.tenantId === 't1')).toBe(true)
      expect(arg.data).toContainEqual({
        tenantId: 't1',
        role: 'assistant',
        moduleKey: 'protocols',
        accessLevel: 'none',
      })
      expect(arg.data).toContainEqual({
        tenantId: 't1',
        role: 'doctor',
        moduleKey: 'users',
        accessLevel: 'none',
      })
      expect(arg.data).toContainEqual({
        tenantId: 't1',
        role: 'super_admin',
        moduleKey: 'permissions',
        accessLevel: 'manage',
      })
    })
  })

  describe('getMatrix', () => {
    it('resolves capabilities for all four roles', async () => {
      const spy = vi
        .spyOn(service, 'resolveCapabilities')
        .mockImplementation((_tenantId, role) => Promise.resolve(defaultCapabilitiesFor(role)))

      const matrix = await service.getMatrix('t1')

      expect(Object.keys(matrix).sort()).toEqual(
        ['admin', 'assistant', 'doctor', 'super_admin'].sort(),
      )
      expect(matrix.assistant).toEqual(defaultCapabilitiesFor('assistant'))
      expect(matrix.super_admin).toEqual(defaultCapabilitiesFor('super_admin'))
      expect(spy).toHaveBeenCalledWith('t1', 'assistant')
      expect(spy).toHaveBeenCalledWith('t1', 'doctor')
      expect(spy).toHaveBeenCalledWith('t1', 'admin')
      expect(spy).toHaveBeenCalledWith('t1', 'super_admin')
    })
  })

  describe('updateModule', () => {
    it('happy path: super_admin editing doctor grants a module and audits permission_granted', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole.mockResolvedValue([
        { role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' },
      ])

      const result = await service.updateModule('t1', 'super_admin', 'doctor', 'patients', 'manage')

      expect(mockRepo.upsertModule).toHaveBeenCalledWith('t1', 'doctor', 'patients', 'manage')
      expect(mockAuditLog.record).toHaveBeenCalledTimes(1)
      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          actorType: 'user',
          category: 'auth',
          action: 'permission_granted',
          entityType: 'role_permission',
          entityId: 'doctor:patients',
          metadata: { role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' },
        }),
      )
      expect(result.patients).toBe('manage')
    })

    it('revoke: level none audits permission_revoked', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole.mockResolvedValue([])

      await service.updateModule('t1', 'super_admin', 'doctor', 'patients', 'none')

      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permission_revoked' }),
      )
    })

    it('rejects an admin editing their own rank (admin -> admin) without touching repo/audit', async () => {
      await expect(
        service.updateModule('t1', 'admin', 'admin', 'patients', 'manage'),
      ).rejects.toThrow(ForbiddenException)
      expect(mockRepo.upsertModule).not.toHaveBeenCalled()
      expect(mockAuditLog.record).not.toHaveBeenCalled()
    })

    it('rejects an admin editing a higher rank (admin -> super_admin) without touching repo/audit', async () => {
      await expect(
        service.updateModule('t1', 'admin', 'super_admin', 'patients', 'manage'),
      ).rejects.toThrow(ForbiddenException)
      expect(mockRepo.upsertModule).not.toHaveBeenCalled()
      expect(mockAuditLog.record).not.toHaveBeenCalled()
    })
  })
})
