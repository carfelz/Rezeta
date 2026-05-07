import { useEffect, type ReactNode } from 'react'
import { authClient } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { _setUser, _setSession, _setStatus } = useAuthStore()

  useEffect(() => {
    const unsubscribe = authClient.onAuthStateChanged((session) => {
      void (async () => {
        if (!session) {
          _setUser(null)
          _setSession(null)
          _setStatus('unauthenticated')
          return
        }

        _setSession(session)
        _setStatus('loading')

        try {
          const { apiClient } = await import('@/lib/api-client')
          const user = await apiClient.post<AuthUser>('/v1/auth/provision', {})
          _setUser(user)
          _setStatus('authenticated')
        } catch (err) {
          console.error('[AuthProvider] Provision failed:', err)
          await authClient.signOut()
          _setUser(null)
          _setSession(null)
          _setStatus('unauthenticated')
        }
      })()
    })

    return unsubscribe
  }, [_setUser, _setSession, _setStatus])

  return <>{children}</>
}
