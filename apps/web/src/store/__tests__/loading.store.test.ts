import { describe, it, expect, beforeEach } from 'vitest'
import { useLoadingStore } from '../loading.store'

describe('loading.store', () => {
  beforeEach(() => {
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })

  it('starts idle', () => {
    expect(useLoadingStore.getState().pendingCount).toBe(0)
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })

  it('requestStarted flips isLoading and increments the count', () => {
    useLoadingStore.getState().requestStarted()
    expect(useLoadingStore.getState().pendingCount).toBe(1)
    expect(useLoadingStore.getState().isLoading).toBe(true)
  })

  it('stays loading until the last concurrent request finishes', () => {
    const s = useLoadingStore.getState()
    s.requestStarted()
    s.requestStarted()
    s.requestFinished()
    expect(useLoadingStore.getState().isLoading).toBe(true)
    useLoadingStore.getState().requestFinished()
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })

  it('clamps at zero on extra requestFinished calls', () => {
    useLoadingStore.getState().requestFinished()
    expect(useLoadingStore.getState().pendingCount).toBe(0)
    expect(useLoadingStore.getState().isLoading).toBe(false)
  })
})
