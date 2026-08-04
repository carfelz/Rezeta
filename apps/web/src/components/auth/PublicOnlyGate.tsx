import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { resolveDestination } from '@/lib/auth-routing'
import { authGateStrings } from './strings'

interface PublicOnlyGateProps {
  children: ReactNode
}

/**
 * PublicOnlyGate — wraps /login and /establecer-contrasena.
 *
 * identity.kind === 'loading'            → show full-page spinner (same as AuthGate — don't flash content)
 * identity.kind === 'clinic' | 'staff'   → redirect via resolveDestination (validated ?redirectTo= or the identity's default)
 * otherwise ('anonymous' | 'unprovisioned') → render children
 *
 * The redirect decision is delegated entirely to resolveDestination — this
 * gate never substitutes its own fallback path. That single-source-of-truth
 * property is what the auth-identity-resolution refactor exists to guarantee;
 * see apps/web/src/lib/auth-routing.ts.
 */
export function PublicOnlyGate({ children }: PublicOnlyGateProps): JSX.Element {
  const identity = useAuthStore((s) => s.identity)
  const [searchParams] = useSearchParams()

  if (identity.kind === 'loading') {
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
  }

  if (identity.kind === 'clinic' || identity.kind === 'staff') {
    const destination = resolveDestination({
      identity,
      hostname: window.location.hostname,
      requestedRedirect: searchParams.get('redirectTo'),
    })
    // resolveDestination never returns null for 'clinic' or 'staff' — this
    // guard exists only so a future change to that contract fails safe here
    // (render children) instead of navigating to an invalid destination.
    if (destination) {
      return <Navigate to={destination} replace />
    }
  }

  return <>{children}</>
}
