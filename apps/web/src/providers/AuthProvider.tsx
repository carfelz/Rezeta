import { useEffect, type ReactNode } from 'react'
import { authClient } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
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
          // Include the signup profile (if this state change came from signUp),
          // so provisioning creates the user with its name/specialty in one call.
          const profile = useAuthStore.getState()._consumePendingProfile()
          const body = profile
            ? { fullName: profile.fullName, ...(profile.specialty ? { specialty: profile.specialty } : {}) }
            : {}
          const user = await apiClient.post<AuthUser>('/v1/auth/provision', body)
          _setUser(user)
          _setStatus('authenticated')
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          logger.error(error.message, { stack: error.stack, context: 'AuthProvider.provision' })
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
