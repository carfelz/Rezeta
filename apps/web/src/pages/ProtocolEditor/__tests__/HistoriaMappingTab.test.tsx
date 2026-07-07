import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HistoriaMappingTab } from '../HistoriaMappingTab'
import type { ProtocolBlock } from '@/components/protocols/BlockRenderer'

const blocks = [
  { id: 'b1', type: 'clinical_notes', label: 'Motivo de consulta', content: '' },
  { id: 'v1', type: 'vitals', fields: [], values: {} },
  { id: 'dt1', type: 'dosage_table', rows: [] },
  { id: 'a1', type: 'alert', severity: 'info', content: 'ref' },
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
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'examen_fisico' } })
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

  it('toggling include=false emits the exclusion', () => {
    const onChange = vi.fn()
    render(<HistoriaMappingTab blocks={blocks} mapping={undefined} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('switch')[0])
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ b1: { include: false } }))
  })
})
