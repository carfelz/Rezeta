import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

/**
 * BienvenidoGate — layout wrapper for the /bienvenido routes.
 *
 * If the tenant is already seeded, redirect to /dashboard (onboarding is complete).
 * If loading or unauthenticated, the outer AuthGate handles it.
 * Otherwise renders the matched child route via <Outlet />.
 */
export function BienvenidoGate(): JSX.Element {
  const user = useAuthStore((s) => s.user)

  if (user && user.tenantSeededAt !== null) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
