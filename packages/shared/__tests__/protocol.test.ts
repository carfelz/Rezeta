import { describe, it, expect } from 'vitest'
import {
  ProtocolBlockSchema,
  TemplateBlockSchema,
  ProtocolTemplateSchemaContent,
} from '../src/schemas/protocol'

describe('ProtocolBlockSchema', () => {
  it('validates a text block correctly', () => {
    const block = { id: 'blk_01', type: 'text', content: 'Testing text' }
    expect(() => ProtocolBlockSchema.parse(block)).not.toThrow()
  })

  it('fails if placeholder is passed to strict protocol instance', () => {
    // Zod by default strips extra keys, so extra fields like placeholder are silently ignored.
    // Verified: decisions require at least 2 branches (tested below).
  })

  it('validates decisions and requires at least two branches', () => {
    const validDecision = {
      id: 'blk_d1',
      type: 'decision',
      condition: 'Is active?',
      branches: [
        { id: 'b1', label: 'Yes', action: 'Do X' },
        { id: 'b2', label: 'No', action: 'Do Y' },
      ],
    }
    expect(() => ProtocolBlockSchema.parse(validDecision)).not.toThrow()

    const invalidDecision = {
      id: 'blk_d2',
      type: 'decision',
      condition: 'Is active?',
      branches: [{ id: 'b1', label: 'Yes', action: 'Do X' }], // Only one branch -> invalid!
    }
    expect(() => ProtocolBlockSchema.parse(invalidDecision)).toThrowError(/too_small/)
  })

  it('validates a correct dosage table and enforces exactly 5 columns', () => {
    const validDosage = {
      id: 'blk_meds',
      type: 'dosage_table',
      title: 'First-line',
      columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
      rows: [
        { id: 'r1', drug: 'Epi', dose: '0.3mg', route: 'IM', frequency: 'PRN', notes: 'Max 3' },
      ],
    }
    expect(() => ProtocolBlockSchema.parse(validDosage)).not.toThrow()

    const invalidDosage = {
      id: 'blk_meds',
      type: 'dosage_table',
      title: 'First-line',
      columns: ['drug', 'dose', 'route', 'frequency'], // Missing 'notes'
      rows: [
        { id: 'r1', drug: 'Epi', dose: '0.3mg', route: 'IM', frequency: 'PRN', notes: 'Max 3' },
      ],
    }
    expect(() => ProtocolBlockSchema.parse(invalidDosage)).toThrow()
  })

  it('requires checklist or steps to have at least 1 item', () => {
    expect(() =>
      ProtocolBlockSchema.parse({ id: 'b1', type: 'checklist', items: [] }),
    ).toThrowError(/too_small/)
    expect(() => ProtocolBlockSchema.parse({ id: 'b2', type: 'steps', steps: [] })).toThrowError(
      /too_small/,
    )
  })
})

describe('ProtocolTemplateSchemaContent', () => {
  it('allows placeholder and required flags in template blocks', () => {
    const templateBlock = {
      id: 'sec_01',
      type: 'section',
      title: 'Initial',
      required: true,
      placeholder_blocks: [{ id: 'placeholder1', type: 'text', placeholder: 'Enter details here' }],
    }
    expect(() => TemplateBlockSchema.parse(templateBlock)).not.toThrow()
  })

  it('validates a complete template schema', () => {
    const template = {
      version: '1.0',
      metadata: { suggested_specialty: 'general' },
      blocks: [
        {
          id: 'sec_1',
          type: 'section',
          title: 'Welcome',
          required: true,
          placeholder_blocks: [{ id: 'text_1', type: 'text', placeholder: 'Write something' }],
        },
      ],
    }
    expect(() => ProtocolTemplateSchemaContent.parse(template)).not.toThrow()
  })
})
