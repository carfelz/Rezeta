import type { AuthUser, PlatformPrincipal } from '@rezeta/shared'
import { belongsToHostApp } from './staff-host'

/**
 * The single source of truth for "who is signed in, from the app's point of
 * view" — every auth-aware component derives its behaviour from one of these
 * variants instead of re-deriving loading/anonymous/provisioned state itself.
 */
export type Identity =
  | { kind: 'loading' }
  | { kind: 'anonymous' } // no provider session
  | { kind: 'clinic'; user: AuthUser } // institution User row
  | { kind: 'staff'; principal: PlatformPrincipal } // PlatformUser row
  | { kind: 'unprovisioned' } // live session, neither row

/**
 * Rejects redirect targets that could send the browser off-app: null/empty,
 * not `/`-prefixed, protocol-relative (`//`-prefixed), or containing `://`.
 */
export function isSafeRedirect(path: string | null): path is string {
  if (!path) return false
  if (!path.startsWith('/')) return false
  if (path.startsWith('//')) return false
  if (path.includes('://')) return false
  return true
}

/**
 * Returns the path to navigate to, or `null` when the caller must not
 * navigate. `null` is returned for exactly two states — `unprovisioned` and
 * `loading` — and means precisely "do not navigate": the caller renders an
 * explanation (unprovisioned) or nothing yet (loading) instead of falling
 * back to a default path. A fallback for either state is what turned the
 * original login loop into a recurring bug; do not reintroduce one here.
 */
export function resolveDestination(input: {
  identity: Identity
  hostname: string
  requestedRedirect: string | null
}): string | null {
  const { identity, hostname, requestedRedirect } = input

  function safeHostRedirect(): string | null {
    if (!isSafeRedirect(requestedRedirect)) return null
    if (!belongsToHostApp(hostname, requestedRedirect)) return null
    return requestedRedirect
  }

  switch (identity.kind) {
    case 'clinic':
      return safeHostRedirect() ?? '/dashboard'
    case 'staff':
      return safeHostRedirect() ?? '/staff/institutions'
    case 'anonymous':
      return '/login'
    case 'unprovisioned':
    case 'loading':
      return null
  }
}
