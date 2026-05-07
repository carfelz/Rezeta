import { create } from 'zustand'
import type { AuthUser } from '@rezeta/shared'
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
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  status: 'loading',

  _setUser: (user) => set({ user }),
  _setSession: (session) => set({ session }),
  _setStatus: (status) => set({ status }),

  signUp: async (email, password) => {
    await authClient.signUp(email, password)
  },

  signIn: async (email, password) => {
    await authClient.signIn(email, password)
  },

  signOut: async () => {
    await authClient.signOut()
  },
}))
