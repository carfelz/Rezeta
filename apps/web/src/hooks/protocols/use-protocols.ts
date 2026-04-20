import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  CreateProtocolDto,
  UpdateProtocolTitleDto,
  SaveVersionDto,
  ProtocolListItem,
  ProtocolResponse,
} from '@rezeta/shared'

type SaveVersionResponse = {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdAt: string
}
type RenameResponse = { id: string; title: string }

interface UseProtocolsReturn {
  useGetProtocols: () => UseQueryResult<ProtocolListItem[]>
  useGetProtocol: (id: string) => UseQueryResult<ProtocolResponse>
  useCreateProtocol: () => UseMutationResult<ProtocolResponse, Error, CreateProtocolDto>
  useRenameProtocol: (
    id: string,
  ) => UseMutationResult<RenameResponse, Error, UpdateProtocolTitleDto>
  useSaveVersion: (
    protocolId: string,
  ) => UseMutationResult<SaveVersionResponse, Error, SaveVersionDto>
}

export function useProtocols(): UseProtocolsReturn {
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
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
      },
    })
  }

  const useRenameProtocol = (id: string) => {
    return useMutation({
      mutationFn: (dto: UpdateProtocolTitleDto) =>
        apiClient.patch<RenameResponse>(`/v1/protocols/${id}`, dto),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
        void queryClient.invalidateQueries({ queryKey: ['protocols', id] })
      },
    })
  }

  const useSaveVersion = (protocolId: string) => {
    return useMutation({
      mutationFn: (dto: SaveVersionDto) =>
        apiClient.post<SaveVersionResponse>(`/v1/protocols/${protocolId}/versions`, dto),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols', protocolId] })
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
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
