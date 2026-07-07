import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { toastStrings } from '@/lib/toasts'

const mutateRx = vi.fn()
const mutateImg = vi.fn()
const mutateLab = vi.fn()

vi.mock('../use-consultations', () => ({
  useCreatePrescription: () => ({ mutateAsync: mutateRx }),
  useCreateImagingOrder: () => ({ mutateAsync: mutateImg }),
  useCreateLabOrder: () => ({ mutateAsync: mutateLab }),
}))

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import { useFlushOrderQueue } from '../use-flush-order-queue'

const CONSULT_ID = 'consult-1'

function resetStore(): void {
  act(() => useOrderQueueStore.getState().reset())
}

describe('useFlushOrderQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mutateRx.mockResolvedValue({})
    mutateImg.mockResolvedValue({})
    mutateLab.mockResolvedValue({})
    resetStore()
  })

  it('persists a medication group and a lab order, then empties the store and returns true', async () => {
    act(() => {
      const store = useOrderQueueStore.getState()
      store.queueMedication({
        drug: 'Amoxicilina',
        dose: '500mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '7 días',
        source: 'protocolo:faringitis',
      })
      store.queueLabOrder({
        test_name: 'Hemograma',
        indication: 'anemia',
        urgency: 'routine',
        fasting_required: false,
        sample_type: 'blood',
        source: 'protocolo:anemia',
      })
    })

    const { result } = renderHook(() => useFlushOrderQueue(CONSULT_ID))

    let outcome: boolean | undefined
    await act(async () => {
      outcome = await result.current.flush()
    })

    expect(outcome).toBe(true)
    expect(mutateRx).toHaveBeenCalledTimes(1)
    expect(mutateRx).toHaveBeenCalledWith(
      expect.objectContaining({
        groupTitle: 'Receta',
        groupOrder: 1,
        items: [
          expect.objectContaining({
            drug: 'Amoxicilina',
            dose: '500mg',
            route: 'oral',
            frequency: 'cada 8h',
            duration: '7 días',
            source: 'protocolo:faringitis',
          }),
        ],
      }),
    )
    expect(mutateLab).toHaveBeenCalledTimes(1)
    expect(mutateLab).toHaveBeenCalledWith(
      expect.objectContaining({
        groupOrder: 1,
        items: [
          expect.objectContaining({
            testName: 'Hemograma',
            indication: 'anemia',
            sampleType: 'blood',
            source: 'protocolo:anemia',
          }),
        ],
      }),
    )
    expect(useOrderQueueStore.getState().medications).toHaveLength(0)
    expect(useOrderQueueStore.getState().labOrders).toHaveLength(0)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('resolves true and fires no requests when the queue is empty', async () => {
    const { result } = renderHook(() => useFlushOrderQueue(CONSULT_ID))

    let outcome: boolean | undefined
    await act(async () => {
      outcome = await result.current.flush()
    })

    expect(outcome).toBe(true)
    expect(mutateRx).not.toHaveBeenCalled()
    expect(mutateImg).not.toHaveBeenCalled()
    expect(mutateLab).not.toHaveBeenCalled()
  })

  it('returns false and keeps the queue intact when a create rejects', async () => {
    mutateRx.mockRejectedValue(new Error('network'))

    act(() => {
      const store = useOrderQueueStore.getState()
      store.queueMedication({
        drug: 'Amoxicilina',
        dose: '500mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '7 días',
      })
      store.queueLabOrder({
        test_name: 'Hemograma',
        indication: 'anemia',
        urgency: 'routine',
        fasting_required: false,
        sample_type: 'blood',
      })
    })

    const { result } = renderHook(() => useFlushOrderQueue(CONSULT_ID))

    let outcome: boolean | undefined
    await act(async () => {
      outcome = await result.current.flush()
    })

    expect(outcome).toBe(false)
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorFlushOrders)
    // meds failed first, so the lab create is never attempted and its queue stays
    expect(mutateLab).not.toHaveBeenCalled()
    expect(useOrderQueueStore.getState().labOrders).toHaveLength(1)
    expect(useOrderQueueStore.getState().medications).toHaveLength(1)
  })
})
