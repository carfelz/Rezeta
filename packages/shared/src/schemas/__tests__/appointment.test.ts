import { describe, it, expect } from 'vitest'
import {
  AppointmentStatusSchema,
  UpdateAppointmentStatusSchema,
  AppointmentListQuerySchema,
} from '../appointment.js'
import { ErrorCode } from '../../errors.js'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('AppointmentListQuerySchema', () => {
  it('accepts uuid filters, a status, and parseable from/to dates', () => {
    const result = AppointmentListQuerySchema.safeParse({
      locationId: UUID,
      patientId: UUID,
      from: '2026-07-01',
      to: '2026-07-31T23:59:59Z',
      status: 'scheduled',
    })
    expect(result.success).toBe(true)
  })

  it('accepts an empty query (every filter is optional)', () => {
    expect(AppointmentListQuerySchema.safeParse({}).success).toBe(true)
  })

  it('rejects an unparseable from date', () => {
    expect(AppointmentListQuerySchema.safeParse({ from: 'not-a-date' }).success).toBe(false)
  })

  it('rejects an unparseable to date', () => {
    expect(AppointmentListQuerySchema.safeParse({ to: 'garbage' }).success).toBe(false)
  })

  it('rejects a non-uuid locationId', () => {
    expect(AppointmentListQuerySchema.safeParse({ locationId: 'abc' }).success).toBe(false)
  })
})

describe('AppointmentStatusSchema', () => {
  it('accepts in_progress', () => {
    expect(AppointmentStatusSchema.safeParse('in_progress').success).toBe(true)
  })

  it('accepts all lifecycle statuses', () => {
    for (const s of ['scheduled', 'in_progress', 'completed', 'cancelled', 'no_show']) {
      expect(AppointmentStatusSchema.safeParse(s).success).toBe(true)
    }
  })

  it('rejects unknown statuses', () => {
    expect(AppointmentStatusSchema.safeParse('done').success).toBe(false)
  })

  it('UpdateAppointmentStatusSchema accepts in_progress', () => {
    expect(UpdateAppointmentStatusSchema.safeParse({ status: 'in_progress' }).success).toBe(true)
  })
})

describe('appointment workflow error codes', () => {
  it('defines the workflow guard codes', () => {
    expect(ErrorCode.APPOINTMENT_NOT_STARTABLE).toBe('APPOINTMENT_NOT_STARTABLE')
    expect(ErrorCode.APPOINTMENT_HAS_CONSULTATION).toBe('APPOINTMENT_HAS_CONSULTATION')
    expect(ErrorCode.APPOINTMENT_HAS_OPEN_CONSULTATION).toBe('APPOINTMENT_HAS_OPEN_CONSULTATION')
  })
})
