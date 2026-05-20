import { useEffect } from 'react'
import { toast } from 'sonner'
import {
  useOrderQueueStore,
  type OrderGroup,
  type QueuedImagingOrder,
  type QueuedLabOrder,
  type QueuedMedication,
} from '@/store/order-queue.store'
import { toastStrings } from '@/lib/toasts'

interface QueueSnapshot {
  medicationGroups: OrderGroup[]
  medications: QueuedMedication[]
  imagingGroups: OrderGroup[]
  imagingOrders: QueuedImagingOrder[]
  labGroups: OrderGroup[]
  labOrders: QueuedLabOrder[]
  savedAt: number
}

function storageKey(consultationId: string): string {
  return `rz:oq:${consultationId}`
}

/**
 * Persists the in-memory order queue (ungenerated items) to localStorage keyed
 * by consultation ID. On mount, restores any previously saved queue.
 * Clears storage when the consultation is signed.
 */
export function useOrderQueueSession(consultationId: string, isSigned: boolean): void {
  const medicationGroups = useOrderQueueStore((s) => s.medicationGroups)
  const medications = useOrderQueueStore((s) => s.medications)
  const imagingGroups = useOrderQueueStore((s) => s.imagingGroups)
  const imagingOrders = useOrderQueueStore((s) => s.imagingOrders)
  const labGroups = useOrderQueueStore((s) => s.labGroups)
  const labOrders = useOrderQueueStore((s) => s.labOrders)
  const reset = useOrderQueueStore((s) => s.reset)
  const restoreSnapshot = useOrderQueueStore((s) => s.restoreSnapshot)

  // Reset store and restore any saved queue when consultationId changes.
  useEffect(() => {
    if (!consultationId) return
    reset()
    if (isSigned) return
    try {
      const raw = localStorage.getItem(storageKey(consultationId))
      if (!raw) return
      const snapshot = JSON.parse(raw) as QueueSnapshot
      if (
        !snapshot.medications.length &&
        !snapshot.imagingOrders.length &&
        !snapshot.labOrders.length
      )
        return
      restoreSnapshot(snapshot)
      toast.info(toastStrings.orderQueueRestored)
    } catch {
      // corrupted or unavailable storage — start fresh
    }
  }, [consultationId]) // intentional: only reset/restore when consultationId changes

  // Persist to localStorage whenever queue changes. Clear when signed or empty.
  useEffect(() => {
    if (!consultationId) return
    if (isSigned) {
      localStorage.removeItem(storageKey(consultationId))
      return
    }
    if (!medications.length && !imagingOrders.length && !labOrders.length) {
      localStorage.removeItem(storageKey(consultationId))
      return
    }
    try {
      const snapshot: QueueSnapshot = {
        medicationGroups,
        medications,
        imagingGroups,
        imagingOrders,
        labGroups,
        labOrders,
        savedAt: Date.now(),
      }
      localStorage.setItem(storageKey(consultationId), JSON.stringify(snapshot))
    } catch {
      // storage quota exceeded — ignore
    }
  }, [
    consultationId,
    isSigned,
    medicationGroups,
    medications,
    imagingGroups,
    imagingOrders,
    labGroups,
    labOrders,
  ])
}
