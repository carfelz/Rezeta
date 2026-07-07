import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoriaMappingTab } from '../HistoriaMappingTab'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

const blocks = [
  { id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: '' },
  { id: 'v1', type: 'vitals', fields: [], values: {} },
  { id: 'dt1', type: 'dosage_table', rows: [] },
  { id: 'a1', type: 'alert', severity: 'info', content: 'ref' },
  { id: 't1', type: 'text', content: 'ref text' },
] as unknown as ProtocolBlock[]

describe('HistoriaMappingTab', () => {
  it('renders one row per block with Auto badge by default', () => {
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={vi.fn()} />)
    expect(screen.getAllByText('Motivo de consulta').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Auto').length).toBeGreaterThanOrEqual(3)
  })

  it('locks dosage_table rows (no section select)', () => {
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={vi.fn()} />)
    expect(screen.getByText('Fijo por ley — desde recetas firmadas')).toBeInTheDocument()
  })

  it('emits an override when the destination changes', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    const combobox = screen.getAllByRole('combobox')[0]
    expect(combobox).toBeDefined()
    fireEvent.change(combobox!, { target: { value: 'examen_fisico' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ b1: { section: 'examen_fisico' } }))
  })

  it('shows Personalizado on overridden rows and clears them on restore', () => {
    const onChange = vi.fn()
    render(
      <HistoriaMappingTab blocks={blocks} mapping={{ b1: { section: 'evolucion' } }} onChange={onChange} />,
    )
    expect(screen.getByText('Personalizado')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Restaurar automático/ }))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('toggling include=false emits the exclusion for an unlocked row', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    const switchEl = screen.getAllByRole('switch')[0]
    expect(switchEl).toBeDefined()
    fireEvent.click(switchEl!)
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ b1: { include: false } }))
  })

  it('shows "No se incluye" and disables the switch for alert/text reference-material rows', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    const noSeIncluye = screen.getAllByText('No se incluye')
    expect(noSeIncluye.length).toBe(2) // alert + text

    const switches = screen.getAllByRole('switch')
    const alertSwitch = switches[3] // b1, v1, dt1, a1, t1 in block order
    const textSwitch = switches[4]
    expect(alertSwitch).toBeDisabled()
    expect(textSwitch).toBeDisabled()

    fireEvent.click(alertSwitch!)
    fireEvent.click(textSwitch!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables the switch on legally locked rows (dosage_table/lab_order/imaging_order)', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    const switches = screen.getAllByRole('switch')
    const dosageTableSwitch = switches[2]
    expect(dosageTableSwitch).toBeDisabled()
    fireEvent.click(dosageTableSwitch!)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('leaves the section select and label input enabled for unlocked, included rows', () => {
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={vi.fn()} />)
    const switches = screen.getAllByRole('switch')
    expect(switches[0]).not.toBeDisabled() // b1 clinical_notes
    expect(switches[1]).not.toBeDisabled() // v1 vitals
  })
})
