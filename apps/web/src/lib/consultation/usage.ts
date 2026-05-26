import type { ConsultationProtocolUsage, ProtocolBlock } from '@rezeta/shared'

/**
 * Walks a protocol usage's content tree and returns the IDs of every
 * checkable item (checklist items + steps). Used to compute progress
 * indicators on the protocol pills.
 */
export function collectUsageCheckableIds(usage: ConsultationProtocolUsage): string[] {
  const ids: string[] = []
  walk(usage.content?.blocks ?? [], ids)
  return ids
}

function walk(blocks: ProtocolBlock[], out: string[]): void {
  for (const block of blocks) {
    if (block.type === 'section') walk(block.blocks, out)
    else if (block.type === 'checklist') for (const it of block.items) out.push(it.id)
    else if (block.type === 'steps') for (const st of block.steps) out.push(st.id)
  }
}

/**
 * Derives a { [itemId]: boolean } checked-state map from the ordered
 * checklist_items events stored in a usage's modifications. The last event
 * for each item_id wins (allows toggling).
 */
export function deriveCheckedState(usage: ConsultationProtocolUsage): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const ev of usage.modifications?.checklist_items ?? []) {
    result[ev.item_id] = ev.checked
  }
  return result
}
