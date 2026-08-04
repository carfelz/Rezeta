import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { authClient } from '@/lib/auth'
import { resolveDestination } from '@/lib/auth-routing'
import { Card, Button } from '@/components/ui'
import { authGateStrings } from './strings'

interface AuthGateProps {
  children: ReactNode
}

/**
 * Shown when a live session resolves to neither an institution user nor a
 * platform principal (e.g. a soft-deleted or failed-provisioning account).
 * Redirecting this identity anywhere in the doctor app loops back here —
 * every protected route sits behind this same gate — so, mirroring
 * `RequirePlatform`'s `NoStaffAccess`, this renders an explanation and a way
 * out instead. Doctor-app copy is Spanish, colocated in ./strings.ts.
 */
function NoClinicAccess(): JSX.Element {
  return (
    <div className="min-h-screen flex items-center justify-center bg-n-25 p-8">
      <Card className="w-full max-w-400 text-center">
        <h1 className="text-h3 mb-2">{authGateStrings.noAccessTitle}</h1>
        <p className="text-body-sm text-n-600 mb-6">{authGateStrings.noAccessBody}</p>
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-center"
          onClick={() => {
            void authClient.signOut()
          }}
        >
          {authGateStrings.noAccessSignOut}
        </Button>
      </Card>
    </div>
  )
}

/**
 * AuthGate — wraps protected routes in the doctor app.
 *
 * `identity.kind` outcomes:
 *   - `loading` — identity has not resolved yet; show the full-page spinner.
 *   - `clinic` — an institution user. Render children, unless the tenant
 *     hasn't been seeded yet (`tenantSeededAt === null`) and the current path
 *     isn't already under /bienvenido — then send them through onboarding.
 *   - `unprovisioned` — a live session that is neither a clinic user nor a
 *     platform principal. Explain it instead of redirecting; see
 *     `NoClinicAccess` above.
 *   - `anonymous` | `staff` — this route is not for them. Where they go is
 *     resolveDestination's call, not ours (see apps/web/src/lib/auth-routing.ts).
 *     The one thing AuthGate still owns is stamping the current location onto
 *     `?redirectTo=` for an anonymous visitor, so they land back here after
 *     signing in — safe because resolveDestination validates that target
 *     against the host's app before ever honouring it (PR #47).
 */
export function AuthGate({ children }: AuthGateProps): JSX.Element | null {
  const identity = useAuthStore((s) => s.identity)
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  function redirectAway(): JSX.Element | null {
    const destination = resolveDestination({
      identity,
      hostname: window.location.hostname,
      requestedRedirect: null,
    })
    // resolveDestination never returns null for 'anonymous' or 'staff' — this
    // guard exists only so a future change to that contract fails safe here
    // (render nothing) instead of navigating to an invalid destination.
    // 'unprovisioned' is handled separately, above, with an explanation.
    if (!destination) return null
    if (identity.kind === 'anonymous') {
      const redirectTo = encodeURIComponent(location.pathname + location.search)
      return <Navigate to={`${destination}?redirectTo=${redirectTo}`} replace />
    }
    return <Navigate to={destination} replace />
  }

  switch (identity.kind) {
    case 'loading':
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-n-25)',
            gap: 'var(--space-4)',
          }}
        >
          {/* Brand mark */}
          <div
            style={{
              width: 44,
              height: 44,
              background: 'var(--color-p-500)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: 24,
              fontWeight: 500,
              color: 'white',
            }}
          >
            R
          </div>
          <p className="text-body-sm" style={{ color: 'var(--color-n-500)' }}>
            {authGateStrings.loading}
          </p>
        </div>
      )
    case 'clinic':
      if (user && user.tenantSeededAt === null && !location.pathname.startsWith('/bienvenido')) {
        return <Navigate to="/bienvenido" replace />
      }
      return <>{children}</>
    case 'unprovisioned':
      return <NoClinicAccess />
    case 'anonymous':
    case 'staff':
      return redirectAway()
  }
}
