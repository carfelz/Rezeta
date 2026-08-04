import { useEffect, type ReactNode } from 'react'
import { authClient } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
import { ErrorCode } from '@rezeta/shared'
import type { AuthUser, PlatformPrincipal } from '@rezeta/shared'

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { _setUser, _setSession, _setIdentity } = useAuthStore()

  useEffect(() => {
    const unsubscribe = authClient.onAuthStateChanged((session) => {
      void (async () => {
        if (!session) {
          _setUser(null)
          _setSession(null)
          _setIdentity({ kind: 'anonymous' })
          return
        }

        _setSession(session)
        _setIdentity({ kind: 'loading' })

        const { apiClient, ApiRequestError } = await import('@/lib/api-client')
        try {
          const user = await apiClient.post<AuthUser>('/v1/auth/provision', {})
          _setUser(user)
          _setIdentity({ kind: 'clinic', user })
        } catch (err) {
          // USER_NOT_PROVISIONED covers two distinct identities: an institution
          // account that hasn't been created yet, and a platform-staff
          // (PlatformUser) Firebase identity, which by design never gets an
          // institution User row — POST /v1/auth/provision always 401s
          // USER_NOT_PROVISIONED for one, permanently. That is expected, not
          // an error, so it must not be logged as one; the real "signed in
          // successfully" signal for staff is GET /v1/staff/me returning 200,
          // probed below.
          const isUnprovisionedIdentity =
            err instanceof ApiRequestError && err.error.code === ErrorCode.USER_NOT_PROVISIONED

          if (!isUnprovisionedIdentity) {
            const error = err instanceof Error ? err : new Error(String(err))
            logger.error(error.message, { stack: error.stack, context: 'AuthProvider.provision' })
            await authClient.signOut()
            _setSession(null)
            _setUser(null)
            _setIdentity({ kind: 'anonymous' })
            return
          }

          // Signing the Firebase session out here would kill it before the
          // staff console (RequirePlatform / useStaffMe) gets a chance to
          // verify it independently — so the session is left intact while we
          // probe it; only the institution-side user is cleared.
          _setUser(null)
          try {
            const principal = await apiClient.get<PlatformPrincipal>('/v1/staff/me', {
              skipSignOutOn401: true,
            })
            _setIdentity({ kind: 'staff', principal })
          } catch {
            // Live session, neither an institution user nor a platform
            // principal. `session` stays set — that is what lets
            // RequirePlatform tell "signed in but not provisioned" apart
            // from "nobody signed in"; the two need different outcomes (an
            // explanation vs. a redirect to /login).
            _setIdentity({ kind: 'unprovisioned' })
          }
        }
      })()
    })

    return unsubscribe
  }, [_setUser, _setSession, _setIdentity])

  return <>{children}</>
}
