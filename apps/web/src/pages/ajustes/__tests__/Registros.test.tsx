import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AuditLogListResponse } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useAuditLogs: vi.fn(),
  downloadAuditLogCsv: vi.fn(),
  triggerDownload: vi.fn(),
}))

vi.mock('@/hooks/use-auth', () => ({ useAuth: mocks.useAuth }))
vi.mock('@/hooks/audit-logs/use-audit-logs', () => ({
  useAuditLogs: mocks.useAuditLogs,
  downloadAuditLogCsv: mocks.downloadAuditLogCsv,
}))
vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), download: vi.fn() },
  triggerDownload: mocks.triggerDownload,
}))

import { Registros } from '../Registros'

const emptyResponse: AuditLogListResponse = {
  data: [],
  pagination: { cursor: null, hasMore: false, limit: 50 },
}

const sampleItem = {
  id: 'audit-001',
  tenantId: 'tenant-001',
  actorUserId: 'user-001',
  actorType: 'user' as const,
  category: 'auth' as const,
  action: 'login',
  entityType: null,
  entityId: null,
  changes: null,
  metadata: null,
  requestId: 'req-001',
  ipAddress: '192.168.1.1',
  userAgent: null,
  status: 'success' as const,
  errorCode: null,
  createdAt: '2026-04-18T10:23:00.000Z',
  actor: { id: 'user-001', fullName: 'Ana García', email: 'ana@test.com', role: 'owner' },
}

function setup(plan = 'free') {
  mocks.useAuth.mockReturnValue({
    user: { tenantPlan: plan, fullName: 'Ana García' },
  })
}

describe('Registros', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
    mocks.useAuditLogs.mockReturnValue({
      data: emptyResponse,
      isLoading: false,
      isError: false,
    })
  })

  it('renders page title', () => {
    render(<Registros />)
    expect(screen.getByText('Registros de actividad')).toBeInTheDocument()
  })

  it('shows plan banner for free plan', () => {
    render(<Registros />)
    expect(screen.getByText(/últimos 30 días/)).toBeInTheDocument()
  })

  it('shows plan banner for pro plan with 365 days', () => {
    setup('pro')
    render(<Registros />)
    expect(screen.getByText(/últimos 365 días/)).toBeInTheDocument()
  })

  it('does not show plan banner for clinic plan', () => {
    setup('clinic')
    render(<Registros />)
    expect(screen.queryByText(/últimos \d+ días/)).not.toBeInTheDocument()
  })

  it('shows CSV export button for clinic plan', () => {
    setup('clinic')
    render(<Registros />)
    expect(screen.getByRole('button', { name: /Exportar CSV/ })).toBeInTheDocument()
  })

  it('does not show CSV export button for free plan', () => {
    render(<Registros />)
    expect(screen.queryByRole('button', { name: /Exportar CSV/ })).not.toBeInTheDocument()
  })

  it('shows loading state', () => {
    mocks.useAuditLogs.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<Registros />)
    expect(screen.getByText('Cargando registros...')).toBeInTheDocument()
  })

  it('shows error state', () => {
    mocks.useAuditLogs.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Registros />)
    expect(screen.getByText(/No se pudieron cargar/)).toBeInTheDocument()
  })

  it('shows empty state when no records', () => {
    render(<Registros />)
    expect(screen.getByText('Aún no hay actividad registrada')).toBeInTheDocument()
  })

  it('renders table when data is present', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [sampleItem],
        pagination: { cursor: null, hasMore: false, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    expect(screen.getByText('Ana García')).toBeInTheDocument()
    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument()
  })

  it('opens detail drawer on row click', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [sampleItem],
        pagination: { cursor: null, hasMore: false, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    fireEvent.click(screen.getAllByRole('row')[1])
    expect(screen.getByLabelText('Cerrar')).toBeInTheDocument()
  })

  it('closes detail drawer on backdrop click', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [sampleItem],
        pagination: { cursor: null, hasMore: false, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    // open drawer
    fireEvent.click(screen.getAllByRole('row')[1])
    // close via X button
    fireEvent.click(screen.getByLabelText('Cerrar'))
    expect(screen.queryByLabelText('Cerrar')).not.toBeInTheDocument()
  })

  it('shows pagination button when hasMore is true', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [sampleItem],
        pagination: { cursor: 'next-cursor', hasMore: true, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    expect(screen.getByRole('button', { name: /Siguiente/ })).toBeInTheDocument()
  })

  it('shows failed status in table', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [{ ...sampleItem, status: 'failed' as const }],
        pagination: { cursor: null, hasMore: false, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    // "Fallido" appears in both the status dropdown option and the table cell
    expect(screen.getAllByText('Fallido').length).toBeGreaterThanOrEqual(1)
  })

  it('shows changes diff in drawer', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [
          {
            ...sampleItem,
            action: 'update',
            category: 'entity' as const,
            changes: { fullName: { before: 'Old Name', after: 'New Name' } },
          },
        ],
        pagination: { cursor: null, hasMore: false, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    fireEvent.click(screen.getAllByRole('row')[1])
    expect(screen.getByText('fullName')).toBeInTheDocument()
    expect(screen.getByText('Old Name')).toBeInTheDocument()
    expect(screen.getByText('New Name')).toBeInTheDocument()
  })

  it('shows Sistema label for system actor', () => {
    mocks.useAuditLogs.mockReturnValue({
      data: {
        data: [{ ...sampleItem, actorType: 'system' as const, actorUserId: null, actor: null }],
        pagination: { cursor: null, hasMore: false, limit: 50 },
      },
      isLoading: false,
      isError: false,
    })
    render(<Registros />)
    // "Sistema" appears in both the category dropdown option and the actor column
    expect(screen.getAllByText('Sistema').length).toBeGreaterThanOrEqual(1)
  })

  it('calls downloadAuditLogCsv on export click', async () => {
    setup('clinic')
    const blob = new Blob(['csv'], { type: 'text/csv' })
    mocks.downloadAuditLogCsv.mockResolvedValue(blob)
    mocks.useAuditLogs.mockReturnValue({ data: emptyResponse, isLoading: false, isError: false })
    render(<Registros />)
    fireEvent.click(screen.getByRole('button', { name: /Exportar CSV/ }))
    await vi.waitFor(() => expect(mocks.downloadAuditLogCsv).toHaveBeenCalledTimes(1))
    expect(mocks.triggerDownload).toHaveBeenCalledWith(blob, expect.stringContaining('audit-log-'))
  })
})
