import { create } from 'zustand'
import type { AuthUser, UserPreferences } from '@rezeta/shared'
import type { AuthSession } from '@/lib/auth'
import { authClient } from '@/lib/auth'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type SignupProfile = { fullName: string; specialty?: string }

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
  /**
   * Profile captured by `signUp`, consumed once by `AuthProvider` so the single
   * provision call (fired by the `onAuthStateChanged` that `signUp` triggers)
   * creates the user WITH the profile — no separate provision write.
   */
  _pendingProfile: SignupProfile | null
  _consumePendingProfile: () => SignupProfile | null

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

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  status: 'loading',
  _pendingProfile: null,

  _setUser: (user) => set({ user }),
  _setSession: (session) => set({ session }),
  _setStatus: (status) => set({ status }),

  _consumePendingProfile: () => {
    const pending = get()._pendingProfile
    if (pending) set({ _pendingProfile: null })
    return pending
  },

  signUp: async (email, password, profile) => {
    // Capture the profile for AuthProvider's provision instead of posting it
    // here. authClient.signUp triggers onAuthStateChanged, which provisions the
    // new user; a second provision write from this action is then redundant.
    set({ _pendingProfile: profile ?? null })
    try {
      await authClient.signUp(email, password)
    } catch (err) {
      set({ _pendingProfile: null })
      throw err
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
