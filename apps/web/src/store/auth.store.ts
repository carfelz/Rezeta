import { create } from 'zustand'
import type { AuthUser, UserPreferences } from '@rezeta/shared'
import type { AuthSession } from '@/lib/auth'
import { authClient } from '@/lib/auth'
import type { Identity } from '@/lib/auth-routing'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

/**
 * Derives the legacy `status` field from `identity`. Only `clinic` counts as
 * authenticated — `staff` and `unprovisioned` both hold a live provider
 * session but have no institution `User` row, so gates that have not yet
 * been converted to read `identity` directly must keep seeing them as
 * unauthenticated. This shim is removed once no consumer reads `status`
 * (see Task 6 of the auth-identity-resolution refactor).
 */
function statusFromIdentity(identity: Identity): AuthStatus {
  switch (identity.kind) {
    case 'clinic':
      return 'authenticated'
    case 'loading':
      return 'loading'
    case 'anonymous':
    case 'staff':
    case 'unprovisioned':
      return 'unauthenticated'
  }
}

interface AuthState {
  /** Our Postgres user profile */
  user: AuthUser | null
  /** Provider-opaque session (was firebaseUser) */
  session: AuthSession | null
  /** Auth pipeline status — derived shim, see statusFromIdentity */
  status: AuthStatus
  /** What kind of identity is signed in, resolved by AuthProvider */
  identity: Identity

  // ── Internal setters (used by AuthProvider) ────────────────────────────────
  _setUser: (user: AuthUser | null) => void
  _setSession: (session: AuthSession | null) => void
  _setStatus: (status: AuthStatus) => void
  /** Sets `identity` and re-derives the `status` shim from it in one update. */
  _setIdentity: (identity: Identity) => void

  // ── Public actions ─────────────────────────────────────────────────────────
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithSso: (providerId: string) => Promise<void>
  signOut: () => Promise<void>
  /** Replace the cached preferences object on the in-memory user. */
  setPreferences: (preferences: UserPreferences) => void
  /** Replace the full cached user (e.g. after profile update). */
  setUser: (user: AuthUser) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  status: 'loading',
  identity: { kind: 'loading' },

  _setUser: (user) => set({ user }),
  _setSession: (session) => set({ session }),
  _setStatus: (status) => set({ status }),
  _setIdentity: (identity) => set({ identity, status: statusFromIdentity(identity) }),

  signIn: async (email, password) => {
    await authClient.signIn(email, password)
  },

  signInWithGoogle: async () => {
    await authClient.signInWithGoogle()
  },

  signInWithSso: async (providerId) => {
    await authClient.signInWithSso(providerId)
  },

  signOut: async () => {
    await authClient.signOut()
  },

  setPreferences: (preferences) =>
    set((state) => (state.user ? { user: { ...state.user, preferences } } : {})),

  setUser: (user) => set({ user }),
}))
