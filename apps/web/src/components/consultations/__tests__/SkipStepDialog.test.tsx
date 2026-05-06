import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SkipStepDialog } from '../SkipStepDialog'

describe('SkipStepDialog', () => {
  it('renders the overline and title with step name', () => {
    render(<SkipStepDialog stepTitle="Examen físico" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getAllByText(/Saltar paso/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/¿Por qué saltar Examen físico\?/)).toBeInTheDocument()
  })

  it('renders all four preset reasons', () => {
    render(<SkipStepDialog stepTitle="Step" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Paciente no cooperaba')).toBeInTheDocument()
    expect(screen.getByText('No clínicamente relevante hoy')).toBeInTheDocument()
    expect(screen.getByText('Paso ya documentado en visita reciente')).toBeInTheDocument()
    expect(screen.getByText('Otro…')).toBeInTheDocument()
  })

  it('preselects "No clínicamente relevante hoy" by default', () => {
    const onConfirm = vi.fn()
    render(<SkipStepDialog stepTitle="Step" onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Saltar paso' }))
    expect(onConfirm).toHaveBeenCalledWith('No clínicamente relevante hoy')
  })

  it('changes selected reason when another option clicked', () => {
    const onConfirm = vi.fn()
    render(<SkipStepDialog stepTitle="Step" onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Paciente no cooperaba'))
    fireEvent.click(screen.getByRole('button', { name: 'Saltar paso' }))
    expect(onConfirm).toHaveBeenCalledWith('Paciente no cooperaba')
  })

  it('shows textarea when "Otro…" selected', () => {
    render(<SkipStepDialog stepTitle="Step" onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Otro…'))
    expect(screen.getByPlaceholderText(/Describe el motivo/)).toBeInTheDocument()
  })

  it('disables confirm when "Otro…" selected with empty text', () => {
    render(<SkipStepDialog stepTitle="Step" onConfirm={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Otro…'))
    expect(screen.getByRole('button', { name: 'Saltar paso' })).toBeDisabled()
  })

  it('passes free-form reason when "Otro…" used', () => {
    const onConfirm = vi.fn()
    render(<SkipStepDialog stepTitle="Step" onConfirm={onConfirm} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Otro…'))
    const ta = screen.getByPlaceholderText(/Describe el motivo/)
    fireEvent.change(ta, { target: { value: '  Paciente con prisa  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Saltar paso' }))
    expect(onConfirm).toHaveBeenCalledWith('Paciente con prisa')
  })

  it('calls onClose when "Cancelar" clicked', () => {
    const onClose = vi.fn()
    render(<SkipStepDialog stepTitle="Step" onConfirm={vi.fn()} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows loading state when isPending', () => {
    render(<SkipStepDialog stepTitle="Step" onConfirm={vi.fn()} onClose={vi.fn()} isPending />)
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
  })

  it('renders body description text', () => {
    render(<SkipStepDialog stepTitle="Step" onConfirm={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText(/Quedará registrado en la consulta/)).toBeInTheDocument()
  })
})
