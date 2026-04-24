import { create } from 'zustand'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

// ── Block manipulation helpers (pure functions) ───────────────────────────────

function updateBlockById(
  blocks: ProtocolBlock[],
  id: string,
  updater: (b: ProtocolBlock) => ProtocolBlock,
): ProtocolBlock[] {
  return blocks.map((block) => {
    if (block.id === id) return updater(block)
    if (block.type === 'section') {
      return { ...block, blocks: updateBlockById(block.blocks, id, updater) }
    }
    return block
  })
}

function deleteBlockById(blocks: ProtocolBlock[], id: string): ProtocolBlock[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((block) => {
      if (block.type === 'section') {
        return { ...block, blocks: deleteBlockById(block.blocks, id) }
      }
      return block
    })
}

function insertBlockAfter(
  blocks: ProtocolBlock[],
  afterId: string | null,
  newBlock: ProtocolBlock,
): ProtocolBlock[] {
  if (!afterId) return [...blocks, newBlock]

  const idx = blocks.findIndex((b) => b.id === afterId)
  if (idx !== -1) {
    const next = [...blocks]
    next.splice(idx + 1, 0, newBlock)
    return next
  }

  // Check inside sections
  return blocks.map((block) => {
    if (block.type === 'section') {
      const sectionIdx = block.blocks.findIndex((b) => b.id === afterId)
      if (sectionIdx !== -1) {
        const newChildren = [...block.blocks]
        newChildren.splice(sectionIdx + 1, 0, newBlock)
        return { ...block, blocks: newChildren }
      }
    }
    return block
  })
}

function moveBlockInList<T extends { id: string }>(list: T[], id: string, dir: 'up' | 'down'): T[] {
  const idx = list.findIndex((b) => b.id === id)
  if (idx === -1) return list
  const next = [...list]
  const target = dir === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= next.length) return list
  ;[next[idx], next[target]] = [next[target]!, next[idx]!]
  return next
}

function moveBlockById(blocks: ProtocolBlock[], id: string, dir: 'up' | 'down'): ProtocolBlock[] {
  const topIdx = blocks.findIndex((b) => b.id === id)
  if (topIdx !== -1) return moveBlockInList(blocks, id, dir)

  return blocks.map((block) => {
    if (block.type === 'section') {
      const childIdx = block.blocks.findIndex((b) => b.id === id)
      if (childIdx !== -1) {
        return { ...block, blocks: moveBlockInList(block.blocks, id, dir) }
      }
    }
    return block
  })
}

function blocksEqual(a: ProtocolBlock[], b: ProtocolBlock[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ── Extract required block IDs from the template schema ──────────────────────

export function extractRequiredBlockIds(templateSchema: unknown): Set<string> {
  const ids = new Set<string>()
  const schema = templateSchema as {
    blocks?: Array<{
      id?: string
      required?: boolean
      type?: string
      placeholder_blocks?: Array<{ id?: string; required?: boolean }>
    }>
  }
  if (!schema?.blocks) return ids
  for (const block of schema.blocks) {
    if (block.required && block.id) ids.add(block.id)
    if (block.placeholder_blocks) {
      for (const child of block.placeholder_blocks) {
        if (child.required && child.id) ids.add(child.id)
      }
    }
  }
  return ids
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface EditorState {
  protocolId: string | null
  blocks: ProtocolBlock[]
  savedBlocks: ProtocolBlock[]
  isDirty: boolean
  selectedBlockId: string | null
  requiredBlockIds: Set<string>

  initEditor: (protocolId: string, blocks: ProtocolBlock[], requiredBlockIds: Set<string>) => void
  selectBlock: (id: string | null) => void
  updateBlock: (id: string, updater: (b: ProtocolBlock) => ProtocolBlock) => void
  deleteBlock: (id: string) => void
  insertBlock: (block: ProtocolBlock, afterId?: string | null) => void
  appendToSection: (sectionId: string, block: ProtocolBlock) => void
  moveBlock: (id: string, dir: 'up' | 'down') => void
  duplicateBlock: (id: string) => void
  markSaved: () => void
  resetEditor: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  protocolId: null,
  blocks: [],
  savedBlocks: [],
  isDirty: false,
  selectedBlockId: null,
  requiredBlockIds: new Set(),

  initEditor: (protocolId, blocks, requiredBlockIds) =>
    set({
      protocolId,
      blocks,
      savedBlocks: blocks,
      isDirty: false,
      selectedBlockId: null,
      requiredBlockIds,
    }),

  selectBlock: (id) => set({ selectedBlockId: id }),

  updateBlock: (id, updater) =>
    set((s) => {
      const next = updateBlockById(s.blocks, id, updater)
      return { blocks: next, isDirty: !blocksEqual(next, s.savedBlocks) }
    }),

  deleteBlock: (id) =>
    set((s) => {
      const next = deleteBlockById(s.blocks, id)
      const selectedBlockId = s.selectedBlockId === id ? null : s.selectedBlockId
      return { blocks: next, isDirty: !blocksEqual(next, s.savedBlocks), selectedBlockId }
    }),

  insertBlock: (block, afterId = null) =>
    set((s) => {
      const next = insertBlockAfter(s.blocks, afterId ?? null, block)
      return { blocks: next, isDirty: !blocksEqual(next, s.savedBlocks), selectedBlockId: block.id }
    }),

  appendToSection: (sectionId, block) =>
    set((s) => {
      const next = s.blocks.map((b) => {
        if (b.type === 'section' && b.id === sectionId) {
          return { ...b, blocks: [...b.blocks, block] }
        }
        return b
      })
      return { blocks: next, isDirty: !blocksEqual(next, s.savedBlocks), selectedBlockId: block.id }
    }),

  moveBlock: (id, dir) =>
    set((s) => {
      const next = moveBlockById(s.blocks, id, dir)
      return { blocks: next, isDirty: !blocksEqual(next, s.savedBlocks) }
    }),

  duplicateBlock: (id) =>
    set((s) => {
      const cloneBlock = (block: ProtocolBlock): ProtocolBlock => {
        const prefix = block.type === 'section' ? 'sec' : 'blk'
        const newId = `${prefix}_${crypto.randomUUID().slice(0, 8)}`
        if (block.type === 'section') {
          return { ...block, id: newId, blocks: block.blocks.map(cloneBlock) }
        }
        return { ...block, id: newId }
      }
      const findAndClone = (blocks: ProtocolBlock[]): ProtocolBlock[] => {
        const idx = blocks.findIndex((b) => b.id === id)
        if (idx !== -1) {
          const clone = cloneBlock(blocks[idx]!)
          const next = [...blocks]
          next.splice(idx + 1, 0, clone)
          return next
        }
        return blocks.map((block) => {
          if (block.type === 'section') {
            return { ...block, blocks: findAndClone(block.blocks) }
          }
          return block
        })
      }
      const next = findAndClone(s.blocks)
      return { blocks: next, isDirty: !blocksEqual(next, s.savedBlocks) }
    }),

  markSaved: () => set((s) => ({ savedBlocks: s.blocks, isDirty: false })),

  resetEditor: () =>
    set({
      protocolId: null,
      blocks: [],
      savedBlocks: [],
      isDirty: false,
      selectedBlockId: null,
      requiredBlockIds: new Set(),
    }),
}))

// ── Local autosave ─────────────────────────────────────────────────────────────

const AUTOSAVE_PREFIX = 'protocol-draft-'

export function saveLocalDraft(protocolId: string, blocks: ProtocolBlock[]): void {
  try {
    localStorage.setItem(
      `${AUTOSAVE_PREFIX}${protocolId}`,
      JSON.stringify({ blocks, savedAt: Date.now() }),
    )
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function loadLocalDraft(
  protocolId: string,
): { blocks: ProtocolBlock[]; savedAt: number } | null {
  try {
    const raw = localStorage.getItem(`${AUTOSAVE_PREFIX}${protocolId}`)
    if (!raw) return null
    return JSON.parse(raw) as { blocks: ProtocolBlock[]; savedAt: number }
  } catch {
    return null
  }
}

export function clearLocalDraft(protocolId: string): void {
  localStorage.removeItem(`${AUTOSAVE_PREFIX}${protocolId}`)
}
