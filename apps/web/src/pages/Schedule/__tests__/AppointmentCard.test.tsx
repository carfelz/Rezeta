import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { AppointmentWithDetails } from '@rezeta/shared'
import { AppointmentCard } from '../AppointmentCard'

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

const completedWithConsultation: AppointmentWithDetails = {
  ...baseAppt,
  status: 'completed',
  consultationId: 'c1',
  consultationStatus: 'signed',
}

function makeHandlers() {
  return {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onStatusChange: vi.fn(),
    isUpdatingStatus: false,
    onStartConsultation: vi.fn(),
    isStartingConsultation: false,
  }
}

describe('AppointmentCard workflow actions', () => {
  it('shows Iniciar consulta on a scheduled appointment without consultation', () => {
    render(<AppointmentCard appt={scheduledAppt} {...makeHandlers()} />)
    expect(screen.getByText('Iniciar consulta')).toBeInTheDocument()
    expect(screen.getByText('Completar')).toBeInTheDocument()
  })

  it('shows Continuar consulta and En consulta badge when in_progress', () => {
    render(<AppointmentCard appt={inProgressAppt} {...makeHandlers()} />)
    expect(screen.getByText('Continuar consulta')).toBeInTheDocument()
    expect(screen.getByText('En consulta')).toBeInTheDocument()
    expect(screen.queryByText('Completar')).not.toBeInTheDocument()
    expect(screen.queryByText('No asistió')).not.toBeInTheDocument()
  })

  it('shows Ver consulta on a completed appointment with a consultation', () => {
    render(<AppointmentCard appt={completedWithConsultation} {...makeHandlers()} />)
    expect(screen.getByText('Ver consulta')).toBeInTheDocument()
  })

  it('hides Completar when a consultation is linked', () => {
    render(
      <AppointmentCard
        appt={{ ...scheduledAppt, consultationId: 'c1', consultationStatus: 'open' }}
        {...makeHandlers()}
      />,
    )
    expect(screen.queryByText('Completar')).not.toBeInTheDocument()
  })

  it('hides Eliminar when in_progress', () => {
    render(<AppointmentCard appt={inProgressAppt} {...makeHandlers()} />)
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument()
  })

  it('fires onStartConsultation on Iniciar consulta click', async () => {
    const handlers = makeHandlers()
    render(<AppointmentCard appt={scheduledAppt} {...handlers} />)
    await userEvent.click(screen.getByText('Iniciar consulta'))
    expect(handlers.onStartConsultation).toHaveBeenCalled()
  })
})
