import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SsoConnections } from '../SsoConnections'

const h = vi.hoisted(() => ({
  useSsoConnections: vi.fn(),
  useCreateSsoConnection: vi.fn(),
  useUpdateSsoConnection: vi.fn(),
  useSetSsoConnectionStatus: vi.fn(),
  useDeleteSsoConnection: vi.fn(),
  useTestSsoConnection: vi.fn(),
  useStaffInstitutions: vi.fn(),
}))

vi.mock('@/hooks/identity/use-sso-connections', () => ({
  useSsoConnections: h.useSsoConnections,
  useCreateSsoConnection: h.useCreateSsoConnection,
  useUpdateSsoConnection: h.useUpdateSsoConnection,
  useSetSsoConnectionStatus: h.useSetSsoConnectionStatus,
  useDeleteSsoConnection: h.useDeleteSsoConnection,
  useTestSsoConnection: h.useTestSsoConnection,
}))
vi.mock('@/hooks/staff/use-institutions', () => ({ useStaffInstitutions: h.useStaffInstitutions }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const institutions = [
  {
    id: 't1',
    name: 'Centro Vista Alegre',
    type: 'clinic' as const,
    plan: 'clinic' as const,
    createdAt: '2026-07-01T00:00:00.000Z',
    userCount: 5,
    activeUserCount: 4,
  },
]

const connection = {
  id: 'sso-1',
  tenantId: 't1',
  tenantName: 'Centro Vista Alegre',
  type: 'oidc' as const,
  providerId: 'centro-vista-alegre',
  displayName: 'Azure AD',
  issuerUrl: 'https://login.microsoftonline.com/tenant/v2.0',
  clientId: 'client-abc',
  domains: ['clinica.do', 'hospital.do'],
  allowPassword: true,
  status: 'active' as const,
  createdAt: '2026-07-01T00:00:00.000Z',
}

const createMutation = { mutateAsync: vi.fn(), isPending: false }
const updateMutation = { mutateAsync: vi.fn(), isPending: false }
const setStatusMutation = { mutateAsync: vi.fn(), isPending: false }
const deleteMutation = { mutateAsync: vi.fn(), isPending: false }
const testMutation = { mutateAsync: vi.fn(), isPending: false }

beforeEach(() => {
  vi.clearAllMocks()
  createMutation.isPending = false
  updateMutation.isPending = false
  setStatusMutation.isPending = false
  deleteMutation.isPending = false
  testMutation.isPending = false
  h.useSsoConnections.mockReturnValue({ data: [connection], isLoading: false, isError: false })
  h.useStaffInstitutions.mockReturnValue({ data: institutions, isLoading: false, isError: false })
  h.useCreateSsoConnection.mockReturnValue(createMutation)
  h.useUpdateSsoConnection.mockReturnValue(updateMutation)
  h.useSetSsoConnectionStatus.mockReturnValue(setStatusMutation)
  h.useDeleteSsoConnection.mockReturnValue(deleteMutation)
  h.useTestSsoConnection.mockReturnValue(testMutation)
})

describe('SsoConnections', () => {
  it('renders the table with institution, display name, domains, status, and password indicator', () => {
    render(<SsoConnections />)
    expect(screen.getByText('SSO connections')).toBeInTheDocument()
    expect(screen.getByText('Centro Vista Alegre')).toBeInTheDocument()
    expect(screen.getByText('Azure AD')).toBeInTheDocument()
    expect(screen.getByText('clinica.do, hospital.do')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('opens the create modal on "New connection" and submits the typed payload, closing on success', async () => {
    createMutation.mutateAsync.mockResolvedValue({ ...connection, id: 'sso-2' })
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'New connection' }))
    expect(screen.getByText('New SSO connection')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 't1' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Azure AD'), {
      target: { value: 'Okta SSO' },
    })
    fireEvent.change(screen.getByPlaceholderText('https://login.microsoftonline.com/…'), {
      target: { value: 'https://okta.example.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('client_id'), {
      target: { value: 'client-999' },
    })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'super-secret' },
    })
    fireEvent.change(screen.getByPlaceholderText('clinica.do, hospital.do'), {
      target: { value: 'nuevo.do' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create connection' }))

    await waitFor(() =>
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({
        tenantId: 't1',
        displayName: 'Okta SSO',
        issuerUrl: 'https://okta.example.com',
        clientId: 'client-999',
        clientSecret: 'super-secret',
        domains: ['nuevo.do'],
        allowPassword: true,
      }),
    )
    await waitFor(() => expect(screen.queryByText('New SSO connection')).not.toBeInTheDocument())
  })

  it('edit modal leaves the secret field empty with helper text and omits clientSecret when untouched', async () => {
    updateMutation.mutateAsync.mockResolvedValue(connection)
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByText('Leave empty to keep the current secret')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(updateMutation.mutateAsync).toHaveBeenCalled())
    const payload = updateMutation.mutateAsync.mock.calls[0]?.[0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('clientSecret')
    expect(payload).toMatchObject({ displayName: 'Azure AD' })
  })

  it('"Test" calls the test mutation and shows a success Callout listing verified checks', async () => {
    testMutation.mutateAsync.mockResolvedValue({ ok: true, checked: ['issuer', 'jwks'] })
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    await waitFor(() => expect(testMutation.mutateAsync).toHaveBeenCalled())
    expect(await screen.findByText(/issuer, jwks/)).toBeInTheDocument()
  })

  it('"Test" shows a danger Callout with the failure reason on failure', async () => {
    testMutation.mutateAsync.mockResolvedValue({
      ok: false,
      checked: ['issuer'],
      failure: 'jwks unreachable',
    })
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(await screen.findByText('jwks unreachable')).toBeInTheDocument()
  })

  it('"Deactivate" goes through a ConfirmDialog and fires the status mutation on confirm', async () => {
    setStatusMutation.mutateAsync.mockResolvedValue({ ...connection, status: 'disabled' })
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(screen.getByText('Deactivate connection')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(setStatusMutation.mutateAsync).toHaveBeenCalledWith({ status: 'disabled' }),
    )
  })

  it('shows the English pending label on the confirm button while the deactivate mutation is in flight', () => {
    setStatusMutation.isPending = true
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled()
    expect(screen.queryByText('Procesando...')).not.toBeInTheDocument()
  })

  it('delete goes through a danger ConfirmDialog and fires the delete mutation on confirm', async () => {
    deleteMutation.mutateAsync.mockResolvedValue(undefined)
    render(<SsoConnections />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Delete connection')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(deleteMutation.mutateAsync).toHaveBeenCalled())
  })
})
