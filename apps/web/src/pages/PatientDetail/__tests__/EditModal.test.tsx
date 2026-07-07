import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Patient } from '@rezeta/shared'

const mocks = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  useUpdatePatient: () => ({ mutateAsync: mocks.updateMutateAsync, isPending: false }),
}))

import { EditModal } from '../EditModal'

// Radix Select's pointerdown-based item selection needs these jsdom shims —
// jsdom implements neither pointer capture nor scrollIntoView.
beforeEach(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
  Element.prototype.scrollIntoView = vi.fn()
})

const patient: Patient = {
  id: 'p1',
  tenantId: 't1',
  ownerUserId: 'u1',
  firstName: 'Ana',
  lastName: 'Reyes',
  sex: 'female',
  dateOfBirth: '1990-01-01',
  documentType: 'cedula',
  documentNumber: '001-1234567-8',
  phone: null,
  email: null,
  allergies: ['Penicilina'],
  chronicConditions: ['Diabetes'],
  notes: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
} as unknown as Patient

describe('EditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateMutateAsync.mockResolvedValue(patient)
  })

  it('seeds allergy and chronic condition chips from the patient prop', () => {
    render(<EditModal patient={patient} onClose={vi.fn()} />)
    expect(screen.getByText('Penicilina')).toBeInTheDocument()
    expect(screen.getByText('Diabetes')).toBeInTheDocument()
  })

  it('adds a chronic condition and reflects it in the update payload', async () => {
    const user = userEvent.setup()
    render(<EditModal patient={patient} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText('Condiciones crónicas'), 'Hipertensión{Enter}')
    await user.click(screen.getByText('Guardar cambios'))

    expect(mocks.updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        chronicConditions: ['Diabetes', 'Hipertensión'],
        allergies: ['Penicilina'],
      }),
    )
  })

  it('removes an allergy chip and reflects it in the update payload', async () => {
    const user = userEvent.setup()
    render(<EditModal patient={patient} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Quitar Penicilina' }))
    await user.click(screen.getByText('Guardar cambios'))

    expect(mocks.updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allergies: [], chronicConditions: ['Diabetes'] }),
    )
  })

  it('offers RNC as a document type option and reflects it in the update payload', async () => {
    const user = userEvent.setup()
    render(<EditModal patient={patient} onClose={vi.fn()} />)

    // Selects in DOM order: sex, then document type — index 1 is doc type.
    await user.click(screen.getAllByRole('combobox')[1]!)
    await user.click(screen.getByRole('option', { name: 'RNC' }))
    await user.click(screen.getByText('Guardar cambios'))

    expect(mocks.updateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ documentType: 'rnc' }),
    )
  })
})
