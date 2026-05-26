import { describe, it, expect } from 'vitest'
import { TemplateBlockSchema, ProtocolBlockSchema, CreateProtocolCategorySchema } from '../schemas/protocol.js'

describe('vitals block in TemplateBlockSchema', () => {
  it('accepts a valid vitals block', () => {
    const result = TemplateBlockSchema.safeParse({
      id: 'blk_001',
      type: 'vitals',
      fields: [
        { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
        { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('clinical_notes block in TemplateBlockSchema', () => {
  it('accepts a valid clinical_notes block', () => {
    const result = TemplateBlockSchema.safeParse({
      id: 'blk_002',
      type: 'clinical_notes',
      label: 'Motivo de consulta',
      required: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('vitals block in ProtocolBlockSchema', () => {
  it('accepts a valid vitals block with values', () => {
    const result = ProtocolBlockSchema.safeParse({
      id: 'blk_001',
      type: 'vitals',
      fields: [
        { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
      ],
      values: { bp: '120/80' },
    })
    expect(result.success).toBe(true)
  })
})

describe('clinical_notes block in ProtocolBlockSchema', () => {
  it('accepts a valid clinical_notes block', () => {
    const result = ProtocolBlockSchema.safeParse({
      id: 'blk_002',
      type: 'clinical_notes',
      label: 'Motivo de consulta',
      content: 'Paciente refiere dolor de cabeza',
    })
    expect(result.success).toBe(true)
  })
})

describe('CreateProtocolCategorySchema', () => {
  it('accepts name + color', () => {
    const result = CreateProtocolCategorySchema.safeParse({ name: 'Emergencias', color: '#EF4444' })
    expect(result.success).toBe(true)
  })
  it('requires name', () => {
    const result = CreateProtocolCategorySchema.safeParse({ color: '#EF4444' })
    expect(result.success).toBe(false)
  })
})
