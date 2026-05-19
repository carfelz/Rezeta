import { z } from 'zod'

/**
 * Cross-device user preferences synced via the API.
 * Persisted as a JSONB blob on `User.preferences`.
 */
export const UserPreferencesSchema = z.object({
  consultationViewMode: z.enum(['soap', 'canvas']).optional(),
  primaryLocationId: z.string().uuid().optional(),
})

export const UpdateUserPreferencesSchema = UserPreferencesSchema

export type UserPreferences = z.infer<typeof UserPreferencesSchema>
export type UpdateUserPreferencesDto = z.infer<typeof UpdateUserPreferencesSchema>

export const DEFAULT_USER_PREFERENCES: UserPreferences = {}
