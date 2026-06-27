import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUiStore } from '../ui.store'

describe('useUiStore', () => {
  beforeEach(() => {
    act(() => {
      useUiStore.setState({
        activeLocationId: null,
        missingFieldsPanelOpen: false,
      })
    })
  })

  // ── activeLocationId ──────────────────────────────────────────────────────

  it('initializes with null activeLocationId', () => {
    const { result } = renderHook(() => useUiStore())
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

  // ── missingFieldsPanelOpen ────────────────────────────────────────────────

  it('initializes with missingFieldsPanelOpen false', () => {
    const { result } = renderHook(() => useUiStore())
    expect(result.current.missingFieldsPanelOpen).toBe(false)
  })

  it('setMissingFieldsPanelOpen opens panel', () => {
    const { result } = renderHook(() => useUiStore())
    act(() => result.current.setMissingFieldsPanelOpen(true))
    expect(result.current.missingFieldsPanelOpen).toBe(true)
  })

  it('setMissingFieldsPanelOpen closes panel', () => {
    const { result } = renderHook(() => useUiStore())
    act(() => result.current.setMissingFieldsPanelOpen(true))
    act(() => result.current.setMissingFieldsPanelOpen(false))
    expect(result.current.missingFieldsPanelOpen).toBe(false)
  })
})
