import { create } from 'zustand'
import type { User as FirebaseUser } from 'firebase/auth'
import type { AuthUser } from '@rezeta/shared'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  /** Our Postgres user profile */
  user: AuthUser | null
  /** The Firebase SDK user object (for token access) */
  firebaseUser: FirebaseUser | null
  /** Auth pipeline status */
  status: AuthStatus

  // ── Internal setters (used by AuthProvider) ────────────────────────────────
  _setUser: (user: AuthUser | null) => void
  _setFirebaseUser: (firebaseUser: FirebaseUser | null) => void
  _setStatus: (status: AuthStatus) => void

  // ── Public actions ─────────────────────────────────────────────────────────
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  status: 'loading',

  _setUser: (user) => set({ user }),
  _setFirebaseUser: (firebaseUser) => set({ firebaseUser }),
  _setStatus: (status) => set({ status }),

  signUp: async (email, password) => {
    const { createUserWithEmailAndPassword } = await import('firebase/auth')
    const { auth } = await import('@/lib/firebase')
    // onAuthStateChanged in AuthProvider handles provision + state update
    await createUserWithEmailAndPassword(auth, email, password)
  },

  signIn: async (email, password) => {
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const { auth } = await import('@/lib/firebase')
    // Let FirebaseError propagate with its .code intact (Login.tsx reads it)
    await signInWithEmailAndPassword(auth, email, password)
  },

  signOut: async () => {
    const { signOut } = await import('firebase/auth')
    const { auth } = await import('@/lib/firebase')
    await signOut(auth)
    // onAuthStateChanged fires with null → state updated by AuthProvider
  },
}))
