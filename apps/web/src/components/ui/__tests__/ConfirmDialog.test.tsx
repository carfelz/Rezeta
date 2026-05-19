import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    title: 'Archivar paciente',
    description: 'Esta acción no se puede deshacer.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  return { ...render(<ConfirmDialog {...props} />), props }
}

describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    renderDialog()
    expect(screen.getByText('Archivar paciente')).toBeInTheDocument()
    expect(screen.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Archivar paciente')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Confirmar' }))
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderDialog()
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('uses custom confirmLabel and cancelLabel', () => {
    renderDialog({ confirmLabel: 'Sí, eliminar', cancelLabel: 'No, volver' })
    expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No, volver' })).toBeInTheDocument()
  })

  it('shows loading state on confirm button', () => {
    renderDialog({ loading: true })
    expect(screen.getByRole('button', { name: 'Procesando...' })).toBeDisabled()
  })

  it('disables cancel button when loading', () => {
    renderDialog({ loading: true })
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
  })

  it('does not call onCancel on close when loading', async () => {
    const user = userEvent.setup()
    const { props } = renderDialog({ loading: true })
    await user.keyboard('{Escape}')
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('renders primary variant without crashing', () => {
    expect(() => renderDialog({ variant: 'primary' })).not.toThrow()
  })

  it('renders danger variant without crashing', () => {
    expect(() => renderDialog({ variant: 'danger' })).not.toThrow()
  })
})
