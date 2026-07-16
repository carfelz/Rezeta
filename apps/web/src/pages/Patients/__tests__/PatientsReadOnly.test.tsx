import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { makeAuthUser, seedAuthUser } from '@/test/auth-helpers'

const patient = {
  id: 'p1',
  tenantId: 't1',
  ownerUserId: 'u1',
  firstName: 'Ana',
  lastName: 'Reyes',
  dateOfBirth: '1990-01-01',
  sex: 'female',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: '809-555-0000',
  email: null,
  address: null,
  bloodType: null,
  allergies: [],
  chronicConditions: [],
  notes: null,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
}

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatients: () => ({ data: { items: [patient], hasMore: false }, isLoading: false, isError: false }),
  useDeletePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

import { Patients } from '../index'

function renderPatients(): void {
  render(
    <MemoryRouter>
      <Patients />
    </MemoryRouter>,
  )
}

afterEach(() => {
  seedAuthUser(null)
  vi.clearAllMocks()
})

describe('Patients read-only gating', () => {
  it('hides create/edit/delete controls for a view-only assistant', () => {
    seedAuthUser(makeAuthUser('assistant')) // patients = view
    renderPatients()
    expect(screen.queryByRole('button', { name: 'Registrar paciente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Editar paciente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Eliminar paciente' })).not.toBeInTheDocument()
    // read access is unaffected
    expect(screen.getByRole('button', { name: 'Ver paciente' })).toBeInTheDocument()
  })

  it('shows create/edit/delete controls for a doctor', () => {
    seedAuthUser(makeAuthUser('doctor')) // patients = manage
    renderPatients()
    expect(screen.getByRole('button', { name: 'Registrar paciente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar paciente' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Eliminar paciente' })).toBeInTheDocument()
  })
})
