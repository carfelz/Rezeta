import { z } from 'zod'

/**
 * The four institution roles (see permissions design §3). Kept in sync with the
 * `UserRole` union in ../types/auth.ts. Values are validated in Zod because the
 * DB column is a plain String (no Prisma enum).
 */
export const UserRoleSchema = z.enum(['assistant', 'doctor', 'admin', 'super_admin'])

export const CreateUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  fullName: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre no puede superar 200 caracteres'),
  role: UserRoleSchema,
})

export const ChangeRoleSchema = z.object({
  role: UserRoleSchema,
})

export const SetActiveSchema = z.object({
  isActive: z.boolean(),
})

// ── API response schema (a user listed in the institution roster) ─────────────
export const ManagedUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: UserRoleSchema,
  isActive: z.boolean(),
  createdAt: z.string(),
  /** ISO timestamp of the user's first successful sign-in; null until they accept the invite. */
  lastLoginAt: z.string().nullable(),
  /** Derived roster status: 'invited' until first sign-in, then 'active'. */
  status: z.enum(['invited', 'active']),
})

export type UserRoleValue = z.infer<typeof UserRoleSchema>
export type CreateUserDto = z.infer<typeof CreateUserSchema>
export type ChangeRoleDto = z.infer<typeof ChangeRoleSchema>
export type SetActiveDto = z.infer<typeof SetActiveSchema>
export type ManagedUserDto = z.infer<typeof ManagedUserSchema>
