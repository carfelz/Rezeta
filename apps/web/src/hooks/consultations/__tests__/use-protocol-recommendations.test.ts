import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { createElement } from 'react'

const mockGet = vi.fn()
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: (url: string) => mockGet(url),
  },
}))

import { useProtocolRecommendations } from '../use-protocol-recommendations'
import type { ProtocolRecommendation } from '@rezeta/shared'

function makeRec(overrides: Partial<ProtocolRecommendation> = {}): ProtocolRecommendation {
  return {
    protocolId: 'proto-1',
    title: 'HTA — Seguimiento',
    typeId: 'type-1',
    typeName: 'Cardiovascular',
    currentVersionNumber: 2,
    lastUsedAt: new Date().toISOString(),
    usageCount: 1,
    isMostProbable: false,
    ...overrides,
  }
}

function wrapper(): { wrapper: ({ children }: { children: ReactNode }) => JSX.Element } {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    wrapper: ({ children }) => createElement(QueryClientProvider, { client: qc }, children),
  }
}

describe('useProtocolRecommendations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls /v1/patients/:patientId/protocol-recommendations when enabled with a patientId', async () => {
    mockGet.mockResolvedValue([makeRec({ protocolId: 'p-1' }), makeRec({ protocolId: 'p-2' })])
    const { result } = renderHook(() => useProtocolRecommendations('patient-abc', true), wrapper())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockGet).toHaveBeenCalledWith(
      '/v1/patients/patient-abc/protocol-recommendations?limit=4',
    )
    expect(result.current.suggestions).toHaveLength(2)
  })

  it('returns at most MAX_SUGGESTIONS (4)', async () => {
    mockGet.mockResolvedValue(
      Array.from({ length: 6 }).map((_, i) => makeRec({ protocolId: `p-${i}` })),
    )
    const { result } = renderHook(() => useProtocolRecommendations('patient-abc', true), wrapper())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.suggestions).toHaveLength(4)
  })

  it('returns empty when disabled', async () => {
    const { result } = renderHook(() => useProtocolRecommendations('patient-abc', false), wrapper())
    expect(result.current.suggestions).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('returns empty and skips fetch when patientId is null', () => {
    const { result } = renderHook(() => useProtocolRecommendations(null, true), wrapper())
    expect(result.current.suggestions).toEqual([])
    expect(mockGet).not.toHaveBeenCalled()
  })

  it('different patientIds produce independent queries', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('patient-A')) return Promise.resolve([makeRec({ protocolId: 'A1' })])
      return Promise.resolve([makeRec({ protocolId: 'B1' })])
    })
    const { result: rA } = renderHook(
      () => useProtocolRecommendations('patient-A', true),
      wrapper(),
    )
    const { result: rB } = renderHook(
      () => useProtocolRecommendations('patient-B', true),
      wrapper(),
    )
    await waitFor(() => expect(rA.current.isLoading).toBe(false))
    await waitFor(() => expect(rB.current.isLoading).toBe(false))
    expect(rA.current.suggestions[0]?.protocolId).toBe('A1')
    expect(rB.current.suggestions[0]?.protocolId).toBe('B1')
  })
})
