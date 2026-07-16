import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useStaffMe } from '@/hooks/staff/use-staff-me'
import { useAuthStore } from '@/store/auth.store'

/**
 * Route gate for the staff console. Passes only when GET /v1/staff/me resolves a
 * platform principal; an institution user's token 401s there, so they are
 * redirected to the institution dashboard. This is a UX gate — the backend
 * AuthGuard/PlatformGuard on @PlatformRoute() is the real authorization boundary.
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
 */
export function RequirePlatform({ children }: { children: ReactNode }): JSX.Element | null {
  const authStatus = useAuthStore((s) => s.status)
  const { data, isLoading, isError } = useStaffMe(authStatus !== 'loading')
  if (authStatus === 'loading' || isLoading) return null
  if (isError || !data) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
