import { describe, it, expect } from 'vitest'
import { AppointmentStatusSchema, UpdateAppointmentStatusSchema } from '../appointment.js'
import { ErrorCode } from '../../errors.js'

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
