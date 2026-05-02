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
  useLocations,
  useLocation,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from '../locations/use-locations'

const mockLocation = {
  id: 'loc-1',
  tenantId: 't-1',
  name: 'Centro Médico Real',
  address: 'Calle Principal 1',
  city: 'Santo Domingo',
  phone: '809-555-1234',
  isOwned: false,
  notes: null,
  commissionPercent: 0,
  consultationFee: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useLocations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches locations list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockLocation])
    const { result } = renderHook(() => useLocations(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/locations')
    expect(result.current.data).toEqual([mockLocation])
  })
})

describe('useLocation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single location by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockLocation)
    const { result } = renderHook(() => useLocation('loc-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/locations/loc-1')
  })

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useLocation(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useCreateLocation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to /v1/locations and invalidates cache', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockLocation)
    const { result } = renderHook(() => useCreateLocation(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ name: 'Centro Médico Real', address: 'Calle 1' })
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/locations', {
      name: 'Centro Médico Real',
      address: 'Calle 1',
    })
  })
})

describe('useUpdateLocation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches location and invalidates both list and single', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockLocation, name: 'Updated' })
    const { result } = renderHook(() => useUpdateLocation('loc-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/locations/loc-1', { name: 'Updated' })
  })
})

describe('useDeleteLocation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes location by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteLocation(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('loc-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/locations/loc-1')
  })
})
