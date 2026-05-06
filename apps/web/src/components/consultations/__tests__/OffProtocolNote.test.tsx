import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OffProtocolNote } from '../OffProtocolNote'

describe('OffProtocolNote', () => {
  it('renders the amber overline label', () => {
    render(<OffProtocolNote onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Fuera de protocolo')).toBeInTheDocument()
  })

  it('renders title and body inputs', () => {
    render(<OffProtocolNote onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByPlaceholderText(/Título del hallazgo/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Describe el hallazgo/)).toBeInTheDocument()
  })

  it('disables both action buttons when body is empty', () => {
    render(<OffProtocolNote onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('Convertir en paso')).toBeDisabled()
    expect(screen.getByText(/Mover a/)).toBeDisabled()
  })

  it('enables "Convertir en paso" when body has content', () => {
    render(<OffProtocolNote onSave={vi.fn()} onCancel={vi.fn()} />)
    const ta = screen.getByPlaceholderText(/Describe el hallazgo/)
    fireEvent.change(ta, { target: { value: 'Hallazgo importante' } })
    expect(screen.getByText('Convertir en paso')).not.toBeDisabled()
  })

  it('calls onSave with title, body, and null promoteTo on "Convertir en paso"', () => {
    const onSave = vi.fn()
    render(<OffProtocolNote onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Título del hallazgo/), {
      target: { value: 'Dolor torácico' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Describe el hallazgo/), {
      target: { value: 'Episodio breve' },
    })
    fireEvent.click(screen.getByText('Convertir en paso'))
    expect(onSave).toHaveBeenCalledWith({
      title: 'Dolor torácico',
      body: 'Episodio breve',
      promoteTo: null,
    })
  })

  it('opens SOAP mover dropdown and saves with selected field', () => {
    const onSave = vi.fn()
    render(<OffProtocolNote onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/Describe el hallazgo/), {
      target: { value: 'Body content' },
    })
    fireEvent.click(screen.getByText(/Mover a/))
    fireEvent.click(screen.getByText('Subjetivo'))
    expect(onSave).toHaveBeenCalledWith({
      title: '',
      body: 'Body content',
      promoteTo: 'subjective',
    })
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn()
    render(<OffProtocolNote onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onCancel).toHaveBeenCalled()
  })

  it('renders timestamp footer', () => {
    render(<OffProtocolNote onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(/Dr\. García/)).toBeInTheDocument()
  })

  it('disables actions when isPending is true', () => {
    render(<OffProtocolNote onSave={vi.fn()} onCancel={vi.fn()} isPending />)
    fireEvent.change(screen.getByPlaceholderText(/Describe el hallazgo/), {
      target: { value: 'x' },
    })
    expect(screen.getByText('Convertir en paso')).toBeDisabled()
  })
})
