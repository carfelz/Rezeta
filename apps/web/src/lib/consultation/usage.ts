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
