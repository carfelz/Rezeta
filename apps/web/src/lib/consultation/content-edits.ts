import type { ProtocolBlock } from '@rezeta/shared'

/**
 * A doctor-authored edit to a single run-mode content block, buffered
 * client-side before it's merged into the usage's content and flushed to the
 * server. Mirrors the two writable block shapes: `vitals` (full values
 * object per entry) and `clinical_notes` (full text).
 */
export type ContentEdit =
  | { kind: 'vitals'; values: Record<string, string | number> }
  | { kind: 'notes'; content: string }

/**
 * Applies buffered content edits onto a protocol usage's block tree,
 * recursing into `section` blocks (blocks nest). Last-write-wins per block
 * is the caller's responsibility (the buffer only ever holds one edit per
 * block id); this helper is a pure, single-pass merge.
 *
 * Blocks without a matching edit — and block types that aren't editable in
 * run mode — pass through unchanged (same reference), so callers can rely on
 * referential equality to detect untouched branches.
 */
export function applyContentEdits(
  blocks: ProtocolBlock[],
  editsByBlockId: Record<string, ContentEdit>,
): ProtocolBlock[] {
  return blocks.map((block) => {
    if (block.type === 'section') {
      const nextChildren = applyContentEdits(block.blocks, editsByBlockId)
      // Every child came back referentially unchanged, so this section has no
      // edits anywhere beneath it — return the original object rather than a
      // clone, preserving referential equality up the tree for callers.
      const unchanged =
        nextChildren.length === block.blocks.length &&
        nextChildren.every((child, i) => child === block.blocks[i])
      return unchanged ? block : { ...block, blocks: nextChildren }
    }

    const edit = editsByBlockId[block.id]
    if (!edit) return block

    if (edit.kind === 'vitals' && block.type === 'vitals') {
      return { ...block, values: edit.values }
    }
    if (edit.kind === 'notes' && block.type === 'clinical_notes') {
      return { ...block, content: edit.content }
    }
    return block
  })
}
