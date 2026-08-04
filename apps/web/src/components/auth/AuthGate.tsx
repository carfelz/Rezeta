import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { resolveDestination } from '@/lib/auth-routing'
import { authGateStrings } from './strings'

interface AuthGateProps {
  children: ReactNode
}

/**
 * AuthGate — wraps protected routes in the doctor app.
 *
 * `identity.kind` outcomes:
 *   - `loading` — identity has not resolved yet; show the full-page spinner.
 *   - `clinic` — an institution user. Render children, unless the tenant
 *     hasn't been seeded yet (`tenantSeededAt === null`) and the current path
 *     isn't already under /bienvenido — then send them through onboarding.
 *   - `anonymous` | `staff` | `unprovisioned` — this route is not for them.
 *     Where they go is resolveDestination's call, not ours (see
 *     apps/web/src/lib/auth-routing.ts); substituting a fallback path here
 *     for a null destination is exactly the login loop this refactor exists
 *     to remove. The one thing AuthGate still owns is stamping the current
 *     location onto `?redirectTo=` for an anonymous visitor, so they land
 *     back here after signing in — safe because resolveDestination validates
 *     that target against the host's app before ever honouring it (PR #47).
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
    case 'anonymous':
    case 'staff':
    case 'unprovisioned':
      return redirectAway()
  }
}
