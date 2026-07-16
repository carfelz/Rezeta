import { describe, it, expect } from 'vitest'
import { UpdatePermissionSchema } from '../permissions.js'
import { MODULE_KEYS } from '../../permissions/catalog.js'

describe('UpdatePermissionSchema', () => {
  it('accepts a valid payload', () => {
    const r = UpdatePermissionSchema.safeParse({
      role: 'doctor',
      moduleKey: 'patients',
      accessLevel: 'manage',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown moduleKey', () => {
    const r = UpdatePermissionSchema.safeParse({
      role: 'doctor',
      moduleKey: 'nope',
      accessLevel: 'manage',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an out-of-set accessLevel', () => {
    const r = UpdatePermissionSchema.safeParse({
      role: 'doctor',
      moduleKey: 'patients',
      accessLevel: 'admin',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an out-of-set role', () => {
    const r = UpdatePermissionSchema.safeParse({
      role: 'owner',
      moduleKey: 'patients',
      accessLevel: 'manage',
    })
    expect(r.success).toBe(false)
  })

  it('accepts every moduleKey in MODULE_KEYS', () => {
    for (const moduleKey of MODULE_KEYS) {
      const r = UpdatePermissionSchema.safeParse({
        role: 'admin',
        moduleKey,
        accessLevel: 'view',
      })
      expect(r.success).toBe(true)
    }
  })

  it('accepts every accessLevel in the allowed set', () => {
    for (const accessLevel of ['none', 'view', 'manage'] as const) {
      const r = UpdatePermissionSchema.safeParse({
        role: 'admin',
        moduleKey: 'patients',
        accessLevel,
      })
      expect(r.success).toBe(true)
    }
  })
})
