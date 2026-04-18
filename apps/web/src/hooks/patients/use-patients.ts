import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Patient } from '@rezeta/shared'
import type { CreatePatientDto, UpdatePatientDto } from '@rezeta/shared'

interface PatientListResponse {
  items: Patient[]
  hasMore: boolean
  nextCursor?: string
}

interface PatientListParams {
  search?: string
  cursor?: string
}

const PATIENTS_KEY = 'patients'

export function usePatients(params?: PatientListParams) {
  const searchParams = new URLSearchParams()
  if (params?.search) searchParams.set('search', params.search)
  if (params?.cursor) searchParams.set('cursor', params.cursor)
  const qs = searchParams.toString()

  return useQuery({
    queryKey: [PATIENTS_KEY, params],
    queryFn: () => apiClient.get<PatientListResponse>(`/v1/patients${qs ? `?${qs}` : ''}`),
  })
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: [PATIENTS_KEY, id],
    queryFn: () => apiClient.get<Patient>(`/v1/patients/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePatientDto) => apiClient.post<Patient>('/v1/patients', dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PATIENTS_KEY] }),
  })
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdatePatientDto) => apiClient.patch<Patient>(`/v1/patients/${id}`, dto),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PATIENTS_KEY] }),
  })
}

export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/patients/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PATIENTS_KEY] }),
  })
}
