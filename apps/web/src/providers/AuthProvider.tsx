import { useEffect, type ReactNode } from 'react'
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { _setUser, _setFirebaseUser, _setStatus } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
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
          const { apiClient } = await import('@/lib/api-client')
          const user = await apiClient.post<AuthUser>('/v1/auth/provision', {})
          _setUser(user)
          _setStatus('authenticated')
        } catch (err) {
          console.error('[AuthProvider] Provision failed:', err)
          await fbSignOut(auth)
          _setUser(null)
          _setFirebaseUser(null)
          _setStatus('unauthenticated')
        }
      })()
    })

    return unsubscribe
  }, [_setUser, _setFirebaseUser, _setStatus])

  return <>{children}</>
}
