import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient, ApiRequestError } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import { useAuthStore } from '@/store/auth.store'
import { ErrorCode } from '@rezeta/shared'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'

export interface StarterCandidate {
  clientId: string
  name: string
  categoryName: string
  schema: object
}

/**
 * A rival onboarding request already seeded this tenant — the work is done, so
 * load the resulting user instead of failing. Concurrent requests are routine:
 * StrictMode double-invokes the mount effect in dev, and a double-click or a
 * network retry does the same in production.
 */
async function seedOrLoadSeededUser(seed: () => Promise<AuthUser>): Promise<AuthUser> {
  try {
    return await seed()
  } catch (err: unknown) {
    if (err instanceof ApiRequestError && err.error.code === ErrorCode.TENANT_ALREADY_SEEDED) {
      return apiClient.get<AuthUser>('/v1/auth/me')
    }
    throw err
  }
}

export function useOnboardingStarters(): UseQueryResult<StarterCandidate[], Error> {
  return useQuery({
    queryKey: ['onboarding-starters'],
    queryFn: () => apiClient.get<StarterCandidate[]>('/v1/onboarding/starters'),
    staleTime: Infinity, // starters never change at runtime
  })
}

export function useOnboardingDefault(): UseMutationResult<AuthUser, Error, void> {
  const qc = useQueryClient()
  const _setUser = useAuthStore((s) => s._setUser)

  return useMutation({
    mutationFn: () =>
      seedOrLoadSeededUser(() => apiClient.post<AuthUser>('/v1/onboarding/default', {})),
    onSuccess: (updatedUser) => {
      _setUser(updatedUser)
      void qc.invalidateQueries()
      toast.success(toastStrings.onboardingComplete)
    },
    onError: () => {
      toast.error(toastStrings.errorOnboarding)
    },
  })
}

export function useOnboardingCustom(): UseMutationResult<AuthUser, Error, OnboardingCustomInput> {
  const qc = useQueryClient()
  const _setUser = useAuthStore((s) => s._setUser)

  return useMutation({
    mutationFn: (input: OnboardingCustomInput) =>
      seedOrLoadSeededUser(() => apiClient.post<AuthUser>('/v1/onboarding/custom', input)),
    onSuccess: (updatedUser) => {
      _setUser(updatedUser)
      void qc.invalidateQueries()
      toast.success(toastStrings.onboardingComplete)
    },
    onError: () => {
      toast.error(toastStrings.errorOnboarding)
    },
  })
}
