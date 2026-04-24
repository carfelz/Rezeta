import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  CreateProtocolDto,
  UpdateProtocolTitleDto,
  SaveVersionDto,
  ProtocolListItem,
  ProtocolResponse,
  VersionListItem,
  VersionDetailResponse,
} from '@rezeta/shared'

type SaveVersionResponse = {
  id: string
  versionNumber: number
  changeSummary: string | null
  createdAt: string
}
type RenameResponse = { id: string; title: string }

export interface ProtocolListFilters {
  search?: string
  typeId?: string
  status?: string
  favoritesOnly?: boolean
  sort?: 'updatedAt_desc' | 'updatedAt_asc' | 'title_asc' | 'title_desc'
}

interface UseProtocolsReturn {
  useGetProtocols: (filters?: ProtocolListFilters) => UseQueryResult<ProtocolListItem[]>
  useGetProtocol: (id: string) => UseQueryResult<ProtocolResponse>
  useCreateProtocol: () => UseMutationResult<ProtocolResponse, Error, CreateProtocolDto>
  useRenameProtocol: (
    id: string,
  ) => UseMutationResult<RenameResponse, Error, UpdateProtocolTitleDto>
  useSaveVersion: (
    protocolId: string,
  ) => UseMutationResult<SaveVersionResponse, Error, SaveVersionDto>
  useToggleFavorite: (protocolId: string) => UseMutationResult<void, Error, boolean>
  useGetVersionHistory: (protocolId: string) => UseQueryResult<VersionListItem[]>
  useGetVersion: (
    protocolId: string,
    versionId: string | null,
  ) => UseQueryResult<VersionDetailResponse>
  useRestoreVersion: (protocolId: string) => UseMutationResult<SaveVersionResponse, Error, string>
}

function buildQuery(filters: ProtocolListFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.typeId) params.set('typeId', filters.typeId)
  if (filters.status) params.set('status', filters.status)
  if (filters.favoritesOnly) params.set('favoritesOnly', 'true')
  if (filters.sort) params.set('sort', filters.sort)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function useProtocols(): UseProtocolsReturn {
  const queryClient = useQueryClient()

  const useGetProtocols = (filters: ProtocolListFilters = {}) => {
    return useQuery({
      queryKey: ['protocols', filters],
      queryFn: () => apiClient.get<ProtocolListItem[]>(`/v1/protocols${buildQuery(filters)}`),
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

  const useToggleFavorite = (protocolId: string) => {
    return useMutation({
      mutationFn: (isFavorite: boolean) => {
        if (isFavorite) {
          return apiClient.post<void>(`/v1/protocols/${protocolId}/favorite`, {})
        }
        return apiClient.delete(`/v1/protocols/${protocolId}/favorite`)
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
      },
    })
  }

  const useGetVersionHistory = (protocolId: string) => {
    return useQuery({
      queryKey: ['protocols', protocolId, 'versions'],
      queryFn: () => apiClient.get<VersionListItem[]>(`/v1/protocols/${protocolId}/versions`),
      enabled: !!protocolId,
    })
  }

  const useGetVersion = (protocolId: string, versionId: string | null) => {
    return useQuery({
      queryKey: ['protocols', protocolId, 'versions', versionId],
      queryFn: () =>
        apiClient.get<VersionDetailResponse>(`/v1/protocols/${protocolId}/versions/${versionId!}`),
      enabled: !!protocolId && !!versionId,
    })
  }

  const useRestoreVersion = (protocolId: string) => {
    return useMutation({
      mutationFn: (versionId: string) =>
        apiClient.post<SaveVersionResponse>(
          `/v1/protocols/${protocolId}/versions/${versionId}/restore`,
          {},
        ),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols', protocolId] })
        void queryClient.invalidateQueries({ queryKey: ['protocols', protocolId, 'versions'] })
      },
    })
  }

  return {
    useGetProtocols,
    useGetProtocol,
    useCreateProtocol,
    useRenameProtocol,
    useSaveVersion,
    useToggleFavorite,
    useGetVersionHistory,
    useGetVersion,
    useRestoreVersion,
  }
}
