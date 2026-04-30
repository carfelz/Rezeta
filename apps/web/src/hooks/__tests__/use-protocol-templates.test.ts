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
  useProtocolTemplates,
  useProtocolTemplate,
  useCreateProtocolTemplate,
  useUpdateProtocolTemplate,
  useDeleteProtocolTemplate,
} from '../protocol-templates/use-protocol-templates'

const mockTemplate = {
  id: 'tpl-1',
  tenantId: 't-1',
  name: 'Intervención de emergencia',
  schema: { version: '1.0', blocks: [] },
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

describe('useProtocolTemplates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches all templates', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([mockTemplate])
    const { result } = renderHook(() => useProtocolTemplates(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocol-templates')
    expect(result.current.data).toEqual([mockTemplate])
  })
})

describe('useProtocolTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches single template by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(mockTemplate)
    const { result } = renderHook(() => useProtocolTemplate('tpl-1'), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(apiClient.get).toHaveBeenCalledWith('/v1/protocol-templates/tpl-1')
  })

  it('is disabled when id is empty', () => {
    const { result } = renderHook(() => useProtocolTemplate(''), { wrapper: makeWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
    expect(apiClient.get).not.toHaveBeenCalled()
  })
})

describe('useCreateProtocolTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts new template', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(mockTemplate)
    const { result } = renderHook(() => useCreateProtocolTemplate(), { wrapper: makeWrapper() })
    const dto = { name: 'New Template', schema: { version: '1.0', blocks: [] } }
    await act(async () => {
      await result.current.mutateAsync(dto as Parameters<typeof result.current.mutateAsync>[0])
    })
    expect(apiClient.post).toHaveBeenCalledWith('/v1/protocol-templates', dto)
  })
})

describe('useUpdateProtocolTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('patches template and invalidates list and single', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ ...mockTemplate, name: 'Updated' })
    const { result } = renderHook(() => useUpdateProtocolTemplate('tpl-1'), {
      wrapper: makeWrapper(),
    })
    await act(async () => {
      await result.current.mutateAsync({ name: 'Updated' } as Parameters<
        typeof result.current.mutateAsync
      >[0])
    })
    expect(apiClient.patch).toHaveBeenCalledWith('/v1/protocol-templates/tpl-1', {
      name: 'Updated',
    })
  })
})

describe('useDeleteProtocolTemplate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes template by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteProtocolTemplate(), { wrapper: makeWrapper() })
    await act(async () => {
      await result.current.mutateAsync('tpl-1')
    })
    expect(apiClient.delete).toHaveBeenCalledWith('/v1/protocol-templates/tpl-1')
  })
})
