import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { CanvasView } from '@/components/consultations/CanvasView'
import { computeMissingRequiredFields } from '@rezeta/shared'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiRequestError: class ApiRequestError extends Error {
    error: { code: string; message: string; details?: Record<string, unknown> }
    constructor(error: { code: string; message: string; details?: Record<string, unknown> }) {
      super(error.message)
      this.error = error
    }
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from 'sonner'
import { apiClient, ApiRequestError } from '@/lib/api-client'
import {
  usePendingModifications,
  mergeModifications,
  applyPendingToConsultation,
} from '../use-pending-modifications'
import { ErrorCode, type ConsultationWithDetails, type ConsultationProtocolUsage } from '@rezeta/shared'

const usage = {
  id: 'usage-1',
  consultationId: 'cons-1',
  protocolId: 'proto-1',
  updatedAt: '2026-01-01T10:00:00.000Z',
  // Deliberately different from updatedAt: a modifications-only PATCH bumps
  // the row's updatedAt but must not bump contentUpdatedAt, and the flush
  // precondition must ride on contentUpdatedAt, not updatedAt.
  contentUpdatedAt: '2026-01-01T09:00:00.000Z',
  modifications: {
    checklist_items: [{ item_id: 'itm-0', checked: true, timestamp: 'past' }],
  },
  content: {
    version: '1',
    template_version: '2',
    historia_mapping: { 'vit-1': { section: 'examen_fisico' } },
    blocks: [
      { id: 'vit-1', type: 'vitals', fields: [], values: { temp: 36.5 } },
      { id: 'notes-1', type: 'clinical_notes', label: 'Notas', content: 'original' },
      {
        id: 'sec-1',
        type: 'section',
        title: 'Sección',
        blocks: [{ id: 'vit-nested', type: 'vitals', fields: [], values: {} }],
      },
    ],
  },
} as unknown as ConsultationProtocolUsage

const consultation = {
  id: 'cons-1',
  status: 'open',
  protocolUsages: [usage],
} as unknown as ConsultationWithDetails

function makeClientAndWrapper(): {
  client: QueryClient
  wrapper: ({ children }: { children: React.ReactNode }) => React.ReactElement
} {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['consultations', 'cons-1'], consultation)
  const wrapper = ({ children }: { children: React.ReactNode }): React.ReactElement =>
    React.createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

describe('mergeModifications', () => {
  it('concatenates event arrays per key without touching other keys', () => {
    const merged = mergeModifications(
      { checklist_items: [{ item_id: 'a', checked: true, timestamp: 't1' }] },
      {
        checklist_items: [{ item_id: 'b', checked: false, timestamp: 't2' }],
        steps_completed: [{ step_id: 's1', timestamp: 't3' }],
      },
    )
    expect(merged.checklist_items?.map((e) => e.item_id)).toEqual(['a', 'b'])
    expect(merged.steps_completed?.map((e) => e.step_id)).toEqual(['s1'])
  })
})

describe('applyPendingToConsultation', () => {
  it('overlays pending deltas onto the matching usage only', () => {
    const overlaid = applyPendingToConsultation(consultation, {
      'usage-1': { steps_completed: [{ step_id: 's9', timestamp: 't' }] },
    })
    const u = overlaid.protocolUsages[0]!
    expect(u.modifications?.steps_completed?.map((e) => e.step_id)).toEqual(['s9'])
    expect(u.modifications?.checklist_items).toHaveLength(1)
    // Server-truth object is not mutated
    expect(usage.modifications?.steps_completed).toBeUndefined()
  })

  it('returns the consultation unchanged when nothing is pending', () => {
    expect(applyPendingToConsultation(consultation, {})).toBe(consultation)
  })
})

describe('usePendingModifications', () => {
  beforeEach(() => vi.clearAllMocks())

  it('buffers events locally without firing any API call', () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
    })

    expect(apiClient.patch).not.toHaveBeenCalled()
    expect(result.current.hasPending).toBe(true)
    const merged = result.current.withPending(consultation)
    expect(merged.protocolUsages[0]!.modifications?.checklist_items?.map((e) => e.item_id)).toEqual(
      ['itm-0', 'itm-1'],
    )
  })

  it('flush PATCHes only the delta per usage, clears the buffer, and updates the cache', async () => {
    const serverUsage = { ...usage, id: 'usage-1', modificationSummary: 'from-server' }
    vi.mocked(apiClient.patch).mockResolvedValue(serverUsage)
    const { client, wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
      result.current.record('usage-1', { type: 'step_completed', step_id: 'step-1' })
    })

    let ok = false
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(true)
    expect(result.current.hasPending).toBe(false)
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
    const [url, body, opts] = vi.mocked(apiClient.patch).mock.calls[0]!
    expect(url).toBe('/v1/consultations/cons-1/protocols/usage-1')
    expect(opts).toEqual({ silent: true })
    const mods = (
      body as {
        modifications: {
          checklist_items: { item_id: string }[]
          steps_completed: { step_id: string }[]
        }
      }
    ).modifications
    // Delta only — the pre-existing itm-0 event is never resent
    expect(mods.checklist_items.map((e) => e.item_id)).toEqual(['itm-1'])
    expect(mods.steps_completed.map((e) => e.step_id)).toEqual(['step-1'])

    const cached = client.getQueryData<ConsultationWithDetails>(['consultations', 'cons-1'])!
    expect(cached.protocolUsages[0]).toEqual(serverUsage)
  })

  it('flush resolves true immediately when nothing is pending', async () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })
    await expect(result.current.flush()).resolves.toBe(true)
    expect(apiClient.patch).not.toHaveBeenCalled()
  })

  it('flush re-buffers the delta, toasts, and resolves false when the PATCH fails', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('network'))
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
    })

    let ok = true
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(false)
    expect(toast.error).toHaveBeenCalled()
    expect(result.current.hasPending).toBe(true)

    // A retry flush resends the same delta
    vi.mocked(apiClient.patch).mockResolvedValue(usage)
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(true)
    expect(vi.mocked(apiClient.patch).mock.calls).toHaveLength(2)
  })

  it('flushes buffered events on unmount (doctor navigates away)', () => {
    vi.mocked(apiClient.patch).mockResolvedValue(usage)
    const { wrapper } = makeClientAndWrapper()
    const { result, unmount } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.record('usage-1', { type: 'step_completed', step_id: 'step-1' })
    })
    expect(apiClient.patch).not.toHaveBeenCalled()

    unmount()
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(apiClient.patch).mock.calls[0]![0]).toBe(
      '/v1/consultations/cons-1/protocols/usage-1',
    )
  })

  it('recordContentEdit overlays a vitals edit into the usage content blocks', () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.recordContentEdit('usage-1', 'vit-1', {
        kind: 'vitals',
        values: { temp: 39.1 },
      })
    })

    expect(apiClient.patch).not.toHaveBeenCalled()
    expect(result.current.hasPending).toBe(true)
    const merged = result.current.withPending(consultation)
    const block = merged.protocolUsages[0]!.content.blocks[0] as unknown as {
      values: Record<string, number>
    }
    expect(block.values).toEqual({ temp: 39.1 })
  })

  it('recordContentEdit overlays a notes edit into the usage content blocks', () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.recordContentEdit('usage-1', 'notes-1', {
        kind: 'notes',
        content: 'updated note text',
      })
    })

    const merged = result.current.withPending(consultation)
    const block = merged.protocolUsages[0]!.content.blocks[1] as unknown as { content: string }
    expect(block.content).toBe('updated note text')
  })

  it('recordContentEdit is last-write-wins per block', () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.recordContentEdit('usage-1', 'notes-1', { kind: 'notes', content: 'first' })
      result.current.recordContentEdit('usage-1', 'notes-1', { kind: 'notes', content: 'second' })
    })

    const merged = result.current.withPending(consultation)
    const block = merged.protocolUsages[0]!.content.blocks[1] as unknown as { content: string }
    expect(block.content).toBe('second')
  })

  it('flush sends the full merged content alongside the modifications delta in one PATCH', async () => {
    const serverUsage = { ...usage, id: 'usage-1' }
    vi.mocked(apiClient.patch).mockResolvedValue(serverUsage)
    const { result } = renderHook(() => usePendingModifications('cons-1'), {
      wrapper: makeClientAndWrapper().wrapper,
    })

    act(() => {
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
      result.current.recordContentEdit('usage-1', 'vit-1', {
        kind: 'vitals',
        values: { temp: 40 },
      })
    })

    let ok = false
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(true)
    expect(result.current.hasPending).toBe(false)
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
    const [, body] = vi.mocked(apiClient.patch).mock.calls[0]!
    const { content, modifications, expectedContentUpdatedAt } = body as {
      content: { version: string; blocks: { id: string; values?: Record<string, number> }[] }
      modifications: { checklist_items: { item_id: string }[] }
      expectedContentUpdatedAt: string
    }
    expect(modifications.checklist_items.map((e) => e.item_id)).toEqual(['itm-1'])
    // Unknown content keys (version, template_version, historia_mapping) survive the merge
    expect(content).toEqual(
      expect.objectContaining({ version: '1', template_version: '2' }),
    )
    expect(content).toHaveProperty('historia_mapping')
    expect(content.blocks[0]).toEqual({ id: 'vit-1', type: 'vitals', fields: [], values: { temp: 40 } })
    // The precondition rides alongside the content replace, and is derived
    // from contentUpdatedAt (not the row-level updatedAt).
    expect(expectedContentUpdatedAt).toBe(usage.contentUpdatedAt)
  })

  it('flush sends content-only (no modifications key) when only content edits are pending', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(usage)
    const { result } = renderHook(() => usePendingModifications('cons-1'), {
      wrapper: makeClientAndWrapper().wrapper,
    })

    act(() => {
      result.current.recordContentEdit('usage-1', 'notes-1', {
        kind: 'notes',
        content: 'content only',
      })
    })

    await act(async () => {
      await result.current.flush()
    })

    const [, body] = vi.mocked(apiClient.patch).mock.calls[0]!
    expect(body).not.toHaveProperty('modifications')
    expect(body).toHaveProperty('content')
  })

  it('flush omits the content key when only events are pending', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue(usage)
    const { result } = renderHook(() => usePendingModifications('cons-1'), {
      wrapper: makeClientAndWrapper().wrapper,
    })

    act(() => {
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
    })

    await act(async () => {
      await result.current.flush()
    })

    const [, body] = vi.mocked(apiClient.patch).mock.calls[0]!
    expect(body).not.toHaveProperty('content')
    expect(body).toHaveProperty('modifications')
  })

  it('flush does not clear the content buffer when the PATCH fails', async () => {
    vi.mocked(apiClient.patch).mockRejectedValue(new Error('network'))
    const { result } = renderHook(() => usePendingModifications('cons-1'), {
      wrapper: makeClientAndWrapper().wrapper,
    })

    act(() => {
      result.current.recordContentEdit('usage-1', 'notes-1', {
        kind: 'notes',
        content: 'will fail',
      })
    })

    let ok = true
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(false)
    expect(result.current.hasPending).toBe(true)
    const merged = result.current.withPending(consultation)
    const block = merged.protocolUsages[0]!.content.blocks[1] as unknown as { content: string }
    expect(block.content).toBe('will fail')

    // A retry flush resends the same content edit
    vi.mocked(apiClient.patch).mockResolvedValue(usage)
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(true)
    expect(vi.mocked(apiClient.patch).mock.calls).toHaveLength(2)
    const [, retryBody] = vi.mocked(apiClient.patch).mock.calls[1]!
    expect(retryBody).toHaveProperty('content')
  })

  it('discardUsage drops both buffers for a removed usage; flush only PATCHes the surviving one', async () => {
    const usage2 = { ...usage, id: 'usage-2' }
    const consultationWithBoth = {
      ...consultation,
      protocolUsages: [usage, usage2],
    } as unknown as ConsultationWithDetails
    const survivorServerUsage = { ...usage, id: 'usage-2' }
    vi.mocked(apiClient.patch).mockResolvedValue(survivorServerUsage)
    const { client, wrapper } = makeClientAndWrapper()
    client.setQueryData(['consultations', 'cons-1'], consultationWithBoth)
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
      result.current.recordContentEdit('usage-1', 'notes-1', {
        kind: 'notes',
        content: 'orphaned edit',
      })
      result.current.record('usage-2', { type: 'step_completed', step_id: 'step-1' })
      result.current.recordContentEdit('usage-2', 'vit-1', {
        kind: 'vitals',
        values: { temp: 38 },
      })
    })

    act(() => {
      result.current.discardUsage('usage-1')
    })

    // Discarded usage's buffered checklist event and content edit are both gone;
    // it renders exactly as server-truth again.
    const overlaid = result.current.withPending(consultationWithBoth)
    const discardedUsage = overlaid.protocolUsages.find((u) => u.id === 'usage-1')!
    expect(discardedUsage.modifications?.checklist_items).toHaveLength(1)
    const discardedNotesBlock = discardedUsage.content.blocks[1] as unknown as { content: string }
    expect(discardedNotesBlock.content).toBe('original')

    let ok = false
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(true)
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
    const [url, body] = vi.mocked(apiClient.patch).mock.calls[0]!
    expect(url).toBe('/v1/consultations/cons-1/protocols/usage-2')
    const { content, modifications } = body as {
      content: { blocks: { id: string; values?: Record<string, number> }[] }
      modifications: { steps_completed: { step_id: string }[] }
    }
    expect(modifications.steps_completed.map((e) => e.step_id)).toEqual(['step-1'])
    expect(content.blocks[0]).toEqual({ id: 'vit-1', type: 'vitals', fields: [], values: { temp: 38 } })
  })

  it('flush skips a usage whose content edits are buffered but the usage is missing from the cache, keeping both buffers and sending no empty body', async () => {
    const { client, wrapper } = makeClientAndWrapper()
    // Only usage-1 is in the cache; usage-missing has a buffered content edit
    // but no matching usage (e.g. evicted from the cache by a refetch race).
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.recordContentEdit('usage-missing', 'notes-x', {
        kind: 'notes',
        content: 'orphaned',
      })
    })

    let ok = false
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(true)
    // No PATCH at all — the only pending usage was skipped, not sent.
    expect(apiClient.patch).not.toHaveBeenCalled()
    // The buffer for the missing usage survives so a later flush can retry it.
    expect(result.current.hasPending).toBe(true)
    const merged = result.current.withPending(client.getQueryData(['consultations', 'cons-1'])!)
    expect(merged.protocolUsages.find((u) => u.id === 'usage-missing')).toBeUndefined()
  })

  it('flush skips only the usage missing from the cache while still flushing a co-pending usage that is present', async () => {
    const serverUsage = { ...usage, id: 'usage-1', modificationSummary: 'ok' }
    vi.mocked(apiClient.patch).mockResolvedValue(serverUsage)
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    act(() => {
      result.current.recordContentEdit('usage-missing', 'notes-x', {
        kind: 'notes',
        content: 'orphaned',
      })
      result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
    })

    let ok = false
    await act(async () => {
      ok = await result.current.flush()
    })

    expect(ok).toBe(true)
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
    const [url] = vi.mocked(apiClient.patch).mock.calls[0]!
    expect(url).toBe('/v1/consultations/cons-1/protocols/usage-1')
    // The skipped usage's content edit is still buffered afterward, even
    // though the co-pending usage-1 delta was flushed and cleared.
    expect(result.current.hasPending).toBe(true)
  })

  it('discardUsage is a no-op when the usage has nothing buffered', () => {
    const { result } = renderHook(() => usePendingModifications('cons-1'), {
      wrapper: makeClientAndWrapper().wrapper,
    })

    act(() => {
      result.current.record('usage-2', { type: 'step_completed', step_id: 'step-1' })
    })

    act(() => {
      result.current.discardUsage('usage-not-buffered')
    })

    expect(result.current.hasPending).toBe(true)
    const overlaid = result.current.withPending(consultation)
    expect(overlaid.protocolUsages[0]!.modifications?.checklist_items).toHaveLength(1)
  })

  describe('PROTOCOL_USAGE_STALE handling', () => {
    it('on a stale rejection: toasts the stale message, drops the contentEdits buffer, re-buffers the modifications delta, and invalidates the consultation query', async () => {
      const staleError = new ApiRequestError({
        code: ErrorCode.PROTOCOL_USAGE_STALE,
        message: 'stale',
      })
      vi.mocked(apiClient.patch).mockRejectedValue(staleError)
      const { client, wrapper } = makeClientAndWrapper()
      const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
      const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

      act(() => {
        result.current.record('usage-1', { type: 'checklist_item', item_id: 'itm-1', checked: true })
        result.current.recordContentEdit('usage-1', 'notes-1', {
          kind: 'notes',
          content: 'edited before conflict',
        })
      })

      let ok = true
      await act(async () => {
        ok = await result.current.flush()
      })

      expect(ok).toBe(false)
      expect(toast.error).toHaveBeenCalledTimes(1)
      expect(toast.error).toHaveBeenCalledWith(
        'Este protocolo fue actualizado en otra pestaña o dispositivo. Recarga la consulta para continuar.',
      )
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['consultations', 'cons-1'] })

      // contentEdits are dropped — the notes block reverts to server truth
      const overlaid = result.current.withPending(consultation)
      const notesBlock = overlaid.protocolUsages[0]!.content.blocks[1] as unknown as {
        content: string
      }
      expect(notesBlock.content).toBe('original')

      // the modifications delta survives and is resent on the next flush
      expect(result.current.hasPending).toBe(true)
      vi.mocked(apiClient.patch).mockResolvedValueOnce({ ...usage, modificationSummary: 'ok' })
      let retryOk = false
      await act(async () => {
        retryOk = await result.current.flush()
      })
      expect(retryOk).toBe(true)
      expect(apiClient.patch).toHaveBeenCalledTimes(2)
      const [, retryBody] = vi.mocked(apiClient.patch).mock.calls[1]!
      expect(retryBody).not.toHaveProperty('content')
      expect(
        (retryBody as { modifications: { checklist_items: { item_id: string }[] } }).modifications
          .checklist_items.map((e) => e.item_id),
      ).toEqual(['itm-1'])
    })

    it('toasts the stale message only once even when multiple usages come back stale', async () => {
      const staleError = new ApiRequestError({
        code: ErrorCode.PROTOCOL_USAGE_STALE,
        message: 'stale',
      })
      vi.mocked(apiClient.patch).mockRejectedValue(staleError)
      const usage2 = { ...usage, id: 'usage-2' }
      const consultationWithBoth = {
        ...consultation,
        protocolUsages: [usage, usage2],
      } as unknown as ConsultationWithDetails
      const { client, wrapper } = makeClientAndWrapper()
      client.setQueryData(['consultations', 'cons-1'], consultationWithBoth)

      const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

      act(() => {
        result.current.recordContentEdit('usage-1', 'notes-1', { kind: 'notes', content: 'a' })
        result.current.recordContentEdit('usage-2', 'notes-1', { kind: 'notes', content: 'b' })
      })

      await act(async () => {
        await result.current.flush()
      })

      expect(toast.error).toHaveBeenCalledTimes(1)
    })

    it('a non-stale rejection keeps the existing generic-toast, re-buffer-both behavior unchanged', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error('network'))
      const { wrapper } = makeClientAndWrapper()
      const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

      act(() => {
        result.current.recordContentEdit('usage-1', 'notes-1', {
          kind: 'notes',
          content: 'will still retry',
        })
      })

      let ok = true
      await act(async () => {
        ok = await result.current.flush()
      })

      expect(ok).toBe(false)
      expect(toast.error).toHaveBeenCalledWith(
        'No se pudo actualizar el protocolo de la consulta.',
      )
      const overlaid = result.current.withPending(consultation)
      const notesBlock = overlaid.protocolUsages[0]!.content.blocks[1] as unknown as {
        content: string
      }
      expect(notesBlock.content).toBe('will still retry')
    })
  })
})

/**
 * Verifies the full run-mode live loop end to end: typing in a rendered
 * `CanvasView` calls `onContentEdit` -> `recordContentEdit` buffers the edit
 * -> `withPending` overlays it onto the server-truth usage -> the re-rendered
 * `CanvasView` shows the new value. This must come from the overlay, not from
 * local component state (VitalsBlock/ClinicalNotesBlock are controlled and
 * hold no state of their own), so a stale overlay would surface here as the
 * input reverting to its previous value after the parent re-renders.
 */
describe('usePendingModifications live loop with CanvasView', () => {
  beforeEach(() => vi.clearAllMocks())

  // Local usage/consultation fixtures with a real vitals field def — the
  // module-level `usage` fixture uses `fields: []` (irrelevant to the
  // PATCH-body tests above), which renders no input for VitalsBlock to type
  // into.
  const usageWithVitalsField = {
    ...usage,
    content: {
      ...usage.content,
      blocks: [
        {
          id: 'vit-1',
          type: 'vitals',
          fields: [{ id: 'temp', label: 'Temperatura', input_type: 'number' }],
          values: { temp: 36.5 },
        },
        usage.content.blocks[1],
        usage.content.blocks[2],
      ],
    },
  } as unknown as ConsultationProtocolUsage
  const consultationWithVitalsField = {
    ...consultation,
    protocolUsages: [usageWithVitalsField],
  } as unknown as ConsultationWithDetails

  function Harness({ initial }: { initial: ConsultationWithDetails }): React.ReactElement {
    const { record, withPending, recordContentEdit } = usePendingModifications('cons-1')
    const overlaid = withPending(initial)
    const activeUsage = overlaid.protocolUsages[0]!
    return (
      <CanvasView
        usage={activeUsage}
        onCheck={() => {}}
        onModification={(event) => record(activeUsage.id, event)}
        onContentEdit={(blockId, edit) => recordContentEdit(activeUsage.id, blockId, edit)}
        isSigned={false}
      />
    )
  }

  it('round-trips a typed vitals value through the overlay back into the input', () => {
    const { wrapper } = makeClientAndWrapper()
    render(<Harness initial={consultationWithVitalsField} />, { wrapper })

    const tempInput = screen.getByDisplayValue('36.5')
    fireEvent.change(tempInput, { target: { value: '39.2' } })

    expect(screen.getByDisplayValue('39.2')).toBeInTheDocument()
  })

  it('round-trips typed clinical notes text through the overlay back into the textarea', () => {
    const { wrapper } = makeClientAndWrapper()
    render(<Harness initial={consultation} />, { wrapper })

    const textarea = screen.getByDisplayValue('original')
    fireEvent.change(textarea, { target: { value: 'Paciente refiere mejoría' } })

    expect(screen.getByDisplayValue('Paciente refiere mejoría')).toBeInTheDocument()
  })
})

describe('computeMissingRequiredFields liveness against the pending overlay', () => {
  beforeEach(() => vi.clearAllMocks())

  const usageWithRequiredNotes = {
    ...usage,
    id: 'usage-req',
    status: 'in_progress',
    modifications: {},
    content: {
      version: '1',
      blocks: [
        { id: 'notes-req', type: 'clinical_notes', label: 'Notas', content: '', required: true },
      ],
    },
  } as unknown as ConsultationProtocolUsage

  const consultationWithRequiredNotes = {
    id: 'cons-1',
    status: 'open',
    protocolUsages: [usageWithRequiredNotes],
  } as unknown as ConsultationWithDetails

  it('lists the required clinical_notes block as missing while empty, and clears it once recordContentEdit fills it', () => {
    const { wrapper } = makeClientAndWrapper()
    const { result } = renderHook(() => usePendingModifications('cons-1'), { wrapper })

    const beforeMissing = computeMissingRequiredFields(
      result.current.withPending(consultationWithRequiredNotes).protocolUsages,
    )
    expect(beforeMissing.map((f) => f.id)).toContain('protocol:usage-req:notes-req')

    act(() => {
      result.current.recordContentEdit('usage-req', 'notes-req', {
        kind: 'notes',
        content: 'Sin hallazgos relevantes',
      })
    })

    const afterMissing = computeMissingRequiredFields(
      result.current.withPending(consultationWithRequiredNotes).protocolUsages,
    )
    expect(afterMissing.map((f) => f.id)).not.toContain('protocol:usage-req:notes-req')
  })
})
