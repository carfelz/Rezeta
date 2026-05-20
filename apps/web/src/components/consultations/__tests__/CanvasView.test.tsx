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

describe('CanvasView', () => {
  it('renders checklist item labels', () => {
    render(<CanvasView usage={makeUsage()} onCheck={vi.fn()} isSigned={false} />)
    expect(screen.getByText('Cefalea')).toBeInTheDocument()
    expect(screen.getByText('Mareo')).toBeInTheDocument()
  })

  it('renders section title', () => {
    render(<CanvasView usage={makeUsage()} onCheck={vi.fn()} isSigned={false} />)
    expect(screen.getAllByText('Anamnesis').length).toBeGreaterThan(0)
  })

  it('calls onCheck when clicking checklist item', () => {
    const onCheck = vi.fn()
    render(<CanvasView usage={makeUsage()} onCheck={onCheck} isSigned={false} />)
    fireEvent.click(screen.getByText('Cefalea'))
    expect(onCheck).toHaveBeenCalledWith('itm_1', true)
  })

  it('does not call onCheck when signed', () => {
    const onCheck = vi.fn()
    render(<CanvasView usage={makeUsage()} onCheck={onCheck} isSigned={true} />)
    fireEvent.click(screen.getByText('Cefalea'))
    expect(onCheck).not.toHaveBeenCalled()
  })

  it('shows empty state when no blocks', () => {
    const usage = makeUsage({ content: { version: '1.0', blocks: [] } })
    render(<CanvasView usage={usage} onCheck={vi.fn()} isSigned={false} />)
    expect(screen.getByText(/Este protocolo todavía no tiene pasos\./)).toBeInTheDocument()
  })

  it('shows Continuar sin protocolo button in empty state when handler provided', () => {
    const usage = makeUsage({ content: { version: '1.0', blocks: [] } })
    const onContinue = vi.fn()
    render(
      <CanvasView
        usage={usage}
        onCheck={vi.fn()}
        isSigned={false}
        onContinueWithoutProtocol={onContinue}
      />,
    )
    fireEvent.click(screen.getByText('Continuar sin protocolo'))
    expect(onContinue).toHaveBeenCalled()
  })

  it('calls onAutoPopulate with plan field when checklist critical item checked', () => {
    const onAutoPopulate = vi.fn()
    const usage = makeUsage({
      content: {
        version: '1.0',
        blocks: [
          {
            id: 'chk_1',
            type: 'checklist',
            items: [{ id: 'itm_1', text: 'Dolor torácico', critical: true }],
          },
        ],
      },
    })
    render(
      <CanvasView
        usage={usage}
        onCheck={vi.fn()}
        isSigned={false}
        onAutoPopulate={onAutoPopulate}
      />,
    )
    fireEvent.click(screen.getByText('Dolor torácico'))
    expect(onAutoPopulate).toHaveBeenCalledWith('objective', '✓ Dolor torácico')
  })
})
