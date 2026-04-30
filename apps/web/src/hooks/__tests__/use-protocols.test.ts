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
import { useProtocols } from '../protocols/use-protocols'

const mockListItem = {
  id: 'proto-1',
  title: 'Manejo de anafilaxia',
  typeId: 'type-1',
  typeName: 'Emergencia',
  status: 'draft',
  isFavorite: false,
  updatedAt: '2026-01-01',
}

const mockProtocolResponse = {
  ...mockListItem,
  currentVersionId: 'v-1',
  content: { version: '1.0', blocks: [] },
}

const mockVersion = {
  id: 'v-1',
  versionNumber: 1,
  changeSummary: null,
  createdAt: '2026-01-01',
}

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children)
}

describe('useProtocols — useGetProtocols', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches protocols without filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockListItem])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(() => result.current.useGetProtocols(), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols')
  })

  it('builds query string with search filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetProtocols({ search: 'anafilaxia' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols?search=anafilaxia')
  })

  it('builds query string with typeId filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetProtocols({ typeId: 'type-1' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols?typeId=type-1')
  })

  it('builds query string with status filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetProtocols({ status: 'active' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols?status=active')
  })

  it('builds query string with favoritesOnly filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetProtocols({ favoritesOnly: true }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols?favoritesOnly=true')
  })

  it('builds query string with sort filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetProtocols({ sort: 'title_asc' }),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols?sort=title_asc')
  })
})

describe('useProtocols — useGetProtocol', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single protocol by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockProtocolResponse)
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(() => result.current.useGetProtocol('proto-1'), {
      wrapper: makeWrapper(),
    })
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols/proto-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(() => result.current.useGetProtocol(''), {
      wrapper: makeWrapper(),
    })
    expect(queryResult.current.fetchStatus).toBe('idle')
  })
})

describe('useProtocols — useCreateProtocol', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new protocol', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockProtocolResponse)
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: mutResult } = renderHook(() => result.current.useCreateProtocol(), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await mutResult.current.mutateAsync({ title: 'Anafilaxia', typeId: 'type-1' })
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/protocols', {
      title: 'Anafilaxia',
      typeId: 'type-1',
    })
  })
})

describe('useProtocols — useRenameProtocol', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches protocol title', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ id: 'proto-1', title: 'New Title' })
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: mutResult } = renderHook(() => result.current.useRenameProtocol('proto-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await mutResult.current.mutateAsync({ title: 'New Title' })
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/protocols/proto-1', { title: 'New Title' })
  })
})

describe('useProtocols — useSaveVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new version', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVersion)
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: mutResult } = renderHook(() => result.current.useSaveVersion('proto-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await mutResult.current.mutateAsync({
        content: { version: '1.0', blocks: [] },
        changeSummary: 'Added steps',
      } as Parameters<typeof mutResult.current.mutateAsync>[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/v1/protocols/proto-1/versions',
      expect.any(Object),
    )
  })
})

describe('useProtocols — useToggleFavorite', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to favorite endpoint when isFavorite=true', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined)
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: mutResult } = renderHook(() => result.current.useToggleFavorite('proto-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await mutResult.current.mutateAsync(true)
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/protocols/proto-1/favorite', {})
  })

  it('deletes favorite when isFavorite=false', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: mutResult } = renderHook(() => result.current.useToggleFavorite('proto-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await mutResult.current.mutateAsync(false)
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/protocols/proto-1/favorite')
  })
})

describe('useProtocols — useGetVersionHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches version list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockVersion])
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetVersionHistory('proto-1'),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols/proto-1/versions')
  })

  it('is disabled when protocolId is empty', () => {
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(() => result.current.useGetVersionHistory(''), {
      wrapper: makeWrapper(),
    })
    expect(queryResult.current.fetchStatus).toBe('idle')
  })
})

describe('useProtocols — useGetVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single version', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ ...mockVersion, content: {} })
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetVersion('proto-1', 'v-1'),
      { wrapper: makeWrapper() },
    )
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocols/proto-1/versions/v-1')
  })

  it('is disabled when versionId is null', () => {
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: queryResult } = renderHook(
      () => result.current.useGetVersion('proto-1', null),
      { wrapper: makeWrapper() },
    )
    expect(queryResult.current.fetchStatus).toBe('idle')
  })
})

describe('useProtocols — useRestoreVersion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts to restore endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockVersion)
    const { result } = renderHook(() => useProtocols(), { wrapper: makeWrapper() })
    const { result: mutResult } = renderHook(() => result.current.useRestoreVersion('proto-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await mutResult.current.mutateAsync('v-1')
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/protocols/proto-1/versions/v-1/restore', {})
  })
})
