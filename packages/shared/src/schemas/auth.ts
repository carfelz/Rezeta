import { z } from 'zod'

// ── Form schemas (used by both frontend and backend) ─────────────────────────

export const SignUpSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(200, 'El nombre no puede superar 200 caracteres'),
    specialty: z.string().max(100, 'La especialidad no puede superar 100 caracteres').optional(),
    email: z.string().email('Correo electrónico inválido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(128, 'La contraseña no puede superar 128 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'La contraseña debe contener mayúsculas, minúsculas y números',
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

export const UpdateProfileSchema = z.object({
  fullName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede superar 200 caracteres'),
  specialty: z.string().max(100).nullable(),
  licenseNumber: z.string().max(100).nullable(),
})

export const SignInSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})

// ── API response schemas ──────────────────────────────────────────────────────

export const TenantApiSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  type: z.string(),
  plan: z.string(),
  country: z.string(),
  language: z.string(),
  timezone: z.string(),
  createdAt: z.string(),
})

export const UserApiSchema = z.object({
  id: z.string().uuid(),
  externalUid: z.string(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['assistant', 'doctor', 'admin', 'super_admin']),
  specialty: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type SignUpDto = z.infer<typeof SignUpSchema>
export type SignInDto = z.infer<typeof SignInSchema>
export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>
export type UserApiDto = z.infer<typeof UserApiSchema>
export type TenantApiDto = z.infer<typeof TenantApiSchema>
