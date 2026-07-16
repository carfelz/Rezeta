import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PageHeader } from '../PageHeader'

const baseProps = {
  consultedAt: '2026-05-18T10:00:00Z',
  locationName: 'Consultorio Privado',
  patientName: 'Ana María Reyes',
  doctorName: 'Dr. Carlos Feliz',
  pageTitle: 'Nueva consulta',
  saveStatus: 'idle' as const,
  isSigned: false,
  canSign: true,
  onAmend: vi.fn(),
  onRetry: vi.fn(),
  onSignClick: vi.fn(),
}

describe('PageHeader', () => {
  it('renders patient and doctor names', () => {
    render(<PageHeader {...baseProps} />)
    expect(screen.getByText(/Ana María Reyes/)).toBeInTheDocument()
    expect(screen.getByText(/Dr. Carlos Feliz/)).toBeInTheDocument()
  })

  it('renders page title', () => {
    render(<PageHeader {...baseProps} pageTitle="Consulta del 18 may" />)
    expect(screen.getByRole('heading', { name: 'Consulta del 18 may' })).toBeInTheDocument()
  })

  it('shows "Firmar y cerrar" button when not signed', () => {
    render(<PageHeader {...baseProps} />)
    expect(screen.getByRole('button', { name: /Firmar y cerrar/i })).toBeInTheDocument()
  })

  it('does not show "Guardar borrador" button', () => {
    render(<PageHeader {...baseProps} />)
    expect(screen.queryByRole('button', { name: /Guardar borrador/i })).not.toBeInTheDocument()
  })

  it('calls onSignClick when "Firmar y cerrar" clicked', async () => {
    const user = userEvent.setup()
    const onSignClick = vi.fn()
    render(<PageHeader {...baseProps} onSignClick={onSignClick} />)
    await user.click(screen.getByRole('button', { name: /Firmar y cerrar/i }))
    expect(onSignClick).toHaveBeenCalledOnce()
  })

  it('shows "Enmienda" button when signed', () => {
    render(<PageHeader {...baseProps} isSigned />)
    expect(screen.getByRole('button', { name: /Enmienda/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Firmar/i })).not.toBeInTheDocument()
  })

  it('hides the "Firmar y cerrar" button when the user cannot manage', () => {
    render(<PageHeader {...baseProps} canManage={false} />)
    expect(screen.queryByRole('button', { name: /Firmar y cerrar/i })).not.toBeInTheDocument()
  })

  it('hides the "Enmienda" button on a signed consultation when the user cannot manage', () => {
    render(<PageHeader {...baseProps} isSigned canManage={false} />)
    expect(screen.queryByRole('button', { name: /Enmienda/i })).not.toBeInTheDocument()
  })

  it('calls onAmend when "Enmienda" clicked', async () => {
    const user = userEvent.setup()
    const onAmend = vi.fn()
    render(<PageHeader {...baseProps} isSigned onAmend={onAmend} />)
    await user.click(screen.getByRole('button', { name: /Enmienda/i }))
    expect(onAmend).toHaveBeenCalledOnce()
  })

  it('passes savedAt to SaveBadge and shows elapsed time', () => {
    const savedAt = new Date(Date.now() - 15_000)
    render(<PageHeader {...baseProps} saveStatus="saved" savedAt={savedAt} />)
    expect(screen.getByText(/Guardado · hace/)).toBeInTheDocument()
  })

  it('passes onRetry to SaveBadge on error state', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<PageHeader {...baseProps} saveStatus="error" onRetry={onRetry} />)
    await user.click(screen.getByRole('button', { name: /Reintentar/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('disables "Firmar y cerrar" when there are no protocols', () => {
    render(<PageHeader {...baseProps} canSign={false} />)
    expect(screen.getByRole('button', { name: /Firmar y cerrar/i })).toBeDisabled()
  })

  it('enables "Firmar y cerrar" when at least one protocol exists', () => {
    render(<PageHeader {...baseProps} canSign={true} />)
    expect(screen.getByRole('button', { name: /Firmar y cerrar/i })).toBeEnabled()
  })
})
