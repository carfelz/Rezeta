import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { toastStrings } from '@/lib/toasts'

const mutateRx = vi.fn()
const mutateImg = vi.fn()
const mutateLab = vi.fn()
const useCreatePrescriptionMock = vi.fn(() => ({ mutateAsync: mutateRx }))
const useCreateImagingOrderMock = vi.fn(() => ({ mutateAsync: mutateImg }))
const useCreateLabOrderMock = vi.fn(() => ({ mutateAsync: mutateLab }))

vi.mock('../use-consultations', () => ({
  useCreatePrescription: (id: string, opts?: { silent?: boolean }) =>
    useCreatePrescriptionMock(id, opts),
  useCreateImagingOrder: (id: string, opts?: { silent?: boolean }) =>
    useCreateImagingOrderMock(id, opts),
  useCreateLabOrder: (id: string, opts?: { silent?: boolean }) => useCreateLabOrderMock(id, opts),
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
        clientRequestId: expect.any(String),
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
        clientRequestId: expect.any(String),
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
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('requests each create hook silenced, so per-group toasts never fire', () => {
    renderHook(() => useFlushOrderQueue(CONSULT_ID))

    expect(useCreatePrescriptionMock).toHaveBeenCalledWith(CONSULT_ID, { silent: true })
    expect(useCreateImagingOrderMock).toHaveBeenCalledWith(CONSULT_ID, { silent: true })
    expect(useCreateLabOrderMock).toHaveBeenCalledWith(CONSULT_ID, { silent: true })
  })

  it('persists a queued imaging order group, then empties the store and returns true', async () => {
    act(() => {
      useOrderQueueStore.getState().queueImagingOrder({
        study_type: 'Radiografía de tórax',
        indication: 'tos persistente',
        urgency: 'routine',
        contrast: false,
        fasting_required: false,
        source: 'protocolo:tos',
      })
    })

    const { result } = renderHook(() => useFlushOrderQueue(CONSULT_ID))

    let outcome: boolean | undefined
    await act(async () => {
      outcome = await result.current.flush()
    })

    expect(outcome).toBe(true)
    expect(mutateImg).toHaveBeenCalledTimes(1)
    expect(mutateImg).toHaveBeenCalledWith(
      expect.objectContaining({
        groupOrder: 1,
        clientRequestId: expect.any(String),
        items: [
          expect.objectContaining({
            studyType: 'Radiografía de tórax',
            indication: 'tos persistente',
            urgency: 'routine',
            contrast: false,
            fastingRequired: false,
            source: 'protocolo:tos',
          }),
        ],
      }),
    )
    expect(useOrderQueueStore.getState().imagingOrders).toHaveLength(0)
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
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith(toastStrings.errorFlushOrders)
    // meds failed first, so the lab create is never attempted and its queue stays
    expect(mutateLab).not.toHaveBeenCalled()
    expect(useOrderQueueStore.getState().labOrders).toHaveLength(1)
    expect(useOrderQueueStore.getState().medications).toHaveLength(1)
  })

  it('sends the same clientRequestId on a retried flush of a still-queued group', async () => {
    // Simulates the client-side-timeout scenario: the first flush's create
    // "fails" from the client's perspective (e.g. an aborted request) so the
    // group stays queued; a second flush retries the SAME group instance.
    mutateRx.mockRejectedValueOnce(new Error('client timeout'))

    act(() => {
      useOrderQueueStore.getState().queueMedication({
        drug: 'Amoxicilina',
        dose: '500mg',
        route: 'oral',
        frequency: 'cada 8h',
        duration: '7 días',
      })
    })

    const { result } = renderHook(() => useFlushOrderQueue(CONSULT_ID))

    await act(async () => {
      await result.current.flush()
    })
    expect(mutateRx).toHaveBeenCalledTimes(1)
    const firstRequestId = mutateRx.mock.calls[0]?.[0]?.clientRequestId as string
    expect(firstRequestId).toBeTruthy()
    // the group is still queued after the failed attempt
    expect(useOrderQueueStore.getState().medications).toHaveLength(1)

    mutateRx.mockResolvedValueOnce({})
    await act(async () => {
      await result.current.flush()
    })

    expect(mutateRx).toHaveBeenCalledTimes(2)
    const secondRequestId = mutateRx.mock.calls[1]?.[0]?.clientRequestId as string
    expect(secondRequestId).toBe(firstRequestId)
    expect(useOrderQueueStore.getState().medications).toHaveLength(0)
  })
})
