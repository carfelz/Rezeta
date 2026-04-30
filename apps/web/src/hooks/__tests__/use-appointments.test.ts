import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'
import {
  useAppointments,
  useAppointment,
  useCreateAppointment,
  useUpdateAppointment,
  useUpdateAppointmentStatus,
  useDeleteAppointment,
} from '../appointments/use-appointments'

const mockAppt = {
  id: 'appt-1',
  tenantId: 't-1',
  patientId: 'p-1',
  locationId: 'loc-1',
  scheduledAt: '2026-05-01T09:00:00Z',
  status: 'scheduled',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useAppointments', () => {
  beforeEach(() => vi.clearAllMocks())

  it('is disabled when locationId is missing', () => {
    const { result } = renderHook(() => useAppointments({}), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('fetches with locationId only', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockAppt])
    const { result } = renderHook(() => useAppointments({ locationId: 'loc-1' }), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/appointments?locationId=loc-1')
  })

  it('builds full query string with all params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const { result } = renderHook(
      () =>
        useAppointments({
          locationId: 'loc-1',
          from: '2026-05-01',
          to: '2026-05-31',
          status: 'scheduled',
        }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith(
      '/v1/appointments?locationId=loc-1&from=2026-05-01&to=2026-05-31&status=scheduled',
    )
  })
})

describe('useAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single appointment', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockAppt)
    const { result } = renderHook(() => useAppointment('appt-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/appointments/appt-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useAppointment(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new appointment', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockAppt)
    const { result } = renderHook(() => useCreateAppointment(), { wrapper: makeWrapper() })
    const dto = { patientId: 'p-1', locationId: 'loc-1', scheduledAt: '2026-05-01T09:00:00Z' }
    await act(async () => {
      await result.current.mutateAsync(dto as Parameters<typeof result.current.mutateAsync>[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/appointments', dto)
  })
})

describe('useUpdateAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches appointment by id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(mockAppt)
    const { result } = renderHook(() => useUpdateAppointment('appt-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ scheduledAt: '2026-05-02T09:00:00Z' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/appointments/appt-1', {
      scheduledAt: '2026-05-02T09:00:00Z',
    })
  })
})

describe('useUpdateAppointmentStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches appointment status', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockAppt, status: 'completed' })
    const { result } = renderHook(() => useUpdateAppointmentStatus('appt-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ status: 'completed' } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/appointments/appt-1/status', {
      status: 'completed',
    })
  })
})

describe('useDeleteAppointment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes appointment by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteAppointment(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('appt-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/appointments/appt-1')
  })
})
