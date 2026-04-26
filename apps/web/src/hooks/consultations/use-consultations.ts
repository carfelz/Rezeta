import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  ConsultationWithDetails,
  ConsultationProtocolUsage,
  CreateConsultationDto,
  UpdateConsultationDto,
  AmendConsultationDto,
  AddProtocolUsageDto,
  UpdateCheckedStateDto,
} from '@rezeta/shared'

const QK = 'consultations'

export interface ConsultationListParams {
  patientId?: string
  locationId?: string
  from?: string
  to?: string
}

export function usePatientConsultations(
  patientId: string,
): UseQueryResult<ConsultationWithDetails[], Error> {
  return useQuery({
    queryKey: [QK, { patientId }],
    queryFn: () =>
      apiClient.get<ConsultationWithDetails[]>(`/v1/consultations?patientId=${patientId}`),
    enabled: Boolean(patientId),
  })
}

export function useConsultations(
  params: ConsultationListParams,
): UseQueryResult<ConsultationWithDetails[], Error> {
  const search = new URLSearchParams()
  if (params.patientId) search.set('patientId', params.patientId)
  if (params.locationId) search.set('locationId', params.locationId)
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  const qs = search.toString()

  return useQuery({
    queryKey: [QK, params],
    queryFn: () =>
      apiClient.get<ConsultationWithDetails[]>(`/v1/consultations${qs ? `?${qs}` : ''}`),
  })
}

export function useConsultation(id: string): UseQueryResult<ConsultationWithDetails, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<ConsultationWithDetails>(`/v1/consultations/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateConsultation(): UseMutationResult<
  ConsultationWithDetails,
  Error,
  CreateConsultationDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateConsultationDto) =>
      apiClient.post<ConsultationWithDetails>('/v1/consultations', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useUpdateConsultation(
  id: string,
): UseMutationResult<ConsultationWithDetails, Error, UpdateConsultationDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateConsultationDto) =>
      apiClient.patch<ConsultationWithDetails>(`/v1/consultations/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useSignConsultation(
  id: string,
): UseMutationResult<ConsultationWithDetails, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.post<ConsultationWithDetails>(`/v1/consultations/${id}/sign`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useAmendConsultation(
  id: string,
): UseMutationResult<ConsultationWithDetails, Error, AmendConsultationDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: AmendConsultationDto) =>
      apiClient.post<ConsultationWithDetails>(`/v1/consultations/${id}/amend`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useDeleteConsultation(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/consultations/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useAddProtocolUsage(
  consultationId: string,
): UseMutationResult<ConsultationProtocolUsage, Error, AddProtocolUsageDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: AddProtocolUsageDto) =>
      apiClient.post<ConsultationProtocolUsage>(
        `/v1/consultations/${consultationId}/protocols`,
        dto,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
    },
  })
}

export function useUpdateCheckedState(
  consultationId: string,
  usageId: string,
): UseMutationResult<ConsultationProtocolUsage, Error, UpdateCheckedStateDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateCheckedStateDto) =>
      apiClient.patch<ConsultationProtocolUsage>(
        `/v1/consultations/${consultationId}/protocols/${usageId}`,
        dto,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
    },
  })
}

export function useRemoveProtocolUsage(
  consultationId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (usageId: string) =>
      apiClient.delete(`/v1/consultations/${consultationId}/protocols/${usageId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
    },
  })
}
