import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  CreatePlatformUserDto,
  PlatformUserApiDto,
  SetActiveDto,
} from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'staff-platform-users'
const BASE = '/v1/staff/identity/users'

export function useStaffPlatformUsers(): UseQueryResult<PlatformUserApiDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<PlatformUserApiDto[]>(BASE),
  })
}

export function useCreatePlatformUser(): UseMutationResult<
  PlatformUserApiDto,
  Error,
  CreatePlatformUserDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePlatformUserDto) => apiClient.post<PlatformUserApiDto>(BASE, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useSetPlatformUserActive(
  id: string,
): UseMutationResult<PlatformUserApiDto, Error, SetActiveDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: SetActiveDto) =>
      apiClient.patch<PlatformUserApiDto>(`${BASE}/${id}/active`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useResendPlatformUserInvite(
  id: string,
): UseMutationResult<PlatformUserApiDto, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<PlatformUserApiDto>(`${BASE}/${id}/resend-invite`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
