import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConsultationViewMode } from '../use-consultation-view-mode'
import { useUiStore } from '@/store/ui.store'

const STORAGE_KEY = 'rezeta:consultation-view-mode'

describe('useConsultationViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() => {
      useUiStore.setState({ viewMode: 'soap' })
    })
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns soap as default mode', () => {
    const { result } = renderHook(() => useConsultationViewMode(true))
    expect(result.current.viewMode).toBe('soap')
  })

  it('reads stored mode from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'canvas')
    const { result } = renderHook(() => useConsultationViewMode(true))
    expect(result.current.viewMode).toBe('canvas')
  })

  it('sets viewMode and persists to localStorage', () => {
    const { result } = renderHook(() => useConsultationViewMode(true))
    act(() => {
      result.current.setViewMode('canvas')
    })
    expect(result.current.viewMode).toBe('canvas')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('canvas')
  })

  it('always returns soap when hasProtocol is false', () => {
    localStorage.setItem(STORAGE_KEY, 'canvas')
    act(() => {
      useUiStore.setState({ viewMode: 'canvas' })
    })
    const { result } = renderHook(() => useConsultationViewMode(false))
    expect(result.current.viewMode).toBe('soap')
  })

  it('resets viewMode to soap when hasProtocol becomes false', () => {
    const { result, rerender } = renderHook(
      ({ hasProtocol }) => useConsultationViewMode(hasProtocol),
      { initialProps: { hasProtocol: true } },
    )
    act(() => {
      result.current.setViewMode('canvas')
    })
    expect(result.current.viewMode).toBe('canvas')

    rerender({ hasProtocol: false })
    expect(result.current.viewMode).toBe('soap')
  })

  it('handles missing localStorage gracefully', () => {
    const originalGetItem = localStorage.getItem.bind(localStorage)
    vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
      if (key === STORAGE_KEY) throw new Error('unavailable')
      return originalGetItem(key)
    })
    expect(() => renderHook(() => useConsultationViewMode(true))).not.toThrow()
    vi.restoreAllMocks()
  })

  it('handles localStorage write error gracefully', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })
    const { result } = renderHook(() => useConsultationViewMode(true))
    expect(() => {
      act(() => {
        result.current.setViewMode('canvas')
      })
    }).not.toThrow()
    vi.restoreAllMocks()
  })
})
