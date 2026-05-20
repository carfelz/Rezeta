import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type {
  Location as ClinicLocation,
  CreateLocationDto,
  UpdateLocationDto,
} from '@rezeta/shared'

const QK = 'locations'

export function useLocations(): UseQueryResult<ClinicLocation[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<ClinicLocation[]>('/v1/locations'),
  })
}

export function useLocation(id: string): UseQueryResult<ClinicLocation, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<ClinicLocation>(`/v1/locations/${id}`),
    enabled: !!id,
  })
}

export function useCreateLocation(): UseMutationResult<ClinicLocation, Error, CreateLocationDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateLocationDto) => apiClient.post<ClinicLocation>('/v1/locations', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      toast.success(toastStrings.locationCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorLocationCreate)
    },
  })
}

export function useUpdateLocation(
  id: string,
): UseMutationResult<ClinicLocation, Error, UpdateLocationDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateLocationDto) =>
      apiClient.patch<ClinicLocation>(`/v1/locations/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      void qc.invalidateQueries({ queryKey: [QK, id] })
      toast.success(toastStrings.locationUpdated)
    },
    onError: () => {
      toast.error(toastStrings.errorLocationUpdate)
    },
  })
}

export function useDeleteLocation(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/locations/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      toast.success(toastStrings.locationDeleted)
    },
    onError: () => {
      toast.error(toastStrings.errorLocationDelete)
    },
  })
}
