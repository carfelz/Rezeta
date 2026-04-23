import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser, OnboardingCustomInput } from '@rezeta/shared'

export interface StarterCandidate {
  clientId: string
  name: string
  typeName: string
  schema: object
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
    mutationFn: () => apiClient.post<AuthUser>('/v1/onboarding/default', {}),
    onSuccess: (updatedUser) => {
      _setUser(updatedUser)
      void qc.invalidateQueries()
    },
  })
}

export function useOnboardingCustom(): UseMutationResult<AuthUser, Error, OnboardingCustomInput> {
  const qc = useQueryClient()
  const _setUser = useAuthStore((s) => s._setUser)

  return useMutation({
    mutationFn: (input: OnboardingCustomInput) =>
      apiClient.post<AuthUser>('/v1/onboarding/custom', input),
    onSuccess: (updatedUser) => {
      _setUser(updatedUser)
      void qc.invalidateQueries()
    },
  })
}
