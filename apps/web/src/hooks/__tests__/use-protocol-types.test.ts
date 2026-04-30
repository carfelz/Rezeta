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
  useProtocolTypes,
  useProtocolType,
  useCreateProtocolType,
  useUpdateProtocolType,
  useDeleteProtocolType,
} from '../protocol-types/use-protocol-types'

const mockType = {
  id: 'type-1',
  tenantId: 't-1',
  name: 'Emergencia',
  templateId: 'tpl-1',
  isSeeded: true,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  deletedAt: null,
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useProtocolTypes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches all protocol types', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockType])
    const { result } = renderHook(() => useProtocolTypes(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocol-types')
    expect(result.current.data).toEqual([mockType])
  })
})

describe('useProtocolType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single type by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockType)
    const { result } = renderHook(() => useProtocolType('type-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocol-types/type-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useProtocolType(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useCreateProtocolType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new type', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockType)
    const { result } = renderHook(() => useCreateProtocolType(), { wrapper: makeWrapper() })
    const dto = { name: 'Emergencia', templateId: 'tpl-1' }
    await act(async () => {
      await result.current.mutateAsync(dto)
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/protocol-types', dto)
  })
})

describe('useUpdateProtocolType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches type by id and invalidates list and single', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockType, name: 'Urgencias' })
    const { result } = renderHook(() => useUpdateProtocolType('type-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ name: 'Urgencias' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/protocol-types/type-1', {
      name: 'Urgencias',
    })
  })
})

describe('useDeleteProtocolType', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes type by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteProtocolType(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('type-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/protocol-types/type-1')
  })
})
