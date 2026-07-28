import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as ReactRouterDomModule from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  navigate: vi.fn(),
  completeTotpSignIn: vi.fn(),
  cancelTotpSignIn: vi.fn(),
  errorCodeToMessage: vi.fn((code: string) => `mapped:${code}`),
}))

vi.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({ signIn: mocks.signIn }),
}))
vi.mock('@/lib/auth', () => ({
  authClient: {
    completeTotpSignIn: mocks.completeTotpSignIn,
    cancelTotpSignIn: mocks.cancelTotpSignIn,
    errorCodeToMessage: mocks.errorCodeToMessage,
  },
}))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDomModule>()
  return { ...actual, useNavigate: () => mocks.navigate }
})

import { Login } from '../index'

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>,
  )
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('signs in and navigates to /dashboard on success', async () => {
    mocks.signIn.mockResolvedValue(undefined)
    renderPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('a@b.com', 'pw'))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('shows a mapped error message on a non-mfa sign-in failure', async () => {
    mocks.signIn.mockRejectedValue({ code: 'auth/wrong-password' })
    renderPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('mapped:auth/wrong-password')).toBeInTheDocument()
  })

  it('switches to the MFA challenge step on auth/multi-factor-auth-required', async () => {
    mocks.signIn.mockRejectedValue({ code: 'auth/multi-factor-auth-required' })
    renderPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Verificación en dos pasos')).toBeInTheDocument()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('completes the TOTP challenge and navigates to /dashboard', async () => {
    mocks.signIn.mockRejectedValue({ code: 'auth/multi-factor-auth-required' })
    mocks.completeTotpSignIn.mockResolvedValue(undefined)
    renderPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByText('Verificación en dos pasos')

    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))

    await waitFor(() => expect(mocks.completeTotpSignIn).toHaveBeenCalledWith('123456'))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('shows a mapped error when the TOTP code is rejected', async () => {
    mocks.signIn.mockRejectedValue({ code: 'auth/multi-factor-auth-required' })
    mocks.completeTotpSignIn.mockRejectedValue({ code: 'auth/invalid-verification-code' })
    renderPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByText('Verificación en dos pasos')

    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar' }))

    expect(await screen.findByText('mapped:auth/invalid-verification-code')).toBeInTheDocument()
  })

  it('returns to the credentials form via "Volver a iniciar sesión"', async () => {
    mocks.signIn.mockRejectedValue({ code: 'auth/multi-factor-auth-required' })
    renderPage()
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    await screen.findByText('Verificación en dos pasos')

    fireEvent.click(screen.getByText('Volver a iniciar sesión'))
    expect(screen.getByLabelText('Correo electrónico')).toBeInTheDocument()
    expect(mocks.cancelTotpSignIn).toHaveBeenCalledOnce()
  })
})
