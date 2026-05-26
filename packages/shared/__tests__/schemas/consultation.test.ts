import { describe, it, expect } from 'vitest'
import {
  CreateConsultationSchema,
  AmendConsultationSchema,
  AddProtocolUsageSchema,
  CreatePrescriptionGroupSchema,
  CreateImagingOrderGroupSchema,
  CreateLabOrderGroupSchema,
} from '../../src/schemas/consultation.js'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

describe('CreateConsultationSchema', () => {
  const valid = { patientId: VALID_UUID, locationId: VALID_UUID }

  it('accepts minimal payload (patientId + locationId only)', () => {
    const result = CreateConsultationSchema.parse(valid)
    expect(result.patientId).toBe(VALID_UUID)
  })

  it('accepts payload with optional appointmentId', () => {
    const result = CreateConsultationSchema.parse({ ...valid, appointmentId: VALID_UUID })
    expect(result.appointmentId).toBe(VALID_UUID)
  })

  it('accepts null appointmentId', () => {
    const result = CreateConsultationSchema.parse({ ...valid, appointmentId: null })
    expect(result.appointmentId).toBeNull()
  })

  it('rejects missing patientId', () => {
    expect(() => CreateConsultationSchema.parse({ locationId: VALID_UUID })).toThrow()
  })

  it('rejects non-uuid patientId', () => {
    expect(() =>
      CreateConsultationSchema.parse({ patientId: 'bad', locationId: VALID_UUID }),
    ).toThrow()
  })

  it('does not have SOAP fields', () => {
    const shape = CreateConsultationSchema.shape
    expect('subjective' in shape).toBe(false)
    expect('chiefComplaint' in shape).toBe(false)
    expect('vitals' in shape).toBe(false)
    expect('diagnoses' in shape).toBe(false)
  })
})

describe('AmendConsultationSchema', () => {
  it('accepts valid amendment with reason', () => {
    const result = AmendConsultationSchema.parse({
      reason: 'Corrección de diagnóstico erróneo.',
    })
    expect(result.reason).toContain('Corrección')
  })

  it('accepts reason + amendment_content', () => {
    const result = AmendConsultationSchema.parse({
      reason: 'Error en el diagnóstico inicial.',
      amendment_content: { note: 'Patient has type 2, not type 1' },
    })
    expect(result.amendment_content).toEqual({ note: 'Patient has type 2, not type 1' })
  })

  it('rejects reason shorter than 10 chars', () => {
    expect(() => AmendConsultationSchema.parse({ reason: 'Corto' })).toThrow()
  })

  it('rejects reason longer than 1000 chars', () => {
    expect(() => AmendConsultationSchema.parse({ reason: 'x'.repeat(1001) })).toThrow()
  })

  it('rejects missing reason', () => {
    expect(() => AmendConsultationSchema.parse({})).toThrow()
  })
})

describe('AddProtocolUsageSchema', () => {
  it('accepts minimal payload', () => {
    const result = AddProtocolUsageSchema.parse({ protocolId: VALID_UUID })
    expect(result.protocolId).toBe(VALID_UUID)
  })

  it('accepts with optional fields', () => {
    const result = AddProtocolUsageSchema.parse({
      protocolId: VALID_UUID,
      parentUsageId: VALID_UUID,
      triggerBlockId: 'block-123',
    })
    expect(result.parentUsageId).toBe(VALID_UUID)
  })

  it('rejects non-uuid protocolId', () => {
    expect(() => AddProtocolUsageSchema.parse({ protocolId: 'not-uuid' })).toThrow()
  })
})

describe('CreatePrescriptionGroupSchema', () => {
  const validItem = {
    drug: 'Amoxicilina',
    dose: '500mg',
    route: 'oral',
    frequency: 'cada 8 horas',
    duration: '7 días',
  }

  it('accepts a valid group', () => {
    const result = CreatePrescriptionGroupSchema.parse({
      groupTitle: 'Antibióticos',
      items: [validItem],
    })
    expect(result.items).toHaveLength(1)
    expect(result.groupOrder).toBe(1)
  })

  it('rejects empty items array', () => {
    expect(() => CreatePrescriptionGroupSchema.parse({ items: [] })).toThrow()
  })

  it('rejects item with empty drug name', () => {
    expect(() =>
      CreatePrescriptionGroupSchema.parse({ items: [{ ...validItem, drug: '' }] }),
    ).toThrow()
  })
})

describe('CreateImagingOrderGroupSchema', () => {
  const validItem = {
    studyType: 'RX Tórax',
    indication: 'Dolor torácico',
    urgency: 'routine' as const,
  }

  it('accepts a valid imaging group', () => {
    const result = CreateImagingOrderGroupSchema.parse({ items: [validItem] })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.contrast).toBe(false)
  })

  it('rejects empty items array', () => {
    expect(() => CreateImagingOrderGroupSchema.parse({ items: [] })).toThrow()
  })

  it('rejects invalid urgency value', () => {
    expect(() =>
      CreateImagingOrderGroupSchema.parse({ items: [{ ...validItem, urgency: 'normal' }] }),
    ).toThrow()
  })
})

describe('CreateLabOrderGroupSchema', () => {
  const validItem = {
    testName: 'Hemograma completo',
    indication: 'Anemia sospechada',
    sampleType: 'blood' as const,
  }

  it('accepts a valid lab group', () => {
    const result = CreateLabOrderGroupSchema.parse({ items: [validItem] })
    expect(result.items[0]?.urgency).toBe('routine')
  })

  it('rejects empty items', () => {
    expect(() => CreateLabOrderGroupSchema.parse({ items: [] })).toThrow()
  })

  it('rejects invalid sampleType', () => {
    expect(() =>
      CreateLabOrderGroupSchema.parse({ items: [{ ...validItem, sampleType: 'saliva' }] }),
    ).toThrow()
  })
})
