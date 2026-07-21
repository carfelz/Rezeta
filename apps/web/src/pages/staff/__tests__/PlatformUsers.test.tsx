import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlatformUsers } from '../PlatformUsers'

const h = vi.hoisted(() => ({
  useStaffPlatformUsers: vi.fn(),
  useCreatePlatformUser: vi.fn(),
  useSetPlatformUserActive: vi.fn(),
  useResendPlatformUserInvite: vi.fn(),
  useStaffMe: vi.fn(),
}))

vi.mock('@/hooks/staff/use-platform-users', () => ({
  useStaffPlatformUsers: h.useStaffPlatformUsers,
  useCreatePlatformUser: h.useCreatePlatformUser,
  useSetPlatformUserActive: h.useSetPlatformUserActive,
  useResendPlatformUserInvite: h.useResendPlatformUserInvite,
}))
vi.mock('@/hooks/staff/use-staff-me', () => ({ useStaffMe: h.useStaffMe }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

const me = { id: 'pu-1', externalUid: 'ext-1', email: 'carlos@rezeta.do', fullName: 'Carlos Féliz' }
const rows = [
  {
    id: 'pu-1',
    email: 'carlos@rezeta.do',
    fullName: 'Carlos Féliz',
    isActive: true,
    createdAt: '2026-07-01T00:00:00.000Z',
    lastLoginAt: '2026-07-20T09:00:00.000Z',
    status: 'active' as const,
  },
  {
    id: 'pu-2',
    email: 'laura@rezeta.do',
    fullName: 'Laura Medina',
    isActive: true,
    createdAt: '2026-07-18T00:00:00.000Z',
    lastLoginAt: null,
    status: 'invited' as const,
  },
]

const createMutation = { mutateAsync: vi.fn(), isPending: false }
const resendMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }
const setActiveMutation = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }

beforeEach(() => {
  vi.clearAllMocks()
  h.useStaffMe.mockReturnValue({ data: me })
  h.useStaffPlatformUsers.mockReturnValue({ data: rows, isLoading: false, isError: false })
  h.useCreatePlatformUser.mockReturnValue(createMutation)
  h.useSetPlatformUserActive.mockReturnValue(setActiveMutation)
  h.useResendPlatformUserInvite.mockReturnValue(resendMutation)
})

describe('PlatformUsers', () => {
  it('renders the roster with derived status and the You chip on own row', () => {
    render(<PlatformUsers />)
    expect(screen.getByText('Platform users')).toBeInTheDocument()
    expect(screen.getByText('Carlos Féliz')).toBeInTheDocument()
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('Invite pending')).toBeInTheDocument()
  })

  it('does not offer Deactivate on the acting user’s own row', () => {
    render(<PlatformUsers />)
    const ownRow = screen.getByText('Carlos Féliz').closest('tr')!
    expect(ownRow.textContent).not.toContain('Deactivate')
    const otherRow = screen.getByText('Laura Medina').closest('tr')!
    expect(otherRow.textContent).toContain('Deactivate')
  })

  it('shows Resend link only for invited users and calls the mutation', async () => {
    render(<PlatformUsers />)
    const resend = screen.getByRole('button', { name: 'Resend link' })
    fireEvent.click(resend)
    await waitFor(() => expect(resendMutation.mutateAsync).toHaveBeenCalled())
  })

  it('submits the create form with the typed payload', async () => {
    createMutation.mutateAsync.mockResolvedValue(rows[1])
    render(<PlatformUsers />)
    fireEvent.click(screen.getByRole('button', { name: 'New user' }))
    fireEvent.change(screen.getByPlaceholderText('Laura Medina'), {
      target: { value: 'Nueva Persona' },
    })
    fireEvent.change(screen.getByPlaceholderText('laura@rezeta.do'), {
      target: { value: 'nueva@rezeta.do' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create user' }))
    await waitFor(() =>
      expect(createMutation.mutateAsync).toHaveBeenCalledWith({
        fullName: 'Nueva Persona',
        email: 'nueva@rezeta.do',
      }),
    )
  })

  it('renders the empty state when there are no users', () => {
    h.useStaffPlatformUsers.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<PlatformUsers />)
    expect(screen.getByText('No platform users yet')).toBeInTheDocument()
  })
})
