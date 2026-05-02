import { z } from 'zod'

const timeRegex = /^\d{2}:\d{2}:\d{2}$/
const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const CreateScheduleBlockSchema = z.object({
  locationId: z.string().uuid(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(timeRegex, 'Must be HH:MM:SS'),
  endTime: z.string().regex(timeRegex, 'Must be HH:MM:SS'),
  slotDurationMin: z.number().int().min(15).max(120).default(30),
})

export const UpdateScheduleBlockSchema = CreateScheduleBlockSchema.partial()

export const CreateScheduleExceptionSchema = z.object({
  locationId: z.string().uuid(),
  date: z.string().regex(dateRegex, 'Must be YYYY-MM-DD'),
  type: z.enum(['blocked', 'available']),
  startTime: z.string().regex(timeRegex, 'Must be HH:MM:SS').optional().nullable(),
  endTime: z.string().regex(timeRegex, 'Must be HH:MM:SS').optional().nullable(),
  reason: z.string().max(500).optional().nullable(),
})

export const UpdateScheduleExceptionSchema = CreateScheduleExceptionSchema.partial()

export type CreateScheduleBlockDto = z.infer<typeof CreateScheduleBlockSchema>
export type UpdateScheduleBlockDto = z.infer<typeof UpdateScheduleBlockSchema>
export type CreateScheduleExceptionDto = z.infer<typeof CreateScheduleExceptionSchema>
export type UpdateScheduleExceptionDto = z.infer<typeof UpdateScheduleExceptionSchema>
