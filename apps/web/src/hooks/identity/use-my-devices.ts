import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import type { UserDeviceItemDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'identity-my-devices'

export function useMyDevices(): UseQueryResult<UserDeviceItemDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<UserDeviceItemDto[]>('/v1/identity/me/devices'),
  })
}

export function useSignOutAllSessions(): UseMutationResult<void, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<void>('/v1/identity/me/sign-out-all', {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
