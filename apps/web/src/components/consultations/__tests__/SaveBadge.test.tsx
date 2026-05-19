import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
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

  it('shows "Guardado" when status is saved without savedAt', () => {
    render(<SaveBadge status="saved" />)
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })

  it('shows elapsed time when status is saved with savedAt', () => {
    const savedAt = new Date(Date.now() - 30_000)
    render(<SaveBadge status="saved" savedAt={savedAt} />)
    expect(screen.getByText(/Guardado · hace/)).toBeInTheDocument()
  })

  it('shows error state', () => {
    render(<SaveBadge status="error" />)
    expect(screen.getByText('Error al guardar')).toBeInTheDocument()
  })

  it('shows retry button when error and onRetry provided', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<SaveBadge status="error" onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: /Reintentar/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not show retry button when error but no onRetry', () => {
    render(<SaveBadge status="error" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
