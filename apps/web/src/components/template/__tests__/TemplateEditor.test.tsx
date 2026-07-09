import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TemplateBlockSchema } from '@rezeta/shared'
import { TemplateEditor, type TemplateEditorState, type TemplateSchema } from '../TemplateEditor'
import { templateEditorWidgetStrings } from '../strings'

// ─── Test helpers ───────────────────────────────────────────────────────────

function baseProps(overrides: Partial<React.ComponentProps<typeof TemplateEditor>> = {}) {
  const initialState: TemplateEditorState = {
    name: 'Plantilla de prueba',
    blocks: [],
    expandedBlockId: null,
    isDirty: false,
  }
  return {
    initialState,
    isLocked: false,
    isSaving: false,
    categories: [],
    categoryId: '',
    onCategoryChange: vi.fn(),
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
}

interface SchemaBlockWithChildren {
  placeholder_blocks?: unknown[]
}

function saveAndGetSchema(onSave: ReturnType<typeof vi.fn>): TemplateSchema {
  fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.save }))
  const call = onSave.mock.calls[0] as [string, TemplateSchema]
  return call[1]
}

// ─── (a) Palette parity ─────────────────────────────────────────────────────

describe('TemplateEditor — block palette parity', () => {
  it('renders all 11 add-block buttons', () => {
    render(<TemplateEditor {...baseProps()} />)
    const expectedLabels = [
      templateEditorWidgetStrings.addSection,
      templateEditorWidgetStrings.addText,
      templateEditorWidgetStrings.addChecklist,
      templateEditorWidgetStrings.addSteps,
      templateEditorWidgetStrings.addDecision,
      templateEditorWidgetStrings.addDosage,
      templateEditorWidgetStrings.addAlert,
      templateEditorWidgetStrings.addVitals,
      templateEditorWidgetStrings.addClinicalNotes,
      templateEditorWidgetStrings.addImagingOrder,
      templateEditorWidgetStrings.addLabOrder,
    ]
    for (const label of expectedLabels) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })
})

// ─── (b) Vitals factory produces schema-valid defaults ──────────────────────

describe('TemplateEditor — vitals block factory', () => {
  it('adding a vitals block produces a block whose fields parse against TemplateBlockSchema', () => {
    const onSave = vi.fn()
    render(<TemplateEditor {...baseProps({ onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addSection }))
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addVitals }))

    const schema = saveAndGetSchema(onSave)
    const section = schema.blocks[0] as SchemaBlockWithChildren
    const vitalsBlock = section.placeholder_blocks?.[0]

    const result = TemplateBlockSchema.safeParse(vitalsBlock)
    expect(result.success).toBe(true)
  })
})

// ─── (c) clinical_notes detail panel edits `label` ──────────────────────────

describe('TemplateEditor — clinical_notes detail panel', () => {
  it('edits label and it round-trips into reducer state', () => {
    const onSave = vi.fn()
    render(<TemplateEditor {...baseProps({ onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addSection }))
    fireEvent.click(
      screen.getByRole('button', { name: templateEditorWidgetStrings.addClinicalNotes }),
    )

    const labelInput = screen.getByPlaceholderText(
      templateEditorWidgetStrings.clinicalNotesLabelPlaceholder,
    )
    fireEvent.change(labelInput, { target: { value: 'Evolución' } })

    const schema = saveAndGetSchema(onSave)
    const section = schema.blocks[0] as SchemaBlockWithChildren
    const clinicalNotesBlock = section.placeholder_blocks?.[0] as { label?: string }
    expect(clinicalNotesBlock.label).toBe('Evolución')
  })
})

// ─── (c.1) header "Requerido" toggle is the single Obligatorio control ──────

describe('TemplateEditor — header required toggle', () => {
  it('toggling the header checkbox round-trips `required` into reducer state', () => {
    const onSave = vi.fn()
    render(<TemplateEditor {...baseProps({ onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addSection }))
    fireEvent.click(
      screen.getByRole('button', { name: templateEditorWidgetStrings.addClinicalNotes }),
    )

    const headerCheckbox = screen.getByRole('checkbox', {
      name: templateEditorWidgetStrings.requiredLabel,
    })
    expect(headerCheckbox).not.toBeChecked()
    fireEvent.click(headerCheckbox)

    const schema = saveAndGetSchema(onSave)
    const section = schema.blocks[0] as SchemaBlockWithChildren
    const clinicalNotesBlock = section.placeholder_blocks?.[0] as { required?: boolean }
    expect(clinicalNotesBlock.required).toBe(true)
  })

  it('the clinical_notes detail panel no longer renders a duplicate Obligatorio checkbox', () => {
    const onSave = vi.fn()
    render(<TemplateEditor {...baseProps({ onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addSection }))
    fireEvent.click(
      screen.getByRole('button', { name: templateEditorWidgetStrings.addClinicalNotes }),
    )

    // The block is auto-expanded on add, so the detail panel (label input,
    // former Obligatorio checkbox, placeholder textarea) is already visible.
    // Two blocks exist (section + clinical_notes), each with its own header
    // "Requerido"/"Requerida" toggle — that's the only place a checkbox
    // should render; the detail panel must not add a third, duplicate one.
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.queryByText('Obligatorio')).not.toBeInTheDocument()
  })
})

// ─── (d) dosage_table detail panel row editor ───────────────────────────────

describe('TemplateEditor — dosage_table detail panel', () => {
  it('adds a row and it appears in reducer state', () => {
    const onSave = vi.fn()
    render(<TemplateEditor {...baseProps({ onSave })} />)
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addSection }))
    fireEvent.click(screen.getByRole('button', { name: templateEditorWidgetStrings.addDosage }))
    fireEvent.click(
      screen.getByRole('button', { name: templateEditorWidgetStrings.dosageAddRow }),
    )

    fireEvent.change(
      screen.getByRole('textbox', { name: templateEditorWidgetStrings.dosageColumnLabels.drug }),
      { target: { value: 'Enalapril' } },
    )
    fireEvent.change(
      screen.getByRole('textbox', { name: templateEditorWidgetStrings.dosageColumnLabels.dose }),
      { target: { value: '10 mg' } },
    )
    fireEvent.change(
      screen.getByRole('textbox', { name: templateEditorWidgetStrings.dosageColumnLabels.route }),
      { target: { value: 'VO' } },
    )
    fireEvent.change(
      screen.getByRole('textbox', {
        name: templateEditorWidgetStrings.dosageColumnLabels.frequency,
      }),
      { target: { value: 'cada 12 h' } },
    )

    const schema = saveAndGetSchema(onSave)
    const section = schema.blocks[0] as SchemaBlockWithChildren
    const dosageBlock = section.placeholder_blocks?.[0] as {
      rows?: Array<Record<string, string>>
    }
    expect(dosageBlock.rows?.[0]).toMatchObject({
      drug: 'Enalapril',
      dose: '10 mg',
      route: 'VO',
      frequency: 'cada 12 h',
    })
  })
})
