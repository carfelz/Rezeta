/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MODULE_KEYS, defaultCapabilitiesFor } from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { PermissionsController } from '../permissions.controller.js'
import { PERMISSION_KEY } from '../../../common/decorators/require-permission.decorator.js'

const mockSvc = {
  getMatrix: vi.fn(),
  updateModule: vi.fn(),
}

function makeUser(role: AuthUser['role']): AuthUser {
  return {
    id: 'u1',
    externalUid: 'ext-1',
    tenantId: 't1',
    email: 'admin@clinic.do',
    fullName: 'Admin',
    role,
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: '2026-01-01T00:00:00.000Z',
    preferences: {} as AuthUser['preferences'],
    capabilities: defaultCapabilitiesFor(role),
  }
}

describe('PermissionsController', () => {
  let controller: PermissionsController

  beforeEach(() => {
    vi.clearAllMocks()
    controller = new PermissionsController(mockSvc as never)
  })

  describe('getMatrix', () => {
    it('delegates to service and returns { matrix, modules } in catalog order', async () => {
      const matrix = {
        assistant: defaultCapabilitiesFor('assistant'),
        doctor: defaultCapabilitiesFor('doctor'),
        admin: defaultCapabilitiesFor('admin'),
        super_admin: defaultCapabilitiesFor('super_admin'),
      }
      mockSvc.getMatrix.mockResolvedValue(matrix)

      const result = await controller.getMatrix('t1')

      expect(mockSvc.getMatrix).toHaveBeenCalledWith('t1')
      expect(result.matrix).toBe(matrix)
      expect(result.modules).toHaveLength(MODULE_KEYS.length)
      expect(result.modules[0]!.key).toBe(MODULE_KEYS[0])
      expect(result.modules[result.modules.length - 1]!.key).toBe(
        MODULE_KEYS[MODULE_KEYS.length - 1],
      )
    })
  })

  describe('update', () => {
    it('delegates to service.updateModule with tenantId, actor role, and dto fields', async () => {
      const updatedCaps = defaultCapabilitiesFor('doctor')
      mockSvc.updateModule.mockResolvedValue(updatedCaps)
      const user = makeUser('super_admin')

      const result = await controller.update('t1', user, {
        role: 'doctor',
        moduleKey: 'patients',
        accessLevel: 'manage',
      })

      expect(mockSvc.updateModule).toHaveBeenCalledWith(
        't1',
        'super_admin',
        'u1',
        'doctor',
        'patients',
        'manage',
      )
      expect(result).toBe(updatedCaps)
    })
  })

  describe('gating metadata', () => {
    it('requires permissions:view on getMatrix', () => {
      expect(Reflect.getMetadata(PERMISSION_KEY, PermissionsController.prototype.getMatrix)).toEqual(
        { module: 'permissions', level: 'view' },
      )
    })

    it('requires permissions:manage on update', () => {
      expect(Reflect.getMetadata(PERMISSION_KEY, PermissionsController.prototype.update)).toEqual({
        module: 'permissions',
        level: 'manage',
      })
    })
  })
})
