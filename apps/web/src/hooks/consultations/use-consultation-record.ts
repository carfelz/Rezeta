import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient, ApiRequestError, triggerDownload } from '@/lib/api-client'
import type { ConsultationRecordDto, UpdateRecordSectionsDto } from '@rezeta/shared'

const QK = 'consultation-record'

export function useConsultationRecord(
  consultationId: string | null,
): UseQueryResult<ConsultationRecordDto | null, Error> {
  return useQuery({
    queryKey: [QK, consultationId],
    queryFn: async () => {
      try {
        return await apiClient.get<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record`)
      } catch (err) {
        if (err instanceof ApiRequestError && err.error.code === 'RECORD_NOT_FOUND') return null
        throw err
      }
    },
    enabled: Boolean(consultationId),
  })
}

function useRecordMutation<TVars>(
  consultationId: string,
  run: (vars: TVars) => Promise<ConsultationRecordDto>,
): UseMutationResult<ConsultationRecordDto, Error, TVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (record) => {
      qc.setQueryData([QK, consultationId], record)
    },
  })
}

export function useEnsureRecord(): UseMutationResult<ConsultationRecordDto, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (consultationId: string) =>
      apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record`, {}),
    onSuccess: (record, consultationId) => {
      qc.setQueryData([QK, consultationId], record)
    },
  })
}

export function useUpdateRecordSections(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, UpdateRecordSectionsDto> {
  return useRecordMutation(consultationId, (dto) =>
    apiClient.patch<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record`, dto),
  )
}

export function useRegenerateRecord(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, void> {
  return useRecordMutation(consultationId, () =>
    apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record/regenerate`, {}),
  )
}

export function useSignRecord(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, void> {
  return useRecordMutation(consultationId, () =>
    apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record/sign`, {}),
  )
}

export async function downloadRecordPdf(consultationId: string): Promise<void> {
  const blob = await apiClient.download(`/v1/consultations/${consultationId}/record/pdf`)
  triggerDownload(blob, `historia-${consultationId}.pdf`)
}
