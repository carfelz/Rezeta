import { describe, it, expect } from 'vitest'
import { CreatePrescriptionGroupSchema, UpdateProtocolUsageSchema } from '../consultation.js'

describe('UpdateProtocolUsageSchema modifications', () => {
  it('accepts a valid vitals_entered event', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        vitals_entered: [
          {
            block_id: 'blk1',
            values: { heart_rate: 72, blood_pressure: '120/80' },
            timestamp: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid notes_edited event', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        notes_edited: [
          { block_id: 'blk2', length: 42, timestamp: '2026-01-01T00:00:00.000Z' },
        ],
      },
    })
    expect(result.success).toBe(true)
  })

  it('tolerates extra keys on a vitals_entered event (legacy-row compat)', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        vitals_entered: [
          {
            block_id: 'blk1',
            values: { heart_rate: 72 },
            timestamp: '2026-01-01T00:00:00.000Z',
            legacy_field: 'kept',
          },
        ],
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.modifications?.vitals_entered?.[0]).toMatchObject({
        legacy_field: 'kept',
      })
    }
  })

  it('tolerates extra keys on a notes_edited event (legacy-row compat)', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        notes_edited: [
          {
            block_id: 'blk2',
            length: 10,
            timestamp: '2026-01-01T00:00:00.000Z',
            legacy_field: 'kept',
          },
        ],
      },
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.modifications?.notes_edited?.[0]).toMatchObject({
        legacy_field: 'kept',
      })
    }
  })

  it('rejects a vitals_entered event missing block_id', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        vitals_entered: [{ values: { heart_rate: 72 }, timestamp: '2026-01-01T00:00:00.000Z' }],
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a notes_edited event with a non-numeric length', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        notes_edited: [
          { block_id: 'blk2', length: 'a lot', timestamp: '2026-01-01T00:00:00.000Z' },
        ],
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a vitals_entered event with a non-datetime timestamp', () => {
    const result = UpdateProtocolUsageSchema.safeParse({
      modifications: {
        vitals_entered: [{ block_id: 'blk1', values: { heart_rate: 72 }, timestamp: 'not-a-date' }],
      },
    })
    expect(result.success).toBe(false)
  })
})

describe('CreatePrescriptionGroupSchema duration', () => {
  const baseItem = { drug: 'Enalapril', dose: '10 mg', route: 'VO', frequency: 'cada 12 h' }

  it('accepts an item with an empty duration (protocol dosage rows carry none)', () => {
    const result = CreatePrescriptionGroupSchema.safeParse({
      groupTitle: 'Receta',
      groupOrder: 1,
      items: [{ ...baseItem, duration: '', source: 'protocol:row_1' }],
    })
    expect(result.success).toBe(true)
  })

  it('accepts an item with duration omitted, defaulting to empty string', () => {
    const result = CreatePrescriptionGroupSchema.safeParse({ items: [baseItem] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.items[0]?.duration).toBe('')
  })

  it('still rejects an item with an empty drug', () => {
    const result = CreatePrescriptionGroupSchema.safeParse({
      items: [{ ...baseItem, drug: '', duration: '30 días' }],
    })
    expect(result.success).toBe(false)
  })
})
