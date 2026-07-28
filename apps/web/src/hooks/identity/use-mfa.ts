import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import type { MfaSyncResultDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

export function useSyncMfaEnrollment(): UseMutationResult<MfaSyncResultDto, Error, void> {
  return useMutation({
    mutationFn: () => apiClient.post<MfaSyncResultDto>('/v1/identity/me/mfa/sync', {}),
  })
}
