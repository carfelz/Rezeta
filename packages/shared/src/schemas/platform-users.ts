import { z } from 'zod'

/**
 * Control-plane staff roster DTOs (`/v1/staff/identity/users`). Mirrors the
 * institution shapes in user-management.ts, minus role/tenant — a PlatformUser
 * has neither. Validation messages are English: the staff console is
 * English-copy (see identity design §6a and apps/web/src/pages/staff/strings.ts).
 * Reuses `SetActiveSchema` from user-management.ts for the active toggle.
 */
export const CreatePlatformUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(200, 'Name cannot exceed 200 characters'),
})

export const PlatformUserApiSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  /** ISO timestamp of the first successful sign-in; null until they accept the invite. */
  lastLoginAt: z.string().nullable(),
  /** Derived roster status: 'invited' until first sign-in, then 'active'. */
  status: z.enum(['invited', 'active']),
})

export type CreatePlatformUserDto = z.infer<typeof CreatePlatformUserSchema>
export type PlatformUserApiDto = z.infer<typeof PlatformUserApiSchema>
