import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as ReactRouterDomModule from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
  signIn: vi.fn(),
  navigate: vi.fn(),
  searchParams: new URLSearchParams({ oobCode: 'oob-1' }),
}))

vi.mock('@/lib/auth', () => ({
  authClient: {
    verifyPasswordResetCode: mocks.verifyPasswordResetCode,
    confirmPasswordReset: mocks.confirmPasswordReset,
    signIn: mocks.signIn,
    errorCodeToMessage: (c: string) => c,
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDomModule>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [mocks.searchParams],
  }
})

import { SetPassword } from '../index'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.searchParams = new URLSearchParams({ oobCode: 'oob-1' })
  mocks.verifyPasswordResetCode.mockResolvedValue('nurse@clinic.do')
  mocks.confirmPasswordReset.mockResolvedValue(undefined)
  mocks.signIn.mockResolvedValue(undefined)
})

describe('SetPassword', () => {
  it('sets the password then signs in and navigates to dashboard', async () => {
    render(<SetPassword />)
    await waitFor(() => expect(mocks.verifyPasswordResetCode).toHaveBeenCalledWith('oob-1'))

    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }))

    await waitFor(() => {
      expect(mocks.confirmPasswordReset).toHaveBeenCalledWith('oob-1', 'NewPass123')
      expect(mocks.signIn).toHaveBeenCalledWith('nurse@clinic.do', 'NewPass123')
      expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true })
    })
  })

  it('shows a mismatch error and does not submit', async () => {
    render(<SetPassword />)
    await waitFor(() => expect(mocks.verifyPasswordResetCode).toHaveBeenCalled())
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), {
      target: { value: 'Different1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    expect(screen.getByText('Las contraseñas no coinciden')).toBeInTheDocument()
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('shows a too-short password error and does not submit', async () => {
    render(<SetPassword />)
    await waitFor(() => expect(mocks.verifyPasswordResetCode).toHaveBeenCalled())
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres')).toBeInTheDocument()
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('shows an invalid-link message when the code cannot be verified', async () => {
    mocks.verifyPasswordResetCode.mockRejectedValue(new Error('expired'))
    render(<SetPassword />)
    await waitFor(() =>
      expect(screen.getByText(/El enlace no es válido o ya expiró/)).toBeInTheDocument(),
    )
  })

  it('shows an invalid-link message when there is no oobCode in the URL', async () => {
    mocks.searchParams = new URLSearchParams()
    render(<SetPassword />)
    await waitFor(() =>
      expect(screen.getByText(/El enlace no es válido o ya expiró/)).toBeInTheDocument(),
    )
    expect(mocks.verifyPasswordResetCode).not.toHaveBeenCalled()
  })

  it('shows a generic error when confirmPasswordReset fails', async () => {
    mocks.confirmPasswordReset.mockRejectedValue(new Error('boom'))
    render(<SetPassword />)
    await waitFor(() => expect(mocks.verifyPasswordResetCode).toHaveBeenCalled())
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.change(screen.getByPlaceholderText('Repite la contraseña'), {
      target: { value: 'NewPass123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    await waitFor(() =>
      expect(
        screen.getByText('No se pudo guardar la contraseña. Intenta de nuevo.'),
      ).toBeInTheDocument(),
    )
  })
})
