import { z } from 'zod'

export const DocumentTypeSchema = z.enum(['cedula', 'passport', 'rnc'])
export const BloodTypeSchema = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
export const SexSchema = z.enum(['male', 'female', 'other'])

export const CreatePatientSchema = z.object({
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().date().nullable().optional(),
  sex: SexSchema.nullable().optional(),
  documentType: DocumentTypeSchema.nullable().optional(),
  documentNumber: z.string().max(30).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bloodType: BloodTypeSchema.nullable().optional(),
  allergies: z.array(z.string()).default([]),
  chronicConditions: z.array(z.string()).default([]),
  notes: z.string().max(2000).nullable().optional(),
})

export const UpdatePatientSchema = CreatePatientSchema.partial()

export type CreatePatientDto = z.infer<typeof CreatePatientSchema>
export type UpdatePatientDto = z.infer<typeof UpdatePatientSchema>
