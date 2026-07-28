import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type * as ReactRouterDomModule from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UserDeviceItemDto } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useMyDevices: vi.fn(),
  useSignOutAllSessions: vi.fn(),
  useAuthStore: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@/hooks/identity/use-my-devices', () => ({
  useMyDevices: mocks.useMyDevices,
  useSignOutAllSessions: mocks.useSignOutAllSessions,
}))
vi.mock('@/store/auth.store', () => ({ useAuthStore: mocks.useAuthStore }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactRouterDomModule>()
  return { ...actual, useNavigate: () => mocks.navigate }
})

import { ProfileDevices } from '../ProfileDevices'

const devices: UserDeviceItemDto[] = [
  {
    id: 'd1',
    fingerprint: 'fp1',
    userAgent: 'Chrome on macOS',
    firstSeenAt: '2026-07-01T00:00:00.000Z',
    lastSeenAt: '2026-07-27T00:00:00.000Z',
  },
]

const signOutMutation = { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false }

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfileDevices />
    </MemoryRouter>,
  )
}

describe('ProfileDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useMyDevices.mockReturnValue({ data: devices, isLoading: false })
    mocks.useSignOutAllSessions.mockReturnValue(signOutMutation)
    mocks.useAuthStore.mockReturnValue({ signOut: vi.fn().mockResolvedValue(undefined) })
  })

  it('renders the device list', () => {
    renderPage()
    expect(screen.getByText('Dispositivos')).toBeInTheDocument()
    expect(screen.getByText('Chrome on macOS')).toBeInTheDocument()
  })

  it('shows the empty state with no devices', () => {
    mocks.useMyDevices.mockReturnValue({ data: [], isLoading: false })
    renderPage()
    expect(screen.getByText('Aún no se ha registrado ningún dispositivo.')).toBeInTheDocument()
  })

  it('opens a confirm dialog and signs out everywhere on confirm', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Cerrar todas las sesiones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesiones' }))
    await waitFor(() => expect(signOutMutation.mutateAsync).toHaveBeenCalled())
  })

  it('shows an error callout when sign-out-all fails', async () => {
    signOutMutation.mutateAsync.mockRejectedValueOnce(new Error('network'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Cerrar todas las sesiones/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesiones' }))
    await waitFor(() =>
      expect(screen.getByText('No se pudieron cerrar las sesiones. Intenta de nuevo.')).toBeInTheDocument(),
    )
  })
})
