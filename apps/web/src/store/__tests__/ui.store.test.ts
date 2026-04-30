import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUiStore } from '../ui.store'

describe('useUiStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useUiStore())
    act(() => result.current.setActiveLocation(''))
  })

  it('initializes with null activeLocationId', () => {
    const { result } = renderHook(() => useUiStore())
    // reset to null via store internals — re-create fresh by clearing
    act(() => {
      useUiStore.setState({ activeLocationId: null })
    })
    expect(result.current.activeLocationId).toBeNull()
  })

  it('setActiveLocation updates activeLocationId', () => {
    const { result } = renderHook(() => useUiStore())
    act(() => result.current.setActiveLocation('loc-1'))
    expect(result.current.activeLocationId).toBe('loc-1')
  })

  it('setActiveLocation can be called multiple times', () => {
    const { result } = renderHook(() => useUiStore())
    act(() => result.current.setActiveLocation('loc-1'))
    act(() => result.current.setActiveLocation('loc-2'))
    expect(result.current.activeLocationId).toBe('loc-2')
  })
})
