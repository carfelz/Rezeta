import { z } from 'zod'

export const ClientErrorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10000).optional(),
  url: z.string().max(500).optional(),
  context: z.string().max(200).optional(),
  severity: z.enum(['error', 'warn']).optional(),
})

export type ClientErrorDto = z.infer<typeof ClientErrorSchema>
