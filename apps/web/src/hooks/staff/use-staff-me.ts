import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { PlatformPrincipal } from '@rezeta/shared'

/**
 * Resolves the current platform principal via GET /v1/staff/me. Returns a 401
 * for any non-platform (institution) user — that error is what the RequirePlatform
 * gate keys off. `retry: false` so a 401 fails fast instead of retrying.
 *
 * `enabled` lets the caller defer firing the request until the Firebase auth
 * SDK has resolved its initial session (see RequirePlatform): on a cold load,
 * `authClient.getToken()` can race ahead of Firebase restoring a persisted
 * session and return null, which would 401 a legitimate platform user.
 *
 * `skipSignOutOn401` is required here: an institution user who navigates to
 * /staff 401s with UNAUTHORIZED (AuthGuard's platform branch — no PlatformUser
 * row for their externalUid), which is not the USER_NOT_PROVISIONED code the
 * api-client otherwise exempts from its sign-out side effect. Without this
 * option, browsing to /staff would sign a valid institution user out entirely
 * instead of RequirePlatform simply redirecting them to /dashboard.
 */
export function useStaffMe(enabled = true): UseQueryResult<PlatformPrincipal, Error> {
  return useQuery({
    queryKey: ['staff', 'me'],
    queryFn: () => apiClient.get<PlatformPrincipal>('/v1/staff/me', { skipSignOutOn401: true }),
    retry: false,
    enabled,
  })
}
