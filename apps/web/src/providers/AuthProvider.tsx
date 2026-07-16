import { useEffect, type ReactNode } from 'react'
import { authClient } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
import { ErrorCode } from '@rezeta/shared'
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

        const { apiClient, ApiRequestError } = await import('@/lib/api-client')
        try {
          const user = await apiClient.post<AuthUser>('/v1/auth/provision', {})
          _setUser(user)
          _setStatus('authenticated')
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err))
          logger.error(error.message, { stack: error.stack, context: 'AuthProvider.provision' })

          // USER_NOT_PROVISIONED covers two distinct identities: an institution
          // account that hasn't been created yet, and a platform-staff
          // (PlatformUser) Firebase identity, which by design never gets an
          // institution User row. Signing the Firebase session out here would
          // kill it before the staff console (RequirePlatform / useStaffMe,
          // gated on GET /v1/staff/me) gets a chance to verify it
          // independently — so the Firebase session is left intact in that
          // case; only the institution-side auth state is cleared.
          const isUnprovisionedIdentity =
            err instanceof ApiRequestError && err.error.code === ErrorCode.USER_NOT_PROVISIONED
          if (!isUnprovisionedIdentity) {
            await authClient.signOut()
          }
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
