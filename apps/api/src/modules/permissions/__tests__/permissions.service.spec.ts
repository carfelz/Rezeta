import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { PermissionsService } from '../permissions.service.js'

const mockRepo = { findByTenantAndRole: vi.fn() }

describe('PermissionsService', () => {
  let service: PermissionsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new PermissionsService(mockRepo as never)
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
})
