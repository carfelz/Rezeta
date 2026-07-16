import type { AuthUser, UserRole } from '@rezeta/shared'
import { defaultCapabilitiesFor } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'

/**
 * Build a fully-populated fake AuthUser for tests. Capabilities default to the
 * catalog defaults for the role; pass `overrides.capabilities` to diverge.
 */
export function makeAuthUser(role: UserRole, overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    externalUid: 'fb-uid',
    tenantId: 'tenant-1',
    email: `${role}@rezeta.app`,
    fullName: 'Test User',
    role,
    specialty: null,
    licenseNumber: null,
    tenantSeededAt: '2026-01-01T00:00:00Z',
    preferences: {},
    capabilities: defaultCapabilitiesFor(role),
    ...overrides,
  }
}

/** Seed (or clear) the auth store with a fake user and its derived status. */
export function seedAuthUser(user: AuthUser | null): void {
  useAuthStore.setState({ user, status: user ? 'authenticated' : 'unauthenticated' })
}
