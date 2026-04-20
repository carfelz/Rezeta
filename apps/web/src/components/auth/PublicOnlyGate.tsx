import type { ReactNode } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { strings } from '@/lib/strings'

interface PublicOnlyGateProps {
  children: ReactNode
}

function isSafeRedirect(path: string | null): path is string {
  if (!path) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('://')) return false
  return true
}

/**
 * PublicOnlyGate — wraps /login and /signup.
 *
 * status === 'loading'         → show full-page spinner (same as AuthGate — don't flash content)
 * status === 'authenticated'   → redirect to ?redirectTo param (validated) or /dashboard
 * status === 'unauthenticated' → render children
 */
export function PublicOnlyGate({ children }: PublicOnlyGateProps): JSX.Element {
  const status = useAuthStore((s) => s.status)
  const [searchParams] = useSearchParams()

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

  if (status === 'authenticated') {
    const redirectTo = searchParams.get('redirectTo')
    const destination = isSafeRedirect(redirectTo) ? redirectTo : '/dashboard'
    return <Navigate to={destination} replace />
  }

  return <>{children}</>
}
