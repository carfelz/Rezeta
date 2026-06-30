// Template-only hint fields that must NOT appear in protocol content.
// `required` is intentionally discarded for all blocks (including `clinical_notes`) because
// it is a template-authoring hint per the protocol-model spec, not protocol content.
const HINT_FIELDS = new Set(['required', 'placeholder', 'placeholder_blocks'])

interface RawBlock {
  id?: string
  type: string
  placeholder_blocks?: RawBlock[]
  blocks?: RawBlock[]
  [key: string]: unknown
}

interface BuiltContent {
  version: string
  template_version: string
  blocks: unknown[]
}

/**
 * Converts a ProtocolTemplate.schema into an initial ProtocolVersion.content:
 * renames nested `placeholder_blocks` -> `blocks`, drops template-only hints,
 * ensures every block has a unique id, and initializes empty value fields so the
 * result satisfies ProtocolContentSchema.
 */
export function buildProtocolContentFromTemplate(schema: unknown): BuiltContent {
  const root = (schema ?? {}) as { version?: string; blocks?: RawBlock[] }
  const counter = { n: 0 }
  return {
    version: '1.0',
    template_version: typeof root.version === 'string' ? root.version : '1.0',
    blocks: (root.blocks ?? []).map((b) => transformBlock(b, counter)),
  }
}

function transformBlock(block: RawBlock, counter: { n: number }): Record<string, unknown> {
  const children = block.placeholder_blocks ?? block.blocks
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(block)) {
    if (HINT_FIELDS.has(key) || key === 'blocks') continue
    if (key === 'description' && block.type !== 'section') continue
    out[key] = value
  }
  out.id = typeof block.id === 'string' && block.id.length > 0 ? block.id : nextId(block.type, counter)
  initEmptyValueFields(out)
  if (block.type === 'section') {
    out.blocks = (children ?? []).map((c) => transformBlock(c, counter))
  }
  return out
}

function nextId(type: string, counter: { n: number }): string {
  counter.n += 1
  return `blk_${type}_${counter.n}`
}

/**
 * Initialize the value-bearing field each block type requires to satisfy
 * ProtocolContentSchema. Arrays that require min(1) are seeded with one
 * placeholder entry so the schema parse passes on first use.
 *
 * Field mapping rationale (driven by ProtocolBlockSchema discriminated union):
 *   text           → content: string
 *   alert          → severity: AlertSeverityEnum, content: string
 *   vitals         → fields: VitalsFieldSchema[] (no min — empty array is valid)
 *   checklist      → items: ChecklistItemSchema[], min(1)  → seed one empty item
 *   steps          → steps: StepSchema[], min(1)           → seed one empty step
 *   decision       → condition: string, branches: DecisionBranchSchema[], min(2) → seed two branches
 *   dosage_table   → columns: FixedDosageColumnsSchema (tuple), rows: DosageRowSchema[], min(1) → seed one row
 *   lab_order      → orders: LabOrderItemSchema[], min(1)  → seed one empty order
 *   imaging_order  → orders: ImagingOrderItemSchema[], min(1) → seed one empty order
 *   clinical_notes → label: string, content: string
 */
function initEmptyValueFields(block: Record<string, unknown>): void {
  switch (block.type) {
    case 'text':
      if (typeof block.content !== 'string') block.content = ''
      break

    case 'alert':
      if (typeof block.severity !== 'string') block.severity = 'info'
      if (typeof block.content !== 'string') block.content = ''
      break

    case 'vitals':
      if (!Array.isArray(block.fields)) block.fields = []
      break

    case 'checklist':
      if (!Array.isArray(block.items) || block.items.length === 0) {
        block.items = [{ id: 'item_1', text: '', critical: false }]
      }
      break

    case 'steps':
      if (!Array.isArray(block.steps) || block.steps.length === 0) {
        block.steps = [{ id: 'step_1', order: 1, title: '' }]
      }
      break

    case 'decision':
      if (typeof block.condition !== 'string') block.condition = ''
      if (!Array.isArray(block.branches) || block.branches.length < 2) {
        block.branches = [
          { id: 'branch_1', label: '', action: '' },
          { id: 'branch_2', label: '', action: '' },
        ]
      }
      break

    case 'dosage_table':
      if (!Array.isArray(block.columns)) {
        block.columns = ['drug', 'dose', 'route', 'frequency', 'notes']
      }
      if (!Array.isArray(block.rows) || block.rows.length === 0) {
        block.rows = [{ id: 'row_1', drug: '', dose: '', route: '', frequency: '', notes: '' }]
      }
      break

    case 'lab_order':
      if (!Array.isArray(block.orders) || block.orders.length === 0) {
        block.orders = [
          {
            id: 'lab_1',
            test_name: '',
            indication: '',
            urgency: 'routine',
            fasting_required: false,
            sample_type: 'blood',
          },
        ]
      }
      break

    case 'imaging_order':
      if (!Array.isArray(block.orders) || block.orders.length === 0) {
        block.orders = [
          {
            id: 'img_1',
            study_type: '',
            indication: '',
            urgency: 'routine',
            contrast: false,
            fasting_required: false,
          },
        ]
      }
      break

    case 'clinical_notes':
      if (typeof block.label !== 'string') block.label = ''
      if (typeof block.content !== 'string') block.content = ''
      break

    default:
      break
  }
}
