import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuthUser } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
  useSyncMfaEnrollment: vi.fn(),
  enrollTotp: vi.fn(),
  unenrollTotp: vi.fn(),
  setUser: vi.fn(),
}))

vi.mock('@/store/auth.store', () => ({ useAuthStore: mocks.useAuthStore }))
vi.mock('@/hooks/identity/use-mfa', () => ({ useSyncMfaEnrollment: mocks.useSyncMfaEnrollment }))
vi.mock('@/lib/auth', () => ({
  authClient: { enrollTotp: mocks.enrollTotp, unenrollTotp: mocks.unenrollTotp },
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

import { ProfileMfa } from '../ProfileMfa'

function baseUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'u1',
    externalUid: 'ext-1',
    tenantId: 't1',
    email: 'dr@rezeta.do',
    fullName: 'Dr. Test',
    role: 'doctor',
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: null,
    preferences: {},
    capabilities: {},
    mfaEnrolledAt: null,
    ...overrides,
  } as AuthUser
}

describe('ProfileMfa', () => {
  const syncMutation = { mutateAsync: vi.fn().mockResolvedValue({ mfaEnrolledAt: '2026-07-28T00:00:00.000Z' }) }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useSyncMfaEnrollment.mockReturnValue(syncMutation)
    mocks.useAuthStore.mockReturnValue({ user: baseUser(), setUser: mocks.setUser })
  })

  it('shows "No activada" and a Configurar button when not enrolled', () => {
    render(<ProfileMfa />)
    expect(screen.getByText('No activada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurar' })).toBeInTheDocument()
  })

  it('shows "Activada" and a Quitar button when enrolled', () => {
    mocks.useAuthStore.mockReturnValue({
      user: baseUser({ mfaEnrolledAt: '2026-07-01T00:00:00.000Z' }),
      setUser: mocks.setUser,
    })
    render(<ProfileMfa />)
    expect(screen.getByText('Activada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument()
  })

  it('starts enrollment and shows the secret + otpauth URL', async () => {
    mocks.enrollTotp.mockResolvedValue({
      secret: 'ABCDEF',
      otpauthUrl: 'otpauth://totp/Rezeta:dr@rezeta.do?secret=ABCDEF',
      verify: vi.fn(),
    })
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Configurar' }))
    expect(await screen.findByText('ABCDEF')).toBeInTheDocument()
    expect(screen.getByText('otpauth://totp/Rezeta:dr@rezeta.do?secret=ABCDEF')).toBeInTheDocument()
  })

  it('shows an error when starting enrollment fails', async () => {
    mocks.enrollTotp.mockRejectedValue(new Error('boom'))
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Configurar' }))
    expect(await screen.findByText('No se pudo iniciar la configuración. Intenta de nuevo.')).toBeInTheDocument()
  })

  it('verifies the code, syncs, and updates the store user on success', async () => {
    const verify = vi.fn().mockResolvedValue(undefined)
    mocks.enrollTotp.mockResolvedValue({ secret: 'ABCDEF', otpauthUrl: 'otpauth://x', verify })
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Configurar' }))
    await screen.findByText('ABCDEF')

    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y activar' }))

    await waitFor(() => expect(verify).toHaveBeenCalledWith('123456'))
    await waitFor(() => expect(syncMutation.mutateAsync).toHaveBeenCalled())
    await waitFor(() =>
      expect(mocks.setUser).toHaveBeenCalledWith(
        expect.objectContaining({ mfaEnrolledAt: '2026-07-28T00:00:00.000Z' }),
      ),
    )
  })

  it('shows an error when verification fails', async () => {
    const verify = vi.fn().mockRejectedValue(new Error('bad code'))
    mocks.enrollTotp.mockResolvedValue({ secret: 'ABCDEF', otpauthUrl: 'otpauth://x', verify })
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Configurar' }))
    await screen.findByText('ABCDEF')
    fireEvent.change(screen.getByLabelText('Código de verificación'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y activar' }))
    expect(await screen.findByText('Código inválido. Verifica e intenta de nuevo.')).toBeInTheDocument()
  })

  it('removes MFA after confirming, syncs, and updates the store user', async () => {
    mocks.useAuthStore.mockReturnValue({
      user: baseUser({ mfaEnrolledAt: '2026-07-01T00:00:00.000Z' }),
      setUser: mocks.setUser,
    })
    mocks.unenrollTotp.mockResolvedValue(undefined)
    mocks.useSyncMfaEnrollment.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ mfaEnrolledAt: null }),
    })
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    const removeButtons = await screen.findAllByRole('button', { name: 'Quitar' })
    fireEvent.click(removeButtons[removeButtons.length - 1]!)
    await waitFor(() => expect(mocks.unenrollTotp).toHaveBeenCalled())
    await waitFor(() => expect(mocks.setUser).toHaveBeenCalledWith(expect.objectContaining({ mfaEnrolledAt: null })))
  })

  it('shows an error when removal fails', async () => {
    mocks.useAuthStore.mockReturnValue({
      user: baseUser({ mfaEnrolledAt: '2026-07-01T00:00:00.000Z' }),
      setUser: mocks.setUser,
    })
    mocks.unenrollTotp.mockRejectedValue(new Error('boom'))
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }))
    const removeButtons = await screen.findAllByRole('button', { name: 'Quitar' })
    fireEvent.click(removeButtons[removeButtons.length - 1]!)
    expect(await screen.findByText('No se pudo quitar la autenticación en dos pasos.')).toBeInTheDocument()
  })

  it('cancels the enrollment flow and returns to the idle state', async () => {
    mocks.enrollTotp.mockResolvedValue({ secret: 'ABCDEF', otpauthUrl: 'otpauth://x', verify: vi.fn() })
    render(<ProfileMfa />)
    fireEvent.click(screen.getByRole('button', { name: 'Configurar' }))
    await screen.findByText('ABCDEF')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('ABCDEF')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Configurar' })).toBeInTheDocument()
  })
})
