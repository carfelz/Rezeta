import { z } from 'zod'

// Tenant `type` and `plan` value sets mirror the Prisma `Tenant` column comments
// (packages/db/prisma/schema.prisma): type = solo|practice|clinic|enterprise,
// plan = free|solo|practice|clinic.
export const CreateInstitutionSchema = z.object({
  institutionName: z
    .string()
    .min(2, 'Institution name must be at least 2 characters')
    .max(200, 'Institution name must be at most 200 characters'),
  type: z.enum(['solo', 'practice', 'clinic', 'enterprise']),
  plan: z.enum(['free', 'solo', 'practice', 'clinic']),
  adminFullName: z
    .string()
    .min(2, 'Admin name must be at least 2 characters')
    .max(200, 'Admin name must be at most 200 characters'),
  adminEmail: z.string().email('Invalid email address'),
})

export const InstitutionCreatedSchema = z.object({
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
})

export type CreateInstitutionDto = z.infer<typeof CreateInstitutionSchema>
export type InstitutionCreatedDto = z.infer<typeof InstitutionCreatedSchema>
