import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const mockUseGetProtocols = vi.fn()

vi.mock('@/hooks/protocols/use-protocols', () => ({
  useProtocols: () => ({
    useGetProtocols: mockUseGetProtocols,
  }),
}))

import { useProtocolSuggestions } from '../use-protocol-suggestions'

const FIVE_PROTOCOLS = Array.from({ length: 5 }).map((_, i) => ({
  id: `p-${i}`,
  title: `Protocolo ${i}`,
  typeId: 't',
  typeName: 'Diag',
  status: 'active',
  isFavorite: false,
  updatedAt: new Date().toISOString(),
  currentVersionNumber: 1,
}))

describe('useProtocolSuggestions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns up to 4 suggestions when enabled', () => {
    mockUseGetProtocols.mockReturnValue({ data: FIVE_PROTOCOLS, isLoading: false })
    const { result } = renderHook(() => useProtocolSuggestions(true))
    expect(result.current.suggestions).toHaveLength(4)
    expect(result.current.suggestions[0]?.id).toBe('p-0')
  })

  it('returns empty when disabled', () => {
    mockUseGetProtocols.mockReturnValue({ data: FIVE_PROTOCOLS, isLoading: false })
    const { result } = renderHook(() => useProtocolSuggestions(false))
    expect(result.current.suggestions).toEqual([])
  })

  it('isLoading=true while fetch in flight when enabled', () => {
    mockUseGetProtocols.mockReturnValue({ data: [], isLoading: true })
    const { result } = renderHook(() => useProtocolSuggestions(true))
    expect(result.current.isLoading).toBe(true)
  })

  it('isLoading=false when disabled even if hook reports loading', () => {
    mockUseGetProtocols.mockReturnValue({ data: [], isLoading: true })
    const { result } = renderHook(() => useProtocolSuggestions(false))
    expect(result.current.isLoading).toBe(false)
  })

  it('passes status=active and sort=updatedAt_desc filters', () => {
    mockUseGetProtocols.mockReturnValue({ data: [], isLoading: false })
    renderHook(() => useProtocolSuggestions(true))
    expect(mockUseGetProtocols).toHaveBeenCalledWith({
      status: 'active',
      sort: 'updatedAt_desc',
    })
  })

  it('returns fewer than 4 when only fewer protocols exist', () => {
    mockUseGetProtocols.mockReturnValue({ data: [FIVE_PROTOCOLS[0]], isLoading: false })
    const { result } = renderHook(() => useProtocolSuggestions(true))
    expect(result.current.suggestions).toHaveLength(1)
  })
})
