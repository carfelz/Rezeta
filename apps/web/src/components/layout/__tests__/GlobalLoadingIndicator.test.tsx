import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GlobalLoadingIndicator } from '../GlobalLoadingIndicator'
import { useLoadingStore } from '@/store/loading.store'

describe('GlobalLoadingIndicator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useLoadingStore.setState({ pendingCount: 0, isLoading: false })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders no chip content while idle', () => {
    render(<GlobalLoadingIndicator />)
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('keeps a permanently-mounted aria-live container even while idle', () => {
    const { container } = render(<GlobalLoadingIndicator />)
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    // Container is visually empty when idle: no chip child rendered.
    expect(liveRegion?.textContent).toBe('')
    expect(liveRegion).toBeEmptyDOMElement()
  })

  it('appears only after loading persists 250ms', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(250))
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })

  it('never appears for fast requests', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    act(() => vi.advanceTimersByTime(100))
    act(() => useLoadingStore.getState().requestFinished())
    act(() => vi.advanceTimersByTime(500))
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('hides immediately when loading ends', () => {
    render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    act(() => vi.advanceTimersByTime(250))
    act(() => useLoadingStore.getState().requestFinished())
    expect(screen.queryByText('Cargando…')).not.toBeInTheDocument()
  })

  it('does not intercept pointer events', () => {
    const { container } = render(<GlobalLoadingIndicator />)
    act(() => useLoadingStore.getState().requestStarted())
    act(() => vi.advanceTimersByTime(250))
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion?.className).toContain('pointer-events-none')
  })
})
