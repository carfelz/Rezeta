import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient, ApiRequestError, triggerDownload } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type {
  ConsultationRecordDto,
  RecordSectionKey,
  RecordVersionSummary,
  UpdateRecordSectionsDto,
} from '@rezeta/shared'
import { RECORD_SECTION_TITLES } from '@rezeta/shared'

const QK = 'consultation-record'

export function useConsultationRecord(
  consultationId: string | null,
): UseQueryResult<ConsultationRecordDto | null, Error> {
  return useQuery({
    queryKey: [QK, consultationId],
    queryFn: async () => {
      try {
        return await apiClient.get<ConsultationRecordDto>(
          `/v1/consultations/${consultationId}/record`,
        )
      } catch (err) {
        if (err instanceof ApiRequestError && err.error.code === 'RECORD_NOT_FOUND') return null
        throw err
      }
    },
    enabled: Boolean(consultationId),
  })
}

export function useRecordVersions(
  consultationId: string | null,
): UseQueryResult<RecordVersionSummary[], Error> {
  return useQuery({
    queryKey: [QK, consultationId, 'versions'],
    queryFn: () =>
      apiClient.get<RecordVersionSummary[]>(`/v1/consultations/${consultationId}/record/versions`),
    enabled: Boolean(consultationId),
  })
}

export function useRecordVersion(
  consultationId: string | null,
  versionNumber: number | null,
): UseQueryResult<ConsultationRecordDto, Error> {
  return useQuery({
    queryKey: [QK, consultationId, 'versions', versionNumber],
    queryFn: () =>
      apiClient.get<ConsultationRecordDto>(
        `/v1/consultations/${consultationId}/record/versions/${versionNumber}`,
      ),
    enabled: Boolean(consultationId) && versionNumber !== null,
  })
}

function useRecordMutation<TVars>(
  consultationId: string,
  run: (vars: TVars) => Promise<ConsultationRecordDto>,
  options?: { invalidateVersions?: boolean },
): UseMutationResult<ConsultationRecordDto, Error, TVars> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (record) => {
      qc.setQueryData([QK, consultationId], record)
      if (options?.invalidateVersions) {
        void qc.invalidateQueries({ queryKey: [QK, consultationId, 'versions'] })
      }
    },
    onError: () => {
      toast.error(toastStrings.errorHistoriaSave)
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
    onError: () => {
      toast.error(toastStrings.errorHistoriaSave)
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
  return useRecordMutation(
    consultationId,
    () =>
      apiClient.post<ConsultationRecordDto>(
        `/v1/consultations/${consultationId}/record/regenerate`,
        {},
      ),
    { invalidateVersions: true },
  )
}

export function useSignRecord(
  consultationId: string,
): UseMutationResult<ConsultationRecordDto, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient.post<ConsultationRecordDto>(`/v1/consultations/${consultationId}/record/sign`, {}),
    onSuccess: (record) => {
      qc.setQueryData([QK, consultationId], record)
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'versions'] })
    },
    onError: (err) => {
      if (err instanceof ApiRequestError && err.error.code === 'RECORD_REQUIRED_SECTIONS_MISSING') {
        const missing = err.error.details?.['missing']
        const names = Array.isArray(missing)
          ? missing
              .filter((key): key is RecordSectionKey => typeof key === 'string' && key in RECORD_SECTION_TITLES)
              .map((key) => RECORD_SECTION_TITLES[key])
          : []
        toast.error(
          names.length > 0
            ? toastStrings.historiaMissingSectionsNamed(names)
            : toastStrings.historiaMissingSections,
        )
        return
      }
      toast.error(toastStrings.errorHistoriaSign)
    },
  })
}

export async function downloadRecordPdf(
  consultationId: string,
  versionNumber?: number,
): Promise<void> {
  const query = versionNumber !== undefined ? `?version=${versionNumber}` : ''
  const blob = await apiClient.download(`/v1/consultations/${consultationId}/record/pdf${query}`)
  const filename =
    versionNumber !== undefined
      ? `historia-${consultationId}-v${versionNumber}.pdf`
      : `historia-${consultationId}.pdf`
  triggerDownload(blob, filename)
}

export async function downloadExpediente(patientId: string): Promise<void> {
  const blob = await apiClient.download(`/v1/patients/${patientId}/record-export`)
  triggerDownload(blob, `expediente-${patientId}.pdf`)
}
