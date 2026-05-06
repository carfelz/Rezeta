import { describe, it, expect } from 'vitest'
import type { ProtocolUsageStatus } from '../src/types/protocol'
import type {
  ProtocolUsageModifications,
  OffProtocolNoteEvent,
  ConditionalStepActivated,
} from '../src/types/consultation'

describe('ProtocolUsageStatus', () => {
  it('accepts all valid status values', () => {
    const statuses: ProtocolUsageStatus[] = ['in_progress', 'completed', 'abandoned', 'switched']
    expect(statuses).toHaveLength(4)
  })

  it('switched is a valid status', () => {
    const status: ProtocolUsageStatus = 'switched'
    expect(status).toBe('switched')
  })
})

describe('ProtocolUsageModifications new kinds', () => {
  it('accepts off_protocol_notes modification', () => {
    const note: OffProtocolNoteEvent = {
      timestamp: new Date().toISOString(),
      note: 'Observación adicional',
      promoted_to_soap_field: 'assessment',
    }

    const mods: ProtocolUsageModifications = {
      off_protocol_notes: [note],
    }

    expect(mods.off_protocol_notes).toHaveLength(1)
    expect(mods.off_protocol_notes?.[0].note).toBe('Observación adicional')
    expect(mods.off_protocol_notes?.[0].promoted_to_soap_field).toBe('assessment')
  })

  it('accepts conditional_steps_activated modification', () => {
    const step: ConditionalStepActivated = {
      block_id: 'blk_1',
      condition: 'BP > 180',
      branch_label: 'Sí',
      timestamp: new Date().toISOString(),
    }

    const mods: ProtocolUsageModifications = {
      conditional_steps_activated: [step],
    }

    expect(mods.conditional_steps_activated).toHaveLength(1)
    expect(mods.conditional_steps_activated?.[0].condition).toBe('BP > 180')
  })

  it('accepts off_protocol_notes without promoted_to_soap_field', () => {
    const note: OffProtocolNoteEvent = {
      timestamp: new Date().toISOString(),
      note: 'Nota sin campo SOAP',
    }

    const mods: ProtocolUsageModifications = {
      off_protocol_notes: [note],
    }

    expect(mods.off_protocol_notes?.[0].promoted_to_soap_field).toBeUndefined()
  })

  it('accepts all promoted_to_soap_field values', () => {
    const fields: OffProtocolNoteEvent['promoted_to_soap_field'][] = [
      'subjective',
      'objective',
      'assessment',
      'plan',
      undefined,
    ]
    fields.forEach((f) => {
      const note: OffProtocolNoteEvent = {
        timestamp: new Date().toISOString(),
        note: 'Test',
        promoted_to_soap_field: f,
      }
      expect(note.promoted_to_soap_field).toBe(f)
    })
  })
})
