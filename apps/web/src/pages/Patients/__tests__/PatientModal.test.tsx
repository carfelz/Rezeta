import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
  updateMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  useCreatePatient: () => ({ mutateAsync: mocks.createMutateAsync, isPending: false }),
  useUpdatePatient: () => ({ mutateAsync: mocks.updateMutateAsync, isPending: false }),
}))

vi.mock('@/hooks/locations/use-locations', () => ({
  useLocations: () => ({ data: [{ id: 'loc1', name: 'Consultorio', isOwned: true }] }),
}))

vi.mock('@/store/ui.store', () => ({
  useUiStore: (selector: (s: { activeLocationId: string | null }) => unknown) =>
    selector({ activeLocationId: 'loc1' }),
}))

vi.mock('../ClinicalHistory', () => ({
  ClinicalHistory: () => <div data-testid="clinical-history" />,
}))

import { PatientModal } from '../PatientModal'

describe('PatientModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createMutateAsync.mockResolvedValue({ id: 'p1' })
    mocks.updateMutateAsync.mockResolvedValue({ id: 'p1' })
  })

  it('renders allergy and chronic condition tag inputs in create mode', () => {
    render(<PatientModal mode="create" onClose={vi.fn()} />)
    expect(screen.getByLabelText('Alergias')).toBeInTheDocument()
    expect(screen.getByLabelText('Condiciones crónicas')).toBeInTheDocument()
  })

  it('submits allergies and chronic conditions entered via TagInput', async () => {
    const user = userEvent.setup()
    render(<PatientModal mode="create" onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Ej. Ana María Reyes'), 'Ana Reyes')
    await user.type(screen.getByLabelText('Alergias'), 'Penicilina{Enter}')
    await user.type(screen.getByLabelText('Condiciones crónicas'), 'Diabetes{Enter}')

    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }))

    expect(mocks.createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allergies: ['Penicilina'],
        chronicConditions: ['Diabetes'],
      }),
    )
  })

  it('commits an uncommitted Alergias draft when Registrar paciente is clicked without Enter', async () => {
    const user = userEvent.setup()
    render(<PatientModal mode="create" onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Ej. Ana María Reyes'), 'Ana Reyes')
    // Type into Alergias but never press Enter — the draft must still be
    // committed via blur when the submit button is clicked.
    await user.type(screen.getByLabelText('Alergias'), 'Penicilina')

    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }))

    expect(mocks.createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        allergies: ['Penicilina'],
      }),
    )
  })

  it('submits empty arrays when no antecedentes are entered', async () => {
    const user = userEvent.setup()
    render(<PatientModal mode="create" onClose={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('Ej. Ana María Reyes'), 'Ana Reyes')
    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }))

    expect(mocks.createMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allergies: [], chronicConditions: [] }),
    )
  })
})
