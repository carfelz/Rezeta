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
 */
export function useStaffMe(enabled = true): UseQueryResult<PlatformPrincipal, Error> {
  return useQuery({
    queryKey: ['staff', 'me'],
    queryFn: () => apiClient.get<PlatformPrincipal>('/v1/staff/me'),
    retry: false,
    enabled,
  })
}
