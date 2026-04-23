import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  ProtocolTemplateDto,
  CreateProtocolTemplateDto,
  UpdateProtocolTemplateDto,
} from '@rezeta/shared'

const QK = 'protocol-templates'

export function useProtocolTemplates(): UseQueryResult<ProtocolTemplateDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<ProtocolTemplateDto[]>('/v1/protocol-templates'),
  })
}

export function useProtocolTemplate(id: string): UseQueryResult<ProtocolTemplateDto, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<ProtocolTemplateDto>(`/v1/protocol-templates/${id}`),
    enabled: !!id,
  })
}

export function useCreateProtocolTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateProtocolTemplateDto) =>
      apiClient.post<ProtocolTemplateDto>('/v1/protocol-templates', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useUpdateProtocolTemplate(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateProtocolTemplateDto) =>
      apiClient.patch<ProtocolTemplateDto>(`/v1/protocol-templates/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      void qc.invalidateQueries({ queryKey: [QK, id] })
    },
  })
}

export function useDeleteProtocolTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/protocol-templates/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}
