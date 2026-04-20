import { z } from 'zod'

// ── Form schemas (used by both frontend and backend) ─────────────────────────

export const SignUpSchema = z
  .object({
    email: z.string().email('Correo electrónico inválido'),
    password: z
      .string()
      .min(8, 'La contraseña debe tener al menos 8 caracteres')
      .max(128, 'La contraseña no puede superar 128 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
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
  firebaseUid: z.string(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['owner', 'doctor']),
  specialty: z.string().nullable(),
  licenseNumber: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type SignUpDto = z.infer<typeof SignUpSchema>
export type SignInDto = z.infer<typeof SignInSchema>
export type UserApiDto = z.infer<typeof UserApiSchema>
export type TenantApiDto = z.infer<typeof TenantApiSchema>
