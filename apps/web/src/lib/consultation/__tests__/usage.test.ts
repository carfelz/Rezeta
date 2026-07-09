import { describe, it, expect } from 'vitest'
import type {
  ChecklistItemEvent,
  ConsultationProtocolUsage,
  ProtocolBlock,
} from '@rezeta/shared'
import { collectUsageCheckableIds, deriveCheckedState } from '../usage'

function makeUsage(blocks: ProtocolBlock[]): ConsultationProtocolUsage {
  return {
    id: 'u-1',
    tenantId: 't-1',
    consultationId: 'c-1',
    protocolId: 'p-1',
    protocolVersionId: 'v-1',
    content: { version: '1.0', blocks } as ConsultationProtocolUsage['content'],
    modifications: {},
    modificationSummary: null,
    parentUsageId: null,
    triggerBlockId: null,
    depth: 0,
    status: 'in_progress',
    completedAt: null,
    notes: null,
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contentUpdatedAt: new Date().toISOString(),
    protocolTitle: 'Test Protocol',
    protocolTypeName: null,
    versionNumber: 1,
  }
}

describe('collectUsageCheckableIds', () => {
  it('returns empty array for usage without checklist or steps', () => {
    expect(collectUsageCheckableIds(makeUsage([]))).toEqual([])
  })

  it('returns empty array when content is null/undefined', () => {
    const usage: ConsultationProtocolUsage = {
      ...makeUsage([]),
      content: null as unknown as ConsultationProtocolUsage['content'],
    }
    expect(collectUsageCheckableIds(usage)).toEqual([])
  })

  it('collects checklist item IDs', () => {
    const usage = makeUsage([
      {
        id: 'b1',
        type: 'checklist',
        items: [
          { id: 'i1', text: 'a' },
          { id: 'i2', text: 'b' },
        ],
      } as ProtocolBlock,
    ])
    expect(collectUsageCheckableIds(usage)).toEqual(['i1', 'i2'])
  })

  it('collects step IDs', () => {
    const usage = makeUsage([
      {
        id: 'b2',
        type: 'steps',
        steps: [
          { id: 's1', order: 1, title: 'Step 1' },
          { id: 's2', order: 2, title: 'Step 2' },
        ],
      } as ProtocolBlock,
    ])
    expect(collectUsageCheckableIds(usage)).toEqual(['s1', 's2'])
  })

  it('ignores blocks that are neither section, checklist, nor steps', () => {
    const usage = makeUsage([
      { id: 't1', type: 'text', content: 'note' } as ProtocolBlock,
      { id: 'a1', type: 'alert', severity: 'info', content: 'hi' } as ProtocolBlock,
    ])
    expect(collectUsageCheckableIds(usage)).toEqual([])
  })

  it('recurses into sections', () => {
    const usage = makeUsage([
      {
        id: 'sec1',
        type: 'section',
        title: 'Sec',
        blocks: [
          {
            id: 'b1',
            type: 'checklist',
            items: [{ id: 'i1', text: 'a' }],
          } as ProtocolBlock,
        ],
      } as ProtocolBlock,
    ])
    expect(collectUsageCheckableIds(usage)).toEqual(['i1'])
  })
})

describe('deriveCheckedState', () => {
  function withEvents(events: ChecklistItemEvent[] | null): ConsultationProtocolUsage {
    // The type says modifications is non-null, but the DB column is nullable
    // and deriveCheckedState guards with `?.`, so exercise the null path too.
    return {
      ...makeUsage([]),
      modifications: (events
        ? { checklist_items: events }
        : null) as ConsultationProtocolUsage['modifications'],
    }
  }

  it('returns an empty map when modifications is null', () => {
    expect(deriveCheckedState(withEvents(null))).toEqual({})
  })

  it('returns an empty map when there are no checklist events', () => {
    const usage = { ...makeUsage([]), modifications: {} }
    expect(deriveCheckedState(usage)).toEqual({})
  })

  it('builds a checked-state map from checklist_items events', () => {
    const usage = withEvents([
      { item_id: 'i1', checked: true, timestamp: '2026-07-06T00:00:00Z' },
      { item_id: 'i2', checked: false, timestamp: '2026-07-06T00:00:01Z' },
    ])
    expect(deriveCheckedState(usage)).toEqual({ i1: true, i2: false })
  })

  it('lets the last event for an item_id win (toggle)', () => {
    const usage = withEvents([
      { item_id: 'i1', checked: true, timestamp: '2026-07-06T00:00:00Z' },
      { item_id: 'i1', checked: false, timestamp: '2026-07-06T00:00:02Z' },
    ])
    expect(deriveCheckedState(usage)).toEqual({ i1: false })
  })
})
