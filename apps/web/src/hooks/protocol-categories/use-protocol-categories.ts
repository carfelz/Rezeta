import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type { CreateProtocolCategoryDto, UpdateProtocolCategoryDto } from '@rezeta/shared'

export interface ProtocolCategoryDto {
  id: string
  tenantId: string
  name: string
  color: string
  isSeeded: boolean
  deletedAt: string | null
}

const QK = 'protocol-categories'

export function useProtocolCategories(): UseQueryResult<ProtocolCategoryDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<ProtocolCategoryDto[]>('/v1/protocol-categories'),
  })
}

export function useProtocolCategory(id: string): UseQueryResult<ProtocolCategoryDto, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<ProtocolCategoryDto>(`/v1/protocol-categories/${id}`),
    enabled: !!id,
  })
}

export function useCreateProtocolCategory(): UseMutationResult<
  ProtocolCategoryDto,
  Error,
  CreateProtocolCategoryDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateProtocolCategoryDto) =>
      apiClient.post<ProtocolCategoryDto>('/v1/protocol-categories', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      toast.success(toastStrings.protocolCategoryCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolCategorySave)
    },
  })
}

export function useUpdateProtocolCategory(
  id: string,
): UseMutationResult<ProtocolCategoryDto, Error, UpdateProtocolCategoryDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateProtocolCategoryDto) =>
      apiClient.patch<ProtocolCategoryDto>(`/v1/protocol-categories/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      void qc.invalidateQueries({ queryKey: [QK, id] })
      toast.success(toastStrings.protocolCategoryUpdated)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolCategorySave)
    },
  })
}

export function useDeleteProtocolCategory(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/protocol-categories/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      toast.success(toastStrings.protocolCategoryDeleted)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolCategorySave)
    },
  })
}
