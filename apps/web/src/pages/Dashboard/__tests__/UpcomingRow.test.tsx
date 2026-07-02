import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppointmentWithDetails } from '@rezeta/shared'

const mockStart = vi.fn()
let mockIsStarting = false
vi.mock('@/hooks/consultations/use-start-consultation', () => ({
  useStartConsultation: () => ({ start: mockStart, isStarting: mockIsStarting }),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

import { UpcomingRow } from '../UpcomingRow'

const baseAppt: AppointmentWithDetails = {
  id: 'a1',
  tenantId: 't1',
  patientId: 'p1',
  doctorUserId: 'd1',
  locationId: 'l1',
  status: 'scheduled',
  startsAt: '2026-07-02T14:00:00.000Z',
  endsAt: '2026-07-02T14:30:00.000Z',
  reason: null,
  notes: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  deletedAt: null,
  patientName: 'Ana Reyes',
  patientDocumentNumber: '001',
  locationName: 'Clínica Central',
  consultationId: null,
  consultationStatus: null,
}

const scheduledAppt: AppointmentWithDetails = { ...baseAppt }

const inProgressAppt: AppointmentWithDetails = {
  ...baseAppt,
  status: 'in_progress',
  consultationId: 'c1',
  consultationStatus: 'open',
}

const cancelledAppt: AppointmentWithDetails = { ...baseAppt, status: 'cancelled' }

describe('UpcomingRow workflow action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsStarting = false
  })

  it('shows Iniciar on scheduled rows and starts a consultation on click', async () => {
    render(<UpcomingRow appt={scheduledAppt} isFirst />)
    const action = screen.getByText('Iniciar')
    expect(action).toBeInTheDocument()
    await userEvent.click(action)
    expect(mockStart).toHaveBeenCalledWith(scheduledAppt)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows Continuar on in_progress rows and starts on click', async () => {
    render(<UpcomingRow appt={inProgressAppt} isFirst />)
    const action = screen.getByText('Continuar')
    expect(action).toBeInTheDocument()
    await userEvent.click(action)
    expect(mockStart).toHaveBeenCalledWith(inProgressAppt)
  })

  it('shows no action on cancelled rows', () => {
    render(<UpcomingRow appt={cancelledAppt} isFirst />)
    expect(screen.queryByText('Iniciar')).not.toBeInTheDocument()
    expect(screen.queryByText('Continuar')).not.toBeInTheDocument()
  })

  it('shows no action on in_progress rows whose consultation is not open', () => {
    render(
      <UpcomingRow
        appt={{ ...inProgressAppt, consultationStatus: 'signed' }}
        isFirst
      />,
    )
    expect(screen.queryByText('Continuar')).not.toBeInTheDocument()
    expect(screen.queryByText('Iniciar')).not.toBeInTheDocument()
  })

  it('navigates to the agenda when the row body is clicked', async () => {
    render(<UpcomingRow appt={scheduledAppt} isFirst />)
    await userEvent.click(screen.getByText('Ana Reyes'))
    expect(mockNavigate).toHaveBeenCalledWith('/agenda')
    expect(mockStart).not.toHaveBeenCalled()
  })

  it('shows no action on scheduled rows that already have a consultation', () => {
    render(
      <UpcomingRow
        appt={{ ...scheduledAppt, consultationId: 'c1', consultationStatus: 'open' }}
        isFirst
      />,
    )
    expect(screen.queryByText('Iniciar')).not.toBeInTheDocument()
  })
})
