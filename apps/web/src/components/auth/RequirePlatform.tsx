import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStaffMe } from '@/hooks/staff/use-staff-me'
import { useAuthStore } from '@/store/auth.store'
import { authClient } from '@/lib/auth'
import { Card, Button } from '@/components/ui'
import { staffStrings } from '@/pages/staff/strings'

/**
 * Shown when a live session resolves to neither a platform principal nor an
 * institution user. Redirecting these identities is what produced the old
 * login loop: /dashboard sits behind AuthGate, which sees `unauthenticated`
 * for them and sends them back to /login, so the real cause (an unprovisioned
 * or deactivated PlatformUser) never surfaced.
 */
function NoStaffAccess(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-400 text-center">
        <h1 className="text-h3 mb-2">{staffStrings.noAccessTitle}</h1>
        <p className="text-body-sm text-n-600 mb-6">{staffStrings.noAccessBody}</p>
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-center"
          onClick={() => {
            void authClient.signOut()
          }}
        >
          {staffStrings.noAccessSignOut}
        </Button>
      </Card>
    </div>
  )
}

/**
 * Route gate for the staff console. Passes only when GET /v1/staff/me resolves a
 * platform principal. This is a UX gate — the backend AuthGuard/PlatformGuard on
 * @PlatformRoute() is the real authorization boundary.
 *
 * Deliberately does NOT gate on the institution `user` (AuthGate's mechanism):
 * a platform token always 401s on POST /v1/auth/provision (there is no
 * institution User row for a PlatformUser), so the institution auth store's
 * `status` settles to 'unauthenticated' for a legitimate platform principal too
 * — using it the way AuthGate does would redirect staff away before this gate
 * ever runs. The one thing borrowed from that store is `status === 'loading'`,
 * purely as a "has Firebase resolved whether there is a session yet" signal —
 * without it, `useStaffMe` could fire before the Firebase SDK restores a
 * persisted session and wrongly read as unauthenticated on a cold load.
 *
 * On failure the outcomes are distinct, because /v1/staff/me answers
 * UNAUTHORIZED for all of them alike:
 *   - `status === 'authenticated'` — an institution user browsing to /staff;
 *     send them to their own dashboard.
 *   - no session — nobody is signed in (e.g. a staff host's `/` redirect on a
 *     cold visit); send them to /login.
 *   - a session but no institution user — a staff identity whose PlatformUser
 *     row is missing or inactive. Explain it, because every redirect loops.
 */
export function RequirePlatform({ children }: { children: ReactNode }): JSX.Element | null {
  const authStatus = useAuthStore((s) => s.status)
  const hasSession = useAuthStore((s) => s.session !== null)
  const { data, isLoading, isError } = useStaffMe(authStatus !== 'loading')
  if (authStatus === 'loading' || isLoading) return null
  if (data && !isError) return <>{children}</>
  if (authStatus === 'authenticated') return <Navigate to="/dashboard" replace />
  if (!hasSession) return <Navigate to="/login" replace />
  return <NoStaffAccess />
}
