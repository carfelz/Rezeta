import { Navigate } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'

/** True when the app is served from a staff subdomain (staff.* / staff-dev.*). */
export function isStaffHostname(hostname: string): boolean {
  return /^staff[.-]/.test(hostname)
}

/**
 * True when `path` belongs to the app this hostname serves. Both hosts ship the
 * same bundle, so a path can be routable yet still belong to the other app.
 *
 * This is what makes `?redirectTo=` safe to honour. AuthGate stamps the route
 * it bounced from into that parameter (`/login?redirectTo=%2Fdashboard`), so a
 * staff user who touched a doctor-app route arrives at the login page already
 * carrying a destination that will bounce them right back — defeating the
 * staff-host default before it is ever consulted.
 */
export function belongsToHostApp(hostname: string, path: string): boolean {
  const isStaffPath = path === '/staff' || path.startsWith('/staff/')
  return isStaffHostname(hostname) === isStaffPath
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
