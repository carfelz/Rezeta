import { describe, it, expect } from 'vitest'
import {
  SignInSchema,
  TenantApiSchema,
  UpdateProfileSchema,
  UserApiSchema,
} from '../../src/schemas/auth.js'
import { defaultCapabilitiesFor } from '../../src/permissions/capabilities.js'

describe('UpdateProfileSchema', () => {
  const valid = {
    fullName: 'Dr. Juan García',
    specialty: 'Cardiología',
    licenseNumber: '1234-DR',
  }

  it('accepts valid profile data', () => {
    const result = UpdateProfileSchema.parse(valid)
    expect(result.fullName).toBe('Dr. Juan García')
  })

  it('accepts null specialty and licenseNumber', () => {
    const result = UpdateProfileSchema.parse({ ...valid, specialty: null, licenseNumber: null })
    expect(result.specialty).toBeNull()
    expect(result.licenseNumber).toBeNull()
  })

  it('rejects missing fullName', () => {
    const { fullName: _, ...rest } = valid
    expect(() => UpdateProfileSchema.parse(rest)).toThrow()
  })

  it('rejects fullName shorter than 2 chars', () => {
    expect(() => UpdateProfileSchema.parse({ ...valid, fullName: 'A' })).toThrow()
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
    externalUid: 'firebase-uid-abc',
    tenantId: '00000000-0000-0000-0000-000000000002',
    email: 'doctor@rezeta.app',
    fullName: 'Dr. Juan García',
    role: 'super_admin' as const,
    specialty: 'Cardiología',
    licenseNumber: 'CMP-12345',
    isActive: true,
    capabilities: defaultCapabilitiesFor('super_admin'),
    createdAt: '2026-04-01T00:00:00.000Z',
  }

  it('accepts valid user API response', () => {
    const result = UserApiSchema.parse(valid)
    expect(result.role).toBe('super_admin')
  })

  it('accepts null optional fields', () => {
    const result = UserApiSchema.parse({
      ...valid,
      fullName: null,
      specialty: null,
      licenseNumber: null,
    })
    expect(result.fullName).toBeNull()
  })

  it('accepts every institution role', () => {
    for (const role of ['assistant', 'doctor', 'admin', 'super_admin'] as const) {
      const result = UserApiSchema.parse({ ...valid, role })
      expect(result.role).toBe(role)
    }
  })

  it('rejects the retired owner role', () => {
    expect(() => UserApiSchema.parse({ ...valid, role: 'owner' })).toThrow()
  })

  it('rejects an unknown role', () => {
    expect(() => UserApiSchema.parse({ ...valid, role: 'superuser' })).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() => UserApiSchema.parse({ ...valid, email: 'bademail' })).toThrow()
  })
})
