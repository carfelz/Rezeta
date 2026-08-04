import { useEffect, type ReactNode } from 'react'
import { authClient } from '@/lib/auth'
import { useAuthStore } from '@/store/auth.store'
import { logger } from '@/lib/logger'
import { ErrorCode } from '@rezeta/shared'
import type { AuthUser, PlatformPrincipal } from '@rezeta/shared'

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const { _setUser, _setSession, _setIdentity } = useAuthStore()

  useEffect(() => {
    // Each firing of onAuthStateChanged starts an independent async chain
    // (dynamic import, then one or two network round-trips). Without a
    // sequence guard, a slower-resolving earlier firing (e.g. a staff
    // session's GET /v1/staff/me probe) can complete after a faster later
    // firing (e.g. a doctor signing in right after) and overwrite its
    // identity with stale data — or, worse, sign the *newer* session out
    // from under it. `seq` is scoped to this effect instance, so it is
    // shared across every firing of this one subscription and reset cleanly
    // on remount; no module-level state to leak between tests or component
    // instances.
    //
    // Guards are placed after every `await` (the only points where a newer
    // firing can have superseded this one) — not before, since nothing can
    // preempt the synchronous code between `mine = ++seq` and the next
    // `await` in a single-threaded runtime, which would make such a guard
    // permanently untestable dead code.
    let seq = 0

    const unsubscribe = authClient.onAuthStateChanged((session) => {
      const mine = ++seq
      const isStale = (): boolean => mine !== seq

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
          if (isStale()) return
          _setUser(user)
          _setIdentity({ kind: 'clinic', user })
        } catch (err) {
          // A newer firing already superseded this one while the provision
          // request was in flight — bail before touching the store, and
          // critically before calling authClient.signOut() below, which
          // would otherwise sign the *newer*, currently-valid session out.
          if (isStale()) return

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
            if (isStale()) return
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
            if (isStale()) return
            _setIdentity({ kind: 'staff', principal })
          } catch {
            // Live session, neither an institution user nor a platform
            // principal. `session` stays set — that is what lets
            // RequirePlatform tell "signed in but not provisioned" apart
            // from "nobody signed in"; the two need different outcomes (an
            // explanation vs. a redirect to /login).
            if (isStale()) return
            _setIdentity({ kind: 'unprovisioned' })
          }
        }
      })()
    })

    return unsubscribe
  }, [_setUser, _setSession, _setIdentity])

  return <>{children}</>
}
