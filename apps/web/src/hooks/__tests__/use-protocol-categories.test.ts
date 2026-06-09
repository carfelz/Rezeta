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
  useProtocolCategories,
  useProtocolCategory,
  useCreateProtocolCategory,
  useUpdateProtocolCategory,
  useDeleteProtocolCategory,
} from '../protocol-categories/use-protocol-categories'

const mockCategory = {
  id: 'cat-1',
  tenantId: 't-1',
  name: 'Emergencias',
  color: '#EF4444',
  isSeeded: true,
  deletedAt: null,
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useProtocolCategories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches all protocol categories', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockCategory])
    const { result } = renderHook(() => useProtocolCategories(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocol-categories')
    expect(result.current.data).toEqual([mockCategory])
  })
})

describe('useProtocolCategory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single category by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockCategory)
    const { result } = renderHook(() => useProtocolCategory('cat-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocol-categories/cat-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useProtocolCategory(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useCreateProtocolCategory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new category', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockCategory)
    const { result } = renderHook(() => useCreateProtocolCategory(), { wrapper: makeWrapper() })
    const dto = { name: 'Emergencias', color: '#EF4444' }
    await act(async () => {
      await result.current.mutateAsync(dto)
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/protocol-categories', dto)
  })
})

describe('useUpdateProtocolCategory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches category by id and invalidates list and single', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockCategory, name: 'Urgencias' })
    const { result } = renderHook(() => useUpdateProtocolCategory('cat-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ name: 'Urgencias' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/protocol-categories/cat-1', {
      name: 'Urgencias',
    })
  })
})

describe('useDeleteProtocolCategory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes category by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteProtocolCategory(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('cat-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/protocol-categories/cat-1')
  })
})
