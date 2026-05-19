import { describe, it, expect } from 'vitest'
import { getCheckedStateFromModifications } from '../src/protocol/checked-state.js'
import type { ProtocolUsageModifications } from '../src/types/consultation.js'

describe('getCheckedStateFromModifications', () => {
  it('returns empty object for empty modifications', () => {
    expect(getCheckedStateFromModifications({})).toEqual({})
  })

  it('marks completed steps as true', () => {
    const mods: ProtocolUsageModifications = {
      steps_completed: [
        { step_id: 'stp_01', timestamp: '2026-01-01T00:00:00Z' },
        { step_id: 'stp_02', timestamp: '2026-01-01T00:01:00Z' },
      ],
    }
    const state = getCheckedStateFromModifications(mods)
    expect(state['stp_01']).toBe(true)
    expect(state['stp_02']).toBe(true)
  })

  it('marks skipped steps under :skipped key', () => {
    const mods: ProtocolUsageModifications = {
      steps_skipped: [
        { step_id: 'stp_03', timestamp: '2026-01-01T00:00:00Z', reason: 'not applicable' },
      ],
    }
    const state = getCheckedStateFromModifications(mods)
    expect(state['stp_03:skipped']).toBe(true)
    expect(state['stp_03']).toBeUndefined()
  })

  it('uses last checklist_items event per item (last wins)', () => {
    const mods: ProtocolUsageModifications = {
      checklist_items: [
        { item_id: 'itm_01', checked: true, timestamp: '2026-01-01T00:00:00Z' },
        { item_id: 'itm_01', checked: false, timestamp: '2026-01-01T00:01:00Z' },
      ],
    }
    const state = getCheckedStateFromModifications(mods)
    expect(state['itm_01']).toBe(false)
  })

  it('marks selected decision branch as true', () => {
    const mods: ProtocolUsageModifications = {
      decision_branches: [
        {
          decision_id: 'blk_dec',
          branch_id: 'brn_yes',
          linked_protocol_launched: false,
          timestamp: '2026-01-01T00:00:00Z',
        },
      ],
    }
    const state = getCheckedStateFromModifications(mods)
    expect(state['brn_yes']).toBe(true)
  })

  it('handles mixed event types together', () => {
    const mods: ProtocolUsageModifications = {
      steps_completed: [{ step_id: 'stp_01', timestamp: '2026-01-01T00:00:00Z' }],
      steps_skipped: [{ step_id: 'stp_02', timestamp: '2026-01-01T00:00:00Z', reason: 'n/a' }],
      checklist_items: [{ item_id: 'itm_01', checked: true, timestamp: '2026-01-01T00:00:00Z' }],
      decision_branches: [
        {
          decision_id: 'blk_dec',
          branch_id: 'brn_no',
          linked_protocol_launched: false,
          timestamp: '2026-01-01T00:00:00Z',
        },
      ],
    }
    const state = getCheckedStateFromModifications(mods)
    expect(state['stp_01']).toBe(true)
    expect(state['stp_02:skipped']).toBe(true)
    expect(state['itm_01']).toBe(true)
    expect(state['brn_no']).toBe(true)
    expect(state['stp_02']).toBeUndefined()
  })
})
