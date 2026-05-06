import type { ProtocolBlock } from '../types/protocol.js'
import type { ConsultationProtocolUsage } from '../types/consultation.js'

export interface MissingRequiredField {
  /** Stable identifier — e.g. `chiefComplaint`, `assessment`, `protocol:<usageId>:<blockId>` */
  id: string
  label: string
  description?: string
}

export interface SoapSnapshot {
  chiefComplaint: string | null
  assessment: string | null
  diagnoses: string[]
}

const SOAP_RULES: { id: string; label: string; check: (s: SoapSnapshot) => boolean }[] = [
  {
    id: 'chiefComplaint',
    label: 'Motivo de consulta',
    check: (s) => !s.chiefComplaint || !s.chiefComplaint.trim(),
  },
  {
    id: 'assessment',
    label: 'Evaluación',
    check: (s) => !s.assessment || !s.assessment.trim(),
  },
  {
    id: 'diagnoses',
    label: 'Diagnósticos',
    check: (s) => s.diagnoses.length === 0,
  },
]

/**
 * Walks a block tree and returns required blocks that are not "completed" given
 * `checkedState`. Completion rules:
 *   - section: not directly required (the required flag cascades to children)
 *   - checklist: every item id must be in checkedState as true
 *   - steps: every step id must be in checkedState as true
 *   - decision: at least one branch id must be in checkedState as true
 *   - dosage_table: at least one row id must be in checkedState as true
 *   - text: passes (no completion semantics)
 *   - alert: passes
 *   - imaging_order/lab_order: at least one order id must be in checkedState as true
 */
function isBlockCompleted(block: ProtocolBlock, checkedState: Record<string, boolean>): boolean {
  switch (block.type) {
    case 'section':
      return block.blocks.every((b) => !blockIsRequired(b) || isBlockCompleted(b, checkedState))
    case 'checklist':
      return block.items.every((it) => checkedState[it.id] === true)
    case 'steps':
      return block.steps.every((st) => checkedState[st.id] === true)
    case 'decision':
      return block.branches.some((br) => checkedState[br.id] === true)
    case 'dosage_table':
      return block.rows.some((r) => checkedState[r.id] === true)
    case 'imaging_order':
      return block.orders.some((o) => checkedState[o.id] === true)
    case 'lab_order':
      return block.orders.some((o) => checkedState[o.id] === true)
    case 'text':
    case 'alert':
      return true
    default:
      return true
  }
}

function blockIsRequired(_block: ProtocolBlock): boolean {
  // The `required` flag lives on TEMPLATE blocks, not protocol-instance blocks.
  // For a protocol usage, we treat blocks marked with a runtime `required: true`
  // (carried over from template via content materialisation) as required.
  // The base type doesn't expose `required`, so we read it as an unknown extension.
  const r = (_block as unknown as { required?: boolean }).required
  return r === true
}

function blockLabel(block: ProtocolBlock): string {
  if ('title' in block && block.title) return block.title
  if (block.type === 'section') return block.title
  if (block.type === 'decision') return block.condition
  return `Bloque ${block.id}`
}

function walkRequired(
  blocks: ProtocolBlock[],
  checkedState: Record<string, boolean>,
  usageId: string,
  out: MissingRequiredField[],
): void {
  for (const block of blocks) {
    if (block.type === 'section') {
      walkRequired(block.blocks, checkedState, usageId, out)
      continue
    }
    if (blockIsRequired(block) && !isBlockCompleted(block, checkedState)) {
      out.push({
        id: `protocol:${usageId}:${block.id}`,
        label: blockLabel(block),
        description: 'Requerido por el protocolo',
      })
    }
  }
}

/**
 * Returns all unfilled required fields for a consultation. Caller decides
 * whether to block the sign action (server) or surface a callout (client).
 *
 * Includes:
 *   - SOAP-required: chiefComplaint, assessment, ≥1 diagnoses
 *   - Protocol-required: every block flagged `required: true` in active usages
 *     that is not "completed" per `isBlockCompleted` semantics
 */
export function computeMissingRequiredFields(
  soap: SoapSnapshot,
  protocolUsages: ConsultationProtocolUsage[],
): MissingRequiredField[] {
  const missing: MissingRequiredField[] = []
  for (const rule of SOAP_RULES) {
    if (rule.check(soap)) missing.push({ id: rule.id, label: rule.label })
  }
  for (const usage of protocolUsages) {
    if (usage.status !== 'in_progress' && usage.status !== 'completed') continue
    const blocks = usage.content?.blocks ?? []
    walkRequired(blocks, usage.checkedState ?? {}, usage.id, missing)
  }
  return missing
}
