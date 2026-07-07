import { describe, it, expect } from 'vitest'
import { applyContentEdits } from '../content-edits'
import type { ProtocolBlock } from '@rezeta/shared'

const vitalsBlock: ProtocolBlock = {
  id: 'vit-1',
  type: 'vitals',
  fields: [{ id: 'temp', label: 'Temperatura', input_type: 'number' }],
  values: { temp: 36.5 },
}

const notesBlock: ProtocolBlock = {
  id: 'notes-1',
  type: 'clinical_notes',
  label: 'Notas',
  content: 'original text',
}

const checklistBlock: ProtocolBlock = {
  id: 'chk-1',
  type: 'checklist',
  items: [{ id: 'itm-1', text: 'Item 1' }],
}

describe('applyContentEdits', () => {
  it('applies a vitals edit into the matching block values', () => {
    const result = applyContentEdits([vitalsBlock], {
      'vit-1': { kind: 'vitals', values: { temp: 38.2 } },
    })
    expect(result[0]).toEqual({ ...vitalsBlock, values: { temp: 38.2 } })
  })

  it('applies a notes edit into the matching block content', () => {
    const result = applyContentEdits([notesBlock], {
      'notes-1': { kind: 'notes', content: 'updated text' },
    })
    expect(result[0]).toEqual({ ...notesBlock, content: 'updated text' })
  })

  it('recurses into nested section blocks', () => {
    const nested: ProtocolBlock = {
      id: 'sec-outer',
      type: 'section',
      title: 'Outer',
      blocks: [
        {
          id: 'sec-inner',
          type: 'section',
          title: 'Inner',
          blocks: [vitalsBlock, notesBlock],
        },
      ],
    }

    const result = applyContentEdits([nested], {
      'vit-1': { kind: 'vitals', values: { temp: 39 } },
      'notes-1': { kind: 'notes', content: 'deep edit' },
    })

    expect(result[0]!.type).toBe('section')
    const outer = result[0] as Extract<ProtocolBlock, { type: 'section' }>
    const inner = outer.blocks[0] as Extract<ProtocolBlock, { type: 'section' }>
    const editedVitals = inner.blocks[0] as Extract<ProtocolBlock, { type: 'vitals' }>
    const editedNotes = inner.blocks[1] as Extract<ProtocolBlock, { type: 'clinical_notes' }>
    expect(editedVitals.values).toEqual({ temp: 39 })
    expect(editedNotes.content).toBe('deep edit')
  })

  it('passes through blocks with no matching edit unchanged (same reference)', () => {
    const result = applyContentEdits([vitalsBlock, checklistBlock], {})
    expect(result[0]).toBe(vitalsBlock)
    expect(result[1]).toBe(checklistBlock)
  })

  it('returns an untouched nested section by the same reference (no clone) when no edit targets it', () => {
    const nested: ProtocolBlock = {
      id: 'sec-outer',
      type: 'section',
      title: 'Outer',
      blocks: [
        {
          id: 'sec-inner',
          type: 'section',
          title: 'Inner',
          blocks: [vitalsBlock, notesBlock],
        },
      ],
    }

    const result = applyContentEdits([nested], {})

    expect(result[0]).toBe(nested)
  })

  it('clones only the section(s) on the path to an edit, leaving sibling sections referentially unchanged', () => {
    const untouchedInner: ProtocolBlock = {
      id: 'sec-untouched',
      type: 'section',
      title: 'Untouched',
      blocks: [vitalsBlock],
    }
    const editedInner: ProtocolBlock = {
      id: 'sec-edited',
      type: 'section',
      title: 'Edited',
      blocks: [notesBlock],
    }
    const outer: ProtocolBlock = {
      id: 'sec-outer',
      type: 'section',
      title: 'Outer',
      blocks: [untouchedInner, editedInner],
    }

    const result = applyContentEdits([outer], {
      'notes-1': { kind: 'notes', content: 'changed' },
    })

    expect(result[0]).not.toBe(outer)
    const resultOuter = result[0] as Extract<ProtocolBlock, { type: 'section' }>
    expect(resultOuter.blocks[0]).toBe(untouchedInner)
    expect(resultOuter.blocks[1]).not.toBe(editedInner)
  })

  it('ignores an edit whose kind does not match the target block type', () => {
    const result = applyContentEdits([checklistBlock], {
      'chk-1': { kind: 'vitals', values: { temp: 1 } },
    })
    expect(result[0]).toBe(checklistBlock)
  })

  it('ignores a notes edit targeting a non clinical_notes block', () => {
    const result = applyContentEdits([vitalsBlock], {
      'vit-1': { kind: 'notes', content: 'nope' },
    })
    expect(result[0]).toBe(vitalsBlock)
  })

  it('returns an empty array for an empty block list', () => {
    expect(applyContentEdits([], { anything: { kind: 'notes', content: 'x' } })).toEqual([])
  })
})
