import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
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
  useGetBlocks,
  useCreateBlock,
  useUpdateBlock,
  useDeleteBlock,
  useGetExceptions,
  useCreateException,
  useUpdateException,
  useDeleteException,
} from '../use-schedules'

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

const mockBlock = {
  id: 'block-1',
  userId: 'user-1',
  locationId: 'loc-1',
  locationName: 'Clínica A',
  dayOfWeek: 1,
  startTime: '08:00:00',
  endTime: '12:00:00',
  slotDurationMin: 30,
  createdAt: '2026-01-01',
}

const mockException = {
  id: 'exc-1',
  userId: 'user-1',
  locationId: 'loc-1',
  locationName: 'Clínica A',
  date: '2026-05-15',
  type: 'blocked' as const,
  startTime: null,
  endTime: null,
  reason: null,
  createdAt: '2026-01-01',
}

describe('useGetBlocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /v1/schedules/blocks without locationId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockBlock])
    const { result } = renderHook(() => useGetBlocks(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/schedules/blocks')
  })

  it('includes locationId query param when provided', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockBlock])
    const { result } = renderHook(() => useGetBlocks('loc-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/schedules/blocks?locationId=loc-1')
  })
})

describe('useCreateBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to /v1/schedules/blocks and invalidates cache', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockBlock)
    const { result } = renderHook(() => useCreateBlock(), { wrapper: makeWrapper() })
    const dto = {
      locationId: 'loc-1',
      dayOfWeek: 1,
      startTime: '08:00:00',
      endTime: '12:00:00',
      slotDurationMin: 30,
    }
    await act(async () => {
      await result.current.mutateAsync(dto)
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/schedules/blocks', dto)
  })
})

describe('useUpdateBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches /v1/schedules/blocks/:id and invalidates cache', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockBlock, endTime: '13:00:00' })
    const { result } = renderHook(() => useUpdateBlock('block-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ endTime: '13:00:00' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/schedules/blocks/block-1', {
      endTime: '13:00:00',
    })
  })
})

describe('useDeleteBlock', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes /v1/schedules/blocks/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteBlock(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('block-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/schedules/blocks/block-1')
  })
})

describe('useGetExceptions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls GET /v1/schedules/exceptions with no params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockException])
    const { result } = renderHook(() => useGetExceptions(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/schedules/exceptions')
  })

  it('includes locationId, from, to when provided', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockException])
    const { result } = renderHook(
      () => useGetExceptions({ locationId: 'loc-1', from: '2026-05-01', to: '2026-05-31' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const url = vi.mocked(apiClient.get).mock.calls[0]?.[0] as string
    expect(url).toContain('locationId=loc-1')
    expect(url).toContain('from=2026-05-01')
    expect(url).toContain('to=2026-05-31')
  })
})

describe('useCreateException', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to /v1/schedules/exceptions and invalidates cache', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockException)
    const { result } = renderHook(() => useCreateException(), { wrapper: makeWrapper() })
    const dto = { locationId: 'loc-1', date: '2026-05-15', type: 'blocked' as const }
    await act(async () => {
      await result.current.mutateAsync(dto)
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/schedules/exceptions', dto)
  })
})

describe('useUpdateException', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches /v1/schedules/exceptions/:id and invalidates cache', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockException, reason: 'Día festivo' })
    const { result } = renderHook(() => useUpdateException('exc-1'), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync({ reason: 'Día festivo' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/schedules/exceptions/exc-1', {
      reason: 'Día festivo',
    })
  })
})

describe('useDeleteException', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes /v1/schedules/exceptions/:id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteException(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('exc-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/schedules/exceptions/exc-1')
  })
})
