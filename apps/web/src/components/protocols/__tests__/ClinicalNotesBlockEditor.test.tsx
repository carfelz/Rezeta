import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ClinicalNotesBlockEditor } from '@/components/protocols/ClinicalNotesBlockEditor'
import { useEditorStore } from '@/store/editor.store'
import { blockEditorStrings } from '@/components/protocols/strings'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

type ClinicalNotesBlock = Extract<ProtocolBlock, { type: 'clinical_notes' }>

function makeBlock(overrides: Partial<ClinicalNotesBlock> = {}): ClinicalNotesBlock {
  return {
    id: 'blk-notes',
    type: 'clinical_notes',
    label: 'Nota clínica',
    content: 'contenido existente',
    required: false,
    ...overrides,
  }
}

function initStore(block: ProtocolBlock): void {
  useEditorStore.getState().initEditor('protocol-1', [block], new Set())
}

describe('ClinicalNotesBlockEditor', () => {
  afterEach(() => {
    useEditorStore.getState().resetEditor()
  })

  it('renders the current label', () => {
    const block = makeBlock({ label: 'Motivo de consulta' })
    initStore(block)

    render(<ClinicalNotesBlockEditor id={block.id} label={block.label} required={block.required} />)

    expect(screen.getByDisplayValue('Motivo de consulta')).toBeInTheDocument()
  })

  it('renders the required checkbox reflecting current state', () => {
    const block = makeBlock({ required: true })
    initStore(block)

    render(<ClinicalNotesBlockEditor id={block.id} label={block.label} required={block.required} />)

    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('Aplicar commits the edited label and required flag, preserving content', async () => {
    const user = userEvent.setup()
    const block = makeBlock({ label: 'Nota clínica', required: false, content: 'contenido existente' })
    initStore(block)

    render(<ClinicalNotesBlockEditor id={block.id} label={block.label} required={block.required} />)

    const input = screen.getByDisplayValue('Nota clínica')
    await user.clear(input)
    await user.type(input, 'Motivo de consulta')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: blockEditorStrings.blockApply }))

    const updated = useEditorStore.getState().blocks[0] as ClinicalNotesBlock
    expect(updated.label).toBe('Motivo de consulta')
    expect(updated.required).toBe(true)
    expect(updated.content).toBe('contenido existente')
    expect(useEditorStore.getState().selectedBlockId).toBeNull()
  })

  it('falls back to the default label when the edited label is blank', async () => {
    const user = userEvent.setup()
    const block = makeBlock({ label: 'Motivo de consulta' })
    initStore(block)

    render(<ClinicalNotesBlockEditor id={block.id} label={block.label} required={block.required} />)

    const input = screen.getByDisplayValue('Motivo de consulta')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: blockEditorStrings.blockApply }))

    const updated = useEditorStore.getState().blocks[0] as ClinicalNotesBlock
    expect(updated.label).toBe('Nota clínica')
  })

  it('Cancelar discards changes and only clears the selection', async () => {
    const user = userEvent.setup()
    const block = makeBlock({ label: 'Nota clínica' })
    initStore(block)
    useEditorStore.getState().selectBlock(block.id)

    render(<ClinicalNotesBlockEditor id={block.id} label={block.label} required={block.required} />)

    const input = screen.getByDisplayValue('Nota clínica')
    await user.clear(input)
    await user.type(input, 'Cambiado')
    await user.click(screen.getByRole('button', { name: blockEditorStrings.blockCancel }))

    const stored = useEditorStore.getState().blocks[0] as ClinicalNotesBlock
    expect(stored.label).toBe('Nota clínica')
    expect(useEditorStore.getState().selectedBlockId).toBeNull()
  })
})
