import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiagnosesSection } from '../DiagnosesSection'

describe('DiagnosesSection', () => {
  it('renders existing diagnoses as chips', () => {
    render(<DiagnosesSection diagnoses={['HTA', 'DM2']} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByText('HTA')).toBeInTheDocument()
    expect(screen.getByText('DM2')).toBeInTheDocument()
  })

  it('removes a diagnosis when × is clicked', () => {
    const onChange = vi.fn()
    render(<DiagnosesSection diagnoses={['HTA']} onChange={onChange} disabled={false} />)
    fireEvent.click(screen.getByLabelText('Quitar HTA'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds a diagnosis on Enter', () => {
    const onChange = vi.fn()
    render(<DiagnosesSection diagnoses={[]} onChange={onChange} disabled={false} />)
    const input = screen.getByPlaceholderText(/Añadir diagnóstico/)
    fireEvent.change(input, { target: { value: 'Asma' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['Asma'])
  })

  it('does not add duplicates', () => {
    const onChange = vi.fn()
    render(<DiagnosesSection diagnoses={['HTA']} onChange={onChange} disabled={false} />)
    const input = screen.getByPlaceholderText(/Añadir diagnóstico/)
    fireEvent.change(input, { target: { value: 'HTA' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hides input when disabled', () => {
    render(<DiagnosesSection diagnoses={['HTA']} onChange={vi.fn()} disabled />)
    expect(screen.queryByPlaceholderText(/Añadir diagnóstico/)).toBeNull()
  })

  it('renders em-dash when disabled with no diagnoses', () => {
    render(<DiagnosesSection diagnoses={[]} onChange={vi.fn()} disabled />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
