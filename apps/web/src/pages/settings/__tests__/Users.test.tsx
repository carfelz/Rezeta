import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ManagedUserDto } from '@rezeta/shared'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

const mocks = vi.hoisted(() => ({
  useUsers: vi.fn(),
  useCreateUser: vi.fn(),
  useChangeUserRole: vi.fn(),
  useSetUserActive: vi.fn(),
  useCan: vi.fn(),
  createMutateAsync: vi.fn(),
  setActiveMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/users/use-users', () => ({
  useUsers: mocks.useUsers,
  useCreateUser: mocks.useCreateUser,
  useChangeUserRole: mocks.useChangeUserRole,
  useSetUserActive: mocks.useSetUserActive,
}))

vi.mock('@/hooks/use-can', () => ({ useCan: mocks.useCan }))

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

const roster = [invitedUser, activeUser, inactiveUser]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useCan.mockReturnValue(true)
  mocks.useUsers.mockReturnValue({ data: roster, isLoading: false, isError: false })
  mocks.createMutateAsync.mockResolvedValue({ ...invitedUser, id: 'u5' })
  mocks.useCreateUser.mockReturnValue({ mutateAsync: mocks.createMutateAsync, isPending: false })
  mocks.useChangeUserRole.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
  mocks.setActiveMutateAsync.mockResolvedValue({ ...activeUser, isActive: false })
  mocks.useSetUserActive.mockReturnValue({
    mutateAsync: mocks.setActiveMutateAsync,
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
