import { describe, it, expect } from 'vitest'
import {
  SignUpSchema,
  SignInSchema,
  TenantApiSchema,
  UserApiSchema,
} from '../../src/schemas/auth.js'

describe('SignUpSchema', () => {
  const valid = {
    email: 'doctor@rezeta.app',
    password: 'Secure123!',
    confirmPassword: 'Secure123!',
  }

  it('accepts valid signup data', () => {
    const result = SignUpSchema.parse(valid)
    expect(result.email).toBe('doctor@rezeta.app')
  })

  it('rejects invalid email', () => {
    expect(() => SignUpSchema.parse({ ...valid, email: 'not-an-email' })).toThrow()
  })

  it('rejects password shorter than 8 chars', () => {
    expect(() =>
      SignUpSchema.parse({ ...valid, password: 'Short1', confirmPassword: 'Short1' }),
    ).toThrow()
  })

  it('rejects password longer than 128 chars', () => {
    const longPwd = 'A'.repeat(129)
    expect(() =>
      SignUpSchema.parse({ ...valid, password: longPwd, confirmPassword: longPwd }),
    ).toThrow()
  })

  it('rejects mismatched passwords', () => {
    expect(() =>
      SignUpSchema.parse({ ...valid, confirmPassword: 'DifferentPass1!' }),
    ).toThrow()
  })

  it('rejects missing email', () => {
    const { email: _, ...rest } = valid
    expect(() => SignUpSchema.parse(rest)).toThrow()
  })
})

describe('SignInSchema', () => {
  const valid = {
    email: 'doctor@rezeta.app',
    password: 'anypassword',
  }

  it('accepts valid signin data', () => {
    const result = SignInSchema.parse(valid)
    expect(result.email).toBe('doctor@rezeta.app')
  })

  it('rejects invalid email', () => {
    expect(() => SignInSchema.parse({ ...valid, email: 'bademail' })).toThrow()
  })

  it('rejects empty password', () => {
    expect(() => SignInSchema.parse({ ...valid, password: '' })).toThrow()
  })

  it('rejects missing password', () => {
    expect(() => SignInSchema.parse({ email: valid.email })).toThrow()
  })
})

describe('TenantApiSchema', () => {
  const valid = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Consultorio Dr. García',
    type: 'clinic',
    plan: 'free',
    country: 'DO',
    language: 'es',
    timezone: 'America/Santo_Domingo',
    createdAt: '2026-04-01T00:00:00.000Z',
  }

  it('accepts valid tenant API response', () => {
    const result = TenantApiSchema.parse(valid)
    expect(result.country).toBe('DO')
  })

  it('accepts null name', () => {
    const result = TenantApiSchema.parse({ ...valid, name: null })
    expect(result.name).toBeNull()
  })

  it('rejects non-uuid id', () => {
    expect(() => TenantApiSchema.parse({ ...valid, id: 'not-uuid' })).toThrow()
  })
})

describe('UserApiSchema', () => {
  const valid = {
    id: '00000000-0000-0000-0000-000000000001',
    firebaseUid: 'firebase-uid-abc',
    tenantId: '00000000-0000-0000-0000-000000000002',
    email: 'doctor@rezeta.app',
    fullName: 'Dr. Juan García',
    role: 'owner' as const,
    specialty: 'Cardiología',
    licenseNumber: 'CMP-12345',
    isActive: true,
    createdAt: '2026-04-01T00:00:00.000Z',
  }

  it('accepts valid user API response', () => {
    const result = UserApiSchema.parse(valid)
    expect(result.role).toBe('owner')
  })

  it('accepts null optional fields', () => {
    const result = UserApiSchema.parse({ ...valid, fullName: null, specialty: null, licenseNumber: null })
    expect(result.fullName).toBeNull()
  })

  it('rejects invalid role', () => {
    expect(() => UserApiSchema.parse({ ...valid, role: 'admin' })).toThrow()
  })

  it('accepts doctor role', () => {
    const result = UserApiSchema.parse({ ...valid, role: 'doctor' })
    expect(result.role).toBe('doctor')
  })

  it('rejects invalid email', () => {
    expect(() => UserApiSchema.parse({ ...valid, email: 'bademail' })).toThrow()
  })
})
