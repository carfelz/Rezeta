import { z } from 'zod'

export const VitalsSchema = z.object({
  bloodPressureSystolic: z.number().int().min(0).max(300).optional(),
  bloodPressureDiastolic: z.number().int().min(0).max(200).optional(),
  heartRate: z.number().int().min(0).max(300).optional(),
  respiratoryRate: z.number().int().min(0).max(100).optional(),
  temperatureCelsius: z.number().min(25).max(45).optional(),
  oxygenSaturation: z.number().min(0).max(100).optional(),
  weightKg: z.number().min(0).max(500).optional(),
  heightCm: z.number().min(0).max(300).optional(),
})

export const CreateConsultationSchema = z.object({
  patientId: z.string().uuid(),
  locationId: z.string().uuid(),
  appointmentId: z.string().uuid().nullable().optional(),
  chiefComplaint: z.string().max(500).nullable().optional(),
  subjective: z.string().max(5000).nullable().optional(),
  objective: z.string().max(5000).nullable().optional(),
  assessment: z.string().max(5000).nullable().optional(),
  plan: z.string().max(5000).nullable().optional(),
  vitals: VitalsSchema.nullable().optional(),
  diagnoses: z.array(z.string().max(200)).default([]),
})

export const UpdateConsultationSchema = CreateConsultationSchema.partial()

export const AmendConsultationSchema = z.object({
  reason: z.string().min(10).max(1000),
  chiefComplaint: z.string().max(500).optional(),
  subjective: z.string().max(5000).optional(),
  objective: z.string().max(5000).optional(),
  assessment: z.string().max(5000).optional(),
  plan: z.string().max(5000).optional(),
  vitals: VitalsSchema.optional(),
  diagnoses: z.array(z.string().max(200)).optional(),
})

export type CreateConsultationDto = z.infer<typeof CreateConsultationSchema>
export type UpdateConsultationDto = z.infer<typeof UpdateConsultationSchema>
export type AmendConsultationDto = z.infer<typeof AmendConsultationSchema>
