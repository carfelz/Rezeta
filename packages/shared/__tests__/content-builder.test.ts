import { describe, it, expect } from 'vitest'
import { buildInitialContentFromTemplate } from '../src/protocol/content-builder'
import { ProtocolContentSchema } from '../src/schemas/protocol'

// ─── Template fixtures matching the actual seed data ─────────────────────────

const emergencyTemplate = {
  version: '1.0',
  metadata: { suggested_specialty: 'emergency_medicine' },
  blocks: [
    {
      id: 'sec_indications',
      type: 'section',
      title: 'Indications',
      required: true,
      placeholder_blocks: [{ type: 'text', placeholder: 'Clinical criteria...' }],
    },
    {
      id: 'sec_contraindications',
      type: 'section',
      title: 'Contraindications',
      required: false,
      placeholder_blocks: [{ type: 'alert', severity: 'danger', placeholder: 'Contraindications' }],
    },
    {
      id: 'sec_assessment',
      type: 'section',
      title: 'Initial Assessment',
      required: true,
      placeholder_blocks: [{ type: 'checklist', placeholder: 'Primary survey.' }],
    },
    {
      id: 'sec_intervention',
      type: 'section',
      title: 'Intervention',
      required: true,
      placeholder_blocks: [
        {
          id: 'blk_int_meds',
          type: 'dosage_table',
          required: true,
          placeholder: 'First-line meds.',
        },
        { type: 'steps', placeholder: 'Supportive care.' },
      ],
    },
  ],
}

const clinicalProcedureTemplate = {
  version: '1.0',
  metadata: { suggested_specialty: 'general' },
  blocks: [
    {
      id: 'sec_preparation',
      type: 'section',
      title: 'Preparation',
      required: false,
      placeholder_blocks: [{ type: 'checklist', placeholder: 'Materials.' }],
    },
    {
      id: 'sec_steps',
      type: 'section',
      title: 'Procedure Steps',
      required: true,
      placeholder_blocks: [{ type: 'steps', placeholder: 'Numbered steps.' }],
    },
    {
      id: 'sec_post',
      type: 'section',
      title: 'Post-procedure Instructions',
      required: true,
      placeholder_blocks: [{ type: 'checklist', placeholder: 'Patient instructions.' }],
    },
  ],
}

const pharmacologicalTemplate = {
  version: '1.0',
  metadata: { suggested_specialty: 'pharmacology' },
  blocks: [
    {
      id: 'sec_dosing',
      type: 'section',
      title: 'Dosing',
      required: true,
      placeholder_blocks: [
        { id: 'blk_dose_table', type: 'dosage_table', required: true, placeholder: 'Drugs.' },
      ],
    },
  ],
}

const diagnosticTemplate = {
  version: '1.0',
  metadata: { suggested_specialty: 'general' },
  blocks: [
    {
      id: 'sec_pathway',
      type: 'section',
      title: 'Decision Pathway',
      required: true,
      placeholder_blocks: [{ type: 'decision', placeholder: 'First branch.' }],
    },
  ],
}

const physiotherapyTemplate = {
  version: '1.0',
  metadata: { suggested_specialty: 'physiotherapy' },
  blocks: [
    {
      id: 'sec_assessment',
      type: 'section',
      title: 'Assessment',
      required: true,
      placeholder_blocks: [{ type: 'checklist', placeholder: 'Pain tests.' }],
    },
    {
      id: 'sec_plan',
      type: 'section',
      title: 'Treatment Plan',
      required: true,
      placeholder_blocks: [{ type: 'steps', placeholder: 'Exercises.' }],
    },
  ],
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildInitialContentFromTemplate', () => {
  it('always passes ProtocolContentSchema validation for emergency template', () => {
    const content = buildInitialContentFromTemplate(emergencyTemplate)
    expect(() => ProtocolContentSchema.parse(content)).not.toThrow()
  })

  it('always passes ProtocolContentSchema validation for all 5 templates', () => {
    for (const t of [
      emergencyTemplate,
      clinicalProcedureTemplate,
      pharmacologicalTemplate,
      diagnosticTemplate,
      physiotherapyTemplate,
    ]) {
      const content = buildInitialContentFromTemplate(t)
      expect(() => ProtocolContentSchema.parse(content)).not.toThrow()
    }
  })

  it('includes only required sections from emergency template', () => {
    const content = buildInitialContentFromTemplate(emergencyTemplate)
    const blocks = content.blocks as Array<{ id: string; type: string }>
    const ids = blocks.map((b) => b.id)
    expect(ids).toContain('sec_indications')
    expect(ids).toContain('sec_assessment')
    expect(ids).toContain('sec_intervention')
    expect(ids).not.toContain('sec_contraindications') // optional — not seeded
  })

  it('seeds required dosage_table inside sec_intervention', () => {
    const content = buildInitialContentFromTemplate(emergencyTemplate)
    const sections = content.blocks as Array<{ id: string; type: string; blocks: unknown[] }>
    const intervention = sections.find((b) => b.id === 'sec_intervention')
    const childBlocks = intervention.blocks as Array<{ id: string; type: string }>
    expect(childBlocks.some((b) => b.id === 'blk_int_meds' && b.type === 'dosage_table')).toBe(true)
  })

  it('does NOT seed optional placeholder_blocks inside required sections', () => {
    const content = buildInitialContentFromTemplate(emergencyTemplate)
    const sections = content.blocks as Array<{ id: string; blocks: unknown[] }>
    const indications = sections.find((b) => b.id === 'sec_indications')
    expect(indications.blocks).toHaveLength(0) // text placeholder is not required
  })

  it('sec_intervention has only the dosage_table (steps placeholder is optional)', () => {
    const content = buildInitialContentFromTemplate(emergencyTemplate)
    const sections = content.blocks as Array<{ id: string; blocks: unknown[] }>
    const intervention = sections.find((b) => b.id === 'sec_intervention')
    expect(intervention.blocks).toHaveLength(1)
  })

  it('sets template_version from the template schema version', () => {
    const content = buildInitialContentFromTemplate(emergencyTemplate)
    expect(content.template_version).toBe('1.0')
  })

  it('pharmacological template seeds required dosage_table with minimum row', () => {
    const content = buildInitialContentFromTemplate(pharmacologicalTemplate)
    const sections = content.blocks as Array<{ id: string; blocks: unknown[] }>
    const dosing = sections.find((b) => b.id === 'sec_dosing')
    const table = (dosing.blocks as Array<{ id: string; type: string; rows: unknown[] }>)[0]
    expect(table?.id).toBe('blk_dose_table')
    expect(table?.type).toBe('dosage_table')
    expect(table?.rows).toHaveLength(1)
  })

  it('diagnostic template seeds sec_pathway with no child blocks (decision placeholder is optional)', () => {
    const content = buildInitialContentFromTemplate(diagnosticTemplate)
    const sections = content.blocks as Array<{ id: string; blocks: unknown[] }>
    const pathway = sections.find((b) => b.id === 'sec_pathway')
    expect(pathway.blocks).toHaveLength(0)
  })

  it('clinical procedure skips optional sec_preparation', () => {
    const content = buildInitialContentFromTemplate(clinicalProcedureTemplate)
    const ids = (content.blocks as Array<{ id: string }>).map((b) => b.id)
    expect(ids).not.toContain('sec_preparation')
    expect(ids).toContain('sec_steps')
    expect(ids).toContain('sec_post')
  })

  it('blank template (no blocks) produces empty blocks array', () => {
    const content = buildInitialContentFromTemplate({ version: '1.0', blocks: [] })
    expect(content.blocks).toHaveLength(0)
    expect(() => ProtocolContentSchema.parse(content)).not.toThrow()
  })

  it('seeded dosage_table row has all required fields', () => {
    const content = buildInitialContentFromTemplate(pharmacologicalTemplate)
    const sections = content.blocks as Array<{ id: string; blocks: unknown[] }>
    const table = (sections[0].blocks as Array<{ rows: Array<Record<string, string>> }>)[0]
    const row = table.rows[0]
    expect(row).toMatchObject({ drug: '', dose: '', route: '', frequency: '', notes: '' })
    expect(typeof row.id).toBe('string')
    expect(row.id.length).toBeGreaterThan(0)
  })

  // ── Individual block type coverage ────────────────────────────────────────

  it('seeds required text block with empty content', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_txt', type: 'text', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { id: string; type: string; content: string }
    expect(block.id).toBe('blk_txt')
    expect(block.type).toBe('text')
    expect(block.content).toBe('')
  })

  it('seeds required checklist block with one empty item', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_chk', type: 'checklist', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { type: string; items: Array<{ text: string; critical: boolean }> }
    expect(block.type).toBe('checklist')
    expect(block.items).toHaveLength(1)
    expect(block.items[0].critical).toBe(false)
  })

  it('seeds required steps block with one empty step', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_stp', type: 'steps', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { type: string; steps: Array<{ order: number; title: string }> }
    expect(block.type).toBe('steps')
    expect(block.steps).toHaveLength(1)
    expect(block.steps[0].order).toBe(1)
  })

  it('seeds required decision block with two branches', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_dec', type: 'decision', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { type: string; condition: string; branches: unknown[] }
    expect(block.type).toBe('decision')
    expect(block.condition).toBe('')
    expect(block.branches).toHaveLength(2)
  })

  it('seeds required alert block with default info severity when not specified', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_alr', type: 'alert', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { type: string; severity: string; content: string }
    expect(block.type).toBe('alert')
    expect(block.severity).toBe('info')
    expect(block.content).toBe('')
  })

  it('seeds required alert block preserving specified severity', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_alr', type: 'alert', severity: 'danger', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { severity: string }
    expect(block.severity).toBe('danger')
  })

  it('seeds unknown block type with only id and type fields (default case)', () => {
    const template = {
      version: '1.0',
      blocks: [{ id: 'blk_unk', type: 'imaging_order', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { id: string; type: string }
    expect(block.id).toBe('blk_unk')
    expect(block.type).toBe('imaging_order')
  })

  it('generates id when block has no id property', () => {
    const template = {
      version: '1.0',
      blocks: [{ type: 'text', required: true }],
    }
    const content = buildInitialContentFromTemplate(template)
    const block = content.blocks[0] as { id: string }
    expect(typeof block.id).toBe('string')
    expect(block.id.startsWith('blk_')).toBe(true)
  })

  it('generates id for section when block has no id property', () => {
    const template = {
      version: '1.0',
      blocks: [{ type: 'section', title: 'No ID', required: true, placeholder_blocks: [] }],
    }
    const content = buildInitialContentFromTemplate(template)
    const section = content.blocks[0] as { id: string; type: string }
    expect(section.type).toBe('section')
    expect(section.id.startsWith('sec_')).toBe(true)
  })

  it('section uses blocks array when placeholder_blocks is absent', () => {
    const template = {
      version: '1.0',
      blocks: [
        {
          id: 'sec_x',
          type: 'section',
          title: 'Section X',
          required: true,
          blocks: [{ id: 'blk_t', type: 'text', required: true }],
        },
      ],
    }
    const content = buildInitialContentFromTemplate(template)
    const section = content.blocks[0] as { blocks: Array<{ id: string }> }
    expect(section.blocks[0].id).toBe('blk_t')
  })

  it('section includes description when provided', () => {
    const template = {
      version: '1.0',
      blocks: [
        {
          id: 'sec_d',
          type: 'section',
          title: 'Desc Section',
          description: 'My description',
          required: true,
          placeholder_blocks: [],
        },
      ],
    }
    const content = buildInitialContentFromTemplate(template)
    const section = content.blocks[0] as { description: string }
    expect(section.description).toBe('My description')
  })

  it('section includes collapsed_by_default when true', () => {
    const template = {
      version: '1.0',
      blocks: [
        {
          id: 'sec_c',
          type: 'section',
          title: 'Collapsed',
          collapsed_by_default: true,
          required: true,
          placeholder_blocks: [],
        },
      ],
    }
    const content = buildInitialContentFromTemplate(template)
    const section = content.blocks[0] as { collapsed_by_default: boolean }
    expect(section.collapsed_by_default).toBe(true)
  })
})
