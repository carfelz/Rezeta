import { describe, it, expect } from 'vitest'
import { ProtocolContentSchema } from '@rezeta/shared'
import { buildProtocolContentFromTemplate } from '../template-to-content.js'
import { getStarterFixtures } from '../../../lib/starter-fixtures/index.js'

// Helper to extract a single block from the output
function firstBlock(schema: unknown): Record<string, unknown> {
  const out = buildProtocolContentFromTemplate(schema)
  return (out.blocks as Array<Record<string, unknown>>)[0]!
}

describe('buildProtocolContentFromTemplate', () => {
  it('produces content that passes ProtocolContentSchema for every seed template (es + en)', () => {
    for (const locale of ['es', 'en'] as const) {
      for (const fixture of getStarterFixtures(locale)) {
        const content = buildProtocolContentFromTemplate(fixture.schema)
        const parsed = ProtocolContentSchema.safeParse(content)
        expect(parsed.success, `${locale}/${fixture.name}: ${JSON.stringify(parsed)}`).toBe(true)
      }
    }
  })

  it('renames placeholder_blocks to blocks recursively', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [
        { id: 'sec', type: 'section', title: 'S', required: true, placeholder_blocks: [
          { type: 'text', placeholder: 'hint' },
        ] },
      ],
    })
    const section = (out.blocks as Array<Record<string, unknown>>)[0]!
    expect(section).not.toHaveProperty('placeholder_blocks')
    expect(section).not.toHaveProperty('required')
    expect(Array.isArray(section.blocks)).toBe(true)
  })

  it('strips placeholder/required/description hints from leaf blocks', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [{ type: 'text', placeholder: 'hint', required: true, description: 'd' }],
    })
    const block = (out.blocks as Array<Record<string, unknown>>)[0]!
    expect(block).not.toHaveProperty('placeholder')
    expect(block).not.toHaveProperty('required')
    expect(block).not.toHaveProperty('description')
  })

  it('assigns a unique id to every block, generating ids where absent', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [
        { type: 'text', placeholder: 'a' },
        { id: 'sec', type: 'section', placeholder_blocks: [{ type: 'text' }, { type: 'text' }] },
      ],
    })
    const ids: string[] = []
    const walk = (blocks: Array<Record<string, unknown>>): void => {
      for (const b of blocks) {
        expect(typeof b.id).toBe('string')
        expect((b.id as string).length).toBeGreaterThan(0)
        ids.push(b.id as string)
        if (Array.isArray(b.blocks)) walk(b.blocks as Array<Record<string, unknown>>)
      }
    }
    walk(out.blocks as Array<Record<string, unknown>>)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('carries template_version from schema.version, defaulting to 1.0', () => {
    expect(buildProtocolContentFromTemplate({ version: '2.3', blocks: [] }).template_version).toBe('2.3')
    expect(buildProtocolContentFromTemplate({ blocks: [] }).template_version).toBe('1.0')
  })

  it('handles null/undefined schema gracefully (schema ?? {} branch)', () => {
    const out = buildProtocolContentFromTemplate(null)
    expect(out.version).toBe('1.0')
    expect(out.template_version).toBe('1.0')
    expect(out.blocks).toEqual([])
  })

  it('handles a schema with no blocks property (root.blocks ?? [] branch)', () => {
    const out = buildProtocolContentFromTemplate({ version: '1.5' })
    expect(out.template_version).toBe('1.5')
    expect(out.blocks).toEqual([])
  })

  it('handles a section with no placeholder_blocks or blocks (children ?? [] branch)', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [{ id: 'sec', type: 'section', title: 'Empty section' }],
    })
    const section = (out.blocks as Array<Record<string, unknown>>)[0]!
    expect(Array.isArray(section.blocks)).toBe(true)
    expect((section.blocks as unknown[]).length).toBe(0)
  })

  it('preserves description on section blocks but strips it from non-section blocks', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [
        { id: 'sec', type: 'section', title: 'S', description: 'keep me', placeholder_blocks: [] },
        { type: 'text', description: 'drop me' },
      ],
    })
    const blocks = out.blocks as Array<Record<string, unknown>>
    expect(blocks[0]!.description).toBe('keep me')
    expect(blocks[1]).not.toHaveProperty('description')
  })

  // ─── initEmptyValueFields: per-block-type branch coverage ──────────────────

  describe('initEmptyValueFields — text block', () => {
    it('initializes content to empty string when absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'text' }] })
      expect(block.content).toBe('')
    })

    it('preserves existing content when already set', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'text', content: 'Hello' }] })
      expect(block.content).toBe('Hello')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'text' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — alert block', () => {
    it('initializes severity to "info" and content to empty string when absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'alert' }] })
      expect(block.severity).toBe('info')
      expect(block.content).toBe('')
    })

    it('preserves existing severity and content when already set', () => {
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'alert', severity: 'warning', content: 'Caution' }],
      })
      expect(block.severity).toBe('warning')
      expect(block.content).toBe('Caution')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'alert' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — vitals block', () => {
    it('initializes fields to empty array when absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'vitals' }] })
      expect(Array.isArray(block.fields)).toBe(true)
      expect((block.fields as unknown[]).length).toBe(0)
    })

    it('preserves existing fields array when already set', () => {
      const existingField = { id: 'f1', label: 'Weight', unit: 'kg', input_type: 'number' }
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'vitals', fields: [existingField] }],
      })
      expect(Array.isArray(block.fields)).toBe(true)
      expect((block.fields as unknown[]).length).toBe(1)
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'vitals' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — checklist block', () => {
    it('seeds one empty item when items absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'checklist' }] })
      const items = block.items as Array<Record<string, unknown>>
      expect(Array.isArray(items)).toBe(true)
      expect(items.length).toBeGreaterThanOrEqual(1)
      expect(typeof items[0]!.id).toBe('string')
      expect(typeof items[0]!.text).toBe('string')
      expect(typeof items[0]!.critical).toBe('boolean')
    })

    it('seeds one empty item when items is an empty array', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'checklist', items: [] }] })
      const items = block.items as Array<Record<string, unknown>>
      expect(items.length).toBeGreaterThanOrEqual(1)
    })

    it('preserves existing items when non-empty', () => {
      const existingItem = { id: 'i1', text: 'Check vitals', critical: true }
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'checklist', items: [existingItem] }],
      })
      const items = block.items as Array<Record<string, unknown>>
      expect(items.length).toBe(1)
      expect(items[0]!.text).toBe('Check vitals')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'checklist' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — steps block', () => {
    it('seeds one empty step when steps absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'steps' }] })
      const steps = block.steps as Array<Record<string, unknown>>
      expect(Array.isArray(steps)).toBe(true)
      expect(steps.length).toBeGreaterThanOrEqual(1)
      expect(typeof steps[0]!.id).toBe('string')
      expect(steps[0]!.order).toBe(1)
      expect(typeof steps[0]!.title).toBe('string')
    })

    it('seeds one empty step when steps is an empty array', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'steps', steps: [] }] })
      const steps = block.steps as Array<Record<string, unknown>>
      expect(steps.length).toBeGreaterThanOrEqual(1)
    })

    it('preserves existing steps when non-empty', () => {
      const existingStep = { id: 's1', order: 1, title: 'Wash hands' }
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'steps', steps: [existingStep] }],
      })
      const steps = block.steps as Array<Record<string, unknown>>
      expect(steps.length).toBe(1)
      expect(steps[0]!.title).toBe('Wash hands')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'steps' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — decision block', () => {
    it('initializes condition to empty string and seeds two branches when absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'decision' }] })
      expect(block.condition).toBe('')
      const branches = block.branches as Array<Record<string, unknown>>
      expect(Array.isArray(branches)).toBe(true)
      expect(branches.length).toBeGreaterThanOrEqual(2)
      expect(typeof branches[0]!.id).toBe('string')
      expect(typeof branches[0]!.label).toBe('string')
      expect(typeof branches[0]!.action).toBe('string')
    })

    it('seeds two branches when only one branch is present', () => {
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'decision', condition: 'Q', branches: [{ id: 'br1', label: 'Yes', action: 'proceed' }] }],
      })
      const branches = block.branches as Array<Record<string, unknown>>
      expect(branches.length).toBeGreaterThanOrEqual(2)
    })

    it('preserves existing branches when two or more are present', () => {
      const existingBranches = [
        { id: 'br1', label: 'Yes', action: 'do_x' },
        { id: 'br2', label: 'No', action: 'do_y' },
      ]
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'decision', condition: 'Q', branches: existingBranches }],
      })
      const branches = block.branches as Array<Record<string, unknown>>
      expect(branches.length).toBe(2)
      expect(branches[0]!.label).toBe('Yes')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'decision' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — dosage_table block', () => {
    it('initializes columns tuple and seeds one empty row when absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'dosage_table' }] })
      const columns = block.columns as string[]
      expect(Array.isArray(columns)).toBe(true)
      expect(columns).toContain('drug')
      expect(columns).toContain('dose')
      expect(columns).toContain('route')
      expect(columns).toContain('frequency')
      const rows = block.rows as Array<Record<string, unknown>>
      expect(Array.isArray(rows)).toBe(true)
      expect(rows.length).toBeGreaterThanOrEqual(1)
      expect(typeof rows[0]!.id).toBe('string')
      expect(typeof rows[0]!.drug).toBe('string')
    })

    it('seeds one row when rows is an empty array', () => {
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'dosage_table', columns: ['drug', 'dose', 'route', 'frequency', 'notes'], rows: [] }],
      })
      const rows = block.rows as Array<Record<string, unknown>>
      expect(rows.length).toBeGreaterThanOrEqual(1)
    })

    it('preserves existing columns and rows when already set', () => {
      const existingRow = { id: 'r1', drug: 'Aspirin', dose: '100mg', route: 'oral', frequency: 'daily', notes: '' }
      const block = firstBlock({
        version: '1.0',
        blocks: [{
          id: 'b1',
          type: 'dosage_table',
          columns: ['drug', 'dose', 'route', 'frequency', 'notes'],
          rows: [existingRow],
        }],
      })
      const rows = block.rows as Array<Record<string, unknown>>
      expect(rows.length).toBe(1)
      expect(rows[0]!.drug).toBe('Aspirin')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'dosage_table' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — lab_order block', () => {
    it('seeds one empty lab order when orders absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'lab_order' }] })
      const orders = block.orders as Array<Record<string, unknown>>
      expect(Array.isArray(orders)).toBe(true)
      expect(orders.length).toBeGreaterThanOrEqual(1)
      expect(typeof orders[0]!.id).toBe('string')
      expect(typeof orders[0]!.test_name).toBe('string')
      expect(orders[0]!.urgency).toBe('routine')
      expect(orders[0]!.fasting_required).toBe(false)
      expect(orders[0]!.sample_type).toBe('blood')
    })

    it('seeds one order when orders is an empty array', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'lab_order', orders: [] }] })
      const orders = block.orders as Array<Record<string, unknown>>
      expect(orders.length).toBeGreaterThanOrEqual(1)
    })

    it('preserves existing orders when non-empty', () => {
      const existingOrder = {
        id: 'lab_x',
        test_name: 'CBC',
        indication: 'Baseline',
        urgency: 'urgent',
        fasting_required: true,
        sample_type: 'blood',
      }
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'lab_order', orders: [existingOrder] }],
      })
      const orders = block.orders as Array<Record<string, unknown>>
      expect(orders.length).toBe(1)
      expect(orders[0]!.test_name).toBe('CBC')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'lab_order' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — imaging_order block', () => {
    it('seeds one empty imaging order when orders absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'imaging_order' }] })
      const orders = block.orders as Array<Record<string, unknown>>
      expect(Array.isArray(orders)).toBe(true)
      expect(orders.length).toBeGreaterThanOrEqual(1)
      expect(typeof orders[0]!.id).toBe('string')
      expect(typeof orders[0]!.study_type).toBe('string')
      expect(orders[0]!.urgency).toBe('routine')
      expect(orders[0]!.contrast).toBe(false)
      expect(orders[0]!.fasting_required).toBe(false)
    })

    it('seeds one order when orders is an empty array', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'imaging_order', orders: [] }] })
      const orders = block.orders as Array<Record<string, unknown>>
      expect(orders.length).toBeGreaterThanOrEqual(1)
    })

    it('preserves existing orders when non-empty', () => {
      const existingOrder = {
        id: 'img_x',
        study_type: 'X-Ray',
        indication: 'Chest pain',
        urgency: 'stat',
        contrast: true,
        fasting_required: false,
      }
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'imaging_order', orders: [existingOrder] }],
      })
      const orders = block.orders as Array<Record<string, unknown>>
      expect(orders.length).toBe(1)
      expect(orders[0]!.study_type).toBe('X-Ray')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'imaging_order' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — clinical_notes block', () => {
    it('initializes label and content to empty strings when absent', () => {
      const block = firstBlock({ version: '1.0', blocks: [{ id: 'b1', type: 'clinical_notes' }] })
      expect(block.label).toBe('')
      expect(block.content).toBe('')
    })

    it('preserves existing label and content when already set', () => {
      const block = firstBlock({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'clinical_notes', label: 'Subjective', content: 'Patient reports...' }],
      })
      expect(block.label).toBe('Subjective')
      expect(block.content).toBe('Patient reports...')
    })

    it('output satisfies ProtocolContentSchema', () => {
      const out = buildProtocolContentFromTemplate({ version: '1.0', blocks: [{ id: 'b1', type: 'clinical_notes' }] })
      expect(ProtocolContentSchema.safeParse(out).success).toBe(true)
    })
  })

  describe('initEmptyValueFields — default (unknown block type)', () => {
    it('passes through unknown block types without adding value fields', () => {
      const out = buildProtocolContentFromTemplate({
        version: '1.0',
        blocks: [{ id: 'b1', type: 'spacer' }],
      })
      const block = (out.blocks as Array<Record<string, unknown>>)[0]!
      expect(block.type).toBe('spacer')
      expect(block.id).toBe('b1')
      // The default branch does nothing — no extra fields are injected
      const keys = Object.keys(block)
      expect(keys).toEqual(expect.arrayContaining(['id', 'type']))
      expect(keys.length).toBe(2)
    })

    it('also passes through a block with extra data intact', () => {
      const out = buildProtocolContentFromTemplate({
        version: '1.0',
        blocks: [{ id: 'b2', type: 'spacer', height: 32 }],
      })
      const block = (out.blocks as Array<Record<string, unknown>>)[0]!
      expect(block.height).toBe(32)
    })
  })

  describe('initEmptyValueFields — all block types in a single template', () => {
    it('builds valid content when every known block type appears together', () => {
      const out = buildProtocolContentFromTemplate({
        version: '1.0',
        blocks: [
          { id: 'b-text', type: 'text' },
          { id: 'b-alert', type: 'alert' },
          { id: 'b-vitals', type: 'vitals' },
          { id: 'b-checklist', type: 'checklist' },
          { id: 'b-steps', type: 'steps' },
          { id: 'b-decision', type: 'decision' },
          { id: 'b-dosage', type: 'dosage_table' },
          { id: 'b-lab', type: 'lab_order' },
          { id: 'b-img', type: 'imaging_order' },
          { id: 'b-notes', type: 'clinical_notes' },
          {
            id: 'b-sec',
            type: 'section',
            title: 'Section',
            placeholder_blocks: [{ id: 'b-nested', type: 'text' }],
          },
        ],
      })
      const blocks = out.blocks as Array<Record<string, unknown>>
      expect(blocks.length).toBe(11)
      // Each block type has its required value field initialized
      expect((blocks.find((b) => b.type === 'text') as Record<string, unknown>).content).toBe('')
      expect((blocks.find((b) => b.type === 'alert') as Record<string, unknown>).severity).toBe('info')
      expect(Array.isArray((blocks.find((b) => b.type === 'vitals') as Record<string, unknown>).fields)).toBe(true)
      expect(Array.isArray((blocks.find((b) => b.type === 'checklist') as Record<string, unknown>).items)).toBe(true)
      expect(Array.isArray((blocks.find((b) => b.type === 'steps') as Record<string, unknown>).steps)).toBe(true)
      expect(Array.isArray((blocks.find((b) => b.type === 'decision') as Record<string, unknown>).branches)).toBe(true)
      expect(Array.isArray((blocks.find((b) => b.type === 'dosage_table') as Record<string, unknown>).columns)).toBe(true)
      expect(Array.isArray((blocks.find((b) => b.type === 'lab_order') as Record<string, unknown>).orders)).toBe(true)
      expect(Array.isArray((blocks.find((b) => b.type === 'imaging_order') as Record<string, unknown>).orders)).toBe(true)
      expect((blocks.find((b) => b.type === 'clinical_notes') as Record<string, unknown>).label).toBe('')
    })
  })
})
