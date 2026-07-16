import { describe, it, expect } from 'vitest'
import {
  CreateUserSchema,
  ChangeRoleSchema,
  SetActiveSchema,
  ManagedUserSchema,
} from '../user-management.js'

describe('CreateUserSchema', () => {
  it('accepts a valid invite payload', () => {
    const r = CreateUserSchema.safeParse({
      email: 'nurse@clinic.do',
      fullName: 'Ana Reyes',
      role: 'assistant',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an unknown role', () => {
    const r = CreateUserSchema.safeParse({
      email: 'x@y.do',
      fullName: 'X',
      role: 'owner',
    })
    expect(r.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const r = CreateUserSchema.safeParse({ email: 'nope', fullName: 'X Y', role: 'doctor' })
    expect(r.success).toBe(false)
  })

  it('rejects a too-short name', () => {
    const r = CreateUserSchema.safeParse({ email: 'a@b.do', fullName: 'A', role: 'doctor' })
    expect(r.success).toBe(false)
  })
})

describe('ChangeRoleSchema', () => {
  it('accepts a valid role', () => {
    expect(ChangeRoleSchema.safeParse({ role: 'admin' }).success).toBe(true)
  })
  it('rejects an unknown role', () => {
    expect(ChangeRoleSchema.safeParse({ role: 'root' }).success).toBe(false)
  })
})

describe('SetActiveSchema', () => {
  it('accepts a boolean', () => {
    expect(SetActiveSchema.safeParse({ isActive: false }).success).toBe(true)
  })
  it('rejects a non-boolean', () => {
    expect(SetActiveSchema.safeParse({ isActive: 'no' }).success).toBe(false)
  })
})

describe('ManagedUserSchema', () => {
  const base = {
    id: '018e3f2a-1111-7000-8000-000000000001',
    email: 'a@b.do',
    fullName: 'Ana',
    role: 'doctor',
    isActive: true,
    createdAt: '2026-07-15T10:00:00.000Z',
  }
  it('accepts an active user with a lastLoginAt and status', () => {
    const r = ManagedUserSchema.safeParse({
      ...base,
      lastLoginAt: '2026-07-15T12:00:00.000Z',
      status: 'active',
    })
    expect(r.success).toBe(true)
  })
  it('accepts an invited user with null lastLoginAt', () => {
    const r = ManagedUserSchema.safeParse({ ...base, lastLoginAt: null, status: 'invited' })
    expect(r.success).toBe(true)
  })
  it('rejects an unknown status', () => {
    const r = ManagedUserSchema.safeParse({ ...base, lastLoginAt: null, status: 'pending' })
    expect(r.success).toBe(false)
  })
})
