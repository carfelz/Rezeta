import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/hooks/appointments/use-appointments', () => ({
  useCreateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAppointment: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/locations/use-locations', () => ({
  useLocations: () => ({ data: [{ id: 'loc1', name: 'Consultorio', city: 'Santo Domingo' }] }),
}))

vi.mock('@/hooks/schedules/use-schedules', () => ({
  useGetBlocks: () => ({ data: [] }),
}))

// Surface the value prop the combobox receives so the test can assert the
// initial patient selection without driving the async patient search.
vi.mock('../PatientCombobox', () => ({
  PatientCombobox: ({ value }: { value: string }) => (
    <div data-testid="patient-combobox-value">{value}</div>
  ),
}))

import { AppointmentFormModal } from '../AppointmentFormModal'

describe('AppointmentFormModal', () => {
  it('pre-selects the patient from defaultPatientId', () => {
    render(
      <AppointmentFormModal
        defaultDate="2026-07-02"
        defaultLocationId="loc1"
        defaultPatientId="p1"
        onClose={vi.fn()}
      />,
    )
    expect(screen.getByTestId('patient-combobox-value')).toHaveTextContent('p1')
  })

  it('leaves the patient empty when defaultPatientId is omitted', () => {
    render(
      <AppointmentFormModal defaultDate="2026-07-02" defaultLocationId="loc1" onClose={vi.fn()} />,
    )
    expect(screen.getByTestId('patient-combobox-value')).toHaveTextContent('')
  })
})
