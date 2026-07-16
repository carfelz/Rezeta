import type { UserRole } from '../types/auth.js'

/**
 * Privilege rank for each institution role. Higher number means more privilege.
 * A user may only act on roles strictly below their own rank (see canManageRole).
 */
export const ROLE_RANK: Record<UserRole, number> = {
  assistant: 1,
  doctor: 2,
  admin: 3,
  super_admin: 4,
}

/**
 * Returns true when actorRole may manage targetRole — i.e. the target's rank is
 * strictly below the actor's. A user can never manage their own rank or a higher
 * one. Enforced in the service layer, not only the UI.
 */
export function canManageRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_RANK[targetRole] < ROLE_RANK[actorRole]
}
