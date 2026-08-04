import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
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
 * Route gate for the staff console. Branches purely on the resolved
 * `identity` from AuthProvider — it does not probe GET /v1/staff/me itself;
 * AuthProvider already does that once, on every auth state change (see
 * apps/web/src/providers/AuthProvider.tsx), and this gate reading the same
 * result a second time is exactly the redundancy the auth-identity-resolution
 * refactor removes. This is a UX gate — the backend AuthGuard/PlatformGuard
 * on @PlatformRoute() is the real authorization boundary.
 *
 * `identity.kind` outcomes:
 *   - `staff` — a resolved platform principal; render the console.
 *   - `clinic` — an institution user who browsed to /staff; send them to
 *     their own dashboard.
 *   - `anonymous` — nobody is signed in (e.g. a staff host's `/` redirect on
 *     a cold visit); send them to /login.
 *   - `unprovisioned` — a live session that is neither a platform principal
 *     nor an institution user (a PlatformUser row missing or inactive).
 *     Explain it instead of redirecting — every redirect from this state
 *     loops, since /dashboard sits behind a gate that would just bounce them
 *     back to /login.
 *   - `loading` — identity has not resolved yet; render nothing.
 */
export function RequirePlatform({ children }: { children: ReactNode }): JSX.Element | null {
  const identity = useAuthStore((s) => s.identity)

  switch (identity.kind) {
    case 'loading':
      return null
    case 'staff':
      return <>{children}</>
    case 'clinic':
      return <Navigate to="/dashboard" replace />
    case 'anonymous':
      return <Navigate to="/login" replace />
    case 'unprovisioned':
      return <NoStaffAccess />
  }
}
