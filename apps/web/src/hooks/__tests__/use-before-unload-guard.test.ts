import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBeforeUnloadGuard } from '../use-before-unload-guard'

describe('useBeforeUnloadGuard', () => {
  let addSpy: ReturnType<typeof vi.spyOn>
  let removeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener')
    removeSpy = vi.spyOn(window, 'removeEventListener')
  })

  it('registers beforeunload listener when active', () => {
    renderHook(() => useBeforeUnloadGuard(true))
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('does not register listener when inactive', () => {
    renderHook(() => useBeforeUnloadGuard(false))
    const calls = addSpy.mock.calls.filter(([event]) => event === 'beforeunload')
    expect(calls).toHaveLength(0)
  })

  it('removes listener on unmount', () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(true))
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('removes listener when active changes from true to false', () => {
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useBeforeUnloadGuard(active),
      { initialProps: { active: true } },
    )
    removeSpy.mockClear()
    rerender({ active: false })
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
  })

  it('handler calls preventDefault and sets returnValue', () => {
    renderHook(() => useBeforeUnloadGuard(true))
    const call = addSpy.mock.calls.find(([event]) => event === 'beforeunload')
    expect(call).toBeDefined()
    const handler = call![1] as EventListener
    const fakeEvent = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent
    handler(fakeEvent)
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(fakeEvent.preventDefault).toHaveBeenCalled()
    expect((fakeEvent as { returnValue: string }).returnValue).toBe('')
  })
})
