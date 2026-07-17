import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ManagedUserDto } from '@rezeta/shared'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const mocks = vi.hoisted(() => ({
  useUsers: vi.fn(),
  useCreateUser: vi.fn(),
  useChangeUserRole: vi.fn(),
  useSetUserActive: vi.fn(),
  useResendInvite: vi.fn(),
  useCan: vi.fn(),
  useAuth: vi.fn(),
  createMutateAsync: vi.fn(),
  setActiveMutateAsync: vi.fn(),
  changeRoleMutateAsync: vi.fn(),
  resendInviteMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/users/use-users', () => ({
  useUsers: mocks.useUsers,
  useCreateUser: mocks.useCreateUser,
  useChangeUserRole: mocks.useChangeUserRole,
  useSetUserActive: mocks.useSetUserActive,
  useResendInvite: mocks.useResendInvite,
}))

vi.mock('@/hooks/use-can', () => ({ useCan: mocks.useCan }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: mocks.useAuth }))

import { Users } from '../Users'

const invitedUser: ManagedUserDto = {
  id: 'u2',
  email: 'nurse@clinic.do',
  fullName: 'Ana Reyes',
  role: 'assistant',
  isActive: true,
  createdAt: '2026-07-15T00:00:00.000Z',
  lastLoginAt: null,
  status: 'invited',
}

const activeUser: ManagedUserDto = {
  id: 'u3',
  email: 'doc@clinic.do',
  fullName: 'Dr. Activo',
  role: 'doctor',
  isActive: true,
  createdAt: '2026-07-15T00:00:00.000Z',
  lastLoginAt: '2026-07-16T00:00:00.000Z',
  status: 'active',
}

const inactiveUser: ManagedUserDto = {
  id: 'u4',
  email: 'inactivo@clinic.do',
  fullName: 'Ex Empleado',
  role: 'doctor',
  isActive: false,
  createdAt: '2026-07-15T00:00:00.000Z',
  lastLoginAt: '2026-07-16T00:00:00.000Z',
  status: 'active',
}

/** A higher-rank peer than 'admin' — used to assert controls stay hidden for it. */
const superAdminUser: ManagedUserDto = {
  id: 'u5',
  email: 'boss@clinic.do',
  fullName: 'Dueña Dueño',
  role: 'super_admin',
  isActive: true,
  createdAt: '2026-07-15T00:00:00.000Z',
  lastLoginAt: '2026-07-16T00:00:00.000Z',
  status: 'active',
}

/** A higher-rank peer who is still invited — used to assert resend also stays hidden for it. */
const invitedSuperAdminUser: ManagedUserDto = {
  id: 'u6',
  email: 'newboss@clinic.do',
  fullName: 'Nueva Dueña',
  role: 'super_admin',
  isActive: true,
  createdAt: '2026-07-15T00:00:00.000Z',
  lastLoginAt: null,
  status: 'invited',
}

const roster = [invitedUser, activeUser, inactiveUser]
const rosterWithHigherRank = [...roster, superAdminUser, invitedSuperAdminUser]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useCan.mockReturnValue(true)
  // Default actor is super_admin (least restrictive) — individual rank-gating
  // tests override this to 'admin' to exercise the filtering behavior.
  mocks.useAuth.mockReturnValue({
    user: { role: 'super_admin' },
    isLoading: false,
    isAuthenticated: true,
  })
  mocks.useUsers.mockReturnValue({ data: roster, isLoading: false, isError: false })
  mocks.createMutateAsync.mockResolvedValue({ ...invitedUser, id: 'u7' })
  mocks.useCreateUser.mockReturnValue({ mutateAsync: mocks.createMutateAsync, isPending: false })
  mocks.changeRoleMutateAsync.mockResolvedValue({ ...invitedUser, role: 'doctor' })
  mocks.useChangeUserRole.mockReturnValue({
    mutateAsync: mocks.changeRoleMutateAsync,
    isPending: false,
  })
  mocks.setActiveMutateAsync.mockResolvedValue({ ...activeUser, isActive: false })
  mocks.useSetUserActive.mockReturnValue({
    mutateAsync: mocks.setActiveMutateAsync,
    isPending: false,
  })
  mocks.resendInviteMutateAsync.mockResolvedValue({ ...invitedUser })
  mocks.useResendInvite.mockReturnValue({
    mutateAsync: mocks.resendInviteMutateAsync,
    isPending: false,
  })
})

describe('Users page — manager', () => {
  it('submits the create form with email, name and role', async () => {
    render(<Users />)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/i }))
    fireEvent.change(screen.getByPlaceholderText('Ej. Ana Reyes'), {
      target: { value: 'Dr. Nuevo' },
    })
    fireEvent.change(screen.getByPlaceholderText('usuario@clinica.do'), {
      target: { value: 'doc@clinic.do' },
    })
    fireEvent.change(screen.getByLabelText('Rol'), { target: { value: 'doctor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => {
      expect(mocks.createMutateAsync).toHaveBeenCalledWith({
        email: 'doc@clinic.do',
        fullName: 'Dr. Nuevo',
        role: 'doctor',
      })
    })
  })

  it('lists existing users', () => {
    render(<Users />)
    expect(screen.getByText('Ana Reyes')).toBeInTheDocument()
    expect(screen.getByText('nurse@clinic.do')).toBeInTheDocument()
  })

  it('renders the invited status badge for a user with status invited', () => {
    render(<Users />)
    expect(screen.getByText('Invitación enviada')).toBeInTheDocument()
  })

  it('renders the active status badge for an active user', () => {
    render(<Users />)
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('renders the inactive status badge for a deactivated user', () => {
    render(<Users />)
    expect(screen.getByText('Inactivo')).toBeInTheDocument()
  })

  it('deactivates an active user', async () => {
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const activeRow = rows.find((r) => r.textContent?.includes('Dr. Activo'))
    const button = activeRow ? within(activeRow).getByRole('button', { name: 'Desactivar' }) : null
    expect(button).not.toBeNull()
    fireEvent.click(button!)
    await waitFor(() => {
      expect(mocks.setActiveMutateAsync).toHaveBeenCalledWith({ isActive: false })
    })
  })

  it('shows a create error callout when the mutation rejects', async () => {
    mocks.createMutateAsync.mockRejectedValue(new Error('boom'))
    render(<Users />)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/i }))
    fireEvent.change(screen.getByPlaceholderText('Ej. Ana Reyes'), {
      target: { value: 'Dr. Nuevo' },
    })
    fireEvent.change(screen.getByPlaceholderText('usuario@clinica.do'), {
      target: { value: 'doc@clinic.do' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Crear usuario' }))
    await waitFor(() => {
      expect(
        screen.getByText('No se pudo crear el usuario. Intenta de nuevo.'),
      ).toBeInTheDocument()
    })
  })

  it('shows a loading state', () => {
    mocks.useUsers.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<Users />)
    expect(screen.getByText('Cargando usuarios...')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    mocks.useUsers.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Users />)
    expect(screen.getByText('No se pudieron cargar los usuarios.')).toBeInTheDocument()
  })

  it('shows an empty state when there are no users', () => {
    mocks.useUsers.mockReturnValue({ data: [], isLoading: false, isError: false })
    render(<Users />)
    expect(screen.getByText('Sin usuarios')).toBeInTheDocument()
  })
})

describe('Users page — assistant (no manage capability)', () => {
  it('cannot reach the create form', () => {
    mocks.useCan.mockReturnValue(false)
    render(<Users />)
    expect(screen.queryByRole('button', { name: /Nuevo usuario/i })).not.toBeInTheDocument()
    expect(screen.getByText('Sin acceso')).toBeInTheDocument()
  })
})

describe('Users page — rank-filtered create-form role options', () => {
  function openCreateForm(): void {
    render(<Users />)
    fireEvent.click(screen.getByRole('button', { name: /Nuevo usuario/i }))
  }

  it('an admin actor only sees assistant + doctor in the create-form role select', () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    openCreateForm()
    const select = screen.getByLabelText<HTMLSelectElement>('Rol')
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual(['Asistente', 'Doctor'])
  })

  it('a super_admin actor sees assistant + doctor + admin, but not super_admin (own rank)', () => {
    mocks.useAuth.mockReturnValue({
      user: { role: 'super_admin' },
      isLoading: false,
      isAuthenticated: true,
    })
    openCreateForm()
    const select = screen.getByLabelText<HTMLSelectElement>('Rol')
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual(['Asistente', 'Doctor', 'Administrador'])
  })
})

describe('Users page — rank-gated activate/deactivate control', () => {
  beforeEach(() => {
    mocks.useUsers.mockReturnValue({ data: rosterWithHigherRank, isLoading: false, isError: false })
  })

  it('hides the activate/deactivate control on a row outranking the actor (admin viewing a super_admin row)', () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Dueña Dueño'))
    expect(row).toBeDefined()
    expect(within(row!).queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument()
    expect(within(row!).queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument()
  })

  it('shows the activate/deactivate control on a row below the actor rank (admin viewing an assistant row)', () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    expect(row).toBeDefined()
    expect(within(row!).getByRole('button', { name: 'Desactivar' })).toBeInTheDocument()
  })
})

describe('Users page — role-change control', () => {
  it('shows a role-change select on a row below the actor rank, filtered to manageable roles', () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    const select = within(row!).getByLabelText<HTMLSelectElement>('Cambiar rol')
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels).toEqual(['Asistente', 'Doctor'])
  })

  it('hides the role-change control on a row outranking the actor', () => {
    mocks.useUsers.mockReturnValue({ data: rosterWithHigherRank, isLoading: false, isError: false })
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Dueña Dueño'))
    expect(within(row!).queryByLabelText('Cambiar rol')).not.toBeInTheDocument()
  })

  it('issues the role-change PATCH via useChangeUserRole when the select changes', async () => {
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    const select = within(row!).getByLabelText('Cambiar rol')
    fireEvent.change(select, { target: { value: 'doctor' } })
    await waitFor(() => {
      expect(mocks.changeRoleMutateAsync).toHaveBeenCalledWith({ role: 'doctor' })
    })
  })

  it('surfaces a role-change error via Callout when the mutation rejects', async () => {
    mocks.changeRoleMutateAsync.mockRejectedValue(new Error('boom'))
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    const select = within(row!).getByLabelText('Cambiar rol')
    fireEvent.change(select, { target: { value: 'doctor' } })
    await waitFor(() => {
      expect(
        within(row!).getByText('No se pudo cambiar el rol. Intenta de nuevo.'),
      ).toBeInTheDocument()
    })
  })
})

describe('Users page — resend invite', () => {
  it('shows the resend button only on invited-status rows', () => {
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const invitedRow = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    const activeRow = rows.find((r) => r.textContent?.includes('Dr. Activo'))
    expect(within(invitedRow!).getByRole('button', { name: 'Reenviar invitación' })).toBeInTheDocument()
    expect(
      within(activeRow!).queryByRole('button', { name: 'Reenviar invitación' }),
    ).not.toBeInTheDocument()
  })

  it('hides the resend button on an invited row that outranks the actor', () => {
    mocks.useUsers.mockReturnValue({ data: rosterWithHigherRank, isLoading: false, isError: false })
    mocks.useAuth.mockReturnValue({ user: { role: 'admin' }, isLoading: false, isAuthenticated: true })
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Nueva Dueña'))
    expect(row).toBeDefined()
    expect(within(row!).queryByRole('button', { name: 'Reenviar invitación' })).not.toBeInTheDocument()
  })

  it('calls useResendInvite mutateAsync when the resend button is clicked', async () => {
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    fireEvent.click(within(row!).getByRole('button', { name: 'Reenviar invitación' }))
    await waitFor(() => {
      expect(mocks.resendInviteMutateAsync).toHaveBeenCalled()
    })
  })

  it('surfaces a resend error when the mutation rejects', async () => {
    mocks.resendInviteMutateAsync.mockRejectedValue(new Error('boom'))
    render(<Users />)
    const rows = screen.getAllByRole('row')
    const row = rows.find((r) => r.textContent?.includes('Ana Reyes'))
    fireEvent.click(within(row!).getByRole('button', { name: 'Reenviar invitación' }))
    await waitFor(() => {
      expect(
        within(row!).getByText('No se pudo reenviar la invitación. Intenta de nuevo.'),
      ).toBeInTheDocument()
    })
  })
})
