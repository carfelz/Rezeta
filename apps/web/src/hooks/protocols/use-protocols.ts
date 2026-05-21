import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type {
  CreateProtocolDto,
  UpdateProtocolTitleDto,
  SaveProtocolVersionDto,
  ProtocolListItem,
  ProtocolResponse,
  VersionListItem,
  VersionDetailResponse,
  ProtocolSuggestion,
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
  ) => UseMutationResult<SaveVersionResponse, Error, SaveProtocolVersionDto>
  useToggleFavorite: (protocolId: string) => UseMutationResult<void, Error, boolean>
  useArchiveProtocol: () => UseMutationResult<void, Error, string>
  useGetVersionHistory: (protocolId: string) => UseQueryResult<VersionListItem[]>
  useGetVersion: (
    protocolId: string,
    versionId: string | null,
  ) => UseQueryResult<VersionDetailResponse>
  useRestoreVersion: (protocolId: string) => UseMutationResult<SaveVersionResponse, Error, string>
  useGetSuggestions: (protocolId: string) => UseQueryResult<ProtocolSuggestion[]>
  useApplySuggestion: (protocolId: string) => UseMutationResult<void, Error, string>
  useCreateVariantFromSuggestion: (protocolId: string) => UseMutationResult<void, Error, string>
  useDismissSuggestion: (protocolId: string) => UseMutationResult<void, Error, string>
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
        toast.success(toastStrings.protocolCreated)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolSave)
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
        toast.success(toastStrings.protocolUpdated)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolSave)
      },
    })
  }

  const useSaveVersion = (protocolId: string) => {
    return useMutation({
      mutationFn: (dto: SaveProtocolVersionDto) =>
        apiClient.post<SaveVersionResponse>(`/v1/protocols/${protocolId}/versions`, dto),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols', protocolId] })
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
        toast.success(toastStrings.protocolVersionPublished)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolSave)
      },
    })
  }

  const useToggleFavorite = (protocolId: string) => {
    return useMutation({
      // Silent — feedback handled by the star icon state itself.
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

  const useArchiveProtocol = () => {
    return useMutation({
      mutationFn: (id: string) => apiClient.patch<void>(`/v1/protocols/${id}/archive`, {}),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
        toast.success(toastStrings.protocolArchived)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolArchive)
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
        toast.success(toastStrings.protocolVersionPublished)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolSave)
      },
    })
  }

  const useGetSuggestions = (protocolId: string) => {
    return useQuery({
      queryKey: ['protocols', protocolId, 'suggestions'],
      queryFn: () => apiClient.get<ProtocolSuggestion[]>(`/v1/protocols/${protocolId}/suggestions`),
      enabled: !!protocolId,
    })
  }

  const useApplySuggestion = (protocolId: string) => {
    return useMutation({
      mutationFn: (suggestionId: string) =>
        apiClient.post<void>(`/v1/protocols/${protocolId}/suggestions/${suggestionId}/apply`, {}),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols', protocolId] })
        void queryClient.invalidateQueries({
          queryKey: ['protocols', protocolId, 'suggestions'],
        })
        toast.success(toastStrings.suggestionApplied)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolSave)
      },
    })
  }

  const useCreateVariantFromSuggestion = (protocolId: string) => {
    return useMutation({
      mutationFn: (suggestionId: string) =>
        apiClient.post<void>(
          `/v1/protocols/${protocolId}/suggestions/${suggestionId}/create-variant`,
          {},
        ),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['protocols'] })
        void queryClient.invalidateQueries({
          queryKey: ['protocols', protocolId, 'suggestions'],
        })
        toast.success(toastStrings.suggestionVariantCreated)
      },
      onError: () => {
        toast.error(toastStrings.errorProtocolSave)
      },
    })
  }

  const useDismissSuggestion = (protocolId: string) => {
    return useMutation({
      mutationFn: (suggestionId: string) =>
        apiClient.delete(`/v1/protocols/${protocolId}/suggestions/${suggestionId}`),
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: ['protocols', protocolId, 'suggestions'],
        })
        toast.success(toastStrings.suggestionDismissed)
      },
      onError: () => {
        toast.error(toastStrings.errorGeneric)
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
    useArchiveProtocol,
    useGetVersionHistory,
    useGetVersion,
    useRestoreVersion,
    useGetSuggestions,
    useApplySuggestion,
    useCreateVariantFromSuggestion,
    useDismissSuggestion,
  }
}
