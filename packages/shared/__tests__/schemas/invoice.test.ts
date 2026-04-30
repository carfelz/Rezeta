import { describe, it, expect } from 'vitest'
import {
  CurrencySchema,
  InvoiceItemSchema,
  CreateInvoiceSchema,
  UpdateInvoiceSchema,
} from '../../src/schemas/invoice.js'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

const validItem = {
  description: 'Consulta médica',
  quantity: 1,
  unitPrice: 2000,
  total: 2000,
}

describe('CurrencySchema', () => {
  it('accepts DOP and USD', () => {
    expect(CurrencySchema.parse('DOP')).toBe('DOP')
    expect(CurrencySchema.parse('USD')).toBe('USD')
  })

  it('rejects unknown currency', () => {
    expect(() => CurrencySchema.parse('EUR')).toThrow()
  })
})

describe('InvoiceItemSchema', () => {
  it('accepts a valid item', () => {
    const result = InvoiceItemSchema.parse(validItem)
    expect(result.quantity).toBe(1)
    expect(result.unitPrice).toBe(2000)
  })

  it('rejects empty description', () => {
    expect(() => InvoiceItemSchema.parse({ ...validItem, description: '' })).toThrow()
  })

  it('rejects description exceeding 500 chars', () => {
    expect(() =>
      InvoiceItemSchema.parse({ ...validItem, description: 'x'.repeat(501) }),
    ).toThrow()
  })

  it('rejects quantity of 0', () => {
    expect(() => InvoiceItemSchema.parse({ ...validItem, quantity: 0 })).toThrow()
  })

  it('rejects negative unitPrice', () => {
    expect(() => InvoiceItemSchema.parse({ ...validItem, unitPrice: -1 })).toThrow()
  })

  it('rejects non-integer quantity', () => {
    expect(() => InvoiceItemSchema.parse({ ...validItem, quantity: 1.5 })).toThrow()
  })
})

describe('CreateInvoiceSchema', () => {
  const valid = {
    patientId: VALID_UUID,
    locationId: VALID_UUID,
    items: [validItem],
  }

  it('accepts valid minimal payload', () => {
    const result = CreateInvoiceSchema.parse(valid)
    expect(result.currency).toBe('DOP')
    expect(result.items).toHaveLength(1)
  })

  it('accepts full payload with optional fields', () => {
    const result = CreateInvoiceSchema.parse({
      ...valid,
      consultationId: VALID_UUID,
      currency: 'USD',
      notes: 'Pago en efectivo',
    })
    expect(result.currency).toBe('USD')
    expect(result.consultationId).toBe(VALID_UUID)
  })

  it('rejects missing patientId', () => {
    const { patientId: _, ...rest } = valid
    expect(() => CreateInvoiceSchema.parse(rest)).toThrow()
  })

  it('rejects non-uuid locationId', () => {
    expect(() => CreateInvoiceSchema.parse({ ...valid, locationId: 'bad-id' })).toThrow()
  })

  it('rejects empty items array', () => {
    expect(() => CreateInvoiceSchema.parse({ ...valid, items: [] })).toThrow()
  })

  it('accepts null consultationId', () => {
    const result = CreateInvoiceSchema.parse({ ...valid, consultationId: null })
    expect(result.consultationId).toBeNull()
  })
})

describe('UpdateInvoiceSchema', () => {
  it('accepts empty object', () => {
    expect(UpdateInvoiceSchema.parse({})).toEqual({})
  })

  it('accepts partial update', () => {
    const result = UpdateInvoiceSchema.parse({ notes: 'Actualizado' })
    expect(result.notes).toBe('Actualizado')
  })
})
