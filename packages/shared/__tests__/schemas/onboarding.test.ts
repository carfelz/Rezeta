import { describe, it, expect } from 'vitest'
import {
  OnboardingCustomTemplateSchema,
  OnboardingCustomTypeSchema,
  OnboardingCustomSchema,
} from '../../src/schemas/onboarding.js'

const validSchema = {
  version: '1.0',
  blocks: [{ id: 'b1', type: 'text', content: 'Instrucción inicial' }],
}

describe('OnboardingCustomTemplateSchema', () => {
  const validTemplate = {
    clientId: 'template-hta',
    name: 'Hipertensión Arterial',
    suggestedSpecialty: 'Cardiología',
    schema: validSchema,
  }

  it('accepts a valid template', () => {
    const result = OnboardingCustomTemplateSchema.parse(validTemplate)
    expect(result.clientId).toBe('template-hta')
    expect(result.name).toBe('Hipertensión Arterial')
  })

  it('accepts template without optional suggestedSpecialty', () => {
    const { suggestedSpecialty: _, ...rest } = validTemplate
    const result = OnboardingCustomTemplateSchema.parse(rest)
    expect(result.suggestedSpecialty).toBeUndefined()
  })

  it('rejects empty clientId', () => {
    expect(() =>
      OnboardingCustomTemplateSchema.parse({ ...validTemplate, clientId: '' }),
    ).toThrow()
  })

  it('rejects empty name', () => {
    expect(() =>
      OnboardingCustomTemplateSchema.parse({ ...validTemplate, name: '' }),
    ).toThrow()
  })

  it('rejects missing schema', () => {
    const { schema: _, ...rest } = validTemplate
    expect(() => OnboardingCustomTemplateSchema.parse(rest)).toThrow()
  })

  it('rejects schema without version', () => {
    expect(() =>
      OnboardingCustomTemplateSchema.parse({
        ...validTemplate,
        schema: { blocks: [] },
      }),
    ).toThrow()
  })
})

describe('OnboardingCustomTypeSchema', () => {
  const validType = { name: 'Consulta HTA', templateClientId: 'template-hta' }

  it('accepts a valid type', () => {
    const result = OnboardingCustomTypeSchema.parse(validType)
    expect(result.name).toBe('Consulta HTA')
    expect(result.templateClientId).toBe('template-hta')
  })

  it('rejects empty name', () => {
    expect(() => OnboardingCustomTypeSchema.parse({ ...validType, name: '' })).toThrow()
  })

  it('rejects empty templateClientId', () => {
    expect(() =>
      OnboardingCustomTypeSchema.parse({ ...validType, templateClientId: '' }),
    ).toThrow()
  })
})

describe('OnboardingCustomSchema', () => {
  const validInput = {
    templates: [
      {
        clientId: 'tmpl-1',
        name: 'Plantilla 1',
        schema: validSchema,
      },
    ],
    types: [{ name: 'Tipo 1', templateClientId: 'tmpl-1' }],
  }

  it('accepts a valid onboarding payload', () => {
    const result = OnboardingCustomSchema.parse(validInput)
    expect(result.templates).toHaveLength(1)
    expect(result.types).toHaveLength(1)
  })

  it('rejects empty templates array', () => {
    expect(() =>
      OnboardingCustomSchema.parse({ ...validInput, templates: [] }),
    ).toThrow()
  })

  it('rejects empty types array', () => {
    expect(() =>
      OnboardingCustomSchema.parse({ ...validInput, types: [] }),
    ).toThrow()
  })

  it('accepts multiple templates and types', () => {
    const result = OnboardingCustomSchema.parse({
      templates: [
        { clientId: 't1', name: 'T1', schema: validSchema },
        { clientId: 't2', name: 'T2', schema: validSchema },
      ],
      types: [
        { name: 'Type 1', templateClientId: 't1' },
        { name: 'Type 2', templateClientId: 't2' },
      ],
    })
    expect(result.templates).toHaveLength(2)
    expect(result.types).toHaveLength(2)
  })
})
