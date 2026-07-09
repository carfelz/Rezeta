import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient, ApiRequestError } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import { appendModification, type BlockModificationEvent } from '@/lib/consultation/modifications'
import { applyContentEdits, type ContentEdit } from '@/lib/consultation/content-edits'
import {
  ErrorCode,
  type ConsultationProtocolUsage,
  type ConsultationWithDetails,
  type ProtocolContent,
  type ProtocolUsageModifications,
} from '@rezeta/shared'

const QK = 'consultations'

type PendingByUsage = Record<string, ProtocolUsageModifications>
type ContentEditsByUsage = Record<string, Record<string, ContentEdit>>

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
 * Merges buffered content edits into a usage's content, preserving unknown
 * content keys (version, template_version, historia_mapping, …) and
 * recursing into section blocks via `applyContentEdits`.
 */
function mergeContent(
  content: ProtocolContent,
  editsByBlockId: Record<string, ContentEdit>,
): ProtocolContent {
  return { ...content, blocks: applyContentEdits(content.blocks, editsByBlockId) }
}

/**
 * Overlays not-yet-persisted modification deltas and content edits onto the
 * server-truth consultation so the UI reflects them immediately. The query
 * cache itself is never touched — refetches triggered by other mutations
 * cannot wipe pending edits.
 */
export function applyPendingToConsultation(
  consultation: ConsultationWithDetails,
  pending: PendingByUsage,
  contentPending: ContentEditsByUsage = {},
): ConsultationWithDetails {
  if (Object.keys(pending).length === 0 && Object.keys(contentPending).length === 0) {
    return consultation
  }
  return {
    ...consultation,
    protocolUsages: consultation.protocolUsages.map((u) => {
      const delta = pending[u.id]
      const contentEdits = contentPending[u.id]
      const withModifications = delta
        ? { ...u, modifications: mergeModifications(u.modifications ?? {}, delta) }
        : u
      return contentEdits
        ? { ...withModifications, content: mergeContent(withModifications.content, contentEdits) }
        : withModifications
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
  /**
   * Buffer a full-value content edit for a run-mode block (vitals values or
   * clinical notes text). Last-write-wins per block: a later edit to the
   * same block id replaces the earlier one rather than stacking.
   */
  recordContentEdit: (usageId: string, blockId: string, edit: ContentEdit) => void
  /**
   * Drop all buffered events and content edits for a usage. Call this once a
   * usage removal has succeeded server-side, so the next flush neither
   * PATCHes a deleted usage (404 -> re-buffered forever) nor silently drops
   * the edits that were meant for it.
   */
  discardUsage: (usageId: string) => void
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

  const [contentPending, setContentPending] = useState<ContentEditsByUsage>({})
  // Same ref-as-source-of-truth pattern as pendingRef, for the same reasons.
  const contentPendingRef = useRef<ContentEditsByUsage>(contentPending)
  const commitContentPending = useCallback((next: ContentEditsByUsage) => {
    contentPendingRef.current = next
    setContentPending(next)
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

  const recordContentEdit = useCallback(
    (usageId: string, blockId: string, edit: ContentEdit) => {
      commitContentPending({
        ...contentPendingRef.current,
        [usageId]: { ...contentPendingRef.current[usageId], [blockId]: edit },
      })
    },
    [commitContentPending],
  )

  const discardUsage = useCallback(
    (usageId: string) => {
      if (usageId in pendingRef.current) {
        const next = { ...pendingRef.current }
        delete next[usageId]
        commitPending(next)
      }
      if (usageId in contentPendingRef.current) {
        const nextContent = { ...contentPendingRef.current }
        delete nextContent[usageId]
        commitContentPending(nextContent)
      }
    },
    [commitContentPending, commitPending],
  )

  const flush = useCallback(async (): Promise<boolean> => {
    const usageIds = new Set([
      ...Object.keys(pendingRef.current),
      ...Object.keys(contentPendingRef.current),
    ])
    if (usageIds.size === 0) return true

    const consultation = qc.getQueryData<ConsultationWithDetails>([QK, consultationId])
    // A usage with buffered content edits but missing from the cache can't be
    // merged into a full content payload — sending {} (or modifications-only,
    // silently dropping the content edits) would either no-op or lose data.
    // Skip that usage's PATCH entirely and keep both its buffers so a later
    // flush (once the usage is back in the cache) can retry it.
    const skipped = new Set<string>()
    const entries = Array.from(usageIds, (usageId) => {
      const delta = pendingRef.current[usageId]
      const contentEdits = contentPendingRef.current[usageId]
      const usage = consultation?.protocolUsages.find((u) => u.id === usageId)
      if (contentEdits && !usage) {
        skipped.add(usageId)
        return null
      }
      // The precondition (expectedContentUpdatedAt) only accompanies a
      // content replace, so it's derived alongside content from the same
      // usage. It rides on contentUpdatedAt (not the row-level updatedAt) so
      // a modifications-only PATCH elsewhere never falsely stales this flush.
      const contentUpdate =
        contentEdits && usage
          ? {
              content: mergeContent(usage.content, contentEdits),
              expectedContentUpdatedAt: usage.contentUpdatedAt,
            }
          : undefined
      const body = {
        ...(delta ? { modifications: delta } : {}),
        ...contentUpdate,
      }
      return [usageId, delta, contentEdits, body] as const
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null)

    // Clear every buffer that IS being flushed; keep the buffers for anything
    // skipped so they survive this flush cycle untouched (not sent, not lost).
    const retainedPending: PendingByUsage = {}
    const retainedContent: ContentEditsByUsage = {}
    for (const usageId of skipped) {
      const delta = pendingRef.current[usageId]
      if (delta) retainedPending[usageId] = delta
      const contentEdits = contentPendingRef.current[usageId]
      if (contentEdits) retainedContent[usageId] = contentEdits
    }
    commitPending(retainedPending)
    commitContentPending(retainedContent)

    const results = await Promise.allSettled(
      entries.map(([usageId, , , body]) =>
        apiClient.patch<ConsultationProtocolUsage>(
          `/v1/consultations/${consultationId}/protocols/${usageId}`,
          body,
          { silent: true },
        ),
      ),
    )

    const failed: PendingByUsage = {}
    const failedContent: ContentEditsByUsage = {}
    // Usages rejected with PROTOCOL_USAGE_STALE: their contentEdits buffer is
    // dropped permanently (re-sending it would just 409 forever) but the
    // modifications delta still goes through `failed` so it gets re-buffered
    // like any other failure.
    let hasStaleFailure = false
    let hasOtherFailure = false
    results.forEach((result, i) => {
      const entry = entries[i]
      if (!entry) return
      const [usageId, delta, contentEdits] = entry
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
        const isStale =
          result.reason instanceof ApiRequestError &&
          result.reason.error.code === ErrorCode.PROTOCOL_USAGE_STALE
        if (isStale) {
          hasStaleFailure = true
          if (delta) failed[usageId] = delta
        } else {
          hasOtherFailure = true
          if (delta) failed[usageId] = delta
          if (contentEdits) failedContent[usageId] = contentEdits
        }
      }
    })

    if (hasStaleFailure || hasOtherFailure) {
      // Re-buffer failed deltas/edits (merged with anything recorded
      // mid-flight) so a later flush retries them.
      const next = { ...pendingRef.current }
      for (const [usageId, delta] of Object.entries(failed)) {
        next[usageId] = mergeModifications(delta, next[usageId] ?? {})
      }
      const nextContent = { ...contentPendingRef.current }
      for (const [usageId, edits] of Object.entries(failedContent)) {
        nextContent[usageId] = { ...edits, ...nextContent[usageId] }
      }
      commitPending(next)
      commitContentPending(nextContent)
      if (hasStaleFailure) {
        toast.error(toastStrings.errorProtocolUsageStale)
        void qc.invalidateQueries({ queryKey: [QK, consultationId] })
      }
      if (hasOtherFailure) {
        toast.error(toastStrings.errorProtocolUsage)
      }
      return false
    }
    return true
  }, [commitContentPending, commitPending, consultationId, qc])

  // Persist whatever is buffered when the doctor leaves the page (unmount on
  // in-app navigation). Fire-and-forget: the fetch outlives the component.
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    return () => {
      void flushRef.current()
    }
  }, [])

  const hasPending = Object.keys(pending).length > 0 || Object.keys(contentPending).length > 0
  const withPending = useCallback(
    (consultation: ConsultationWithDetails) =>
      applyPendingToConsultation(consultation, pending, contentPending),
    [pending, contentPending],
  )

  return useMemo(
    () => ({ hasPending, record, withPending, flush, recordContentEdit, discardUsage }),
    [hasPending, record, withPending, flush, recordContentEdit, discardUsage],
  )
}
