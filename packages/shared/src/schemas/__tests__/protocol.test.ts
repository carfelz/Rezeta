import { describe, it, expect } from 'vitest'
import {
  CreateProtocolSchema,
  CreateProtocolTemplateSchema,
  ProtocolTemplateDtoSchema,
} from '../protocol.js'

describe('CreateProtocolSchema (template-driven)', () => {
  it('requires templateId and title', () => {
    const ok = CreateProtocolSchema.safeParse({
      templateId: '11111111-1111-1111-1111-111111111111',
      title: 'Mi protocolo',
    })
    expect(ok.success).toBe(true)
  })
  it('rejects when templateId is missing', () => {
    expect(CreateProtocolSchema.safeParse({ title: 'X' }).success).toBe(false)
  })
})

describe('CreateProtocolTemplateSchema requires categoryId', () => {
  it('rejects without categoryId', () => {
    expect(
      CreateProtocolTemplateSchema.safeParse({ name: 'T', schema: { version: '1.0', blocks: [] } })
        .success,
    ).toBe(false)
  })
  it('accepts with categoryId', () => {
    expect(
      CreateProtocolTemplateSchema.safeParse({
        name: 'T',
        categoryId: '22222222-2222-2222-2222-222222222222',
        schema: { version: '1.0', blocks: [] },
      }).success,
    ).toBe(true)
  })
})

describe('ProtocolTemplateDtoSchema embeds category', () => {
  it('parses categoryId + category', () => {
    const dto = {
      id: '33333333-3333-3333-3333-333333333333',
      tenantId: '44444444-4444-4444-4444-444444444444',
      name: 'T',
      description: null,
      suggestedSpecialty: null,
      categoryId: '22222222-2222-2222-2222-222222222222',
      category: { id: '22222222-2222-2222-2222-222222222222', name: 'Emergencias', color: '#EF4444' },
      schema: { version: '1.0', blocks: [] },
      isSeeded: true,
      isLocked: false,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }
    expect(ProtocolTemplateDtoSchema.safeParse(dto).success).toBe(true)
  })

  it('rejects without categoryId', () => {
    const dto = {
      id: '33333333-3333-3333-3333-333333333333',
      tenantId: '44444444-4444-4444-4444-444444444444',
      name: 'T',
      description: null,
      suggestedSpecialty: null,
      schema: { version: '1.0', blocks: [] },
      isSeeded: true,
      isLocked: false,
      createdAt: '2026-06-29T00:00:00.000Z',
      updatedAt: '2026-06-29T00:00:00.000Z',
    }
    expect(ProtocolTemplateDtoSchema.safeParse(dto).success).toBe(false)
  })
})
