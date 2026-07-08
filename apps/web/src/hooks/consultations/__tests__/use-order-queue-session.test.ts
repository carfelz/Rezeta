import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderQueueSession } from '../use-order-queue-session'
import { useOrderQueueStore } from '@/store/order-queue.store'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const CONSULT_ID = 'consult-abc'
const STORAGE_KEY = `rz:oq:${CONSULT_ID}`

function makeSnapshot() {
  return {
    medicationGroups: [{ id: 'g1', title: 'Receta', order: 1 }],
    medications: [
      {
        id: 'm1',
        drug: 'Amoxicilina',
        dose: '500mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '7 días',
        groupId: 'g1',
      },
    ],
    imagingGroups: [{ id: 'ig1', title: 'Orden 1', order: 1 }],
    imagingOrders: [],
    labGroups: [{ id: 'lg1', title: 'Lab 1', order: 1 }],
    labOrders: [],
    savedAt: Date.now(),
  }
}

describe('useOrderQueueSession', () => {
  beforeEach(() => {
    localStorage.clear()
    act(() =>
      useOrderQueueStore.setState({
        activeTab: 'medications',
        medicationGroups: [
          { id: 'default-rx', title: 'Receta', order: 1, requestId: crypto.randomUUID() },
        ],
        medications: [],
        imagingGroups: [
          { id: 'default-img', title: 'Orden 1', order: 1, requestId: crypto.randomUUID() },
        ],
        imagingOrders: [],
        labGroups: [
          { id: 'default-lab', title: 'Laboratorio 1', order: 1, requestId: crypto.randomUUID() },
        ],
        labOrders: [],
      }),
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('restores medications from localStorage on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))

    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(1)
    expect(medications[0]!.drug).toBe('Amoxicilina')
  })

  it('shows toast when restoring saved queue', async () => {
    const { toast } = await import('sonner')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))

    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining('restauradas'))
  })

  it('does not restore when signed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))

    renderHook(() => useOrderQueueSession(CONSULT_ID, true))

    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(0)
  })

  it('does not show toast when there is nothing to restore', () => {
    vi.mocked(vi.fn())
    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(0)
  })

  it('persists to localStorage when medications are queued', () => {
    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    act(() => {
      useOrderQueueStore.getState().queueMedication({
        drug: 'Ibuprofeno',
        dose: '400mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '5 días',
      })
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.medications).toHaveLength(1)
    expect(parsed.medications[0].drug).toBe('Ibuprofeno')
  })

  it('removes from localStorage when queue is emptied', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))
    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    act(() => {
      const { medications, removeMedication } = useOrderQueueStore.getState()
      medications.forEach((m) => removeMedication(m.id))
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears localStorage when consultation is signed', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))
    const { rerender } = renderHook(
      ({ signed }: { signed: boolean }) => useOrderQueueSession(CONSULT_ID, signed),
      { initialProps: { signed: false } },
    )

    act(() => {
      useOrderQueueStore.getState().queueMedication({
        drug: 'Test',
        dose: '1mg',
        route: 'oral',
        frequency: 'diario',
        duration: '1 día',
      })
    })

    rerender({ signed: true })
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('resets store when consultationId changes', () => {
    act(() => {
      useOrderQueueStore.getState().queueMedication({
        drug: 'Prev',
        dose: '1mg',
        route: 'oral',
        frequency: 'diario',
        duration: '1d',
      })
    })

    const { rerender } = renderHook(({ id }: { id: string }) => useOrderQueueSession(id, false), {
      initialProps: { id: CONSULT_ID },
    })

    rerender({ id: 'consult-xyz' })

    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(0)
  })

  it('ignores corrupted localStorage data', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{')
    expect(() => renderHook(() => useOrderQueueSession(CONSULT_ID, false))).not.toThrow()
    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(0)
  })

  // Note: this test passes identically with or without the hydration gate
  // under React's test renderer — effects for a single component run in
  // declaration order within one commit, so the restore effect's
  // reset()/restoreSnapshot() calls always land before the mirror effect
  // reads the store, and the race described below cannot manifest here. It
  // does not pin the gate itself. It documents the invariant (a snapshot
  // must survive mount) and guards adjacent regressions — e.g. a future
  // change that makes removeItem fire during mount.
  it('does not wipe the localStorage snapshot via a pre-restore mirror-effect pass on mount', () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))

    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    // The race: a mirror effect running before restore propagates would see
    // empty queue arrays and call removeItem, wiping the snapshot before the
    // restored values ever land. Assert it survives the initial mount intact.
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(1)
    expect(medications[0]!.drug).toBe('Amoxicilina')

    // Mechanism assertion (fallback per brief): removeItem must never be
    // called for this key during the initial mount when a snapshot exists.
    const removedThisKey = removeItemSpy.mock.calls.some(([key]) => key === STORAGE_KEY)
    expect(removedThisKey).toBe(false)

    removeItemSpy.mockRestore()
  })

  // Note: this test passes identically with or without the hydration gate
  // under React's test renderer, for the same reason as the mount-race test
  // above — effects run in declaration order within a commit, so the
  // interleaving this test describes cannot manifest here. It does not pin
  // the gate itself. It documents the invariant (a consultationId switch
  // must not remove either id's snapshot) and guards adjacent regressions —
  // e.g. a future change that makes removeItem fire during the switch.
  it('does not let a consultationId switch remove the new id snapshot before its restore completes', () => {
    const OTHER_ID = 'consult-xyz'
    const OTHER_KEY = `rz:oq:${OTHER_ID}`
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem')

    localStorage.setItem(STORAGE_KEY, JSON.stringify(makeSnapshot()))
    localStorage.setItem(OTHER_KEY, JSON.stringify(makeSnapshot()))

    const { rerender } = renderHook(({ id }: { id: string }) => useOrderQueueSession(id, false), {
      initialProps: { id: CONSULT_ID },
    })

    // id A is hydrated with a non-empty queue; switching to id B triggers a
    // transient reset() before B's restore lands. Neither key should be
    // removed as a side effect of that transient state.
    rerender({ id: OTHER_ID })

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(localStorage.getItem(OTHER_KEY)).not.toBeNull()

    const { medications } = useOrderQueueStore.getState()
    expect(medications).toHaveLength(1)
    expect(medications[0]!.drug).toBe('Amoxicilina')

    removeItemSpy.mockRestore()
  })

  // These two tests pin the hydration gate's real failure mode: a restore-
  // effect exit path that forgets to set hydrated.current = true. If that
  // happened, the mirror effect would early-return forever and the queue
  // would never be persisted again — these tests fail in that scenario
  // because they assert a post-mount write actually reaches localStorage.
  it('still mirrors queue changes to localStorage after a corrupted snapshot on mount', () => {
    localStorage.setItem(STORAGE_KEY, 'not-valid-json{')

    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    act(() => {
      useOrderQueueStore.getState().queueMedication({
        drug: 'Post-corrupt',
        dose: '250mg',
        route: 'oral',
        frequency: 'cada 12h',
        duration: '3 días',
      })
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.medications).toHaveLength(1)
    expect(parsed.medications[0].drug).toBe('Post-corrupt')
  })

  it('still mirrors queue changes to localStorage after mounting with no saved snapshot', () => {
    renderHook(() => useOrderQueueSession(CONSULT_ID, false))

    act(() => {
      useOrderQueueStore.getState().queueMedication({
        drug: 'Fresh',
        dose: '100mg',
        route: 'oral',
        frequency: 'diario',
        duration: '10 días',
      })
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!)
    expect(parsed.medications).toHaveLength(1)
    expect(parsed.medications[0].drug).toBe('Fresh')
  })
})
