import { describe, it, expect } from 'vitest'
import { makeBlock, PALETTE_ITEMS } from '../block-factory.js'

describe('makeBlock', () => {
  it('creates a vitals block with default fields array', () => {
    const block = makeBlock('vitals')
    expect(block).not.toBeNull()
    expect(block!.type).toBe('vitals')
    expect((block as { fields: unknown[] }).fields).toBeInstanceOf(Array)
    expect((block as { fields: unknown[] }).fields.length).toBeGreaterThan(0)
  })

  it('creates a clinical_notes block with label and content', () => {
    const block = makeBlock('clinical_notes')
    expect(block).not.toBeNull()
    expect(block!.type).toBe('clinical_notes')
    expect((block as { label: string }).label).toBeDefined()
    expect((block as { content: string }).content).toBe('')
  })
})

describe('PALETTE_ITEMS', () => {
  it('includes vitals and clinical_notes', () => {
    const types = PALETTE_ITEMS.map((i) => i.type)
    expect(types).toContain('vitals')
    expect(types).toContain('clinical_notes')
  })
})
