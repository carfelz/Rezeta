import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'

interface AuthGateProps {
  children: ReactNode
}

/**
 * AuthGate — wraps protected routes.
 *
 * status === 'loading'         → show full-page spinner
 * status === 'unauthenticated' → redirect to /login
 * status === 'authenticated'   → render children
 */
export function AuthGate({ children }: AuthGateProps): JSX.Element {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'loading') {
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
          {strings.AUTH_GATE_LOADING}
        </p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    const redirectTo = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirectTo=${redirectTo}`} replace />
  }

  return <>{children}</>
}
