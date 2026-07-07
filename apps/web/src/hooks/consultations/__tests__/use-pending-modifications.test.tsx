import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import {
  usePendingModifications,
  mergeModifications,
  applyPendingToConsultation,
} from '../use-pending-modifications'
import type { ConsultationWithDetails, ConsultationProtocolUsage } from '@rezeta/shared'

const usage = {
  id: 'usage-1',
  consultationId: 'cons-1',
  protocolId: 'proto-1',
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
    const { content, modifications } = body as {
      content: { version: string; blocks: { id: string; values?: Record<string, number> }[] }
      modifications: { checklist_items: { item_id: string }[] }
    }
    expect(modifications.checklist_items.map((e) => e.item_id)).toEqual(['itm-1'])
    // Unknown content keys (version, template_version, historia_mapping) survive the merge
    expect(content).toEqual(
      expect.objectContaining({ version: '1', template_version: '2' }),
    )
    expect(content).toHaveProperty('historia_mapping')
    expect(content.blocks[0]).toEqual({ id: 'vit-1', type: 'vitals', fields: [], values: { temp: 40 } })
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
})
