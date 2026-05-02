import { describe, it, expect } from 'vitest'
import {
  CreateScheduleBlockSchema,
  UpdateScheduleBlockSchema,
  CreateScheduleExceptionSchema,
  UpdateScheduleExceptionSchema,
} from '../../src/schemas/schedule.js'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'

describe('CreateScheduleBlockSchema', () => {
  const valid = {
    locationId: VALID_UUID,
    dayOfWeek: 1,
    startTime: '08:00:00',
    endTime: '12:00:00',
  }

  it('accepts valid minimal payload with default slotDurationMin', () => {
    const result = CreateScheduleBlockSchema.parse(valid)
    expect(result.locationId).toBe(VALID_UUID)
    expect(result.dayOfWeek).toBe(1)
    expect(result.startTime).toBe('08:00:00')
    expect(result.endTime).toBe('12:00:00')
    expect(result.slotDurationMin).toBe(30)
  })

  it('accepts dayOfWeek 0 (Sunday)', () => {
    const result = CreateScheduleBlockSchema.parse({ ...valid, dayOfWeek: 0 })
    expect(result.dayOfWeek).toBe(0)
  })

  it('accepts dayOfWeek 6 (Saturday)', () => {
    const result = CreateScheduleBlockSchema.parse({ ...valid, dayOfWeek: 6 })
    expect(result.dayOfWeek).toBe(6)
  })

  it('accepts explicit slotDurationMin', () => {
    const result = CreateScheduleBlockSchema.parse({ ...valid, slotDurationMin: 60 })
    expect(result.slotDurationMin).toBe(60)
  })

  it('rejects dayOfWeek below 0', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, dayOfWeek: -1 })).toThrow()
  })

  it('rejects dayOfWeek above 6', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, dayOfWeek: 7 })).toThrow()
  })

  it('rejects non-integer dayOfWeek', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, dayOfWeek: 1.5 })).toThrow()
  })

  it('rejects invalid startTime format', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, startTime: '8:00' })).toThrow()
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, startTime: '08:00' })).toThrow()
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, startTime: '8am' })).toThrow()
  })

  it('rejects invalid endTime format', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, endTime: '12:00' })).toThrow()
  })

  it('rejects slotDurationMin below 15', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, slotDurationMin: 14 })).toThrow()
  })

  it('rejects slotDurationMin above 120', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, slotDurationMin: 121 })).toThrow()
  })

  it('rejects non-uuid locationId', () => {
    expect(() => CreateScheduleBlockSchema.parse({ ...valid, locationId: 'not-a-uuid' })).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => CreateScheduleBlockSchema.parse({})).toThrow()
    const { locationId: _, ...noLocation } = valid
    expect(() => CreateScheduleBlockSchema.parse(noLocation)).toThrow()
  })
})

describe('UpdateScheduleBlockSchema', () => {
  it('accepts empty object (all partial)', () => {
    const result = UpdateScheduleBlockSchema.parse({})
    expect(result).toEqual({})
  })

  it('accepts partial update with just dayOfWeek', () => {
    const result = UpdateScheduleBlockSchema.parse({ dayOfWeek: 3 })
    expect(result.dayOfWeek).toBe(3)
  })

  it('accepts partial update with just times', () => {
    const result = UpdateScheduleBlockSchema.parse({ startTime: '09:00:00', endTime: '13:00:00' })
    expect(result.startTime).toBe('09:00:00')
    expect(result.endTime).toBe('13:00:00')
  })
})

describe('CreateScheduleExceptionSchema', () => {
  const valid = {
    locationId: VALID_UUID,
    date: '2026-06-15',
    type: 'blocked' as const,
  }

  it('accepts valid minimal payload', () => {
    const result = CreateScheduleExceptionSchema.parse(valid)
    expect(result.locationId).toBe(VALID_UUID)
    expect(result.date).toBe('2026-06-15')
    expect(result.type).toBe('blocked')
    expect(result.startTime).toBeUndefined()
    expect(result.endTime).toBeUndefined()
    expect(result.reason).toBeUndefined()
  })

  it('accepts type available', () => {
    const result = CreateScheduleExceptionSchema.parse({ ...valid, type: 'available' })
    expect(result.type).toBe('available')
  })

  it('accepts optional time range', () => {
    const result = CreateScheduleExceptionSchema.parse({
      ...valid,
      startTime: '09:00:00',
      endTime: '11:00:00',
    })
    expect(result.startTime).toBe('09:00:00')
    expect(result.endTime).toBe('11:00:00')
  })

  it('accepts null startTime and endTime', () => {
    const result = CreateScheduleExceptionSchema.parse({
      ...valid,
      startTime: null,
      endTime: null,
    })
    expect(result.startTime).toBeNull()
    expect(result.endTime).toBeNull()
  })

  it('accepts optional reason', () => {
    const result = CreateScheduleExceptionSchema.parse({ ...valid, reason: 'Día festivo' })
    expect(result.reason).toBe('Día festivo')
  })

  it('rejects invalid date format', () => {
    expect(() => CreateScheduleExceptionSchema.parse({ ...valid, date: '15/06/2026' })).toThrow()
    expect(() => CreateScheduleExceptionSchema.parse({ ...valid, date: '2026-6-15' })).toThrow()
  })

  it('rejects invalid type', () => {
    expect(() => CreateScheduleExceptionSchema.parse({ ...valid, type: 'cancelled' })).toThrow()
  })

  it('rejects reason exceeding 500 chars', () => {
    expect(() =>
      CreateScheduleExceptionSchema.parse({ ...valid, reason: 'x'.repeat(501) }),
    ).toThrow()
  })

  it('rejects invalid startTime format', () => {
    expect(() =>
      CreateScheduleExceptionSchema.parse({ ...valid, startTime: '9:00', endTime: '11:00:00' }),
    ).toThrow()
  })

  it('rejects missing required fields', () => {
    const { date: _, ...noDate } = valid
    expect(() => CreateScheduleExceptionSchema.parse(noDate)).toThrow()
  })
})

describe('UpdateScheduleExceptionSchema', () => {
  it('accepts empty object (all partial)', () => {
    const result = UpdateScheduleExceptionSchema.parse({})
    expect(result).toEqual({})
  })

  it('accepts partial update with just type', () => {
    const result = UpdateScheduleExceptionSchema.parse({ type: 'available' })
    expect(result.type).toBe('available')
  })

  it('accepts partial update with just reason', () => {
    const result = UpdateScheduleExceptionSchema.parse({ reason: 'Reunión médica' })
    expect(result.reason).toBe('Reunión médica')
  })
})
