import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreateProtocolDto, UpdateProtocolTitleDto, SaveVersionDto, ProtocolListItem, ProtocolResponse } from '@rezeta/shared'

export function useProtocols() {
  const queryClient = useQueryClient()

  const useGetProtocols = () => {
    return useQuery({
      queryKey: ['protocols'],
      queryFn: () => apiClient.get<ProtocolListItem[]>('/v1/protocols'),
    })
  }

  const useGetProtocol = (id: string) => {
    return useQuery({
      queryKey: ['protocols', id],
      queryFn: () => apiClient.get<ProtocolResponse>(`/v1/protocols/${id}`),
      enabled: !!id,
    })
  }

  const useCreateProtocol = () => {
    return useMutation({
      mutationFn: (dto: CreateProtocolDto) =>
        apiClient.post<ProtocolResponse>('/v1/protocols', dto),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['protocols'] })
      },
    })
  }

  const useRenameProtocol = (id: string) => {
    return useMutation({
      mutationFn: (dto: UpdateProtocolTitleDto) =>
        apiClient.patch<{ id: string; title: string }>(`/v1/protocols/${id}`, dto),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['protocols'] })
        queryClient.invalidateQueries({ queryKey: ['protocols', id] })
      },
    })
  }

  const useSaveVersion = (protocolId: string) => {
    return useMutation({
      mutationFn: (dto: SaveVersionDto) =>
        apiClient.post<{ id: string; versionNumber: number; changeSummary: string | null; createdAt: string }>(
          `/v1/protocols/${protocolId}/versions`,
          dto,
        ),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['protocols', protocolId] })
        queryClient.invalidateQueries({ queryKey: ['protocols'] })
      },
    })
  }

  return {
    useGetProtocols,
    useGetProtocol,
    useCreateProtocol,
    useRenameProtocol,
    useSaveVersion,
  }
}
