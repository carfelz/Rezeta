import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import { appendModification, type BlockModificationEvent } from '@/lib/consultation/modifications'
import type {
  ConsultationProtocolUsage,
  ConsultationWithDetails,
  ProtocolUsageModifications,
} from '@rezeta/shared'

const QK = 'consultations'

type PendingByUsage = Record<string, ProtocolUsageModifications>

/**
 * Concatenates every event array of `delta` onto `base`. Both objects only
 * hold append-only event arrays, mirroring the server-side merge in
 * ConsultationsRepository.updateProtocolUsage.
 */
export function mergeModifications(
  base: ProtocolUsageModifications,
  delta: ProtocolUsageModifications,
): ProtocolUsageModifications {
  const merged = { ...base } as Record<string, unknown[]>
  for (const [key, events] of Object.entries(delta) as [string, unknown[]][]) {
    if (events) merged[key] = [...(merged[key] ?? []), ...events]
  }
  return merged as ProtocolUsageModifications
}

/**
 * Overlays not-yet-persisted modification deltas onto the server-truth
 * consultation so the UI reflects them immediately. The query cache itself is
 * never touched — refetches triggered by other mutations cannot wipe pending
 * edits.
 */
export function applyPendingToConsultation(
  consultation: ConsultationWithDetails,
  pending: PendingByUsage,
): ConsultationWithDetails {
  if (Object.keys(pending).length === 0) return consultation
  return {
    ...consultation,
    protocolUsages: consultation.protocolUsages.map((u) => {
      const delta = pending[u.id]
      return delta ? { ...u, modifications: mergeModifications(u.modifications ?? {}, delta) } : u
    }),
  }
}

export interface PendingModifications {
  /** True while there are modification events not yet persisted to the API. */
  hasPending: boolean
  /** Buffer a block modification locally instead of PATCHing immediately. */
  record: (usageId: string, event: BlockModificationEvent) => void
  /** Overlay pending deltas onto the server-truth consultation for rendering. */
  withPending: (consultation: ConsultationWithDetails) => ConsultationWithDetails
  /**
   * PATCH all buffered deltas (one request per usage; the server appends the
   * event arrays). Resolves false and keeps the deltas buffered if any request
   * fails, so callers gating on persistence (sign) can abort.
   */
  flush: () => Promise<boolean>
}

export function usePendingModifications(consultationId: string): PendingModifications {
  const qc = useQueryClient()
  const [pending, setPending] = useState<PendingByUsage>({})
  // The ref is the source of truth (flush can run from an unmount cleanup or
  // in the same tick as a record); state exists only to re-render the overlay.
  const pendingRef = useRef<PendingByUsage>(pending)
  const commitPending = useCallback((next: PendingByUsage) => {
    pendingRef.current = next
    setPending(next)
  }, [])

  const record = useCallback(
    (usageId: string, event: BlockModificationEvent) => {
      commitPending({
        ...pendingRef.current,
        [usageId]: appendModification(pendingRef.current[usageId] ?? {}, event),
      })
    },
    [commitPending],
  )

  const flush = useCallback(async (): Promise<boolean> => {
    const entries = Object.entries(pendingRef.current)
    if (entries.length === 0) return true
    commitPending({})

    const results = await Promise.allSettled(
      entries.map(([usageId, delta]) =>
        apiClient.patch<ConsultationProtocolUsage>(
          `/v1/consultations/${consultationId}/protocols/${usageId}`,
          { modifications: delta },
          { silent: true },
        ),
      ),
    )

    const failed: PendingByUsage = {}
    results.forEach((result, i) => {
      const entry = entries[i]
      if (!entry) return
      const [usageId, delta] = entry
      if (result.status === 'fulfilled') {
        // Fold the server-confirmed usage back into the cache so the next
        // render keeps showing the persisted events without a refetch.
        const confirmed = result.value
        if (confirmed) {
          qc.setQueryData<ConsultationWithDetails>([QK, consultationId], (prev) =>
            prev
              ? {
                  ...prev,
                  protocolUsages: prev.protocolUsages.map((u) =>
                    u.id === confirmed.id ? confirmed : u,
                  ),
                }
              : prev,
          )
        }
      } else {
        failed[usageId] = delta
      }
    })

    if (Object.keys(failed).length > 0) {
      // Re-buffer failed deltas (merged with anything recorded mid-flight)
      // so a later flush retries them.
      const next = { ...pendingRef.current }
      for (const [usageId, delta] of Object.entries(failed)) {
        next[usageId] = mergeModifications(delta, next[usageId] ?? {})
      }
      commitPending(next)
      toast.error(toastStrings.errorProtocolUsage)
      return false
    }
    return true
  }, [commitPending, consultationId, qc])

  // Persist whatever is buffered when the doctor leaves the page (unmount on
  // in-app navigation). Fire-and-forget: the fetch outlives the component.
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    return () => {
      void flushRef.current()
    }
  }, [])

  const hasPending = Object.keys(pending).length > 0
  const withPending = useCallback(
    (consultation: ConsultationWithDetails) => applyPendingToConsultation(consultation, pending),
    [pending],
  )

  return useMemo(
    () => ({ hasPending, record, withPending, flush }),
    [hasPending, record, withPending, flush],
  )
}
