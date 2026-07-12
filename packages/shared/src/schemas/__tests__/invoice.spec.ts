import { describe, it, expect } from 'vitest'
import { InvoiceItemSchema, CreateInvoiceSchema } from '../invoice.js'

describe('InvoiceItemSchema', () => {
  const valid = { description: 'Consulta', quantity: 1, unitPrice: 1000, total: 1000 }

  it('accepts a well-formed item', () => {
    expect(InvoiceItemSchema.safeParse(valid).success).toBe(true)
  })

  it('requires quantity to be a positive integer', () => {
    expect(InvoiceItemSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false)
    expect(InvoiceItemSchema.safeParse({ ...valid, quantity: 1.5 }).success).toBe(false)
  })

  it('rejects a negative unitPrice', () => {
    expect(InvoiceItemSchema.safeParse({ ...valid, unitPrice: -1 }).success).toBe(false)
  })

  it('rejects a unitPrice above the sane cap', () => {
    expect(InvoiceItemSchema.safeParse({ ...valid, unitPrice: 100_000_001 }).success).toBe(false)
  })

  it('rejects a total above the sane cap', () => {
    expect(InvoiceItemSchema.safeParse({ ...valid, total: 100_000_001 }).success).toBe(false)
  })

  it('rejects a non-finite unitPrice', () => {
    expect(InvoiceItemSchema.safeParse({ ...valid, unitPrice: Infinity }).success).toBe(false)
  })

  it('rejects a non-finite total', () => {
    expect(InvoiceItemSchema.safeParse({ ...valid, total: Infinity }).success).toBe(false)
  })

  it('still accepts a total field for backward compatibility', () => {
    const parsed = InvoiceItemSchema.safeParse(valid)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.total).toBe(1000)
  })
})

describe('CreateInvoiceSchema', () => {
  it('rejects an item whose unitPrice exceeds the cap', () => {
    const result = CreateInvoiceSchema.safeParse({
      patientId: '11111111-1111-1111-1111-111111111111',
      locationId: '22222222-2222-2222-2222-222222222222',
      items: [{ description: 'X', quantity: 1, unitPrice: 100_000_001, total: 1 }],
    })
    expect(result.success).toBe(false)
  })
})
