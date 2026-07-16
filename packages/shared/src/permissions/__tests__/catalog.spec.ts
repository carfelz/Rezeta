import { describe, it, expect } from 'vitest'
import type { UserRole } from '../../types/auth.js'
import {
  ACCESS_LEVEL_RANK,
  MODULE_KEYS,
  PERMISSION_CATALOG,
  type AccessLevel,
  type ModuleKey,
} from '../catalog.js'

const ROLES: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']

// The authoritative default matrix from the shared contract (spec §4.3).
const EXPECTED: Record<ModuleKey, [AccessLevel, AccessLevel, AccessLevel, AccessLevel]> = {
  // [assistant, doctor, admin, super_admin]
  patients: ['view', 'manage', 'manage', 'manage'],
  consultations: ['view', 'manage', 'manage', 'manage'],
  protocols: ['none', 'manage', 'manage', 'manage'],
  appointments: ['manage', 'manage', 'manage', 'manage'],
  orders: ['manage', 'manage', 'manage', 'manage'],
  billing: ['manage', 'manage', 'manage', 'manage'],
  locations: ['none', 'manage', 'manage', 'manage'],
  templates: ['none', 'manage', 'manage', 'manage'],
  categories: ['none', 'manage', 'manage', 'manage'],
  schedules_config: ['none', 'manage', 'manage', 'manage'],
  audit_log: ['none', 'manage', 'manage', 'manage'],
  users: ['none', 'none', 'manage', 'manage'],
  permissions: ['none', 'none', 'manage', 'manage'],
}

const SECTIONS: Record<ModuleKey, 'clinical' | 'admin'> = {
  patients: 'clinical',
  consultations: 'clinical',
  protocols: 'clinical',
  appointments: 'clinical',
  orders: 'clinical',
  billing: 'clinical',
  locations: 'admin',
  templates: 'admin',
  categories: 'admin',
  schedules_config: 'admin',
  audit_log: 'admin',
  users: 'admin',
  permissions: 'admin',
}

describe('permission catalog', () => {
  it('ranks access levels none < view < manage', () => {
    expect(ACCESS_LEVEL_RANK).toEqual({ none: 0, view: 1, manage: 2 })
  })

  it('lists all 13 modules in display order', () => {
    expect(MODULE_KEYS).toEqual([
      'patients',
      'consultations',
      'protocols',
      'appointments',
      'orders',
      'billing',
      'locations',
      'templates',
      'categories',
      'schedules_config',
      'audit_log',
      'users',
      'permissions',
    ])
  })

  it('has one catalog entry per module key, keyed by itself', () => {
    for (const key of MODULE_KEYS) {
      expect(PERMISSION_CATALOG[key].key).toBe(key)
    }
    expect(Object.keys(PERMISSION_CATALOG).sort()).toEqual([...MODULE_KEYS].sort())
  })

  it('assigns the correct section to each module', () => {
    for (const key of MODULE_KEYS) {
      expect(PERMISSION_CATALOG[key].section).toBe(SECTIONS[key])
    }
  })

  it('matches the default matrix from the contract for every module and role', () => {
    for (const key of MODULE_KEYS) {
      const expectedRow = EXPECTED[key]
      ROLES.forEach((role, i) => {
        expect(PERMISSION_CATALOG[key].defaults[role]).toBe(expectedRow[i])
      })
    }
  })

  it('defines a default for all four roles on every module', () => {
    for (const key of MODULE_KEYS) {
      expect(Object.keys(PERMISSION_CATALOG[key].defaults).sort()).toEqual([...ROLES].sort())
    }
  })
})
