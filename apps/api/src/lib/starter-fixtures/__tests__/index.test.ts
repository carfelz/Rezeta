import { describe, it, expect } from 'vitest'
import { generateRecordSections } from '@rezeta/shared'
import type { ProtocolBlock, RecordSection } from '@rezeta/shared'
import { getStarterFixtures } from '../index.js'
import { buildProtocolContentFromTemplate } from '../../../modules/protocols/template-to-content.js'

describe('starter fixtures (2 templates)', () => {
  for (const locale of ['es', 'en'] as const) {
    it(`${locale}: has exactly 2 fixtures each naming a category`, () => {
      const fixtures = getStarterFixtures(locale)
      expect(fixtures).toHaveLength(2)
      for (const f of fixtures) {
        expect(typeof f.categoryName).toBe('string')
        expect(f.categoryName.length).toBeGreaterThan(0)
      }
    })
  }

  it('es maps emergency->Emergencias, diagnostic->Diagnóstico', () => {
    const byKey = Object.fromEntries(getStarterFixtures('es').map((f) => [f.key, f.categoryName]))
    expect(byKey.emergency).toBe('Emergencias')
    expect(byKey.diagnostic).toBe('Diagnóstico')
  })

  it('en maps emergency->Emergencies, diagnostic->Diagnosis', () => {
    const byKey = Object.fromEntries(getStarterFixtures('en').map((f) => [f.key, f.categoryName]))
    expect(byKey.emergency).toBe('Emergencies')
    expect(byKey.diagnostic).toBe('Diagnosis')
  })

  it('es fixtures have non-empty names and schemas', () => {
    const fixtures = getStarterFixtures('es')
    for (const f of fixtures) {
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.key.length).toBeGreaterThan(0)
      expect(f.schema).toBeDefined()
    }
  })

  it('en fixtures have non-empty names and schemas', () => {
    const fixtures = getStarterFixtures('en')
    for (const f of fixtures) {
      expect(f.name.length).toBeGreaterThan(0)
      expect(f.key.length).toBeGreaterThan(0)
      expect(f.schema).toBeDefined()
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Historia médica enrichment: every starter fixture must carry at least one
// `clinical_notes` block (routable by the historia generator's keyword matcher)
// and at least one `vitals` block, so out-of-the-box protocols populate the
// generated historia rather than leaving it empty.
// ─────────────────────────────────────────────────────────────────────────────

interface RawTemplateBlock {
  id?: string
  type: string
  label?: string
  fields?: Array<{ id: string; label: string; unit?: string; input_type: string }>
  placeholder_blocks?: RawTemplateBlock[]
}

function collectBlocks(blocks: RawTemplateBlock[]): RawTemplateBlock[] {
  const out: RawTemplateBlock[] = []
  for (const b of blocks) {
    out.push(b)
    if (b.type === 'section' && Array.isArray(b.placeholder_blocks)) {
      out.push(...collectBlocks(b.placeholder_blocks))
    }
  }
  return out
}

describe('starter fixtures carry historia-mapped clinical_notes and vitals blocks', () => {
  for (const locale of ['es', 'en'] as const) {
    for (const key of ['emergency', 'diagnostic'] as const) {
      it(`${locale}/${key}: has >=1 clinical_notes block with a non-empty label and >=1 vitals block with >=4 fields`, () => {
        const fixture = getStarterFixtures(locale).find((f) => f.key === key)
        expect(fixture).toBeDefined()
        const schema = fixture!.schema as { blocks: RawTemplateBlock[] }
        const allBlocks = collectBlocks(schema.blocks)

        const notesBlocks = allBlocks.filter((b) => b.type === 'clinical_notes')
        expect(notesBlocks.length).toBeGreaterThanOrEqual(1)
        for (const nb of notesBlocks) {
          expect(nb.label && nb.label.length).toBeGreaterThan(0)
        }

        const vitalsBlocks = allBlocks.filter((b) => b.type === 'vitals')
        expect(vitalsBlocks.length).toBeGreaterThanOrEqual(1)
        expect(vitalsBlocks[0]!.fields?.length ?? 0).toBeGreaterThanOrEqual(4)
      })
    }
  }
})

// Minimal fixed inputs for exercising generateRecordSections end-to-end.
const patient = {
  firstName: 'Ana',
  lastName: 'Reyes',
  dateOfBirth: '1982-03-14',
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: '809-555-1001',
  address: null,
  allergies: [] as string[],
  chronicConditions: [] as string[],
}
const emptyOrders = { prescriptionItems: [], labTests: [], imagingStudies: [] }

function section(sections: RecordSection[], key: RecordSection['key']): RecordSection | undefined {
  return sections.find((s) => s.key === key)
}

/** Recursively fills every clinical_notes/vitals block with dummy content/values so
 * routing can be observed through the real generateRecordSections/matchNotesSection
 * pipeline (matchNotesSection itself is private, so we exercise it indirectly). */
function fillContent(blocks: Array<Record<string, unknown>>): void {
  for (const b of blocks) {
    if (b.type === 'clinical_notes') {
      b.content = 'contenido de prueba'
    } else if (b.type === 'vitals') {
      const fields = (b.fields ?? []) as Array<{ id: string }>
      const values: Record<string, string> = {}
      for (const f of fields) values[f.id] = 'x'
      b.values = values
    } else if (b.type === 'section' && Array.isArray(b.blocks)) {
      fillContent(b.blocks as Array<Record<string, unknown>>)
    }
  }
}

describe('starter fixtures route clinical_notes/vitals into the correct historia sections', () => {
  for (const locale of ['es', 'en'] as const) {
    it(`${locale}/diagnostic: routes motivo -> motivo_consulta, diagnóstico -> diagnosticos, plan -> plan_tratamiento, vitals -> examen_fisico`, () => {
      const fixture = getStarterFixtures(locale).find((f) => f.key === 'diagnostic')!
      const content = buildProtocolContentFromTemplate(fixture.schema)
      fillContent(content.blocks as Array<Record<string, unknown>>)

      const sections = generateRecordSections({
        kind: 'first_visit',
        patient,
        usages: [{ blocks: content.blocks as ProtocolBlock[], modifications: {} }],
        orders: emptyOrders,
        amendments: [],
      })

      expect(section(sections, 'motivo_consulta')?.content).toContain('contenido de prueba')
      expect(section(sections, 'diagnosticos')?.content).toContain('contenido de prueba')
      expect(section(sections, 'plan_tratamiento')?.content).toContain('contenido de prueba')
      expect(section(sections, 'examen_fisico')?.content.length ?? 0).toBeGreaterThan(0)
    })

    it(`${locale}/emergency: routes vitals -> examen_fisico, diagnóstico -> diagnosticos, evolución -> evolucion`, () => {
      const fixture = getStarterFixtures(locale).find((f) => f.key === 'emergency')!
      const content = buildProtocolContentFromTemplate(fixture.schema)
      fillContent(content.blocks as Array<Record<string, unknown>>)

      const sections = generateRecordSections({
        kind: 'evolution',
        patient,
        usages: [{ blocks: content.blocks as ProtocolBlock[], modifications: {} }],
        orders: emptyOrders,
        amendments: [],
      })

      expect(section(sections, 'examen_fisico')?.content.length ?? 0).toBeGreaterThan(0)
      expect(section(sections, 'diagnosticos')?.content).toContain('contenido de prueba')
      expect(section(sections, 'evolucion')?.content).toContain('contenido de prueba')
    })
  }
})
