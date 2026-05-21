import { create } from 'zustand'
import type { AuthUser, UserPreferences } from '@rezeta/shared'
import type { AuthSession } from '@/lib/auth'
import { authClient } from '@/lib/auth'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  /** Our Postgres user profile */
  user: AuthUser | null
  /** Provider-opaque session (was firebaseUser) */
  session: AuthSession | null
  /** Auth pipeline status */
  status: AuthStatus

  // ── Internal setters (used by AuthProvider) ────────────────────────────────
  _setUser: (user: AuthUser | null) => void
  _setSession: (session: AuthSession | null) => void
  _setStatus: (status: AuthStatus) => void

  // ── Public actions ─────────────────────────────────────────────────────────
  signUp: (
    email: string,
    password: string,
    profile?: { fullName: string; specialty?: string },
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
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

  _setUser: (user) => set({ user }),
  _setSession: (session) => set({ session }),
  _setStatus: (status) => set({ status }),

  signUp: async (email, password, profile) => {
    await authClient.signUp(email, password)
    if (profile) {
      const { apiClient } = await import('@/lib/api-client')
      await apiClient.post<AuthUser>('/v1/auth/provision', {
        fullName: profile.fullName,
        ...(profile.specialty ? { specialty: profile.specialty } : {}),
      })
    }
  },

  signIn: async (email, password) => {
    await authClient.signIn(email, password)
  },

  signOut: async () => {
    await authClient.signOut()
  },

  setPreferences: (preferences) =>
    set((state) => (state.user ? { user: { ...state.user, preferences } } : {})),

  setUser: (user) => set({ user }),
}))
