import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VitalsBlockEditor } from '@/components/protocols/VitalsBlockEditor'
import { useEditorStore } from '@/store/editor.store'
import { blockEditorStrings } from '@/components/protocols/strings'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

type VitalsBlock = Extract<ProtocolBlock, { type: 'vitals' }>

function makeBlock(overrides: Partial<VitalsBlock> = {}): VitalsBlock {
  return {
    id: 'blk-vitals',
    type: 'vitals',
    fields: [
      { id: 'f1', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
      { id: 'f2', label: 'IMC', unit: 'kg/m²', input_type: 'computed', formula: 'weight/height^2' },
    ],
    ...overrides,
  }
}

function initStore(block: ProtocolBlock): void {
  useEditorStore.getState().initEditor('protocol-1', [block], new Set())
}

describe('VitalsBlockEditor', () => {
  afterEach(() => {
    useEditorStore.getState().resetEditor()
  })

  it('renders one row per field', () => {
    const block = makeBlock()
    initStore(block)

    render(<VitalsBlockEditor id={block.id} title={block.title} fields={block.fields} />)

    expect(screen.getByDisplayValue('Presión arterial')).toBeInTheDocument()
    expect(screen.getByDisplayValue('IMC')).toBeInTheDocument()
  })

  it('hides the remove control on computed fields but shows it on editable ones', () => {
    const block = makeBlock()
    initStore(block)

    render(<VitalsBlockEditor id={block.id} title={block.title} fields={block.fields} />)

    expect(
      screen.queryByRole('button', { name: blockEditorStrings.vitalsRemoveField('IMC') }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: blockEditorStrings.vitalsRemoveField('Presión arterial') }),
    ).toBeInTheDocument()
  })

  it('does not render an input_type selector for computed fields', () => {
    const block = makeBlock()
    initStore(block)

    render(<VitalsBlockEditor id={block.id} title={block.title} fields={block.fields} />)

    expect(screen.getByText(blockEditorStrings.vitalsTypeComputed)).toBeInTheDocument()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })

  it('adds a field with input_type "number" and a generated id, appended on Aplicar', async () => {
    const user = userEvent.setup()
    const block = makeBlock()
    initStore(block)

    render(<VitalsBlockEditor id={block.id} title={block.title} fields={block.fields} />)

    await user.click(screen.getByRole('button', { name: blockEditorStrings.vitalsAddField }))
    await user.click(screen.getByRole('button', { name: blockEditorStrings.blockApply }))

    const updated = useEditorStore.getState().blocks[0] as VitalsBlock
    expect(updated.fields).toHaveLength(3)
    const added = updated.fields[2]!
    expect(added.input_type).toBe('number')
    expect(added.id).toMatch(/^vtl_/)
    expect(added.label).toBe('')
  })

  it('commits title and label edits on Aplicar, preserving the computed field formula', async () => {
    const user = userEvent.setup()
    const block = makeBlock()
    initStore(block)

    render(<VitalsBlockEditor id={block.id} title={block.title} fields={block.fields} />)

    const titleInput = screen.getByDisplayValue('')
    await user.type(titleInput, 'Signos de ingreso')

    const paInput = screen.getByDisplayValue('Presión arterial')
    await user.clear(paInput)
    await user.type(paInput, 'Presión sistólica')

    await user.click(screen.getByRole('button', { name: blockEditorStrings.blockApply }))

    const updated = useEditorStore.getState().blocks[0] as VitalsBlock
    expect(updated.title).toBe('Signos de ingreso')
    expect(updated.fields[0]!.label).toBe('Presión sistólica')
    expect(updated.fields[1]!.formula).toBe('weight/height^2')
    expect(updated.fields[1]!.input_type).toBe('computed')
    expect(useEditorStore.getState().selectedBlockId).toBeNull()
  })

  it('Cancelar discards draft changes without committing', async () => {
    const user = userEvent.setup()
    const block = makeBlock()
    initStore(block)
    useEditorStore.getState().selectBlock(block.id)

    render(<VitalsBlockEditor id={block.id} title={block.title} fields={block.fields} />)

    await user.click(screen.getByRole('button', { name: blockEditorStrings.vitalsAddField }))
    await user.click(screen.getByRole('button', { name: blockEditorStrings.blockCancel }))

    const stored = useEditorStore.getState().blocks[0] as VitalsBlock
    expect(stored.fields).toHaveLength(2)
    expect(useEditorStore.getState().selectedBlockId).toBeNull()
  })
})
