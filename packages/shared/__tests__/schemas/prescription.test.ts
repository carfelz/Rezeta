import { describe, it, expect } from 'vitest'
import {
  PrescriptionItemSchema,
  CreatePrescriptionSchema,
  UpdatePrescriptionSchema,
} from '../../src/schemas/prescription.js'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

const validItem = {
  drug: 'Metformina',
  dose: '500mg',
  route: 'oral',
  frequency: 'dos veces al día',
}

describe('PrescriptionItemSchema', () => {
  it('accepts a valid item', () => {
    const result = PrescriptionItemSchema.parse(validItem)
    expect(result.drug).toBe('Metformina')
  })

  it('accepts item with optional fields', () => {
    const result = PrescriptionItemSchema.parse({
      ...validItem,
      duration: '30 días',
      instructions: 'Tomar con alimentos',
    })
    expect(result.duration).toBe('30 días')
    expect(result.instructions).toBe('Tomar con alimentos')
  })

  it('rejects empty drug name', () => {
    expect(() => PrescriptionItemSchema.parse({ ...validItem, drug: '' })).toThrow()
  })

  it('rejects drug name exceeding 200 chars', () => {
    expect(() =>
      PrescriptionItemSchema.parse({ ...validItem, drug: 'x'.repeat(201) }),
    ).toThrow()
  })

  it('rejects missing dose', () => {
    const { dose: _, ...rest } = validItem
    expect(() => PrescriptionItemSchema.parse(rest)).toThrow()
  })

  it('rejects empty route', () => {
    expect(() => PrescriptionItemSchema.parse({ ...validItem, route: '' })).toThrow()
  })

  it('rejects empty frequency', () => {
    expect(() => PrescriptionItemSchema.parse({ ...validItem, frequency: '' })).toThrow()
  })

  it('rejects instructions exceeding 500 chars', () => {
    expect(() =>
      PrescriptionItemSchema.parse({ ...validItem, instructions: 'x'.repeat(501) }),
    ).toThrow()
  })
})

describe('CreatePrescriptionSchema', () => {
  const valid = {
    patientId: VALID_UUID,
    items: [validItem],
  }

  it('accepts minimal payload', () => {
    const result = CreatePrescriptionSchema.parse(valid)
    expect(result.patientId).toBe(VALID_UUID)
    expect(result.items).toHaveLength(1)
  })

  it('accepts with optional consultationId and notes', () => {
    const result = CreatePrescriptionSchema.parse({
      ...valid,
      consultationId: VALID_UUID,
      notes: 'Revisar en 15 días',
    })
    expect(result.consultationId).toBe(VALID_UUID)
    expect(result.notes).toBe('Revisar en 15 días')
  })

  it('accepts null consultationId', () => {
    const result = CreatePrescriptionSchema.parse({ ...valid, consultationId: null })
    expect(result.consultationId).toBeNull()
  })

  it('rejects missing patientId', () => {
    expect(() => CreatePrescriptionSchema.parse({ items: [validItem] })).toThrow()
  })

  it('rejects non-uuid patientId', () => {
    expect(() => CreatePrescriptionSchema.parse({ patientId: 'bad', items: [validItem] })).toThrow()
  })

  it('rejects empty items array', () => {
    expect(() => CreatePrescriptionSchema.parse({ patientId: VALID_UUID, items: [] })).toThrow()
  })

  it('rejects notes exceeding 2000 chars', () => {
    expect(() =>
      CreatePrescriptionSchema.parse({ ...valid, notes: 'x'.repeat(2001) }),
    ).toThrow()
  })

  it('accepts multiple items', () => {
    const result = CreatePrescriptionSchema.parse({
      patientId: VALID_UUID,
      items: [validItem, { ...validItem, drug: 'Atorvastatina', dose: '20mg' }],
    })
    expect(result.items).toHaveLength(2)
  })
})

describe('UpdatePrescriptionSchema', () => {
  it('accepts empty object', () => {
    expect(UpdatePrescriptionSchema.parse({})).toEqual({})
  })

  it('accepts partial items update', () => {
    const result = UpdatePrescriptionSchema.parse({ items: [validItem] })
    expect(result.items).toHaveLength(1)
  })
})
