import { describe, it, expect } from 'vitest'
import { ProtocolContentSchema } from '@rezeta/shared'
import { buildProtocolContentFromTemplate } from '../template-to-content.js'
import { getStarterFixtures } from '../../../lib/starter-fixtures/index.js'

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
    const section = (out.blocks as Array<Record<string, unknown>>)[0]
    expect(section).not.toHaveProperty('placeholder_blocks')
    expect(section).not.toHaveProperty('required')
    expect(Array.isArray(section.blocks)).toBe(true)
  })

  it('strips placeholder/required/description hints from leaf blocks', () => {
    const out = buildProtocolContentFromTemplate({
      version: '1.0',
      blocks: [{ type: 'text', placeholder: 'hint', required: true, description: 'd' }],
    })
    const block = (out.blocks as Array<Record<string, unknown>>)[0]
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
})
