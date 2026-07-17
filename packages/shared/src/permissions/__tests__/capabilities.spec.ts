import { describe, it, expect } from 'vitest'
import { MODULE_KEYS } from '../catalog.js'
import {
  defaultCapabilitiesFor,
  hasCapability,
  hasAnyCapabilityInSection,
  type CapabilityMap,
} from '../capabilities.js'

describe('hasCapability', () => {
  const caps: CapabilityMap = defaultCapabilitiesFor('assistant')

  it('grants when the held level equals the required level', () => {
    expect(hasCapability(caps, 'patients', 'view')).toBe(true) // assistant patients = view
  })

  it('grants when the held level outranks the required level', () => {
    expect(hasCapability(caps, 'appointments', 'view')).toBe(true) // assistant appointments = manage
  })

  it('denies when the held level is below the required level', () => {
    expect(hasCapability(caps, 'patients', 'manage')).toBe(false) // view < manage
  })

  it('denies a `none` module against any positive requirement', () => {
    expect(hasCapability(caps, 'protocols', 'view')).toBe(false) // assistant protocols = none
  })

  it('treats a missing module entry as `none`', () => {
    const partial = {} as CapabilityMap
    expect(hasCapability(partial, 'patients', 'view')).toBe(false)
    expect(hasCapability(partial, 'patients', 'none')).toBe(true)
  })
})

describe('defaultCapabilitiesFor', () => {
  it('returns an entry for every module key', () => {
    const caps = defaultCapabilitiesFor('doctor')
    expect(Object.keys(caps).sort()).toEqual([...MODULE_KEYS].sort())
  })

  it('builds the assistant map from the catalog defaults', () => {
    expect(defaultCapabilitiesFor('assistant')).toEqual({
      patients: 'view',
      consultations: 'view',
      protocols: 'none',
      appointments: 'manage',
      orders: 'manage',
      billing: 'manage',
      locations: 'none',
      templates: 'none',
      categories: 'none',
      schedules_config: 'none',
      audit_log: 'none',
      users: 'none',
      permissions: 'none',
    })
  })

  it('grants super_admin manage on users and permissions', () => {
    const caps = defaultCapabilitiesFor('super_admin')
    expect(caps.users).toBe('manage')
    expect(caps.permissions).toBe('manage')
  })

  it('denies doctor on users and permissions (admin-only features)', () => {
    const caps = defaultCapabilitiesFor('doctor')
    expect(caps.users).toBe('none')
    expect(caps.permissions).toBe('none')
  })
})

describe('hasAnyCapabilityInSection', () => {
  it('denies every section when the capability map is empty', () => {
    const empty = {} as CapabilityMap
    expect(hasAnyCapabilityInSection(empty, 'admin')).toBe(false)
    expect(hasAnyCapabilityInSection(empty, 'clinical')).toBe(false)
  })

  it('denies a section when all its modules are none (assistant admin section)', () => {
    const caps = defaultCapabilitiesFor('assistant')
    expect(hasAnyCapabilityInSection(caps, 'admin')).toBe(false)
  })

  it('grants a section when a single module in it meets the required level', () => {
    const caps: CapabilityMap = { ...defaultCapabilitiesFor('assistant'), users: 'manage' }
    // assistant admin-section modules are all `none` except this one override.
    expect(hasAnyCapabilityInSection(caps, 'admin')).toBe(true)
  })

  it('denies when the single granted module is below the required level', () => {
    const caps: CapabilityMap = { ...defaultCapabilitiesFor('assistant'), users: 'view' }
    expect(hasAnyCapabilityInSection(caps, 'admin', 'manage')).toBe(false)
  })

  it('grants the clinical section from the assistant defaults (patients = view)', () => {
    const caps = defaultCapabilitiesFor('assistant')
    expect(hasAnyCapabilityInSection(caps, 'clinical')).toBe(true)
  })

  it('defaults the required level to view', () => {
    const caps: CapabilityMap = { ...defaultCapabilitiesFor('assistant'), users: 'view' }
    expect(hasAnyCapabilityInSection(caps, 'admin')).toBe(true)
  })
})
