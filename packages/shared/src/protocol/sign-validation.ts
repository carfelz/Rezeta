import type { ProtocolBlock } from '../types/protocol.js'
import type { ConsultationProtocolUsage } from '../types/consultation.js'
import { getCheckedStateFromModifications } from './checked-state.js'

export interface MissingRequiredField {
  /** Stable identifier — e.g. `protocol:<usageId>:<blockId>` */
  id: string
  label: string
  description?: string
}

/**
 * Returns all unfilled required fields for a consultation. Caller decides
 * whether to block the sign action (server) or surface a callout (client).
 *
 * Includes:
 *   - Protocol-required: every block flagged `required: true` in active usages
 *     that hasn't been completed according to the usage's modifications.
 */
export function computeMissingRequiredFields(
  protocolUsages: ConsultationProtocolUsage[],
): MissingRequiredField[] {
  const missing: MissingRequiredField[] = []

  // Protocol-required blocks
  for (const usage of protocolUsages) {
    if (usage.status !== 'in_progress' && usage.status !== 'completed') continue
    const blocks = usage.content?.blocks ?? []
    const checkedState = getCheckedStateFromModifications(usage.modifications ?? {})
    walkRequired(blocks, usage.id, checkedState, missing)
  }
  return missing
}

function walkRequired(
  blocks: ProtocolBlock[],
  usageId: string,
  checkedState: Record<string, boolean>,
  out: MissingRequiredField[],
): void {
  for (const block of blocks) {
    if (block.type === 'section') {
      walkRequired(block.blocks, usageId, checkedState, out)
      continue
    }
    if (!blockIsRequired(block)) continue
    if (!blockIsCompleted(block, checkedState)) {
      out.push({
        id: `protocol:${usageId}:${block.id}`,
        label: blockLabel(block),
        description: 'Requerido por el protocolo',
      })
    }
  }
}

function blockIsRequired(block: ProtocolBlock): boolean {
  const r = (block as unknown as { required?: boolean }).required
  return r === true
}

function blockIsCompleted(block: ProtocolBlock, checkedState: Record<string, boolean>): boolean {
  switch (block.type) {
    case 'checklist':
      return block.items.length > 0 && block.items.every((i) => checkedState[i.id])
    case 'steps':
      return block.steps.length > 0 && block.steps.every((s) => checkedState[s.id])
    case 'decision': {
      const branches = block.branches ?? []
      return branches.some((b) => checkedState[b.id])
    }
    case 'dosage_table': {
      const rows = (block as unknown as { rows?: Array<{ id: string }> }).rows ?? []
      return rows.some((r) => checkedState[r.id])
    }
    case 'imaging_order': {
      const orders = (block as unknown as { orders?: Array<{ id: string }> }).orders ?? []
      return orders.some((o) => checkedState[o.id])
    }
    case 'lab_order': {
      const orders = (block as unknown as { orders?: Array<{ id: string }> }).orders ?? []
      return orders.some((o) => checkedState[o.id])
    }
    case 'vitals': {
      const values = block.values ?? {}
      return Object.values(values).some((v) => String(v).trim() !== '')
    }
    case 'clinical_notes': {
      const content = block.content ?? ''
      return content.trim().length > 0
    }
    case 'text':
    case 'alert':
      return true
    default:
      // Unknown block types default to complete
      return true
  }
}

function blockLabel(block: ProtocolBlock): string {
  if ('title' in block && typeof block.title === 'string' && block.title) return block.title
  if (block.type === 'decision' && block.condition) return block.condition
  return `Bloque ${block.id}`
}
