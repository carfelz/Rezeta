import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PermissionMatrixResponse } from '@rezeta/shared'

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

const mocks = vi.hoisted(() => ({
  usePermissionMatrix: vi.fn(),
  useUpdatePermission: vi.fn(),
  useCan: vi.fn(),
  useAuth: vi.fn(),
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
}))

vi.mock('@/hooks/permissions/use-permissions', () => ({
  usePermissionMatrix: mocks.usePermissionMatrix,
  useUpdatePermission: mocks.useUpdatePermission,
}))

vi.mock('@/hooks/use-can', () => ({ useCan: mocks.useCan }))
vi.mock('@/hooks/use-auth', () => ({ useAuth: mocks.useAuth }))

import { Permissions } from '../Permissions'

/** Typed convenience wrapper — avoids `as HTMLSelectElement` casts, which
 * `no-unnecessary-type-assertion` flags here because the assertion itself
 * would otherwise supply the contextual type for getByLabelText's generic. */
function getSelect(label: string): HTMLSelectElement {
  return screen.getByLabelText<HTMLSelectElement>(label)
}

// Fixture: two clinical modules with DIFFERING levels for 'doctor' (to exercise
// "Mixto"), plus one admin module. 'assistant' and 'admin'/'super_admin' stay
// uniform per section so only the doctor column is mixed.
const fixture: PermissionMatrixResponse = {
  modules: [
    {
      key: 'patients',
      section: 'clinical',
      defaults: { assistant: 'view', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
    },
    {
      key: 'consultations',
      section: 'clinical',
      defaults: { assistant: 'view', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
    },
    {
      key: 'locations',
      section: 'admin',
      defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
    },
  ],
  matrix: {
    assistant: { patients: 'view', consultations: 'view', locations: 'none' } as never,
    doctor: { patients: 'manage', consultations: 'view', locations: 'manage' } as never,
    admin: { patients: 'manage', consultations: 'manage', locations: 'manage' } as never,
    super_admin: { patients: 'manage', consultations: 'manage', locations: 'manage' } as never,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.usePermissionMatrix.mockReturnValue({ data: fixture, isLoading: false, isError: false })
  mocks.mutateAsync.mockResolvedValue({})
  mocks.useUpdatePermission.mockReturnValue({ mutate: mocks.mutate, mutateAsync: mocks.mutateAsync })
  mocks.useCan.mockReturnValue(true)
  mocks.useAuth.mockReturnValue({ user: { role: 'admin' } })
})

describe('Permissions page', () => {
  it('renders defaults: each module select shows its matrix value', () => {
    render(<Permissions />)
    expect(getSelect('Pacientes — Doctor').value).toBe('manage')
    expect(getSelect('Consultas — Doctor').value).toBe('view')
    expect(getSelect('Ubicaciones — Administrador').value).toBe('manage')
  })

  it('changing a cell issues a single PATCH via mutate', async () => {
    render(<Permissions />)
    fireEvent.change(getSelect('Pacientes — Doctor'), { target: { value: 'view' } })
    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        role: 'doctor',
        moduleKey: 'patients',
        accessLevel: 'view',
      })
    })
  })

  it('section bulk-apply issues one PATCH per module in the section', async () => {
    render(<Permissions />)
    fireEvent.change(getSelect('Trabajo clínico — Doctor — Aplicar a toda la sección'), {
      target: { value: 'manage' },
    })
    await waitFor(() => {
      expect(mocks.mutateAsync).toHaveBeenCalledTimes(2)
    })
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      role: 'doctor',
      moduleKey: 'patients',
      accessLevel: 'manage',
    })
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      role: 'doctor',
      moduleKey: 'consultations',
      accessLevel: 'manage',
    })
  })

  it('shows "Mixto" for a mixed section', () => {
    render(<Permissions />)
    const select = getSelect('Trabajo clínico — Doctor — Aplicar a toda la sección')
    expect(select.value).toBe('mixed')
    expect(screen.getByText('Mixto')).toBeInTheDocument()
  })

  it('disables own-rank and higher-rank columns for an admin user, leaves lower ranks enabled', () => {
    render(<Permissions />)
    expect(getSelect('Pacientes — Administrador').disabled).toBe(true)
    expect(getSelect('Pacientes — Propietario').disabled).toBe(true)
    expect(getSelect('Pacientes — Doctor').disabled).toBe(false)
    expect(getSelect('Pacientes — Asistente').disabled).toBe(false)
  })

  it('is fully read-only when the user lacks manage capability', () => {
    mocks.useCan.mockReturnValue(false)
    render(<Permissions />)
    const selects = screen.getAllByRole<HTMLSelectElement>('combobox')
    expect(selects.length).toBeGreaterThan(0)
    for (const select of selects) {
      expect(select.disabled).toBe(true)
    }
  })

  it('shows a loading state', () => {
    mocks.usePermissionMatrix.mockReturnValue({ data: undefined, isLoading: true, isError: false })
    render(<Permissions />)
    expect(screen.getByText('Cargando permisos...')).toBeInTheDocument()
  })

  it('shows an error state', () => {
    mocks.usePermissionMatrix.mockReturnValue({ data: undefined, isLoading: false, isError: true })
    render(<Permissions />)
    expect(
      screen.getByText('No se pudieron cargar los permisos. Intenta recargar la página.'),
    ).toBeInTheDocument()
  })
})
