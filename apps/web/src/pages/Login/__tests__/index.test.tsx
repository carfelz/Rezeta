import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as ReactRouterDomModule from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithSso: vi.fn(),
  navigate: vi.fn(),
  completeTotpSignIn: vi.fn(),
  cancelTotpSignIn: vi.fn(),
  errorCodeToMessage: vi.fn((code: string) => `mapped:${code}`),
  fetchLoginMethods: vi.fn(),
}))

vi.mock('@/store/auth.store', () => ({
  useAuthStore: () => ({
    signIn: mocks.signIn,
    signInWithGoogle: mocks.signInWithGoogle,
    signInWithSso: mocks.signInWithSso,
  }),
}))
vi.mock('@/lib/auth', () => ({
  authClient: {
    completeTotpSignIn: mocks.completeTotpSignIn,
    cancelTotpSignIn: mocks.cancelTotpSignIn,
    errorCodeToMessage: mocks.errorCodeToMessage,
  },
}))
vi.mock('@/hooks/identity/use-login-methods', () => ({
  fetchLoginMethods: mocks.fetchLoginMethods,
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

  it('renders a Google button below the password form under a divider, and signs in on click', async () => {
    mocks.signInWithGoogle.mockResolvedValue(undefined)
    renderPage()
    expect(screen.getByText('o')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }))
    await waitFor(() => expect(mocks.signInWithGoogle).toHaveBeenCalledOnce())
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('switches to the MFA challenge when Google sign-in requires it', async () => {
    mocks.signInWithGoogle.mockRejectedValue({ code: 'auth/multi-factor-auth-required' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }))
    expect(await screen.findByText('Verificación en dos pasos')).toBeInTheDocument()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('swaps to an SSO-only primary button on email blur when the account is sso-only', async () => {
    mocks.fetchLoginMethods.mockResolvedValue({
      methods: ['sso'],
      ssoProviderId: 'oidc.clinica',
      ssoDisplayName: 'Clinica SSO',
    })
    mocks.signInWithSso.mockResolvedValue(undefined)
    renderPage()
    const emailInput = screen.getByLabelText('Correo electrónico')
    fireEvent.change(emailInput, { target: { value: 'doctor@clinica.do' } })
    fireEvent.blur(emailInput)
    await waitFor(() => expect(mocks.fetchLoginMethods).toHaveBeenCalledWith('doctor@clinica.do'))

    expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument()
    const ssoButton = await screen.findByRole('button', { name: 'Continuar con Clinica SSO' })
    fireEvent.click(ssoButton)
    await waitFor(() => expect(mocks.signInWithSso).toHaveBeenCalledWith('oidc.clinica'))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/dashboard', { replace: true }))
  })

  it('keeps the password form and adds a secondary SSO button when the tenant still allows password', async () => {
    mocks.fetchLoginMethods.mockResolvedValue({
      methods: ['password', 'sso'],
      ssoProviderId: 'oidc.clinica',
      ssoDisplayName: 'Clinica SSO',
    })
    renderPage()
    const emailInput = screen.getByLabelText('Correo electrónico')
    fireEvent.change(emailInput, { target: { value: 'doctor@clinica.do' } })
    fireEvent.blur(emailInput)

    await screen.findByRole('button', { name: 'Continuar con Clinica SSO' })
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })

  it('leaves the password + Google form unchanged when the routing check rejects', async () => {
    mocks.fetchLoginMethods.mockRejectedValue(new Error('network down'))
    renderPage()
    const emailInput = screen.getByLabelText('Correo electrónico')
    fireEvent.change(emailInput, { target: { value: 'doctor@clinica.do' } })
    fireEvent.blur(emailInput)

    await waitFor(() => expect(mocks.fetchLoginMethods).toHaveBeenCalled())
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument()
  })

  it('restores the password form after changing the email back to a non-sso domain', async () => {
    mocks.fetchLoginMethods.mockResolvedValue({
      methods: ['sso'],
      ssoProviderId: 'oidc.clinica',
      ssoDisplayName: 'Clinica SSO',
    })
    renderPage()
    const emailInput = screen.getByLabelText('Correo electrónico')
    fireEvent.change(emailInput, { target: { value: 'doctor@clinica.do' } })
    fireEvent.blur(emailInput)
    await waitFor(() => expect(screen.queryByLabelText('Contraseña')).not.toBeInTheDocument())

    fireEvent.change(emailInput, { target: { value: 'doctor@gmail.com' } })
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument()
  })
})
