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
  usePatients,
  usePatient,
  useCreatePatient,
  useUpdatePatient,
  useDeletePatient,
} from '../patients/use-patients'

const mockPatient = {
  id: 'p-1',
  tenantId: 't-1',
  ownerUserId: 'u-1',
  firstName: 'Ana',
  lastName: 'Reyes',
  email: 'ana@example.com',
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('usePatients', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches patients without params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [mockPatient], hasMore: false })
    const { result } = renderHook(() => usePatients(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/patients')
  })

  it('builds query string with search param', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], hasMore: false })
    const { result } = renderHook(() => usePatients({ search: 'Ana' }), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/patients?search=Ana')
  })

  it('builds query string with cursor param', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], hasMore: false })
    const { result } = renderHook(() => usePatients({ cursor: 'cursor-abc' }), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/patients?cursor=cursor-abc')
  })

  it('builds query string with search and cursor', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ items: [], hasMore: false })
    const { result } = renderHook(() => usePatients({ search: 'Ana', cursor: 'c1' }), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/patients?search=Ana&cursor=c1')
  })
})

describe('usePatient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single patient by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockPatient)
    const { result } = renderHook(() => usePatient('p-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/patients/p-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => usePatient(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useCreatePatient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new patient', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockPatient)
    const { result } = renderHook(() => useCreatePatient(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ firstName: 'Ana', lastName: 'Reyes' } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/patients', {
      firstName: 'Ana',
      lastName: 'Reyes',
    })
  })
})

describe('useUpdatePatient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches patient by id', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockPatient, firstName: 'María' })
    const { result } = renderHook(() => useUpdatePatient('p-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ firstName: 'María' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/patients/p-1', { firstName: 'María' })
  })
})

describe('useDeletePatient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes patient by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeletePatient(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('p-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/patients/p-1')
  })
})
