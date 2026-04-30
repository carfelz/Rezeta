import { describe, it, expect } from 'vitest'
import {
  AppointmentStatusSchema,
  CreateAppointmentSchema,
  UpdateAppointmentSchema,
  UpdateAppointmentStatusSchema,
} from '../../src/schemas/appointment.js'

const VALID_UUID = '00000000-0000-0000-0000-000000000001'
const VALID_DATETIME = '2026-05-01T09:00:00.000Z'
const VALID_DATETIME_END = '2026-05-01T10:00:00.000Z'

describe('AppointmentStatusSchema', () => {
  it('accepts valid statuses', () => {
    const statuses = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
    for (const s of statuses) {
      expect(AppointmentStatusSchema.parse(s)).toBe(s)
    }
  })

  it('rejects invalid status', () => {
    expect(() => AppointmentStatusSchema.parse('pending')).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => AppointmentStatusSchema.parse('')).toThrow()
  })
})

describe('CreateAppointmentSchema', () => {
  const valid = {
    patientId: VALID_UUID,
    locationId: VALID_UUID,
    startsAt: VALID_DATETIME,
    endsAt: VALID_DATETIME_END,
  }

  it('accepts a valid minimal payload', () => {
    const result = CreateAppointmentSchema.parse(valid)
    expect(result.patientId).toBe(VALID_UUID)
    expect(result.locationId).toBe(VALID_UUID)
  })

  it('accepts optional reason and notes', () => {
    const result = CreateAppointmentSchema.parse({
      ...valid,
      reason: 'Follow-up visit',
      notes: 'Bring previous labs',
    })
    expect(result.reason).toBe('Follow-up visit')
    expect(result.notes).toBe('Bring previous labs')
  })

  it('accepts null for optional fields', () => {
    const result = CreateAppointmentSchema.parse({ ...valid, reason: null, notes: null })
    expect(result.reason).toBeNull()
    expect(result.notes).toBeNull()
  })

  it('rejects missing patientId', () => {
    const { patientId: _, ...rest } = valid
    expect(() => CreateAppointmentSchema.parse(rest)).toThrow()
  })

  it('rejects missing locationId', () => {
    const { locationId: _, ...rest } = valid
    expect(() => CreateAppointmentSchema.parse(rest)).toThrow()
  })

  it('rejects non-uuid patientId', () => {
    expect(() => CreateAppointmentSchema.parse({ ...valid, patientId: 'not-a-uuid' })).toThrow()
  })

  it('rejects non-datetime startsAt', () => {
    expect(() => CreateAppointmentSchema.parse({ ...valid, startsAt: '2026-05-01' })).toThrow()
  })

  it('rejects reason exceeding 500 chars', () => {
    expect(() =>
      CreateAppointmentSchema.parse({ ...valid, reason: 'x'.repeat(501) }),
    ).toThrow()
  })

  it('rejects notes exceeding 2000 chars', () => {
    expect(() =>
      CreateAppointmentSchema.parse({ ...valid, notes: 'x'.repeat(2001) }),
    ).toThrow()
  })
})

describe('UpdateAppointmentSchema', () => {
  it('accepts empty object (all partial)', () => {
    const result = UpdateAppointmentSchema.parse({})
    expect(result).toEqual({})
  })

  it('accepts partial update with just startsAt', () => {
    const result = UpdateAppointmentSchema.parse({ startsAt: VALID_DATETIME })
    expect(result.startsAt).toBe(VALID_DATETIME)
  })
})

describe('UpdateAppointmentStatusSchema', () => {
  it('accepts valid status', () => {
    expect(UpdateAppointmentStatusSchema.parse({ status: 'completed' }).status).toBe('completed')
  })

  it('rejects missing status', () => {
    expect(() => UpdateAppointmentStatusSchema.parse({})).toThrow()
  })

  it('rejects invalid status string', () => {
    expect(() => UpdateAppointmentStatusSchema.parse({ status: 'unknown' })).toThrow()
  })
})
