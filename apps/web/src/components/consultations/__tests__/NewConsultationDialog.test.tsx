import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const navigateMock = vi.fn()
const createConsultationMock = vi.fn()
const createPatientMock = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/hooks/consultations/use-consultations', () => ({
  useCreateConsultation: () => ({
    mutateAsync: createConsultationMock,
    isPending: false,
  }),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  useCreatePatient: () => ({
    mutateAsync: createPatientMock,
    isPending: false,
  }),
  // PatientCombobox consumes usePatients for its search dropdown.
  usePatients: () => ({
    data: {
      items: [{ id: 'p1', firstName: 'Ana', lastName: 'Reyes', documentNumber: '001' }],
    },
  }),
}))

vi.mock('@/hooks/locations/use-locations', () => ({
  useLocations: () => ({
    data: [{ id: 'loc1', name: 'Consultorio', city: 'Santo Domingo' }],
  }),
}))

vi.mock('@/store/ui.store', () => ({
  useUiStore: (selector: (s: { activeLocationId: string | null }) => unknown) =>
    selector({ activeLocationId: 'loc1' }),
}))

import { NewConsultationDialog } from '../NewConsultationDialog'

describe('NewConsultationDialog', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    createConsultationMock.mockReset()
    createPatientMock.mockReset()
    createConsultationMock.mockResolvedValue({ id: 'c1' })
    createPatientMock.mockResolvedValue({ id: 'pNew' })
  })

  it('creates a walk-in consultation for an existing patient and navigates', async () => {
    const user = userEvent.setup()
    render(<NewConsultationDialog open onClose={vi.fn()} />)

    // Select a patient via the combobox (location is pre-selected from active location).
    await user.click(screen.getByPlaceholderText('Buscar por nombre o cédula'))
    await user.click(await screen.findByText('Ana Reyes'))

    await user.click(screen.getByText('Iniciar consulta'))

    expect(createConsultationMock).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: 'p1', locationId: 'loc1' }),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/consultas/c1'))
  })

  it('shows the minimal patient form when no match and creates patient then consultation', async () => {
    const user = userEvent.setup()
    render(<NewConsultationDialog open onClose={vi.fn()} />)

    await user.click(screen.getByText('Crear paciente'))
    await user.type(screen.getByLabelText('Nombre'), 'Juan')
    await user.type(screen.getByLabelText('Apellido'), 'Pérez')
    await user.type(screen.getByLabelText('Fecha de nacimiento'), '1990-04-12')

    await user.click(screen.getByText('Iniciar consulta'))

    await waitFor(() => expect(createPatientMock).toHaveBeenCalled())
    await waitFor(() => expect(createConsultationMock).toHaveBeenCalled())
  })

  it('disables submit until patient and location are set', () => {
    render(<NewConsultationDialog open onClose={vi.fn()} />)
    expect(screen.getByText('Iniciar consulta').closest('button')).toBeDisabled()
  })

  it('keeps the dialog open and does not navigate when consultation creation fails', async () => {
    const user = userEvent.setup()
    createConsultationMock.mockRejectedValueOnce(new Error('boom'))
    const onClose = vi.fn()
    render(<NewConsultationDialog open onClose={onClose} />)

    await user.click(screen.getByPlaceholderText('Buscar por nombre o cédula'))
    await user.click(await screen.findByText('Ana Reyes'))
    await user.click(screen.getByText('Iniciar consulta'))

    await waitFor(() => expect(createConsultationMock).toHaveBeenCalled())
    expect(navigateMock).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
