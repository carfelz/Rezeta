import { describe, it, expect, vi, beforeEach } from 'vitest'
import { appendModification } from '../modifications'
import type { ProtocolUsageModifications } from '@rezeta/shared'

const FIXED_TS = '2026-01-01T00:00:00.000Z'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(FIXED_TS))
})

afterEach(() => {
  vi.useRealTimers()
})

const empty: ProtocolUsageModifications = {}

describe('appendModification', () => {
  it('step_completed appends to steps_completed', () => {
    const result = appendModification(empty, { type: 'step_completed', step_id: 's1' })
    expect(result.steps_completed).toEqual([{ step_id: 's1', timestamp: FIXED_TS }])
  })

  it('step_completed appends to existing array', () => {
    const existing: ProtocolUsageModifications = {
      steps_completed: [{ step_id: 's0', timestamp: '2025-01-01T00:00:00.000Z' }],
    }
    const result = appendModification(existing, { type: 'step_completed', step_id: 's1' })
    expect(result.steps_completed).toHaveLength(2)
    expect(result.steps_completed?.[1].step_id).toBe('s1')
  })

  it('checklist_item appends to checklist_items', () => {
    const result = appendModification(empty, {
      type: 'checklist_item',
      item_id: 'i1',
      checked: true,
    })
    expect(result.checklist_items).toEqual([{ item_id: 'i1', checked: true, timestamp: FIXED_TS }])
  })

  it('checklist_item with checked=false records correctly', () => {
    const result = appendModification(empty, {
      type: 'checklist_item',
      item_id: 'i2',
      checked: false,
    })
    expect(result.checklist_items?.[0].checked).toBe(false)
  })

  it('decision_branch appends to decision_branches', () => {
    const result = appendModification(empty, {
      type: 'decision_branch',
      decision_id: 'd1',
      branch_id: 'b1',
      linked_protocol_launched: true,
    })
    expect(result.decision_branches).toEqual([
      { decision_id: 'd1', branch_id: 'b1', linked_protocol_launched: true, timestamp: FIXED_TS },
    ])
  })

  it('imaging_queued appends to imaging_orders_queued', () => {
    const result = appendModification(empty, {
      type: 'imaging_queued',
      order_id: 'o1',
      study_type: 'chest_xray',
    })
    expect(result.imaging_orders_queued).toEqual([
      { order_id: 'o1', study_type: 'chest_xray', timestamp: FIXED_TS },
    ])
  })

  it('medication_queued appends to medications_added without notes', () => {
    const result = appendModification(empty, {
      type: 'medication_queued',
      block_id: 'blk1',
      row_id: 'r1',
      drug: 'Metformina',
      dose: '500mg',
      route: 'oral',
      frequency: 'bid',
    })
    expect(result.medications_added?.[0]).toEqual({
      block_id: 'blk1',
      row_id: 'r1',
      drug: 'Metformina',
      dose: '500mg',
      route: 'oral',
      frequency: 'bid',
      timestamp: FIXED_TS,
    })
    expect(result.medications_added?.[0]).not.toHaveProperty('notes')
  })

  it('medication_queued includes notes when provided', () => {
    const result = appendModification(empty, {
      type: 'medication_queued',
      block_id: 'blk1',
      row_id: 'r1',
      drug: 'Metformina',
      dose: '500mg',
      route: 'oral',
      frequency: 'bid',
      notes: 'con comida',
    })
    expect(result.medications_added?.[0].notes).toBe('con comida')
  })

  it('lab_queued appends to lab_orders_queued', () => {
    const result = appendModification(empty, {
      type: 'lab_queued',
      order_id: 'l1',
      test_name: 'HbA1c',
    })
    expect(result.lab_orders_queued).toEqual([
      { order_id: 'l1', test_name: 'HbA1c', timestamp: FIXED_TS },
    ])
  })

  it('vitals_entered appends to vitals_entered', () => {
    const result = appendModification(empty, {
      type: 'vitals_entered',
      block_id: 'blk1',
      values: { heart_rate: 72, blood_pressure: '120/80' },
    })
    expect(result.vitals_entered).toEqual([
      {
        block_id: 'blk1',
        values: { heart_rate: 72, blood_pressure: '120/80' },
        timestamp: FIXED_TS,
      },
    ])
  })

  it('notes_edited appends to notes_edited', () => {
    const result = appendModification(empty, {
      type: 'notes_edited',
      block_id: 'blk2',
      length: 42,
    })
    expect(result.notes_edited).toEqual([{ block_id: 'blk2', length: 42, timestamp: FIXED_TS }])
  })

  it('does not mutate existing object', () => {
    const existing: ProtocolUsageModifications = { steps_completed: [] }
    appendModification(existing, { type: 'step_completed', step_id: 's1' })
    expect(existing.steps_completed).toHaveLength(0)
  })

  it('accepts explicit timestamp', () => {
    const ts = '2025-06-15T12:00:00.000Z'
    const result = appendModification(empty, { type: 'step_completed', step_id: 's1' }, ts)
    expect(result.steps_completed?.[0].timestamp).toBe(ts)
  })
})
