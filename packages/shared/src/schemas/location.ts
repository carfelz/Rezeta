import { z } from 'zod'

export const CreateLocationSchema = z.object({
  name: z.string().min(2).max(200),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  commissionPercent: z.number().min(0).max(100).default(0),
})

export const UpdateLocationSchema = CreateLocationSchema.partial()

export type CreateLocationDto = z.infer<typeof CreateLocationSchema>
export type UpdateLocationDto = z.infer<typeof UpdateLocationSchema>
