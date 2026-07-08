import { useCallback } from 'react'
import { toast } from 'sonner'
import { useOrderQueueStore } from '@/store/order-queue.store'
import { toastStrings } from '@/lib/toasts'
import {
  useCreatePrescription,
  useCreateImagingOrder,
  useCreateLabOrder,
} from './use-consultations'

/**
 * Persists the client-side order queue (medications, labs, imaging) to the
 * server through the same create endpoints used by the manual "Generar"
 * buttons, so queued-but-ungenerated orders are not silently discarded when a
 * consultation is signed.
 *
 * `flush()` walks each group sequentially (medications, then labs, then
 * imaging), removing each group from the store as its create succeeds — so a
 * failure leaves the remaining queue intact for retry. It returns true only
 * when the whole queue is persisted; on the first failure it toasts
 * `errorFlushOrders` and returns false so the caller aborts the sign.
 */
export function useFlushOrderQueue(consultationId: string): {
  flush: () => Promise<boolean>
} {
  const createPrescription = useCreatePrescription(consultationId)
  const createImagingOrder = useCreateImagingOrder(consultationId)
  const createLabOrder = useCreateLabOrder(consultationId)

  const flush = useCallback(async (): Promise<boolean> => {
    const {
      medicationGroups,
      medications,
      labGroups,
      labOrders,
      imagingGroups,
      imagingOrders,
      removeMedicationGroup,
      removeLabGroup,
      removeImagingGroup,
    } = useOrderQueueStore.getState()

    try {
      for (const group of medicationGroups) {
        const items = medications.filter((m) => m.groupId === group.id)
        if (items.length === 0) continue
        await createPrescription.mutateAsync({
          groupTitle: group.title,
          groupOrder: group.order,
          items: items.map((m) => ({
            drug: m.drug,
            dose: m.dose,
            route: m.route,
            frequency: m.frequency,
            duration: m.duration,
            notes: m.notes,
            source: m.source,
          })),
        })
        removeMedicationGroup(group.id)
      }

      for (const group of labGroups) {
        const items = labOrders.filter((o) => o.groupId === group.id)
        if (items.length === 0) continue
        await createLabOrder.mutateAsync({
          groupTitle: group.title,
          groupOrder: group.order,
          items: items.map((o) => ({
            testName: o.test_name,
            indication: o.indication,
            urgency: o.urgency,
            fastingRequired: o.fasting_required,
            sampleType: o.sample_type,
            ...(o.special_instructions ? { specialInstructions: o.special_instructions } : {}),
            ...(o.source ? { source: o.source } : {}),
          })),
        })
        removeLabGroup(group.id)
      }

      for (const group of imagingGroups) {
        const items = imagingOrders.filter((o) => o.groupId === group.id)
        if (items.length === 0) continue
        await createImagingOrder.mutateAsync({
          groupTitle: group.title,
          groupOrder: group.order,
          items: items.map((o) => ({
            studyType: o.study_type,
            indication: o.indication,
            urgency: o.urgency,
            contrast: o.contrast,
            fastingRequired: o.fasting_required,
            ...(o.special_instructions ? { specialInstructions: o.special_instructions } : {}),
            ...(o.source ? { source: o.source } : {}),
          })),
        })
        removeImagingGroup(group.id)
      }

      return true
    } catch {
      toast.error(toastStrings.errorFlushOrders)
      return false
    }
  }, [createPrescription, createImagingOrder, createLabOrder])

  return { flush }
}
