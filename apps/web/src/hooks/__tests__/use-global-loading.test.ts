import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGlobalLoading } from '../use-global-loading'
import { useLoadingStore } from '@/store/loading.store'

describe('useGlobalLoading', () => {
  beforeEach(() => {
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })

  it('reflects the store flag', () => {
    const { result } = renderHook(() => useGlobalLoading())
    expect(result.current.isLoading).toBe(false)
    act(() => useLoadingStore.getState().requestStarted())
    expect(result.current.isLoading).toBe(true)
    act(() => useLoadingStore.getState().requestFinished())
    expect(result.current.isLoading).toBe(false)
  })
})
