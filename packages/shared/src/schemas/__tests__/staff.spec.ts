import { describe, it, expect } from 'vitest'
import { CreateInstitutionSchema, InstitutionCreatedSchema, StaffInstitutionSchema } from '../staff.js'

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

describe('StaffInstitutionSchema', () => {
  it('accepts a roster row', () => {
    const parsed = StaffInstitutionSchema.parse({
      id: '11111111-2222-4333-8444-555555555555',
      name: 'Centro Vista Alegre',
      type: 'clinic',
      plan: 'clinic',
      createdAt: '2026-07-28T12:00:00.000Z',
      userCount: 5,
      activeUserCount: 4,
    })
    expect(parsed.userCount).toBe(5)
  })

  it('accepts a null name and rejects negative counts', () => {
    expect(
      StaffInstitutionSchema.parse({
        id: '11111111-2222-4333-8444-555555555555',
        name: null,
        type: 'solo',
        plan: 'free',
        createdAt: '2026-07-28T12:00:00.000Z',
        userCount: 0,
        activeUserCount: 0,
      }).name,
    ).toBeNull()
    expect(() =>
      StaffInstitutionSchema.parse({
        id: '11111111-2222-4333-8444-555555555555',
        name: null,
        type: 'solo',
        plan: 'free',
        createdAt: '2026-07-28T12:00:00.000Z',
        userCount: -1,
        activeUserCount: 0,
      }),
    ).toThrow()
  })
})
