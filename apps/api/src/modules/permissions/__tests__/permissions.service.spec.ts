import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
    it('happy path: super_admin editing doctor grants a module and audits actorUserId + before/after levels', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole
        // before-capture resolveCapabilities call: prior stored level is 'view'
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'view' }])
        // final resolveCapabilities call (post-upsert): new stored level is 'manage'
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' }])

      const result = await service.updateModule(
        't1',
        'super_admin',
        'actor-1',
        'doctor',
        'patients',
        'manage',
      )

      expect(mockRepo.upsertModule).toHaveBeenCalledWith('t1', 'doctor', 'patients', 'manage')
      expect(mockAuditLog.record).toHaveBeenCalledTimes(1)
      expect(mockAuditLog.record).toHaveBeenCalledWith({
        tenantId: 't1',
        actorUserId: 'actor-1',
        actorType: 'user',
        category: 'auth',
        action: 'permission_granted',
        entityType: 'role_permission',
        entityId: 'doctor:patients',
        metadata: { role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' },
        changes: { accessLevel: { before: 'view', after: 'manage' } },
      })
      expect(result.patients).toBe('manage')
    })

    it('revoke: level none audits permission_revoked with before/after levels and actorUserId', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole
        // before-capture: no stored row yet, so before is the catalog default ('manage' for doctor/patients)
        .mockResolvedValueOnce([])
        // final resolveCapabilities call (post-upsert): stored row now says 'none'
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'none' }])

      await service.updateModule('t1', 'super_admin', 'actor-2', 'doctor', 'patients', 'none')

      expect(mockAuditLog.record).toHaveBeenCalledWith({
        tenantId: 't1',
        actorUserId: 'actor-2',
        actorType: 'user',
        category: 'auth',
        action: 'permission_revoked',
        entityType: 'role_permission',
        entityId: 'doctor:patients',
        metadata: { role: 'doctor', moduleKey: 'patients', accessLevel: 'none' },
        changes: { accessLevel: { before: 'manage', after: 'none' } },
      })
    })

    it('upgrade: view -> manage audits permission_granted', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'view' }])
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' }])

      await service.updateModule('t1', 'super_admin', 'actor-1', 'doctor', 'patients', 'manage')

      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission_granted',
          changes: { accessLevel: { before: 'view', after: 'manage' } },
        }),
      )
    })

    it('downgrade: manage -> view audits permission_revoked (not granted)', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' }])
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'view' }])

      await service.updateModule('t1', 'super_admin', 'actor-1', 'doctor', 'patients', 'view')

      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission_revoked',
          changes: { accessLevel: { before: 'manage', after: 'view' } },
        }),
      )
    })

    it('explicit revoke: view -> none audits permission_revoked', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'view' }])
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'none' }])

      await service.updateModule('t1', 'super_admin', 'actor-1', 'doctor', 'patients', 'none')

      expect(mockAuditLog.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'permission_revoked',
          changes: { accessLevel: { before: 'view', after: 'none' } },
        }),
      )
    })

    it('no-op: manage -> manage does not emit an audit event, and skips the write', async () => {
      mockRepo.upsertModule.mockResolvedValue(undefined)
      // Only the "before" capture hits the repository. Since before === after,
      // updateModule short-circuits before the upsert/invalidate/audit — the
      // trailing resolveCapabilities call it returns is served from the cache
      // that the "before" capture just populated, with no second repo call.
      mockRepo.findByTenantAndRole.mockResolvedValueOnce([
        { role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' },
      ])

      const result = await service.updateModule(
        't1',
        'super_admin',
        'actor-1',
        'doctor',
        'patients',
        'manage',
      )

      expect(mockRepo.upsertModule).not.toHaveBeenCalled()
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)
      expect(mockAuditLog.record).not.toHaveBeenCalled()
      expect(result.patients).toBe('manage')
    })

    it('rejects an admin editing their own rank (admin -> admin) without touching repo/audit', async () => {
      await expect(
        service.updateModule('t1', 'admin', 'actor-3', 'admin', 'patients', 'manage'),
      ).rejects.toThrow(ForbiddenException)
      expect(mockRepo.upsertModule).not.toHaveBeenCalled()
      expect(mockAuditLog.record).not.toHaveBeenCalled()
    })

    it('rejects an admin editing a higher rank (admin -> super_admin) without touching repo/audit', async () => {
      await expect(
        service.updateModule('t1', 'admin', 'actor-4', 'super_admin', 'patients', 'manage'),
      ).rejects.toThrow(ForbiddenException)
      expect(mockRepo.upsertModule).not.toHaveBeenCalled()
      expect(mockAuditLog.record).not.toHaveBeenCalled()
    })
  })

  describe('capabilities cache', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not hit the repository on a second resolveCapabilities call for the same (tenant, role)', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValueOnce([
        { role: 'doctor', moduleKey: 'patients', accessLevel: 'view' },
      ])

      const first = await service.resolveCapabilities('t1', 'doctor')
      const second = await service.resolveCapabilities('t1', 'doctor')

      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)
      expect(second).toEqual(first)
      expect(second.patients).toBe('view')
    })

    it('updateModule invalidates the (tenant, targetRole) entry so the write is visible immediately', async () => {
      // Populate the cache with the assistant's defaults (protocols: 'none').
      mockRepo.findByTenantAndRole.mockResolvedValueOnce([])
      await service.resolveCapabilities('t1', 'assistant')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)

      mockRepo.upsertModule.mockResolvedValue(undefined)
      // Only one more repository call is expected: the post-invalidation
      // resolveCapabilities inside updateModule. The pre-write "before" capture
      // reads from the still-valid cache entry, so it does not touch the repo.
      mockRepo.findByTenantAndRole.mockResolvedValueOnce([
        { role: 'assistant', moduleKey: 'protocols', accessLevel: 'manage' },
      ])

      const result = await service.updateModule(
        't1',
        'admin',
        'actor-1',
        'assistant',
        'protocols',
        'manage',
      )

      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(2)
      expect(result.protocols).toBe('manage')

      // The entry updateModule just re-cached reflects the write without a
      // further repository round-trip.
      const after = await service.resolveCapabilities('t1', 'assistant')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(2)
      expect(after.protocols).toBe('manage')
    })

    it('leaves other (tenant, role) cache entries untouched by an unrelated invalidation', async () => {
      mockRepo.findByTenantAndRole
        .mockResolvedValueOnce([{ role: 'doctor', moduleKey: 'patients', accessLevel: 'view' }])
        .mockResolvedValueOnce([{ role: 'assistant', moduleKey: 'patients', accessLevel: 'view' }])

      await service.resolveCapabilities('t1', 'doctor')
      await service.resolveCapabilities('t1', 'assistant')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(2)

      mockRepo.upsertModule.mockResolvedValue(undefined)
      mockRepo.findByTenantAndRole.mockResolvedValueOnce([
        { role: 'doctor', moduleKey: 'patients', accessLevel: 'manage' },
      ])
      await service.updateModule('t1', 'super_admin', 'actor-2', 'doctor', 'patients', 'manage')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(3)

      // The untouched assistant entry is still cached — no extra repo call.
      const assistantCaps = await service.resolveCapabilities('t1', 'assistant')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(3)
      expect(assistantCaps.patients).toBe('view')
    })

    it('seedDefaults invalidates all four roles for that tenant only', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([])
      await service.resolveCapabilities('t1', 'assistant')
      await service.resolveCapabilities('t1', 'doctor')
      await service.resolveCapabilities('t1', 'admin')
      await service.resolveCapabilities('t1', 'super_admin')
      await service.resolveCapabilities('t2', 'doctor')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(5)

      const tx = { rolePermission: { createMany: vi.fn().mockResolvedValue({ count: 52 }) } }
      await service.seedDefaults(tx as never, 't1')

      // All four t1 roles now re-query the repository.
      await service.resolveCapabilities('t1', 'assistant')
      await service.resolveCapabilities('t1', 'doctor')
      await service.resolveCapabilities('t1', 'admin')
      await service.resolveCapabilities('t1', 'super_admin')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(9)

      // t2's cached entry is unaffected.
      await service.resolveCapabilities('t2', 'doctor')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(9)
    })

    it('re-queries the repository once the TTL has elapsed', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValue([])

      await service.resolveCapabilities('t1', 'doctor')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)

      await service.resolveCapabilities('t1', 'doctor')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(60_001)

      await service.resolveCapabilities('t1', 'doctor')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(2)
    })

    it('does not invalidate the cache when updateModule is rejected as FORBIDDEN', async () => {
      mockRepo.findByTenantAndRole.mockResolvedValueOnce([])
      await service.resolveCapabilities('t1', 'admin')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)

      await expect(
        service.updateModule('t1', 'admin', 'actor-3', 'admin', 'patients', 'manage'),
      ).rejects.toThrow(ForbiddenException)
      expect(mockRepo.upsertModule).not.toHaveBeenCalled()

      // Still cached — the rejected attempt never reached the repo or the cache.
      await service.resolveCapabilities('t1', 'admin')
      expect(mockRepo.findByTenantAndRole).toHaveBeenCalledTimes(1)
    })
  })
})
