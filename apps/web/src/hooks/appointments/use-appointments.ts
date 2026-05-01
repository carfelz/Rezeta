import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  AppointmentWithDetails,
  CreateAppointmentDto,
  UpdateAppointmentDto,
  UpdateAppointmentStatusDto,
} from '@rezeta/shared'

const QK = 'appointments'

export interface AppointmentListParams {
  locationId?: string
  from?: string
  to?: string
  status?: string
}

export function useAppointments(
  params: AppointmentListParams,
  options?: { enabled?: boolean },
): UseQueryResult<AppointmentWithDetails[], Error> {
  const search = new URLSearchParams()
  if (params.locationId) search.set('locationId', params.locationId)
  if (params.from) search.set('from', params.from)
  if (params.to) search.set('to', params.to)
  if (params.status) search.set('status', params.status)
  const qs = search.toString()

  return useQuery({
    queryKey: [QK, params],
    queryFn: () => apiClient.get<AppointmentWithDetails[]>(`/v1/appointments${qs ? `?${qs}` : ''}`),
    enabled: options?.enabled ?? Boolean(params.locationId),
  })
}

export function useTodayAppointments(): UseQueryResult<AppointmentWithDetails[], Error> {
  const today = new Date()
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
  return useAppointments({ from, to }, { enabled: true })
}

export function useAppointment(id: string): UseQueryResult<AppointmentWithDetails, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<AppointmentWithDetails>(`/v1/appointments/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateAppointment(): UseMutationResult<
  AppointmentWithDetails,
  Error,
  CreateAppointmentDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateAppointmentDto) =>
      apiClient.post<AppointmentWithDetails>('/v1/appointments', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useUpdateAppointment(
  id: string,
): UseMutationResult<AppointmentWithDetails, Error, UpdateAppointmentDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateAppointmentDto) =>
      apiClient.patch<AppointmentWithDetails>(`/v1/appointments/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useUpdateAppointmentStatus(
  id: string,
): UseMutationResult<AppointmentWithDetails, Error, UpdateAppointmentStatusDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateAppointmentStatusDto) =>
      apiClient.patch<AppointmentWithDetails>(`/v1/appointments/${id}/status`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useDeleteAppointment(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/appointments/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}
