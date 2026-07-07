import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EditorBlockRenderer } from '@/components/protocols/EditorBlockRenderer'
import { BlockRenderer } from '@/components/protocols/BlockRenderer'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'
import { useEditorStore } from '@/store/editor.store'
import { blockTypeStrings } from '@/components/protocols/strings'

/**
 * Regression coverage for the "double header" bug found in the E2E
 * consultation-flow pass: an unselected leaf card in the protocol editor
 * rendered TWO stacked headers — the outer one from EditorBlockRenderer and a
 * second one from BlockRenderer's ProtocolBlock chrome. For vitals /
 * clinical_notes this also surfaced generic "Bloque" labels because the
 * outer type-label maps didn't know those types.
 *
 * These tests assert:
 *  (a) the outer editor-card header shows the correct typed chip (never the
 *      generic fallback) for vitals and clinical_notes blocks;
 *  (b) a dosage_table editor card renders its title and type chip exactly
 *      once each — i.e. the inner ProtocolBlock chrome is gone;
 *  (c) BlockRenderer itself, given `chromeless`, renders leaf content with no
 *      ProtocolBlock header at all.
 */

function initStore(block: ProtocolBlock): void {
  useEditorStore.getState().initEditor('protocol-1', [block], new Set())
}

function vitalsBlock(): ProtocolBlock {
  return {
    id: 'blk-vitals',
    type: 'vitals',
    fields: [{ id: 'temp', label: 'Temperatura', unit: '°C', input_type: 'number' }],
  } as ProtocolBlock
}

function clinicalNotesBlock(): ProtocolBlock {
  return {
    id: 'blk-notes',
    type: 'clinical_notes',
    label: 'Evolución',
    content: '',
    required: false,
  } as ProtocolBlock
}

function dosageBlock(): ProtocolBlock {
  return {
    id: 'blk-dosage',
    type: 'dosage_table',
    title: 'Antihipertensivos',
    rows: [
      { id: 'row-1', drug: 'Losartán', dose: '50mg', route: 'oral', frequency: 'c/24h', notes: '' },
    ],
  } as ProtocolBlock
}

describe('EditorBlockRenderer — single typed header per unselected leaf card', () => {
  afterEach(() => {
    useEditorStore.getState().resetEditor()
  })

  it('shows the "Signos vitales" chip for a vitals block, never the generic fallback', () => {
    const block = vitalsBlock()
    initStore(block)
    render(<EditorBlockRenderer block={block} />)

    expect(screen.getAllByText(blockTypeStrings.vitals).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(blockTypeStrings.unknown)).not.toBeInTheDocument()
  })

  it('shows "Nota clínica" chip and the block label as title for a clinical_notes block', () => {
    const block = clinicalNotesBlock()
    initStore(block)
    render(<EditorBlockRenderer block={block} />)

    expect(screen.getByText(blockTypeStrings.clinicalNotes)).toBeInTheDocument()
    // The card title equals the block's label (the leaf's own field label, from
    // ClinicalNotesBlock, legitimately mirrors it in the body — that is not the
    // "stacked header" bug this task fixes).
    expect(screen.getAllByText('Evolución').length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText(blockTypeStrings.unknown)).not.toBeInTheDocument()
  })

  it('renders a dosage_table title and type chip exactly once (no duplicated inner chrome)', () => {
    const block = dosageBlock()
    initStore(block)
    render(<EditorBlockRenderer block={block} />)

    expect(screen.getAllByText('Antihipertensivos')).toHaveLength(1)
    expect(screen.getAllByText(blockTypeStrings.dosageTable)).toHaveLength(1)
  })
})

describe('BlockRenderer — chromeless', () => {
  it('renders dosage rows without the ProtocolBlock header', () => {
    const block = dosageBlock()
    render(<BlockRenderer block={block} chromeless />)

    // No ProtocolBlock chrome: neither the type chip nor the block title
    // (rendered only by the outer editor card in the real flow) appear here.
    expect(screen.queryByText(blockTypeStrings.dosageTable)).not.toBeInTheDocument()
    expect(screen.queryByText('Antihipertensivos')).not.toBeInTheDocument()
    // The row content itself is still rendered.
    expect(screen.getByText('Losartán')).toBeInTheDocument()
  })
})
