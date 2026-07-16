import { describe, it, expect } from 'vitest'
import { CreateInstitutionSchema, InstitutionCreatedSchema } from '../staff.js'

describe('CreateInstitutionSchema', () => {
  const valid = {
    institutionName: 'Clínica Norte',
    type: 'clinic' as const,
    plan: 'free' as const,
    adminFullName: 'Dra. Ana Reyes',
    adminEmail: 'ana@clinica.com',
  }

  it('accepts a well-formed payload', () => {
    expect(CreateInstitutionSchema.parse(valid)).toEqual(valid)
  })

  it('rejects an invalid admin email', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, adminEmail: 'not-an-email' })
    expect(r.success).toBe(false)
  })

  it('rejects an institution name shorter than 2 chars', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, institutionName: 'X' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown tenant type', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, type: 'hospital' })
    expect(r.success).toBe(false)
  })

  it('rejects an unknown plan', () => {
    const r = CreateInstitutionSchema.safeParse({ ...valid, plan: 'enterprise' })
    expect(r.success).toBe(false)
  })
})

describe('InstitutionCreatedSchema', () => {
  it('accepts a well-formed response', () => {
    const v = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      userId: '22222222-2222-2222-2222-222222222222',
      email: 'ana@clinica.com',
    }
    expect(InstitutionCreatedSchema.parse(v)).toEqual(v)
  })
})
