import { create } from 'zustand'
import type { AuthUser, UserPreferences } from '@rezeta/shared'
import type { AuthSession } from '@/lib/auth'
import { authClient } from '@/lib/auth'
import type { Identity } from '@/lib/auth-routing'

interface AuthState {
  /** Our Postgres user profile */
  user: AuthUser | null
  /** Provider-opaque session (was firebaseUser) */
  session: AuthSession | null
  /** What kind of identity is signed in, resolved by AuthProvider */
  identity: Identity

  // ── Internal setters (used by AuthProvider) ────────────────────────────────
  _setUser: (user: AuthUser | null) => void
  _setSession: (session: AuthSession | null) => void
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
  identity: { kind: 'loading' },

  _setUser: (user) => set({ user }),
  _setSession: (session) => set({ session }),
  _setIdentity: (identity) => set({ identity }),

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
