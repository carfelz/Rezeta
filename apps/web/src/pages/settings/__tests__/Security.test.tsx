import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LoginEventItemDto, SecuritySummaryDto } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useCan: vi.fn(),
  useSecuritySummary: vi.fn(),
  useSecurityLogins: vi.fn(),
  downloadSecurityLoginsCsv: vi.fn(),
  triggerDownload: vi.fn(),
}))

vi.mock('@/hooks/use-can', () => ({ useCan: mocks.useCan }))
vi.mock('@/hooks/identity/use-security', () => ({
  useSecuritySummary: mocks.useSecuritySummary,
  useSecurityLogins: mocks.useSecurityLogins,
  downloadSecurityLoginsCsv: mocks.downloadSecurityLoginsCsv,
}))
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), download: vi.fn() },
  triggerDownload: mocks.triggerDownload,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

import { Security } from '../Security'

const summary: SecuritySummaryDto = { logins: 12, distinctUsers: 4, blocked: 1, dormantUsers30d: 2, mfaAdoptionPct: 40 }
const logins: LoginEventItemDto[] = [
  {
    id: 'le-1',
    userId: 'u1',
    userName: 'Dra. Ana García',
    outcome: 'success',
    method: 'password',
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: '2026-07-28T12:00:00.000Z',
  },
  {
    id: 'le-2',
    userId: null,
    userName: null,
    outcome: 'blocked',
    method: 'unknown',
    ipAddress: '10.0.0.2',
    userAgent: null,
    createdAt: '2026-07-27T09:00:00.000Z',
  },
]

describe('Security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useCan.mockReturnValue(true)
    mocks.useSecuritySummary.mockReturnValue({ data: summary, isLoading: false, isError: false })
    mocks.useSecurityLogins.mockReturnValue({ data: logins, isLoading: false, isError: false })
  })

  it('renders the page title and stat tiles', () => {
    render(<Security />)
    expect(screen.getByText('Seguridad')).toBeInTheDocument()
    expect(screen.getByText('Accesos 7d')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('renders the login-activity table with user, method and outcome', () => {
    render(<Security />)
    expect(screen.getByText('Dra. Ana García')).toBeInTheDocument()
    expect(screen.getByText('Exitoso')).toBeInTheDocument()
    expect(screen.getByText('Bloqueado')).toBeInTheDocument()
    expect(screen.getByText('Usuario desconocido')).toBeInTheDocument()
  })

  it('hides the export button without users:manage', () => {
    mocks.useCan.mockReturnValue(false)
    render(<Security />)
    expect(screen.queryByRole('button', { name: 'Exportar' })).not.toBeInTheDocument()
  })

  it('exports CSV via triggerDownload on click', async () => {
    mocks.downloadSecurityLoginsCsv.mockResolvedValue(new Blob(['csv']))
    render(<Security />)
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }))
    await waitFor(() => expect(mocks.triggerDownload).toHaveBeenCalled())
  })

  it('shows the empty state when there is no login activity', () => {
    mocks.useSecurityLogins.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<Security />)
    expect(screen.getByText('Sin actividad')).toBeInTheDocument()
  })

  it('shows a danger callout on load error', () => {
    mocks.useSecurityLogins.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Security />)
    expect(screen.getByText('No se pudo cargar la actividad de acceso.')).toBeInTheDocument()
  })

  it('renders the MFA adoption tile, formatted as a percent', () => {
    render(<Security />)
    expect(screen.getByText('Adopción MFA')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('renders an em dash for a null MFA adoption percent (zero active users)', () => {
    mocks.useSecuritySummary.mockReturnValue({
      data: { ...summary, mfaAdoptionPct: null },
      isLoading: false,
      isError: false,
    })
    render(<Security />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
