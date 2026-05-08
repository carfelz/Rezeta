import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SaveBadge } from '../SaveBadge'

describe('SaveBadge', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<SaveBadge status="idle" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Sin guardar" when status is dirty', () => {
    render(<SaveBadge status="dirty" />)
    expect(screen.getByText('Sin guardar')).toBeInTheDocument()
  })

  it('shows "Guardando…" when status is saving', () => {
    render(<SaveBadge status="saving" />)
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
  })

  it('shows "Guardado" when status is saved', () => {
    render(<SaveBadge status="saved" />)
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })
})
