import { z } from 'zod'

export const AppointmentStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
])

export const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdateAppointmentSchema = CreateAppointmentSchema.partial()

export const UpdateAppointmentStatusSchema = z.object({
  status: AppointmentStatusSchema,
})

// A string parseable as a date/datetime. The list endpoints forward these to
// `new Date(...)`; rejecting garbage here keeps malformed input from reaching
// Prisma (which would otherwise 500 on a bad date range).
const DateLikeString = z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
  message: 'Invalid date',
})

export const AppointmentListQuerySchema = z.object({
  locationId: z.string().uuid().optional(),
  patientId: z.string().uuid().optional(),
  from: DateLikeString.optional(),
  to: DateLikeString.optional(),
  status: AppointmentStatusSchema.optional(),
})

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>
export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>
export type AppointmentListQuery = z.infer<typeof AppointmentListQuerySchema>
