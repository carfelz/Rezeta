import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CanvasView } from '../CanvasView'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

const makeUsage = (
  overrides: Partial<ConsultationProtocolUsage> = {},
): ConsultationProtocolUsage => ({
  id: 'usage-1',
  tenantId: 'tenant-1',
  consultationId: 'consult-1',
  protocolId: 'proto-1',
  protocolVersionId: 'ver-1',
  protocolTitle: 'Protocolo de prueba',
  protocolTypeName: 'Diagnóstico',
  versionNumber: 1,
  status: 'in_progress',
  depth: 0,
  parentUsageId: null,
  triggerBlockId: null,
  completedAt: null,
  notes: null,
  appliedAt: new Date().toISOString(),
  modificationSummary: null,
  checkedState: {},
  modifications: {},
  content: {
    version: '1.0',
    blocks: [
      {
        id: 'sec_1',
        type: 'section',
        title: 'Anamnesis',
        blocks: [
          {
            id: 'chk_1',
            type: 'checklist',
            items: [
              { id: 'itm_1', text: 'Cefalea' },
              { id: 'itm_2', text: 'Mareo' },
            ],
          },
        ],
      },
    ],
  },
  ...overrides,
})

const defaultSoap = {
  chiefComplaint: '',
  subjective: '',
  objective: '',
  assessment: '',
  plan: '',
}

describe('CanvasView', () => {
  it('renders step labels', () => {
    render(
      <CanvasView
        usage={makeUsage()}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={false}
      />,
    )
    expect(screen.getByText('Cefalea')).toBeInTheDocument()
    expect(screen.getByText('Mareo')).toBeInTheDocument()
  })

  it('renders section title under each step', () => {
    render(
      <CanvasView
        usage={makeUsage()}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={false}
      />,
    )
    expect(screen.getAllByText('Anamnesis').length).toBeGreaterThan(0)
  })

  it('renders mono step numbers (01, 02)', () => {
    render(
      <CanvasView
        usage={makeUsage()}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={false}
      />,
    )
    expect(screen.getAllByText('01').length).toBeGreaterThan(0)
    expect(screen.getByText('02')).toBeInTheDocument()
  })

  it('marks first incomplete step as active with EN CURSO badge', () => {
    render(
      <CanvasView
        usage={makeUsage()}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={false}
      />,
    )
    expect(screen.getByText('En curso')).toBeInTheDocument()
  })

  it('shows Editar link on completed steps', () => {
    render(
      <CanvasView
        usage={makeUsage({ checkedState: { itm_1: true } })}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={false}
      />,
    )
    expect(screen.getByText('Editar')).toBeInTheDocument()
  })

  it('calls onToggleStep when circle button clicked', () => {
    const onToggleStep = vi.fn()
    render(
      <CanvasView
        usage={makeUsage()}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={onToggleStep}
        isSigned={false}
      />,
    )
    const stepButtons = screen.getAllByRole('button', { name: /completado|pendiente/ })
    fireEvent.click(stepButtons[0])
    expect(onToggleStep).toHaveBeenCalledWith('itm_1', true)
  })

  it('disables step buttons when signed', () => {
    render(
      <CanvasView
        usage={makeUsage()}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={true}
      />,
    )
    const stepButtons = screen.getAllByRole('button', { name: /completado|pendiente/ })
    stepButtons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('hides Editar link when signed', () => {
    render(
      <CanvasView
        usage={makeUsage({ checkedState: { itm_1: true } })}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={true}
      />,
    )
    expect(screen.queryByText('Editar')).toBeNull()
  })

  it('shows empty message when no interactive steps', () => {
    const usage = makeUsage({ content: { version: '1.0', blocks: [] } })
    render(
      <CanvasView
        usage={usage}
        soap={defaultSoap}
        onSoapChange={vi.fn()}
        onToggleStep={vi.fn()}
        isSigned={false}
      />,
    )
    expect(screen.getByText(/Este protocolo todavía no tiene pasos\./)).toBeInTheDocument()
  })
})
