import { describe, it, expect } from 'vitest'
import type { UserRole } from '../../types/auth.js'
import { ROLE_RANK, canManageRole } from '../roles.js'

const ROLES: UserRole[] = ['assistant', 'doctor', 'admin', 'super_admin']

describe('ROLE_RANK', () => {
  it('ranks the four roles strictly ascending by privilege', () => {
    expect(ROLE_RANK).toEqual({ assistant: 1, doctor: 2, admin: 3, super_admin: 4 })
  })

  it('has a distinct rank for every role', () => {
    const ranks = ROLES.map((r) => ROLE_RANK[r])
    expect(new Set(ranks).size).toBe(ROLES.length)
  })
})

describe('canManageRole', () => {
  // Full 4x4 truth table: canManageRole(actor, target) === rank[target] < rank[actor].
  const cases: Array<[UserRole, UserRole, boolean]> = [
    ['assistant', 'assistant', false],
    ['assistant', 'doctor', false],
    ['assistant', 'admin', false],
    ['assistant', 'super_admin', false],
    ['doctor', 'assistant', true],
    ['doctor', 'doctor', false],
    ['doctor', 'admin', false],
    ['doctor', 'super_admin', false],
    ['admin', 'assistant', true],
    ['admin', 'doctor', true],
    ['admin', 'admin', false],
    ['admin', 'super_admin', false],
    ['super_admin', 'assistant', true],
    ['super_admin', 'doctor', true],
    ['super_admin', 'admin', true],
    ['super_admin', 'super_admin', false],
  ]

  it.each(cases)('actor=%s target=%s -> %s', (actor, target, expected) => {
    expect(canManageRole(actor, target)).toBe(expected)
  })

  it('never lets a role manage its own rank', () => {
    for (const role of ROLES) {
      expect(canManageRole(role, role)).toBe(false)
    }
  })

  it('never lets a role manage a strictly higher rank', () => {
    expect(canManageRole('assistant', 'super_admin')).toBe(false)
    expect(canManageRole('admin', 'super_admin')).toBe(false)
    expect(canManageRole('doctor', 'admin')).toBe(false)
  })
})
