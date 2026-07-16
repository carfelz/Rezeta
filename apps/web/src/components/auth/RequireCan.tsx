import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { AccessLevel, ModuleKey } from '@rezeta/shared'
import { useCan } from '@/hooks/use-can'

interface RequireCanProps {
  module: ModuleKey
  level?: AccessLevel
  children: ReactNode
}

/**
 * Route guard: renders children when the user has at least `level` (default
 * 'view') on `module`, otherwise redirects to the dashboard. AuthGate handles
 * the unauthenticated case earlier; this guard only refines access per module.
 */
export function RequireCan({ module, level = 'view', children }: RequireCanProps): JSX.Element {
  const allowed = useCan(module, level)
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
