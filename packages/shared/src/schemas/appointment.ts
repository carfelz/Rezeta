import { z } from 'zod'

export const AppointmentStatusSchema = z.enum(['scheduled', 'completed', 'cancelled', 'no_show'])

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

export type CreateAppointmentDto = z.infer<typeof CreateAppointmentSchema>
export type UpdateAppointmentDto = z.infer<typeof UpdateAppointmentSchema>
export type UpdateAppointmentStatusDto = z.infer<typeof UpdateAppointmentStatusSchema>
