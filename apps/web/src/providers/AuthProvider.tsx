import { useEffect, type ReactNode } from 'react'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

const STUB_AUTH = import.meta.env['VITE_STUB_AUTH'] === 'true'

// Dev stub — used only when VITE_STUB_AUTH=true (no Firebase at all)
const STUB_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000002',
  tenantId: '00000000-0000-0000-0000-000000000001',
  firebaseUid: 'dev-firebase-uid',
  email: 'demo@rezeta.app',
  fullName: 'Dr. Juan García',
  role: 'owner',
  specialty: 'Cardiología',
  licenseNumber: 'CMP-12345',
}

/**
 * AuthProvider — listens to Firebase onAuthStateChanged.
 *
 * When a Firebase user appears:
 *   1. Call POST /v1/auth/provision to ensure the user exists in our DB.
 *   2. Store the returned Postgres profile in Zustand (status: 'authenticated').
 *
 * When no Firebase user:
 *   → Set status: 'unauthenticated', clear user.
 *
 * On provision failure:
 *   → Sign out from Firebase, set status: 'unauthenticated'.
 */
export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { _setUser, _setFirebaseUser, _setStatus } = useAuthStore()

  useEffect(() => {
    if (STUB_AUTH) {
      _setUser(STUB_USER)
      _setFirebaseUser(null)
      _setStatus('authenticated')
      return
    }

    let unsubscribe: (() => void) | undefined

    async function initFirebaseAuth() {
      const { onAuthStateChanged, signOut: fbSignOut } = await import('firebase/auth')
      const { auth } = await import('@/lib/firebase')
      const { apiClient } = await import('@/lib/api-client')

      if (!auth) {
        _setUser(null)
        _setFirebaseUser(null)
        _setStatus('unauthenticated')
        return
      }

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        void (async () => {
          if (!firebaseUser) {
            _setUser(null)
            _setFirebaseUser(null)
            _setStatus('unauthenticated')
            return
          }

          _setFirebaseUser(firebaseUser)
          _setStatus('loading')

          try {
            // POST /v1/auth/provision is idempotent — safe to call on every login
            const user = await apiClient.post<AuthUser>('/v1/auth/provision', {})
            _setUser(user)
            _setStatus('authenticated')
          } catch (err) {
            console.error('[AuthProvider] Provision failed:', err)
            // Sign out to leave a clean state — no half-authenticated session
            await fbSignOut(auth)
            _setUser(null)
            _setFirebaseUser(null)
            _setStatus('unauthenticated')
          }
        })()
      })
    }

    void initFirebaseAuth()
    return () => unsubscribe?.()
  }, [_setUser, _setFirebaseUser, _setStatus])

  return <>{children}</>
}
