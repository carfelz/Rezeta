import { describe, it, expect } from 'vitest'
import {
  SignInSchema,
  SignUpSchema,
  TenantApiSchema,
  UpdateProfileSchema,
  UserApiSchema,
} from '../auth.js'

const validUser = {
  id: '018e3f2a-0000-7000-8000-000000000001',
  externalUid: 'fb-uid',
  tenantId: '018e3f2a-0000-7000-8000-000000000002',
  email: 'doc@test.com',
  fullName: 'Dr. Test',
  role: 'doctor',
  specialty: 'Cardiología',
  licenseNumber: 'MED-001',
  isActive: true,
  capabilities: { patients: 'manage', users: 'none' },
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('UserApiSchema', () => {
  it('accepts a user with capabilities', () => {
    const parsed = UserApiSchema.parse(validUser)
    expect(parsed.capabilities.patients).toBe('manage')
  })

  it('rejects a missing capabilities', () => {
    const { capabilities: _omit, ...rest } = validUser
    expect(UserApiSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects an invalid capability level', () => {
    const bad = { ...validUser, capabilities: { patients: 'god_mode' } }
    expect(UserApiSchema.safeParse(bad).success).toBe(false)
  })
})

describe('TenantApiSchema', () => {
  it('accepts a valid tenant', () => {
    const parsed = TenantApiSchema.parse({
      id: '018e3f2a-0000-7000-8000-000000000002',
      name: 'Clínica Central',
      type: 'clinic',
      plan: 'free',
      country: 'DO',
      language: 'es',
      timezone: 'America/Santo_Domingo',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(parsed.name).toBe('Clínica Central')
  })
})

describe('SignUpSchema', () => {
  const base = {
    fullName: 'Dr. Test',
    email: 'doc@test.com',
    password: 'Abcdef12',
    confirmPassword: 'Abcdef12',
  }

  it('accepts matching strong passwords', () => {
    expect(SignUpSchema.safeParse(base).success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    expect(SignUpSchema.safeParse({ ...base, confirmPassword: 'Abcdef13' }).success).toBe(false)
  })

  it('rejects a weak password (no uppercase/number)', () => {
    expect(
      SignUpSchema.safeParse({ ...base, password: 'abcdefgh', confirmPassword: 'abcdefgh' })
        .success,
    ).toBe(false)
  })
})

describe('SignInSchema', () => {
  it('accepts valid credentials', () => {
    expect(SignInSchema.safeParse({ email: 'doc@test.com', password: 'x' }).success).toBe(true)
  })

  it('rejects an invalid email', () => {
    expect(SignInSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })
})

describe('UpdateProfileSchema', () => {
  it('accepts a valid profile update', () => {
    expect(
      UpdateProfileSchema.safeParse({
        fullName: 'Dr. Test',
        specialty: null,
        licenseNumber: null,
      }).success,
    ).toBe(true)
  })

  it('rejects a too-short name', () => {
    expect(
      UpdateProfileSchema.safeParse({ fullName: 'A', specialty: null, licenseNumber: null })
        .success,
    ).toBe(false)
  })
})
