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

  it('routes clinical_notes labels mentioning resultado/estudio to resultados_estudios', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'r1',
        type: 'clinical_notes',
        label: 'Resultado de laboratorio',
        content: 'Hemoglobina 13.2 g/dL.',
      } as ProtocolBlock,
      {
        id: 'r2',
        type: 'clinical_notes',
        label: 'Estudio de imagen',
        content: 'Rx tórax sin hallazgos.',
      } as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    const results = section(out, 'resultados_estudios')?.content ?? ''
    expect(results).toContain('Hemoglobina 13.2 g/dL.')
    expect(results).toContain('Rx tórax sin hallazgos.')
  })

  it('renders ficha_identificacion without optional lines when patient fields are null/empty', () => {
    const minimalPatient = {
      firstName: 'Juan',
      lastName: 'Solo',
      dateOfBirth: null,
      sex: null,
      documentType: null,
      documentNumber: null,
      phone: null,
      address: null,
      allergies: [],
      chronicConditions: [],
    }
    const out = generateRecordSections(makeInput({ patient: minimalPatient }))
    const ficha = section(out, 'ficha_identificacion')?.content ?? ''
    expect(ficha).toBe('Juan Solo')
    expect(ficha).not.toContain('años')
    expect(ficha).not.toContain('Teléfono')
    expect(ficha).not.toContain('Dirección')
    expect(ficha).not.toContain('Alergias')
    expect(ficha).not.toContain('Condiciones crónicas')
    expect(ficha).not.toMatch(/^(cedula|passport|rnc|doc):/i)
  })

  it('renders a patient sex value outside the known label map as-is', () => {
    const patientWithUnknownSex = { ...patient, sex: 'unknown' }
    const out = generateRecordSections(makeInput({ patient: patientWithUnknownSex }))
    const ficha = section(out, 'ficha_identificacion')?.content ?? ''
    expect(ficha).toContain('unknown')
  })

  it('renders a vitals field without a unit as just "label value"', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'v2',
        type: 'vitals',
        fields: [{ id: 'wt', label: 'Peso', input_type: 'number' }],
        values: { wt: 70 },
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'examen_fisico')?.content).toContain('Peso 70')
    expect(section(out, 'examen_fisico')?.content).not.toMatch(/Peso 70 \S+$/m)
  })

  it('produces no output for a checklist with zero checked items', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'ck2',
        type: 'checklist',
        title: 'Sin marcar',
        items: [{ id: 'i1', text: 'Nada marcado', checked: false }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Sin marcar')
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Nada marcado')
  })

  it('produces no output for a steps block with no completed or skipped steps', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'st2',
        type: 'steps',
        title: 'Pendiente',
        steps: [{ id: 's1', order: 1, title: 'Paso sin tocar' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Pendiente')
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Paso sin tocar')
  })

  it('produces no output for a decision block with no recorded branch', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'd2',
        type: 'decision',
        condition: '¿Fiebre > 38.5?',
        branches: [{ id: 'br1', label: 'Sí', action: 'Antipirético' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Fiebre')
  })

  it('resolves a decision branch label from block.branches when only branch_id is recorded', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'd3',
        type: 'decision',
        condition: '¿Requiere referencia?',
        branches: [
          { id: 'br1', label: 'Referir a especialista', action: 'Referir' },
          { id: 'br2', label: 'Manejo ambulatorio', action: 'Continuar' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: { decision_branches: [{ block_id: 'd3', branch_id: 'br1' }] },
          },
        ],
      }),
    )
    expect(section(out, 'evolucion')?.content ?? '').toContain(
      '¿Requiere referencia? → Referir a especialista',
    )
  })

  it('produces no output when a decision has neither branch_label nor a matching branch_id', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'd4',
        type: 'decision',
        condition: '¿Alergia confirmada?',
        branches: [{ id: 'br1', label: 'Sí', action: 'Suspender' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: { decision_branches: [{ block_id: 'd4', branch_id: 'no-such-branch' }] },
          },
        ],
      }),
    )
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Alergia confirmada')
  })

  it('emits an empty required plan_tratamiento section when usages have no blocks and orders are empty', () => {
    const out = generateRecordSections(
      makeInput({ usages: [{ blocks: [], modifications: {} }], orders: emptyOrders }),
    )
    const plan = section(out, 'plan_tratamiento')
    expect(plan).toBeDefined()
    expect(plan?.content).toBe('')
    expect(plan?.required).toBe(true)
  })

  it('routes a clinical_notes label matching only "antecedente" to antecedentes', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'a1', type: 'clinical_notes', label: 'Antecedentes familiares', content: 'Madre diabética.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ kind: 'first_visit', usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'antecedentes')?.content).toContain('Madre diabética.')
  })

  it('routes a clinical_notes label matching only "tratamiento" (no "plan") to plan_tratamiento', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'p1', type: 'clinical_notes', label: 'Tratamiento indicado', content: 'Reposo relativo.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'plan_tratamiento')?.content).toContain('Reposo relativo.')
  })

  it('routes a clinical_notes label matching "evolución" to evolucion', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'e1', type: 'clinical_notes', label: 'Evolución del cuadro', content: 'Mejoría notable.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content).toContain('Mejoría notable.')
  })

  it('defaults the document type label to "DOC" when documentNumber is set but documentType is null', () => {
    const patientNoDocType = { ...patient, documentType: null }
    const out = generateRecordSections(makeInput({ patient: patientNoDocType }))
    expect(section(out, 'ficha_identificacion')?.content).toContain('DOC: 001-1234567-8')
  })

  it('treats a section block missing its own blocks array as having no children', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'sec2', type: 'section', title: 'Vacía' } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(out.every((s) => !s.content.includes('Vacía'))).toBe(true)
  })

  it('treats a clinical_notes block missing content/label as empty and emits nothing', () => {
    const blocks: ProtocolBlock[] = [{ id: 'cn1', type: 'clinical_notes' } as unknown as ProtocolBlock]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    // No section should contain undefined/garbage text from the missing fields.
    const all = out.map((s) => s.content).join('\n')
    expect(all).not.toContain('undefined')
  })

  it('treats a vitals block missing values/fields as having nothing to render', () => {
    const blocks: ProtocolBlock[] = [{ id: 'v3', type: 'vitals' } as unknown as ProtocolBlock]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    const all = out.map((s) => s.content).join('\n')
    expect(all).not.toContain('undefined')
  })

  it('treats a checklist block missing items as having nothing to render', () => {
    const blocks: ProtocolBlock[] = [{ id: 'ck3', type: 'checklist', title: 'Sin items' } as unknown as ProtocolBlock]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Sin items')
  })

  it('defaults a checklist title to "Verificación" when title is missing', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'ck4',
        type: 'checklist',
        items: [{ id: 'i1', text: 'Ítem confirmado', checked: true }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content).toContain('Verificación: Ítem confirmado')
  })

  it('treats a steps block missing steps as having nothing to render', () => {
    const blocks: ProtocolBlock[] = [{ id: 'st3', type: 'steps', title: 'Sin pasos' } as unknown as ProtocolBlock]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Sin pasos')
  })

  it('renders a skipped step without a reason as just "(omitido)"', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'st4',
        type: 'steps',
        title: 'Manejo',
        steps: [{ id: 's1', order: 1, title: 'Paso omitido sin razón' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: { steps_skipped: [{ step_id: 's1' }] } }],
      }),
    )
    expect(section(out, 'evolucion')?.content).toContain('Paso omitido sin razón (omitido)')
    expect(section(out, 'evolucion')?.content).not.toContain('(omitido:')
  })

  it('defaults a steps block title to "Pasos" when title is missing', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'st5',
        type: 'steps',
        steps: [{ id: 's1', order: 1, title: 'Paso completado' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({ usages: [{ blocks, modifications: { steps_completed: [{ step_id: 's1' }] } }] }),
    )
    expect(section(out, 'evolucion')?.content).toContain('Pasos: Paso completado')
  })

  it('treats a decision block missing branches as unresolvable when only branch_id is given', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'd5', type: 'decision', condition: '¿Sin ramas?' } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          { blocks, modifications: { decision_branches: [{ block_id: 'd5', branch_id: 'br1' }] } },
        ],
      }),
    )
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Sin ramas')
  })

  it('produces no output when the resolved decision label is an empty string', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'd6',
        type: 'decision',
        condition: '¿Etiqueta vacía?',
        branches: [{ id: 'br1', label: '', action: 'Nada' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: { decision_branches: [{ block_id: 'd6', branch_id: 'br1', branch_label: '' }] },
          },
        ],
      }),
    )
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Etiqueta vacía')
  })
})

describe('historia_mapping overrides', () => {
  it('redirects a clinical_notes block to the mapped section', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Notas', content: 'Hallazgo dirigido.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { b1: { section: 'examen_fisico' } } }],
      }),
    )
    expect(section(out, 'examen_fisico')?.content).toContain('Hallazgo dirigido.')
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Hallazgo dirigido.')
  })

  it('excludes a block with include=false', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Motivo', content: 'Nunca sale.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({ usages: [{ blocks, modifications: {}, historiaMapping: { b1: { include: false } } }] }),
    )
    expect(out.map((s) => s.content).join('\n')).not.toContain('Nunca sale.')
  })

  it('prefixes a custom label on non-notes blocks', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'ck1',
        type: 'checklist',
        title: 'Adherencia',
        items: [{ id: 'i1', text: 'Dieta', checked: true }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { ck1: { label: 'Hábitos del paciente' } } }],
      }),
    )
    expect(section(out, 'evolucion')?.content).toContain('Hábitos del paciente: Dieta')
  })

  it('ignores mapping entries on legally locked block types', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'dt1',
        type: 'dosage_table',
        rows: [{ id: 'r1', drug: 'X', dose: '1', route: 'VO', frequency: 'od', notes: '' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { dt1: { section: 'evolucion' } } }],
      }),
    )
    expect(section(out, 'evolucion')?.content ?? '').toBe('')
  })

  it('replaces the label used for clinical_notes matching instead of the input label', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'b2',
        type: 'clinical_notes',
        label: 'Notas libres',
        content: 'Texto sobre diagnóstico.',
      } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { b2: { label: 'Diagnóstico' } } }],
      }),
    )
    expect(section(out, 'diagnosticos')?.content).toContain('Texto sobre diagnóstico.')
  })

  it('redirects a vitals block and prefixes its label when both section and label are mapped', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'v1',
        type: 'vitals',
        fields: [{ id: 'bp', label: 'PA', unit: 'mmHg', input_type: 'text' }],
        values: { bp: '120/80' },
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: {},
            historiaMapping: { v1: { section: 'evolucion', label: 'Signos de control' } },
          },
        ],
      }),
    )
    expect(section(out, 'evolucion')?.content).toContain('Signos de control: PA 120/80 mmHg')
    expect(section(out, 'examen_fisico')?.content ?? '').not.toContain('PA 120/80')
  })

  it('redirects a steps block to a mapped section with a custom title', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'st1',
        type: 'steps',
        title: 'Manejo',
        steps: [{ id: 's1', order: 1, title: 'Paso hecho' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: { steps_completed: [{ step_id: 's1' }] },
            historiaMapping: { st1: { section: 'plan_tratamiento', label: 'Seguimiento' } },
          },
        ],
      }),
    )
    expect(section(out, 'plan_tratamiento')?.content).toContain('Seguimiento: Paso hecho')
    expect(section(out, 'evolucion')?.content ?? '').not.toContain('Paso hecho')
  })

  it('redirects a decision block and prefixes the decision line with a custom label', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'd1',
        type: 'decision',
        condition: '¿Requiere ajuste?',
        branches: [
          { id: 'br1', label: 'Sí', action: 'Ajustar' },
          { id: 'br2', label: 'No', action: 'Mantener' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: { decision_branches: [{ block_id: 'd1', branch_id: 'br1' }] },
            historiaMapping: { d1: { section: 'diagnosticos', label: 'Ajuste terapéutico' } },
          },
        ],
      }),
    )
    expect(section(out, 'diagnosticos')?.content).toContain('Ajuste terapéutico: ¿Requiere ajuste? → Sí')
  })

  it('applies mapping entries to blocks nested inside a section block', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'sec1',
        type: 'section',
        title: 'Evaluación',
        blocks: [
          { id: 'n1', type: 'clinical_notes', label: 'Motivo', content: 'Nota anidada dirigida.' },
        ],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: {},
            historiaMapping: { n1: { section: 'diagnosticos' } },
          },
        ],
      }),
    )
    expect(section(out, 'diagnosticos')?.content).toContain('Nota anidada dirigida.')
    expect(section(out, 'motivo_consulta')?.content ?? '').not.toContain('Nota anidada dirigida.')
  })

  it('routes a clinical_notes block with content but no label and no mapping to the narrative default', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b3', type: 'clinical_notes', content: 'Sin etiqueta.' } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(makeInput({ usages: [{ blocks, modifications: {} }] }))
    expect(section(out, 'evolucion')?.content).toContain('Sin etiqueta.')
  })

  it('resolves a mapped decision label even when the block has no condition text', () => {
    const blocks: ProtocolBlock[] = [
      {
        id: 'd7',
        type: 'decision',
        branches: [{ id: 'br1', label: 'Sí', action: 'Continuar' }],
      } as unknown as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [
          {
            blocks,
            modifications: { decision_branches: [{ block_id: 'd7', branch_id: 'br1' }] },
          },
        ],
      }),
    )
    expect(section(out, 'evolucion')?.content).toContain('Decisión:  → Sí')
  })

  it('falls back to default behavior for blocks with no mapping entry when a mapping is present', () => {
    const blocks: ProtocolBlock[] = [
      { id: 'b1', type: 'clinical_notes', label: 'Motivo', content: 'Sin mapear.' } as ProtocolBlock,
    ]
    const out = generateRecordSections(
      makeInput({
        usages: [{ blocks, modifications: {}, historiaMapping: { other_block: { include: false } } }],
      }),
    )
    expect(section(out, 'motivo_consulta')?.content).toContain('Sin mapear.')
  })
})
