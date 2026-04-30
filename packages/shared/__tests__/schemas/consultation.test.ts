import { describe, it, expect } from 'vitest'
import {
  VitalsSchema,
  CreateConsultationSchema,
  UpdateConsultationSchema,
  AmendConsultationSchema,
  AddProtocolUsageSchema,
  UpdateCheckedStateSchema,
  CreatePrescriptionGroupSchema,
  CreateImagingOrderGroupSchema,
  CreateLabOrderGroupSchema,
} from '../../src/schemas/consultation.js'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

describe('VitalsSchema', () => {
  it('accepts a full valid vitals object', () => {
    const result = VitalsSchema.parse({
      bloodPressureSystolic: 120,
      bloodPressureDiastolic: 80,
      heartRate: 72,
      respiratoryRate: 18,
      temperatureCelsius: 36.6,
      oxygenSaturation: 98,
      weightKg: 75,
      heightCm: 170,
    })
    expect(result.heartRate).toBe(72)
  })

  it('accepts empty object (all optional)', () => {
    expect(VitalsSchema.parse({})).toEqual({})
  })

  it('rejects bloodPressureSystolic above 300', () => {
    expect(() => VitalsSchema.parse({ bloodPressureSystolic: 301 })).toThrow()
  })

  it('rejects temperatureCelsius below 25', () => {
    expect(() => VitalsSchema.parse({ temperatureCelsius: 24 })).toThrow()
  })

  it('rejects temperatureCelsius above 45', () => {
    expect(() => VitalsSchema.parse({ temperatureCelsius: 46 })).toThrow()
  })

  it('rejects oxygenSaturation above 100', () => {
    expect(() => VitalsSchema.parse({ oxygenSaturation: 101 })).toThrow()
  })

  it('rejects non-integer heartRate', () => {
    expect(() => VitalsSchema.parse({ heartRate: 72.5 })).toThrow()
  })
})

describe('CreateConsultationSchema', () => {
  const valid = { patientId: VALID_UUID, locationId: VALID_UUID }

  it('accepts minimal payload', () => {
    const result = CreateConsultationSchema.parse(valid)
    expect(result.patientId).toBe(VALID_UUID)
    expect(result.diagnoses).toEqual([])
  })

  it('accepts full payload with SOAP and vitals', () => {
    const result = CreateConsultationSchema.parse({
      ...valid,
      chiefComplaint: 'Dolor de cabeza',
      subjective: 'Paciente reporta dolor',
      objective: 'Sin fiebre',
      assessment: 'Migraña',
      plan: 'Ibuprofeno 400mg',
      vitals: { heartRate: 72 },
      diagnoses: ['Migraña', 'Tensión cervical'],
    })
    expect(result.assessment).toBe('Migraña')
    expect(result.diagnoses).toHaveLength(2)
  })

  it('rejects missing patientId', () => {
    expect(() => CreateConsultationSchema.parse({ locationId: VALID_UUID })).toThrow()
  })

  it('rejects non-uuid patientId', () => {
    expect(() =>
      CreateConsultationSchema.parse({ patientId: 'bad', locationId: VALID_UUID }),
    ).toThrow()
  })

  it('rejects chiefComplaint exceeding 500 chars', () => {
    expect(() =>
      CreateConsultationSchema.parse({ ...valid, chiefComplaint: 'x'.repeat(501) }),
    ).toThrow()
  })

  it('rejects diagnosis string exceeding 200 chars', () => {
    expect(() =>
      CreateConsultationSchema.parse({ ...valid, diagnoses: ['x'.repeat(201)] }),
    ).toThrow()
  })
})

describe('UpdateConsultationSchema', () => {
  it('accepts empty update', () => {
    expect(UpdateConsultationSchema.parse({})).toEqual({})
  })

  it('accepts partial SOAP update', () => {
    const result = UpdateConsultationSchema.parse({ plan: 'Seguimiento en 2 semanas' })
    expect(result.plan).toBe('Seguimiento en 2 semanas')
  })
})

describe('AmendConsultationSchema', () => {
  it('accepts valid amendment', () => {
    const result = AmendConsultationSchema.parse({
      reason: 'Error en el diagnóstico inicial.',
      assessment: 'Diagnóstico corregido',
    })
    expect(result.reason).toContain('Error')
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

describe('UpdateCheckedStateSchema', () => {
  it('accepts valid checked state', () => {
    const result = UpdateCheckedStateSchema.parse({
      checkedState: { 'item-1': true, 'item-2': false },
    })
    expect(result.checkedState['item-1']).toBe(true)
  })

  it('accepts with completedAt datetime', () => {
    const result = UpdateCheckedStateSchema.parse({
      checkedState: {},
      completedAt: '2026-05-01T10:00:00.000Z',
    })
    expect(result.completedAt).toBe('2026-05-01T10:00:00.000Z')
  })

  it('accepts null completedAt', () => {
    const result = UpdateCheckedStateSchema.parse({ checkedState: {}, completedAt: null })
    expect(result.completedAt).toBeNull()
  })

  it('rejects non-boolean checked state value', () => {
    expect(() =>
      UpdateCheckedStateSchema.parse({ checkedState: { 'item-1': 'yes' } }),
    ).toThrow()
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
  const validOrder = {
    study_type: 'RX Tórax',
    indication: 'Dolor torácico',
    urgency: 'routine' as const,
  }

  it('accepts a valid imaging group', () => {
    const result = CreateImagingOrderGroupSchema.parse({ orders: [validOrder] })
    expect(result.orders).toHaveLength(1)
    expect(result.orders[0]?.contrast).toBe(false)
  })

  it('rejects empty orders array', () => {
    expect(() => CreateImagingOrderGroupSchema.parse({ orders: [] })).toThrow()
  })

  it('rejects invalid urgency value', () => {
    expect(() =>
      CreateImagingOrderGroupSchema.parse({ orders: [{ ...validOrder, urgency: 'normal' }] }),
    ).toThrow()
  })
})

describe('CreateLabOrderGroupSchema', () => {
  const validOrder = {
    test_name: 'Hemograma completo',
    indication: 'Anemia sospechada',
    sample_type: 'blood' as const,
  }

  it('accepts a valid lab group', () => {
    const result = CreateLabOrderGroupSchema.parse({ orders: [validOrder] })
    expect(result.orders[0]?.urgency).toBe('routine')
  })

  it('rejects empty orders', () => {
    expect(() => CreateLabOrderGroupSchema.parse({ orders: [] })).toThrow()
  })

  it('rejects invalid sample_type', () => {
    expect(() =>
      CreateLabOrderGroupSchema.parse({ orders: [{ ...validOrder, sample_type: 'saliva' }] }),
    ).toThrow()
  })
})
