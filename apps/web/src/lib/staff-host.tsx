import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

/** True when the app is served from a staff subdomain (staff.* / staff-dev.*). */
export function isStaffHostname(hostname: string): boolean {
  return /^staff[.-]/.test(hostname)
}

/**
 * Where a successful sign-in lands when no explicit `?redirectTo=` was given.
 * Staff hosts must not default to `/dashboard`: a PlatformUser has no
 * institution User row, so AuthGate sees `unauthenticated` and bounces them
 * back to /login — a loop whose only visible symptom is the (expected)
 * USER_NOT_PROVISIONED from POST /v1/auth/provision.
 */
export function defaultPostLoginPath(hostname: string): string {
  return isStaffHostname(hostname) ? '/staff/institutions' : '/dashboard'
}

/**
 * Root routes contributed only on staff hosts: `/` goes straight to the staff
 * console. Must be spread into the router BEFORE the AuthGate layout — staff
 * users 404 on /v1/auth/me, so the doctor-app AuthGate would bounce them to
 * /login before the layout's own index redirect could run.
 *
 * Declared as an index route (not `path: '/'`): the AuthGate layout's own
 * index route carries React Router's index bonus and would outrank a plain
 * `/` path; two index routes tie, and the first-defined one wins.
 */
export function staffHostRootRoutes(hostname: string): RouteObject[] {
  if (!isStaffHostname(hostname)) return []
  return [
    { index: true, element: <Navigate to="/staff/institutions" replace /> },
  ]
}
