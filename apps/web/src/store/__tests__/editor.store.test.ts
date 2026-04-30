import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useEditorStore,
  extractRequiredBlockIds,
  saveLocalDraft,
  loadLocalDraft,
  clearLocalDraft,
} from '@/store/editor.store'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

const makeTextBlock = (id: string, content = 'Hello'): ProtocolBlock => ({
  id,
  type: 'text',
  content,
})

const makeSectionBlock = (id: string, children: ProtocolBlock[] = []): ProtocolBlock => ({
  id,
  type: 'section',
  title: `Section ${id}`,
  blocks: children,
  collapsible: false,
  defaultCollapsed: false,
})

describe('useEditorStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useEditorStore())
    act(() => result.current.resetEditor())
  })

  describe('initEditor', () => {
    it('sets protocolId, blocks, and clears dirty flag', () => {
      const { result } = renderHook(() => useEditorStore())
      const blocks = [makeTextBlock('b1')]
      act(() => result.current.initEditor('p-1', blocks, new Set(['b1'])))
      expect(result.current.protocolId).toBe('p-1')
      expect(result.current.blocks).toHaveLength(1)
      expect(result.current.isDirty).toBe(false)
      expect(result.current.requiredBlockIds.has('b1')).toBe(true)
    })
  })

  describe('selectBlock', () => {
    it('sets selectedBlockId', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.selectBlock('b1'))
      expect(result.current.selectedBlockId).toBe('b1')
    })

    it('can clear selection with null', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.selectBlock('b1'))
      act(() => result.current.selectBlock(null))
      expect(result.current.selectedBlockId).toBeNull()
    })
  })

  describe('insertBlock', () => {
    it('appends block when no afterId', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeTextBlock('b1')], new Set()))
      act(() => result.current.insertBlock(makeTextBlock('b2')))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b1', 'b2'])
    })

    it('inserts after specified block', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor('p-1', [makeTextBlock('b1'), makeTextBlock('b3')], new Set()),
      )
      act(() => result.current.insertBlock(makeTextBlock('b2'), 'b1'))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    })

    it('marks isDirty after insert', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [], new Set()))
      act(() => result.current.insertBlock(makeTextBlock('b1')))
      expect(result.current.isDirty).toBe(true)
    })

    it('selects the inserted block', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [], new Set()))
      act(() => result.current.insertBlock(makeTextBlock('new-block')))
      expect(result.current.selectedBlockId).toBe('new-block')
    })
  })

  describe('updateBlock', () => {
    it('updates a top-level block', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeTextBlock('b1', 'old')], new Set()))
      act(() =>
        result.current.updateBlock('b1', (b) => ({ ...b, content: 'new' }) as ProtocolBlock),
      )
      const block = result.current.blocks.find((b) => b.id === 'b1') as { content: string }
      expect(block.content).toBe('new')
    })

    it('marks isDirty when content changes', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeTextBlock('b1')], new Set()))
      act(() =>
        result.current.updateBlock('b1', (b) => ({ ...b, content: 'changed' }) as ProtocolBlock),
      )
      expect(result.current.isDirty).toBe(true)
    })

    it('updates a nested block inside a section', () => {
      const { result } = renderHook(() => useEditorStore())
      const section = makeSectionBlock('sec1', [makeTextBlock('child1', 'original')])
      act(() => result.current.initEditor('p-1', [section], new Set()))
      act(() =>
        result.current.updateBlock(
          'child1',
          (b) => ({ ...b, content: 'updated' }) as ProtocolBlock,
        ),
      )
      const sec = result.current.blocks[0] as { blocks: Array<{ content: string }> }
      expect(sec.blocks[0]?.content).toBe('updated')
    })
  })

  describe('deleteBlock', () => {
    it('removes a block by id', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor('p-1', [makeTextBlock('b1'), makeTextBlock('b2')], new Set()),
      )
      act(() => result.current.deleteBlock('b1'))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b2'])
    })

    it('clears selectedBlockId when selected block is deleted', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeTextBlock('b1')], new Set()))
      act(() => result.current.selectBlock('b1'))
      act(() => result.current.deleteBlock('b1'))
      expect(result.current.selectedBlockId).toBeNull()
    })
  })

  describe('moveBlock', () => {
    it('moves block up', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor(
          'p-1',
          [makeTextBlock('b1'), makeTextBlock('b2'), makeTextBlock('b3')],
          new Set(),
        ),
      )
      act(() => result.current.moveBlock('b2', 'up'))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b2', 'b1', 'b3'])
    })

    it('moves block down', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor(
          'p-1',
          [makeTextBlock('b1'), makeTextBlock('b2'), makeTextBlock('b3')],
          new Set(),
        ),
      )
      act(() => result.current.moveBlock('b1', 'down'))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b2', 'b1', 'b3'])
    })

    it('does not move first block further up', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor('p-1', [makeTextBlock('b1'), makeTextBlock('b2')], new Set()),
      )
      act(() => result.current.moveBlock('b1', 'up'))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b1', 'b2'])
    })
  })

  describe('markSaved', () => {
    it('clears isDirty and saves current blocks as savedBlocks', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [], new Set()))
      act(() => result.current.insertBlock(makeTextBlock('b1')))
      expect(result.current.isDirty).toBe(true)
      act(() => result.current.markSaved())
      expect(result.current.isDirty).toBe(false)
    })
  })

  describe('appendToSection', () => {
    it('appends block to the correct section', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeSectionBlock('sec1')], new Set()))
      act(() => result.current.appendToSection('sec1', makeTextBlock('child1')))
      const sec = result.current.blocks[0] as { blocks: ProtocolBlock[] }
      expect(sec.blocks).toHaveLength(1)
      expect(sec.blocks[0]?.id).toBe('child1')
    })

    it('marks isDirty after appendToSection', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeSectionBlock('sec1')], new Set()))
      act(() => result.current.appendToSection('sec1', makeTextBlock('child1')))
      expect(result.current.isDirty).toBe(true)
    })
  })

  describe('duplicateBlock', () => {
    it('duplicates a top-level block and inserts it after', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor('p-1', [makeTextBlock('b1'), makeTextBlock('b2')], new Set()),
      )
      act(() => result.current.duplicateBlock('b1'))
      expect(result.current.blocks).toHaveLength(3)
      expect(result.current.blocks[0]?.id).toBe('b1')
      expect(result.current.blocks[2]?.id).toBe('b2')
    })

    it('gives the duplicate a new unique id', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeTextBlock('b1')], new Set()))
      act(() => result.current.duplicateBlock('b1'))
      const ids = result.current.blocks.map((b) => b.id)
      expect(ids[0]).toBe('b1')
      expect(ids[1]).not.toBe('b1')
      expect(ids[1]).toMatch(/^blk_/)
    })

    it('marks isDirty after duplicate', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() => result.current.initEditor('p-1', [makeTextBlock('b1')], new Set()))
      act(() => result.current.duplicateBlock('b1'))
      expect(result.current.isDirty).toBe(true)
    })

    it('duplicates a section with its children', () => {
      const { result } = renderHook(() => useEditorStore())
      const section = makeSectionBlock('sec1', [makeTextBlock('child1')])
      act(() => result.current.initEditor('p-1', [section], new Set()))
      act(() => result.current.duplicateBlock('sec1'))
      expect(result.current.blocks).toHaveLength(2)
      const clone = result.current.blocks[1] as { id: string; blocks: ProtocolBlock[] }
      expect(clone.id).toMatch(/^sec_/)
      expect(clone.blocks).toHaveLength(1)
      expect(clone.blocks[0]?.id).not.toBe('child1')
    })

    it('duplicates a nested block inside a section', () => {
      const { result } = renderHook(() => useEditorStore())
      const section = makeSectionBlock('sec1', [makeTextBlock('child1'), makeTextBlock('child2')])
      act(() => result.current.initEditor('p-1', [section], new Set()))
      act(() => result.current.duplicateBlock('child1'))
      const sec = result.current.blocks[0] as { blocks: ProtocolBlock[] }
      expect(sec.blocks).toHaveLength(3)
      expect(sec.blocks[0]?.id).toBe('child1')
      expect(sec.blocks[2]?.id).toBe('child2')
    })
  })

  describe('insertBlock nested inside section', () => {
    it('inserts after a block inside a section', () => {
      const { result } = renderHook(() => useEditorStore())
      const section = makeSectionBlock('sec1', [makeTextBlock('child1'), makeTextBlock('child3')])
      act(() => result.current.initEditor('p-1', [section], new Set()))
      act(() => result.current.insertBlock(makeTextBlock('child2'), 'child1'))
      const sec = result.current.blocks[0] as { blocks: ProtocolBlock[] }
      expect(sec.blocks.map((b) => b.id)).toEqual(['child1', 'child2', 'child3'])
    })
  })

  describe('deleteBlock nested inside section', () => {
    it('removes a block inside a section', () => {
      const { result } = renderHook(() => useEditorStore())
      const section = makeSectionBlock('sec1', [makeTextBlock('child1'), makeTextBlock('child2')])
      act(() => result.current.initEditor('p-1', [section], new Set()))
      act(() => result.current.deleteBlock('child1'))
      const sec = result.current.blocks[0] as { blocks: ProtocolBlock[] }
      expect(sec.blocks.map((b) => b.id)).toEqual(['child2'])
    })
  })

  describe('moveBlock nested inside section', () => {
    it('moves a block up inside a section', () => {
      const { result } = renderHook(() => useEditorStore())
      const section = makeSectionBlock('sec1', [makeTextBlock('a'), makeTextBlock('b')])
      act(() => result.current.initEditor('p-1', [section], new Set()))
      act(() => result.current.moveBlock('b', 'up'))
      const sec = result.current.blocks[0] as { blocks: ProtocolBlock[] }
      expect(sec.blocks.map((b) => b.id)).toEqual(['b', 'a'])
    })

    it('does not move last block further down', () => {
      const { result } = renderHook(() => useEditorStore())
      act(() =>
        result.current.initEditor('p-1', [makeTextBlock('b1'), makeTextBlock('b2')], new Set()),
      )
      act(() => result.current.moveBlock('b2', 'down'))
      expect(result.current.blocks.map((b) => b.id)).toEqual(['b1', 'b2'])
    })
  })
})

describe('extractRequiredBlockIds', () => {
  it('returns empty set for no blocks', () => {
    expect(extractRequiredBlockIds({ blocks: [] }).size).toBe(0)
  })

  it('extracts required block ids', () => {
    const schema = {
      blocks: [
        { id: 'b1', required: true },
        { id: 'b2', required: false },
        { id: 'b3', required: true },
      ],
    }
    const ids = extractRequiredBlockIds(schema)
    expect(ids.has('b1')).toBe(true)
    expect(ids.has('b2')).toBe(false)
    expect(ids.has('b3')).toBe(true)
  })

  it('extracts required ids from placeholder_blocks inside sections', () => {
    const schema = {
      blocks: [
        {
          id: 'sec',
          required: false,
          placeholder_blocks: [{ id: 'child1', required: true }],
        },
      ],
    }
    const ids = extractRequiredBlockIds(schema)
    expect(ids.has('child1')).toBe(true)
  })

  it('handles null/undefined gracefully', () => {
    expect(extractRequiredBlockIds(null).size).toBe(0)
    expect(extractRequiredBlockIds({}).size).toBe(0)
  })
})

describe('Local draft helpers', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and loads a draft', () => {
    const blocks = [makeTextBlock('b1')]
    saveLocalDraft('protocol-1', blocks)
    const loaded = loadLocalDraft('protocol-1')
    expect(loaded).not.toBeNull()
    expect(loaded?.blocks).toHaveLength(1)
    expect(loaded?.savedAt).toBeTypeOf('number')
  })

  it('returns null when no draft exists', () => {
    expect(loadLocalDraft('nonexistent')).toBeNull()
  })

  it('clears a draft', () => {
    saveLocalDraft('protocol-1', [])
    clearLocalDraft('protocol-1')
    expect(loadLocalDraft('protocol-1')).toBeNull()
  })
})
