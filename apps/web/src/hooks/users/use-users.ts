import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ManagedUserDto, CreateUserDto, ChangeRoleDto, SetActiveDto } from '@rezeta/shared'

const QK = 'users'

export function useUsers(): UseQueryResult<ManagedUserDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<ManagedUserDto[]>('/v1/users'),
  })
}

export function useCreateUser(): UseMutationResult<ManagedUserDto, Error, CreateUserDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateUserDto) => apiClient.post<ManagedUserDto>('/v1/users', dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useChangeUserRole(
  id: string,
): UseMutationResult<ManagedUserDto, Error, ChangeRoleDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: ChangeRoleDto) =>
      apiClient.patch<ManagedUserDto>(`/v1/users/${id}/role`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useSetUserActive(
  id: string,
): UseMutationResult<ManagedUserDto, Error, SetActiveDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: SetActiveDto) =>
      apiClient.patch<ManagedUserDto>(`/v1/users/${id}/active`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
