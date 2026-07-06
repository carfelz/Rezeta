import { describe, it, expect } from 'vitest'
import { generateRecordSections } from '../record/generate-record-sections.js'
import type { GenerateRecordSectionsInput } from '../record/generate-record-sections.js'
import type { ProtocolBlock } from '../types/protocol.js'

const patient = {
  firstName: 'María',
  lastName: 'Peña',
  dateOfBirth: '1972-03-15',
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: '809-555-0101',
  address: 'C/ El Sol 12, Santiago',
  allergies: ['penicilina'],
  chronicConditions: ['hipertensión'],
}

const emptyOrders = { prescriptionItems: [], labTests: [], imagingStudies: [] }

function makeInput(overrides: Partial<GenerateRecordSectionsInput> = {}): GenerateRecordSectionsInput {
  return {
    kind: 'evolution',
    patient,
    usages: [],
    orders: emptyOrders,
    amendments: [],
    ...overrides,
  }
}

function section(sections: ReturnType<typeof generateRecordSections>, key: string) {
  return sections.find((s) => s.key === key)
}

describe('generateRecordSections', () => {
  it('always emits ficha_identificacion with patient data', () => {
    const out = generateRecordSections(makeInput())
    const ficha = section(out, 'ficha_identificacion')
    expect(ficha?.content).toContain('María Peña')
    expect(ficha?.content).toContain('001-1234567-8')
    expect(ficha?.content).toContain('Alergias: penicilina')
    expect(ficha?.source).toBe('generated')
  })

  it('emits required-but-empty sections for evolution kind', () => {
    const out = generateRecordSections(makeInput())
    for (const key of ['motivo_consulta', 'examen_fisico', 'evolucion', 'diagnosticos', 'plan_tratamiento']) {
      const s = section(out, key)
      expect(s?.required).toBe(true)
    }
    expect(section(out, 'enfermedad_actual')).toBeUndefined()
    expect(section(out, 'antecedentes')?.required ?? false).toBe(false)
  })

  it('requires antecedentes on first_visit and routes unmatched notes to enfermedad_actual', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Notas generales', content: 'Dolor torácico atípico.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({ kind: 'first_visit', usages: [{ blocks, modifications: {} }] }),
    )
    expect(section(out, 'antecedentes')?.required).toBe(true)
    expect(section(out, 'enfermedad_actual')?.content).toContain('Dolor torácico atípico.')
    expect(section(out, 'evolucion')).toBeUndefined()
  })

  it('maps clinical_notes by normalized label (accents/case ignored)', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'MOTIVO DE CONSULTA', content: 'Cefalea.' } as ProtocolBlock,
      { id: 'b2', type: 'clinical_notes', label: 'Diagnóstico presuntivo', content: 'HTA esencial.' } as ProtocolBlock,
      { id: 'b3', type: 'clinical_notes', label: 'Exploración dirigida', content: 'RsCsRs sin soplos.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'motivo_consulta')?.content).toBe('Cefalea.')
    expect(section(out, 'diagnosticos')?.content).toBe('HTA esencial.')
    expect(section(out, 'examen_fisico')?.content).toContain('RsCsRs sin soplos.')
  })

  it('formats vitals values into examen_fisico and skips empty vitals', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'v1',
        type: 'vitals',
        fields: [
          { id: 'bp', label: 'PA', unit: 'mmHg', input_type: 'text' },
          { id: 'hr', label: 'FC', unit: 'lpm', input_type: 'number' },
          { id: 'temp', label: 'Temp', unit: '°C', input_type: 'number' },
        ],
        values: { bp: '148/92', hr: 76 },
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'examen_fisico')?.content).toContain('PA 148/92 mmHg · FC 76 lpm')
    expect(section(out, 'examen_fisico')?.content).not.toContain('Temp')
  })

  it('summarizes checklist checked items, steps, and decisions into evolucion', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'ck1',
        type: 'checklist',
        title: 'Adherencia',
        items: [
          { id: 'i1', text: 'Toma dosis nocturna', checked: false },
          { id: 'i2', text: 'Dieta hiposódica', checked: true },
        ],
      } as unknown as ProtocolBlock,
      {
        id: 'st1',
        type: 'steps',
        title: 'Manejo',
        steps: [
          { id: 's1', order: 1, title: 'Medir PA en ambos brazos' },
          { id: 's2', order: 2, title: 'Fondo de ojo' },
        ],
      } as unknown as ProtocolBlock,
      {
        id: 'd1',
        type: 'decision',
        condition: '¿PA ≥ 160/100?',
        branches: [
          { id: 'br1', label: 'Sí', action: 'Referir' },
          { id: 'br2', label: 'No', action: 'Continuar' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: {
              steps_completed: [{ step_id: 's1' }],
              steps_skipped: [{ step_id: 's2', reason: 'sin oftalmoscopio' }],
              decision_branches: [{ block_id: 'd1', branch_id: 'br2', branch_label: 'No' }],
            },
          },
        ],
      }),
    )
    const evo = section(out, 'evolucion')?.content ?? ''
    expect(evo).toContain('Adherencia: Dieta hiposódica')
    expect(evo).not.toContain('Toma dosis nocturna')
    expect(evo).toContain('Medir PA en ambos brazos')
    expect(evo).toContain('omitido')
    expect(evo).toContain('¿PA ≥ 160/100? → No')
  })

  it('composes plan_tratamiento from order records, never from blocks', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'dt1',
        type: 'dosage_table',
        rows: [{ id: 'r1', drug: 'NuncaRecetado', dose: '1', route: 'VO', frequency: 'od', notes: '' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {} }],
        orders: {
          prescriptionItems: [{ drug: 'Losartán', dose: '100 mg', route: 'VO', frequency: 'cada 24 h', duration: '30 días' }],
          labTests: ['Perfil lipídico', 'Creatinina'],
          imagingStudies: ['Rx de tórax'],
        },
      }),
    )
    const plan = section(out, 'plan_tratamiento')?.content ?? ''
    expect(plan).toContain('Losartán 100 mg VO cada 24 h — 30 días')
    expect(plan).toContain('Laboratorio: Perfil lipídico, Creatinina')
    expect(plan).toContain('Imágenes: Rx de tórax')
    expect(plan).not.toContain('NuncaRecetado')
  })

  it('recurses into section blocks and ignores alert/text blocks', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'sec1',
        type: 'section',
        title: 'Evaluación',
        blocks: [
          { id: 'n1', type: 'clinical_notes', label: 'Motivo', content: 'Anidado.' },
          { id: 'a1', type: 'alert', severity: 'danger', content: 'Nunca sale.' },
          { id: 't1', type: 'text', content: 'Tampoco.' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'motivo_consulta')?.content).toBe('Anidado.')
    const all = out.map((s) => s.content).join('\n')
    expect(all).not.toContain('Nunca sale.')
    expect(all).not.toContain('Tampoco.')
  })

  it('adds enmiendas section only when amendments exist', () => {
    const without = generateRecordSections(makeInput())
    expect(section(without, 'enmiendas')).toBeUndefined()
    const withAmendment = generateRecordSections(
      makeInput({ amendments: [{ reason: 'Dosis corregida', amendedAt: '2026-07-01T10:00:00Z' }] }),
    )
    expect(section(withAmendment, 'enmiendas')?.content).toContain('Dosis corregida')
    expect(section(withAmendment, 'enmiendas')?.required).toBe(false)
  })

  it('orders sections by the legal skeleton order', () => {
    const out = generateRecordSections(makeInput())
    const keys = out.map((s) => s.key)
    expect(keys.indexOf('motivo_consulta')).toBeLessThan(keys.indexOf('examen_fisico'))
    expect(keys.indexOf('diagnosticos')).toBeLessThan(keys.indexOf('plan_tratamiento'))
    expect(keys[0]).toBe('ficha_identificacion')
  })
})
