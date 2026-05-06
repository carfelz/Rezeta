import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProtocolStrip } from '../ProtocolStrip'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

const baseUsage: ConsultationProtocolUsage = {
  id: 'usage-1',
  tenantId: 'tenant-1',
  consultationId: 'consult-1',
  protocolId: 'protocol-1',
  protocolVersionId: 'version-1',
  protocolTitle: 'Protocolo HTA',
  protocolTypeName: 'Diagnóstico',
  versionNumber: 2,
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
            title: 'Síntomas',
            items: [
              { id: 'itm_1', text: 'Cefalea' },
              { id: 'itm_2', text: 'Mareo' },
            ],
          },
        ],
      },
    ],
  },
}

describe('ProtocolStrip', () => {
  it('renders protocol title', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('Protocolo HTA')).toBeInTheDocument()
  })

  it('renders version number', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('renders progress when items exist', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('0 / 2')).toBeInTheDocument()
  })

  it('shows completed progress when items checked', () => {
    const usage = { ...baseUsage, checkedState: { itm_1: true, itm_2: true } }
    render(<ProtocolStrip usage={usage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  it('shows "Ver pasos" button when steps exist', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('Ver pasos')).toBeInTheDocument()
  })

  it('opens step list popover on click', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Ver pasos'))
    expect(screen.getByText('Pasos del protocolo')).toBeInTheDocument()
  })

  it('shows "Cambiar" button when not signed', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('Cambiar')).toBeInTheDocument()
  })

  it('hides "Cambiar" button when signed', () => {
    render(<ProtocolStrip usage={baseUsage} isSigned={true} onChangePicker={vi.fn()} />)
    expect(screen.queryByText('Cambiar')).not.toBeInTheDocument()
  })

  it('calls onChangePicker when "Cambiar" clicked', () => {
    const onChangePicker = vi.fn()
    render(<ProtocolStrip usage={baseUsage} isSigned={false} onChangePicker={onChangePicker} />)
    fireEvent.click(screen.getByText('Cambiar'))
    expect(onChangePicker).toHaveBeenCalledTimes(1)
  })

  it('shows step completion status in popover', () => {
    const usage = { ...baseUsage, checkedState: { itm_1: true } }
    render(<ProtocolStrip usage={usage} isSigned={false} onChangePicker={vi.fn()} />)
    fireEvent.click(screen.getByText('Ver pasos'))
    expect(screen.getByText('Anamnesis')).toBeInTheDocument()
  })

  it('renders with no content blocks gracefully', () => {
    const usage = { ...baseUsage, content: { version: '1.0', blocks: [] } }
    render(<ProtocolStrip usage={usage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('Protocolo HTA')).toBeInTheDocument()
    expect(screen.queryByText('Ver pasos')).not.toBeInTheDocument()
  })

  it('renders with null content gracefully', () => {
    const usage = { ...baseUsage, content: null as unknown as ConsultationProtocolUsage['content'] }
    render(<ProtocolStrip usage={usage} isSigned={false} onChangePicker={vi.fn()} />)
    expect(screen.getByText('Protocolo HTA')).toBeInTheDocument()
  })
})
