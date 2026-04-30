import { describe, it, expect } from 'vitest'
import {
  DocumentTypeSchema,
  BloodTypeSchema,
  SexSchema,
  CreatePatientSchema,
  UpdatePatientSchema,
} from '../../src/schemas/patient.js'

const VALID_FULL_PAYLOAD = {
  fullName: 'María García',
  dateOfBirth: '1985-03-15',
  sex: 'female' as const,
  documentType: 'cedula' as const,
  documentNumber: '001-1234567-8',
  phone: '+1-809-555-1234',
  email: 'maria@example.com',
  address: 'Calle Las Flores 42, Santo Domingo',
  bloodType: 'O+' as const,
  allergies: ['Penicilina', 'Sulfa'],
  chronicConditions: ['Hipertensión'],
  notes: 'Paciente con historia de alergias graves',
}

describe('DocumentTypeSchema', () => {
  it('accepts valid document types', () => {
    expect(DocumentTypeSchema.parse('cedula')).toBe('cedula')
    expect(DocumentTypeSchema.parse('passport')).toBe('passport')
    expect(DocumentTypeSchema.parse('rnc')).toBe('rnc')
  })

  it('rejects invalid document type', () => {
    expect(() => DocumentTypeSchema.parse('dni')).toThrow()
  })
})

describe('BloodTypeSchema', () => {
  const types = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
  it.each(types)('accepts blood type %s', (t) => {
    expect(BloodTypeSchema.parse(t)).toBe(t)
  })

  it('rejects invalid blood type', () => {
    expect(() => BloodTypeSchema.parse('C+')).toThrow()
  })
})

describe('SexSchema', () => {
  it('accepts male, female, other', () => {
    expect(SexSchema.parse('male')).toBe('male')
    expect(SexSchema.parse('female')).toBe('female')
    expect(SexSchema.parse('other')).toBe('other')
  })

  it('rejects invalid sex value', () => {
    expect(() => SexSchema.parse('unknown')).toThrow()
  })
})

describe('CreatePatientSchema', () => {
  it('accepts full valid payload', () => {
    const result = CreatePatientSchema.parse(VALID_FULL_PAYLOAD)
    expect(result.fullName).toBe('María García')
    expect(result.bloodType).toBe('O+')
    expect(result.allergies).toHaveLength(2)
  })

  it('accepts minimal payload with only fullName', () => {
    const result = CreatePatientSchema.parse({ fullName: 'Juan Pérez' })
    expect(result.fullName).toBe('Juan Pérez')
    expect(result.allergies).toEqual([])
    expect(result.chronicConditions).toEqual([])
  })

  it('rejects fullName shorter than 2 characters', () => {
    expect(() => CreatePatientSchema.parse({ fullName: 'A' })).toThrow()
  })

  it('rejects fullName longer than 200 characters', () => {
    expect(() => CreatePatientSchema.parse({ fullName: 'A'.repeat(201) })).toThrow()
  })

  it('rejects missing fullName', () => {
    expect(() => CreatePatientSchema.parse({})).toThrow()
  })

  it('rejects invalid email', () => {
    expect(() =>
      CreatePatientSchema.parse({ fullName: 'Test', email: 'not-an-email' }),
    ).toThrow()
  })

  it('accepts null for nullable optional fields', () => {
    const result = CreatePatientSchema.parse({
      fullName: 'Test Patient',
      dateOfBirth: null,
      sex: null,
      documentType: null,
      documentNumber: null,
      phone: null,
      email: null,
      address: null,
      bloodType: null,
      notes: null,
    })
    expect(result.dateOfBirth).toBeNull()
    expect(result.email).toBeNull()
  })

  it('rejects invalid documentType enum', () => {
    expect(() =>
      CreatePatientSchema.parse({ fullName: 'Test', documentType: 'ssn' }),
    ).toThrow()
  })

  it('rejects documentNumber exceeding 30 chars', () => {
    expect(() =>
      CreatePatientSchema.parse({ fullName: 'Test', documentNumber: 'X'.repeat(31) }),
    ).toThrow()
  })
})

describe('UpdatePatientSchema', () => {
  it('accepts empty object', () => {
    expect(UpdatePatientSchema.parse({})).toEqual({})
  })

  it('accepts partial update with just phone', () => {
    const result = UpdatePatientSchema.parse({ phone: '+1-809-000-0001' })
    expect(result.phone).toBe('+1-809-000-0001')
  })

  it('accepts partial allergies update', () => {
    const result = UpdatePatientSchema.parse({ allergies: ['Latex'] })
    expect(result.allergies).toEqual(['Latex'])
  })
})
