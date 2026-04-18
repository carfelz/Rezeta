import { z } from 'zod'

export const PrescriptionItemSchema = z.object({
  drug: z.string().min(1).max(200),
  dose: z.string().min(1).max(200),
  route: z.string().min(1).max(100),
  frequency: z.string().min(1).max(200),
  duration: z.string().max(100).nullable().optional(),
  instructions: z.string().max(500).nullable().optional(),
})

export const CreatePrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  consultationId: z.string().uuid().nullable().optional(),
  items: z.array(PrescriptionItemSchema).min(1),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdatePrescriptionSchema = CreatePrescriptionSchema.partial()

export type CreatePrescriptionDto = z.infer<typeof CreatePrescriptionSchema>
export type UpdatePrescriptionDto = z.infer<typeof UpdatePrescriptionSchema>
