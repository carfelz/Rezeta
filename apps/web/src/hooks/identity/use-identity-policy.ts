import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { IdentityPolicyDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'identity-policy'

/** `enabled` lets callers skip the fetch for a user who lacks users:manage — the endpoint 403s for them, so there's no point issuing the request (see Security.tsx's IdentityPolicyCard). */
export function useIdentityPolicy(enabled = true): UseQueryResult<IdentityPolicyDto, Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<IdentityPolicyDto>('/v1/identity/policy'),
    enabled,
  })
}

export function useUpdateIdentityPolicy(): UseMutationResult<IdentityPolicyDto, Error, IdentityPolicyDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto) => apiClient.patch<IdentityPolicyDto>('/v1/identity/policy', dto),
    onSuccess: (data) => qc.setQueryData([QK], data),
  })
}
