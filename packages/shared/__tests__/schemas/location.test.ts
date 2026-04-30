import { describe, it, expect } from 'vitest'
import { CreateLocationSchema, UpdateLocationSchema } from '../../src/schemas/location.js'

describe('CreateLocationSchema', () => {
  const valid = {
    name: 'Clínica Centro',
    address: 'Av. 27 de Febrero 100, Santo Domingo',
    city: 'Santo Domingo',
    phone: '+1-809-555-0100',
    isOwned: true,
    notes: 'Consultas los lunes y miércoles',
    commissionPercent: 20,
  }

  it('accepts a full valid payload', () => {
    const result = CreateLocationSchema.parse(valid)
    expect(result.name).toBe('Clínica Centro')
    expect(result.commissionPercent).toBe(20)
    expect(result.isOwned).toBe(true)
  })

  it('applies defaults for isOwned and commissionPercent', () => {
    const result = CreateLocationSchema.parse({ name: 'Mi Consultorio' })
    expect(result.isOwned).toBe(false)
    expect(result.commissionPercent).toBe(0)
  })

  it('rejects name shorter than 2 characters', () => {
    expect(() => CreateLocationSchema.parse({ name: 'X' })).toThrow()
  })

  it('rejects name longer than 200 characters', () => {
    expect(() => CreateLocationSchema.parse({ name: 'N'.repeat(201) })).toThrow()
  })

  it('rejects missing name', () => {
    expect(() => CreateLocationSchema.parse({})).toThrow()
  })

  it('rejects commissionPercent below 0', () => {
    expect(() => CreateLocationSchema.parse({ name: 'Test', commissionPercent: -1 })).toThrow()
  })

  it('rejects commissionPercent above 100', () => {
    expect(() => CreateLocationSchema.parse({ name: 'Test', commissionPercent: 101 })).toThrow()
  })

  it('accepts commissionPercent boundary values 0 and 100', () => {
    expect(CreateLocationSchema.parse({ name: 'Test', commissionPercent: 0 }).commissionPercent).toBe(0)
    expect(CreateLocationSchema.parse({ name: 'Test', commissionPercent: 100 }).commissionPercent).toBe(100)
  })

  it('accepts null for optional fields', () => {
    const result = CreateLocationSchema.parse({ name: 'Test', address: null, city: null, phone: null, notes: null })
    expect(result.address).toBeNull()
    expect(result.city).toBeNull()
  })

  it('rejects address exceeding 500 chars', () => {
    expect(() => CreateLocationSchema.parse({ name: 'Test', address: 'A'.repeat(501) })).toThrow()
  })
})

describe('UpdateLocationSchema', () => {
  it('accepts empty object', () => {
    expect(UpdateLocationSchema.parse({})).toEqual({})
  })

  it('accepts partial update', () => {
    const result = UpdateLocationSchema.parse({ city: 'Santiago', commissionPercent: 15 })
    expect(result.city).toBe('Santiago')
    expect(result.commissionPercent).toBe(15)
  })

  it('still enforces validation rules on provided fields', () => {
    expect(() => UpdateLocationSchema.parse({ commissionPercent: 150 })).toThrow()
  })
})
