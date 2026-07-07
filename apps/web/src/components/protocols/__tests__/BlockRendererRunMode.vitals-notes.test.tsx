import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BlockRendererRunMode, type RunModeProps } from '../BlockRendererRunMode'

/**
 * Covers the `vitals` and `clinical_notes` run-mode render cases. Neighboring
 * component tests in this directory (e.g. TemplatePickerModal.test.tsx) use a
 * plain RTL `render` with no extra providers — BlockRendererRunMode needs
 * none either, so this harness is minimal: build a block + runMode props and
 * render directly.
 */

type VitalsRuntimeBlock = {
  id: string
  type: 'vitals'
  title?: string
  fields: Array<{
    id: string
    label: string
    unit?: string
    input_type: 'text' | 'number' | 'computed'
    formula?: string
  }>
  values?: Record<string, string | number>
}

type NotesRuntimeBlock = {
  id: string
  type: 'clinical_notes'
  label: string
  content: string
  required?: boolean
}

function baseRunMode(overrides: Partial<RunModeProps> = {}): RunModeProps {
  return {
    checkedState: {},
    onCheck: vi.fn(),
    ...overrides,
  }
}

function vitalsBlock(overrides: Partial<VitalsRuntimeBlock> = {}): VitalsRuntimeBlock {
  return {
    id: 'vitals-1',
    type: 'vitals',
    fields: [
      { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
      { id: 'height', label: 'Talla', unit: 'cm', input_type: 'number' },
      { id: 'bmi', label: 'IMC', input_type: 'computed' },
    ],
    values: {},
    ...overrides,
  }
}

function notesBlock(overrides: Partial<NotesRuntimeBlock> = {}): NotesRuntimeBlock {
  return {
    id: 'notes-1',
    type: 'clinical_notes',
    label: 'Notas clínicas',
    content: '',
    ...overrides,
  }
}

/**
 * VitalsBlock renders each field's `<label>` as a plain sibling of its
 * `<input>` (no `htmlFor`/`id` association), so `getByLabelText` can't find
 * them. Number-type fields get the `spinbutton` role; querying by that role
 * and indexing by declaration order (weight = index 0, height = index 1 in
 * every fixture used here) is the stable way to target a specific field.
 */
function getNumberInput(index: number): HTMLElement {
  return screen.getAllByRole('spinbutton')[index]!
}

describe('BlockRendererRunMode — vitals', () => {
  it('propagates a merged values object via onContentEdit on field input', () => {
    const onContentEdit = vi.fn()
    const block = vitalsBlock({ values: { weight: '70' } })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onContentEdit })} />)

    fireEvent.change(getNumberInput(1), { target: { value: '175' } })

    expect(onContentEdit).toHaveBeenCalledTimes(1)
    expect(onContentEdit).toHaveBeenCalledWith('vitals-1', {
      kind: 'vitals',
      // weight (unchanged) is preserved, height is the new value, bmi derives
      values: { weight: '70', height: '175', bmi: '22.9' },
    })
  })

  it('derives BMI only when weight and height are both numeric', () => {
    const onContentEdit = vi.fn()
    const block = vitalsBlock({ values: { weight: '80' } })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onContentEdit })} />)

    fireEvent.change(getNumberInput(1), { target: { value: '160' } })

    expect(onContentEdit).toHaveBeenCalledWith('vitals-1', {
      kind: 'vitals',
      values: { weight: '80', height: '160', bmi: '31.2' },
    })
  })

  it('clears/omits bmi when weight or height is not numeric', () => {
    const onContentEdit = vi.fn()
    // bmi already present in current values from a previous computation;
    // clearing height should drop it again.
    const block = vitalsBlock({ values: { weight: '70', height: '175', bmi: '22.9' } })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onContentEdit })} />)

    fireEvent.change(getNumberInput(1), { target: { value: '' } })

    expect(onContentEdit).toHaveBeenCalledWith('vitals-1', {
      kind: 'vitals',
      values: { weight: '70', height: '' },
    })
  })

  it('renders a computed non-bmi field as read-only, showing its current value', () => {
    const block = vitalsBlock({
      fields: [
        { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
        { id: 'map', label: 'PAM', input_type: 'computed' },
      ],
      values: { weight: '70', map: '93' },
    })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode()} />)

    expect(screen.getByText('93')).toBeInTheDocument()
    // A computed field renders as a read-only div, not an input — only the
    // one editable (weight) spinbutton should exist.
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
  })

  it('emits exactly one vitals_entered modification per editing burst, on blur', () => {
    const onModification = vi.fn()
    const onContentEdit = vi.fn()
    const block = vitalsBlock({ values: { weight: '70' } })
    render(
      <BlockRendererRunMode
        block={block}
        runMode={baseRunMode({ onModification, onContentEdit })}
      />,
    )

    const heightInput = getNumberInput(1)
    // Simulate an editing burst: several keystrokes (each a change event)
    // before the field loses focus.
    fireEvent.change(heightInput, { target: { value: '1' } })
    fireEvent.change(heightInput, { target: { value: '17' } })
    fireEvent.change(heightInput, { target: { value: '175' } })

    expect(onModification).not.toHaveBeenCalled()

    // React bubbles focus/blur, so a wrapper `onBlur` on the block's
    // container captures the field's blur without VitalsBlock needing to
    // expose its own onBlur prop.
    fireEvent.blur(heightInput)

    expect(onModification).toHaveBeenCalledTimes(1)
    expect(onModification).toHaveBeenCalledWith({
      type: 'vitals_entered',
      block_id: 'vitals-1',
      values: { weight: '70', height: '175', bmi: '22.9' },
    })
  })

  it('emits exactly one vitals_entered event when focus moves between fields within the block, carrying both values', () => {
    const onModification = vi.fn()
    const onContentEdit = vi.fn()
    const block = vitalsBlock({ values: {} })
    render(
      <BlockRendererRunMode
        block={block}
        runMode={baseRunMode({ onModification, onContentEdit })}
      />,
    )

    const weightInput = getNumberInput(0)
    const heightInput = getNumberInput(1)

    // Type in weight, then move focus to height (still inside the block) —
    // this must NOT emit yet, since blur/focusout bubbles per field and
    // would otherwise multiply-emit one event per field transition.
    fireEvent.change(weightInput, { target: { value: '70' } })
    fireEvent.blur(weightInput, { relatedTarget: heightInput })

    expect(onModification).not.toHaveBeenCalled()

    // Type in height, then blur out of the block entirely (relatedTarget is
    // outside the wrapper, e.g. null) — this should emit exactly once, with
    // both values merged.
    fireEvent.change(heightInput, { target: { value: '175' } })
    fireEvent.blur(heightInput, { relatedTarget: null })

    expect(onModification).toHaveBeenCalledTimes(1)
    expect(onModification).toHaveBeenCalledWith({
      type: 'vitals_entered',
      block_id: 'vitals-1',
      values: { weight: '70', height: '175', bmi: '22.9' },
    })
  })

  it('disables inputs and fires no callbacks when isSigned', () => {
    const onModification = vi.fn()
    const onContentEdit = vi.fn()
    const block = vitalsBlock({ values: { weight: '70', height: '175' } })
    render(
      <BlockRendererRunMode
        block={block}
        runMode={baseRunMode({ onModification, onContentEdit, isSigned: true })}
      />,
    )

    const weightInput = getNumberInput(0)
    expect(weightInput).toBeDisabled()

    fireEvent.change(weightInput, { target: { value: '99' } })
    fireEvent.blur(weightInput)

    expect(onContentEdit).not.toHaveBeenCalled()
    expect(onModification).not.toHaveBeenCalled()
  })

  it('emits no modification when a field is focused and blurred with no change', () => {
    const onModification = vi.fn()
    const block = vitalsBlock({ values: { weight: '70' } })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onModification })} />)

    const weightInput = getNumberInput(0)
    fireEvent.focus(weightInput)
    fireEvent.blur(weightInput)

    expect(onModification).not.toHaveBeenCalled()
  })

  it('emits exactly once after a change then blur, and emits nothing on a second focus/blur with no further change', () => {
    const onModification = vi.fn()
    const block = vitalsBlock({ values: { weight: '70' } })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onModification })} />)

    const weightInput = getNumberInput(0)
    fireEvent.change(weightInput, { target: { value: '80' } })
    fireEvent.blur(weightInput)
    expect(onModification).toHaveBeenCalledTimes(1)

    fireEvent.focus(weightInput)
    fireEvent.blur(weightInput)
    expect(onModification).toHaveBeenCalledTimes(1)
  })
})

describe('BlockRendererRunMode — clinical_notes', () => {
  it('propagates content via onContentEdit on every change', () => {
    const onContentEdit = vi.fn()
    const block = notesBlock({ content: 'Hola' })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onContentEdit })} />)

    fireEvent.change(screen.getByDisplayValue('Hola'), { target: { value: 'Hola mundo' } })

    expect(onContentEdit).toHaveBeenCalledTimes(1)
    expect(onContentEdit).toHaveBeenCalledWith('notes-1', {
      kind: 'notes',
      content: 'Hola mundo',
    })
  })

  it('emits notes_edited with the final length on blur, not per keystroke', () => {
    const onModification = vi.fn()
    const block = notesBlock({ content: '' })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onModification })} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'a' } })
    fireEvent.change(textarea, { target: { value: 'ab' } })
    fireEvent.change(textarea, { target: { value: 'abc' } })

    expect(onModification).not.toHaveBeenCalled()

    fireEvent.blur(textarea)

    expect(onModification).toHaveBeenCalledTimes(1)
    expect(onModification).toHaveBeenCalledWith({
      type: 'notes_edited',
      block_id: 'notes-1',
      // The blur handler reads from a ref updated directly by onChange (not
      // just synced from the `content` prop), so it reflects the final
      // keystroke of the burst ("abc", length 3) even though this test never
      // re-renders the component with an updated `content` prop — the
      // component must not depend on the parent re-rendering before blur.
      length: 3,
    })
  })

  it('emits notes_edited reflecting a controlled content update at blur time', () => {
    const onModification = vi.fn()
    const block = notesBlock({ content: 'draft' })
    const { rerender } = render(
      <BlockRendererRunMode block={block} runMode={baseRunMode({ onModification })} />,
    )

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'draft note' } })

    // Simulate the parent re-rendering with the newly-propagated content
    // (as it would once onContentEdit updates the buffered usage content).
    rerender(
      <BlockRendererRunMode
        block={notesBlock({ content: 'draft note' })}
        runMode={baseRunMode({ onModification })}
      />,
    )

    fireEvent.blur(screen.getByRole('textbox'))

    expect(onModification).toHaveBeenCalledTimes(1)
    expect(onModification).toHaveBeenCalledWith({
      type: 'notes_edited',
      block_id: 'notes-1',
      length: 'draft note'.length,
    })
  })

  it('disables the textarea and fires no callbacks when isSigned', () => {
    const onModification = vi.fn()
    const onContentEdit = vi.fn()
    const block = notesBlock({ content: 'Fijo' })
    render(
      <BlockRendererRunMode
        block={block}
        runMode={baseRunMode({ onModification, onContentEdit, isSigned: true })}
      />,
    )

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()

    fireEvent.change(textarea, { target: { value: 'Intento de cambio' } })
    fireEvent.blur(textarea)

    expect(onContentEdit).not.toHaveBeenCalled()
    expect(onModification).not.toHaveBeenCalled()
  })

  it('emits no modification when the textarea is focused and blurred with no change', () => {
    const onModification = vi.fn()
    const block = notesBlock({ content: 'Hola' })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onModification })} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.focus(textarea)
    fireEvent.blur(textarea)

    expect(onModification).not.toHaveBeenCalled()
  })

  it('emits exactly once after a change then blur, and emits nothing on a second focus/blur with no further change', () => {
    const onModification = vi.fn()
    const block = notesBlock({ content: '' })
    render(<BlockRendererRunMode block={block} runMode={baseRunMode({ onModification })} />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'abc' } })
    fireEvent.blur(textarea)
    expect(onModification).toHaveBeenCalledTimes(1)

    fireEvent.focus(textarea)
    fireEvent.blur(textarea)
    expect(onModification).toHaveBeenCalledTimes(1)
  })
})
