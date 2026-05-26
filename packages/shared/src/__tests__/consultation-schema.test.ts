import { describe, it, expect } from 'vitest'
import { CreateConsultationSchema, AmendConsultationSchema } from '../schemas/consultation.js'

describe('CreateConsultationSchema', () => {
  it('accepts minimal walk-in payload (no appointmentId, no protocolId)', () => {
    const result = CreateConsultationSchema.safeParse({
      patientId: 'a0000000-0000-0000-0000-000000000001',
      locationId: 'a0000000-0000-0000-0000-000000000002',
    })
    expect(result.success).toBe(true)
  })
  it('rejects payload with SOAP fields (they no longer exist)', () => {
    const schema = CreateConsultationSchema.shape
    expect('subjective' in schema).toBe(false)
    expect('chiefComplaint' in schema).toBe(false)
    expect('vitals' in schema).toBe(false)
  })
  it('rejects missing patientId', () => {
    const result = CreateConsultationSchema.safeParse({ locationId: 'a0000000-0000-0000-0000-000000000002' })
    expect(result.success).toBe(false)
  })
})

describe('AmendConsultationSchema', () => {
  it('requires reason', () => {
    const result = AmendConsultationSchema.safeParse({ reason: '' })
    expect(result.success).toBe(false)
  })
  it('accepts reason + amendment_content', () => {
    const result = AmendConsultationSchema.safeParse({
      reason: 'Corrección de diagnóstico erróneo',
      amendment_content: { note: 'Patient has type 2, not type 1' },
    })
    expect(result.success).toBe(true)
  })
})
