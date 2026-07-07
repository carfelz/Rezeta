import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────
// This file exercises the *real* PatientCombobox (and therefore the real
// PatientModal it renders for "Nuevo paciente") wired into AppointmentFormModal,
// so the end-to-end create-then-select flow is verified against actual
// component behavior rather than a stub.

const appointmentMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/appointments/use-appointments', () => ({
  useCreateAppointment: () => ({ mutateAsync: appointmentMocks.createMutateAsync, isPending: false }),
  useUpdateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/locations/use-locations', () => ({
  useLocations: () => ({ data: [{ id: 'loc1', name: 'Consultorio', city: 'Santo Domingo' }] }),
}))

vi.mock('@/hooks/schedules/use-schedules', () => ({
  useGetBlocks: () => ({ data: [] }),
}))

const patientMocks = vi.hoisted(() => ({
  createMutateAsync: vi.fn(),
}))

vi.mock('@/hooks/patients/use-patients', () => ({
  usePatients: () => ({ data: { items: [] } }),
  useCreatePatient: () => ({ mutateAsync: patientMocks.createMutateAsync, isPending: false }),
  useUpdatePatient: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/store/ui.store', () => ({
  useUiStore: (selector: (s: { activeLocationId: string | null }) => unknown) =>
    selector({ activeLocationId: 'loc1' }),
}))

import { AppointmentFormModal } from '../AppointmentFormModal'

describe('AppointmentFormModal + PatientCombobox integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a patient inline from the booking picker and selects it in the form', async () => {
    patientMocks.createMutateAsync.mockResolvedValue({
      id: 'new-patient-1',
      firstName: 'Luis',
      lastName: 'Pérez',
    })

    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <AppointmentFormModal defaultDate="2026-07-02" defaultLocationId="loc1" onClose={onClose} />,
    )

    await user.click(screen.getByPlaceholderText(/buscar paciente/i))
    await user.click(screen.getByRole('button', { name: /nuevo paciente/i }))

    expect(screen.getByRole('heading', { name: 'Registrar paciente' })).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Ej. Ana María Reyes'), 'Luis Pérez')
    await user.click(screen.getByRole('button', { name: 'Registrar paciente' }))

    expect(patientMocks.createMutateAsync).toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Registrar paciente' }),
    ).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Luis Pérez')).toBeInTheDocument()

    // Pin the nested-form bubbling fix: submitting the inner patient-create
    // form (portaled inside this outer AppointmentFormModal's <form>) must
    // NOT also trigger the outer appointment form's submit handler or close
    // the outer modal. Without PatientModal's handleSubmit calling
    // e.stopPropagation(), React's synthetic submit event bubbles through
    // the React tree (not the DOM tree) and would fire both. Verified by
    // temporarily removing that stopPropagation call: this assertion fails
    // (appointmentMocks.createMutateAsync gets called) without the fix.
    expect(appointmentMocks.createMutateAsync).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
