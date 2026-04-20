/**
 * Builds the initial ProtocolContent from a ProtocolTemplate schema.
 *
 * Rule: include only required sections, and within them only required blocks,
 * each instantiated with the minimum valid content for their type.
 * Optional sections and optional placeholder_blocks are not seeded — they
 * become available via the editor palette in Slice 4+.
 */

function genId(prefix: string): string {
  const rand = () => Math.random().toString(36).slice(2, 7)
  return `${prefix}_${rand()}${rand()}`
}

interface TemplateBlock {
  id?: string
  type: string
  title?: string
  description?: string
  collapsed_by_default?: boolean
  required?: boolean
  severity?: string
  placeholder_blocks?: TemplateBlock[]
  blocks?: TemplateBlock[]
}

interface TemplateSchema {
  version: string
  metadata?: Record<string, unknown>
  blocks: TemplateBlock[]
}

export interface InitialProtocolContent {
  version: string
  template_version: string
  blocks: unknown[]
}

export function buildInitialContentFromTemplate(
  templateSchema: TemplateSchema,
): InitialProtocolContent {
  return {
    version: '1.0',
    template_version: templateSchema.version,
    blocks: buildRequiredBlocks(templateSchema.blocks),
  }
}

function buildRequiredBlocks(templateBlocks: TemplateBlock[]): unknown[] {
  const result: unknown[] = []
  for (const block of templateBlocks) {
    if (!block.required) continue

    if (block.type === 'section') {
      const childSource = block.placeholder_blocks ?? block.blocks ?? []
      const childBlocks = buildRequiredBlocks(childSource)
      const section: Record<string, unknown> = {
        id: block.id ?? genId('sec'),
        type: 'section',
        title: block.title ?? '',
        blocks: childBlocks,
      }
      if (block.description) section.description = block.description
      if (block.collapsed_by_default) section.collapsed_by_default = true
      result.push(section)
    } else {
      result.push(buildMinimalBlock(block))
    }
  }
  return result
}

function buildMinimalBlock(block: TemplateBlock): unknown {
  const id = block.id ?? genId('blk')

  switch (block.type) {
    case 'text':
      return { id, type: 'text', content: '' }

    case 'checklist':
      return {
        id,
        type: 'checklist',
        items: [{ id: genId('itm'), text: '', critical: false }],
      }

    case 'steps':
      return {
        id,
        type: 'steps',
        steps: [{ id: genId('stp'), order: 1, title: '', detail: '' }],
      }

    case 'decision':
      return {
        id,
        type: 'decision',
        condition: '',
        branches: [
          { id: 'brn_1', label: '', action: '' },
          { id: 'brn_2', label: '', action: '' },
        ],
      }

    case 'dosage_table':
      return {
        id,
        type: 'dosage_table',
        columns: ['drug', 'dose', 'route', 'frequency', 'notes'] as const,
        rows: [
          {
            id: genId('row'),
            drug: '',
            dose: '',
            route: '',
            frequency: '',
            notes: '',
          },
        ],
      }

    case 'alert':
      return {
        id,
        type: 'alert',
        severity: block.severity ?? 'info',
        title: '',
        content: '',
      }

    default:
      return { id, type: block.type }
  }
}
