import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import type { AppointmentWithDetails } from '@rezeta/shared'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

const mockMutateAsync = vi.fn()
let mockIsPending = false
vi.mock('../use-consultations', () => ({
  useCreateConsultation: () => ({
    mutateAsync: mockMutateAsync,
    isPending: mockIsPending,
  }),
}))

import { useStartConsultation } from '../use-start-consultation'

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

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  return createElement('div', null, children)
}

describe('useStartConsultation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPending = false
  })

  it('navigates directly when the appointment already has a consultation', () => {
    const { result } = renderHook(() => useStartConsultation(), { wrapper })
    result.current.start({ ...baseAppt, consultationId: 'c1', consultationStatus: 'open' })
    expect(mockNavigate).toHaveBeenCalledWith('/consultas/c1')
    expect(mockMutateAsync).not.toHaveBeenCalled()
  })

  it('creates a consultation then navigates when none exists', async () => {
    mockMutateAsync.mockResolvedValue({ id: 'new-c' })
    const { result } = renderHook(() => useStartConsultation(), { wrapper })
    result.current.start(baseAppt)
    expect(mockMutateAsync).toHaveBeenCalledWith({
      patientId: 'p1',
      locationId: 'l1',
      appointmentId: 'a1',
    })
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/consultas/new-c'))
  })

  it('does not navigate when creation fails and swallows the rejection', async () => {
    mockMutateAsync.mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useStartConsultation(), { wrapper })
    await expect(
      (async () => {
        result.current.start(baseAppt)
        await new Promise((r) => setTimeout(r, 0))
      })(),
    ).resolves.toBeUndefined()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('exposes the mutation pending state via isStarting', () => {
    mockIsPending = true
    const { result } = renderHook(() => useStartConsultation(), { wrapper })
    expect(result.current.isStarting).toBe(true)
  })
})
