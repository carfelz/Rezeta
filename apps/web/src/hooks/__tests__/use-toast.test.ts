import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToast } from '../use-toast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with empty toasts', () => {
    const { result } = renderHook(() => useToast())
    expect(result.current.toasts).toHaveLength(0)
  })

  it('adds toast on toast()', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'Hello', variant: 'success' })
    })
    expect(result.current.toasts).toHaveLength(1)
    expect(result.current.toasts[0].title).toBe('Hello')
    expect(result.current.toasts[0].open).toBe(true)
  })

  it('sets open=false after duration, removes after 200ms more', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'Temp', variant: 'info', duration: 1000 })
    })
    expect(result.current.toasts[0].open).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.toasts[0].open).toBe(false)

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('uses default duration of 3000ms', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'Default', variant: 'info' })
    })

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(result.current.toasts[0].open).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.toasts[0].open).toBe(false)
  })

  it('dismiss sets open=false for target toast', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'A', variant: 'success' })
      result.current.toast({ title: 'B', variant: 'info' })
    })
    const id = result.current.toasts[0].id

    act(() => {
      result.current.dismiss(id)
    })

    expect(result.current.toasts[0].open).toBe(false)
    expect(result.current.toasts[1].open).toBe(true)
  })

  it('each toast gets unique id', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'A', variant: 'success' })
      result.current.toast({ title: 'B', variant: 'info' })
    })
    const ids = result.current.toasts.map((t) => t.id)
    expect(new Set(ids).size).toBe(2)
  })

  it('stores description and variant', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast({ title: 'T', description: 'D', variant: 'warning' })
    })
    expect(result.current.toasts[0].description).toBe('D')
    expect(result.current.toasts[0].variant).toBe('warning')
  })
})
