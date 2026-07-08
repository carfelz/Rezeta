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
    expect(medications[0].drug).toBe('Amoxicilina')
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
})
