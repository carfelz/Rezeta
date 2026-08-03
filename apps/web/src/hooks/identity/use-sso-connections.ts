import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type { CreateSsoConnectionDto, SsoConnectionDto, SsoTestResultDto, UpdateSsoConnectionDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'staff-sso-connections'
const BASE = '/v1/staff/identity/sso-connections'

export interface SetSsoConnectionStatusDto {
  status: 'active' | 'disabled'
}

export function useSsoConnections(): UseQueryResult<SsoConnectionDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<SsoConnectionDto[]>(BASE),
  })
}

export function useCreateSsoConnection(): UseMutationResult<
  SsoConnectionDto,
  Error,
  CreateSsoConnectionDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateSsoConnectionDto) => apiClient.post<SsoConnectionDto>(BASE, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useUpdateSsoConnection(
  id: string,
): UseMutationResult<SsoConnectionDto, Error, UpdateSsoConnectionDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateSsoConnectionDto) =>
      apiClient.patch<SsoConnectionDto>(`${BASE}/${id}`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useSetSsoConnectionStatus(
  id: string,
): UseMutationResult<SsoConnectionDto, Error, SetSsoConnectionStatusDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: SetSsoConnectionStatusDto) =>
      apiClient.patch<SsoConnectionDto>(`${BASE}/${id}/status`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useDeleteSsoConnection(id: string): UseMutationResult<void, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.delete(`${BASE}/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useTestSsoConnection(
  id: string,
): UseMutationResult<SsoTestResultDto, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<SsoTestResultDto>(`${BASE}/${id}/test`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
