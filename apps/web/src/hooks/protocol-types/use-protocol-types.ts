import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ProtocolTypeDto, CreateProtocolTypeDto, UpdateProtocolTypeDto } from '@rezeta/shared'

const QK = 'protocol-types'

export function useProtocolTypes(): UseQueryResult<ProtocolTypeDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<ProtocolTypeDto[]>('/v1/protocol-types'),
  })
}

export function useProtocolType(id: string): UseQueryResult<ProtocolTypeDto, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<ProtocolTypeDto>(`/v1/protocol-types/${id}`),
    enabled: !!id,
  })
}

export function useCreateProtocolType(): UseMutationResult<
  ProtocolTypeDto,
  Error,
  CreateProtocolTypeDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateProtocolTypeDto) =>
      apiClient.post<ProtocolTypeDto>('/v1/protocol-types', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useUpdateProtocolType(
  id: string,
): UseMutationResult<ProtocolTypeDto, Error, UpdateProtocolTypeDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateProtocolTypeDto) =>
      apiClient.patch<ProtocolTypeDto>(`/v1/protocol-types/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      void qc.invalidateQueries({ queryKey: [QK, id] })
    },
  })
}

export function useDeleteProtocolType(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/protocol-types/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}
