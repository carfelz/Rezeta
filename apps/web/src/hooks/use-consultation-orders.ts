import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  Prescription,
  ImagingOrder,
  LabOrder,
  CreatePrescriptionGroupDto,
  CreateImagingOrderGroupDto,
  CreateLabOrderGroupDto,
} from '@rezeta/shared'

export interface ConsultationOrders {
  prescriptions: Prescription[]
  imagingOrders: ImagingOrder[]
  labOrders: LabOrder[]
}

export function useConsultationOrders(
  consultationId: string,
): UseQueryResult<ConsultationOrders, Error> {
  return useQuery({
    queryKey: ['consultation-orders', consultationId],
    queryFn: () => apiClient.get<ConsultationOrders>(`/v1/consultations/${consultationId}/orders`),
    enabled: !!consultationId,
  })
}

export function useCreatePrescriptionGroup(
  consultationId: string,
): UseMutationResult<Prescription, Error, CreatePrescriptionGroupDto> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePrescriptionGroupDto) =>
      apiClient.post<Prescription>(`/v1/consultations/${consultationId}/prescriptions`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
      void queryClient.invalidateQueries({ queryKey: ['consultations', consultationId] })
    },
  })
}

export function useCreateImagingOrderGroup(
  consultationId: string,
): UseMutationResult<ImagingOrder[], Error, CreateImagingOrderGroupDto> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateImagingOrderGroupDto) =>
      apiClient.post<ImagingOrder[]>(
        `/v1/consultations/${consultationId}/imaging-orders`,
        dto,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
    },
  })
}

export function useCreateLabOrderGroup(
  consultationId: string,
): UseMutationResult<LabOrder[], Error, CreateLabOrderGroupDto> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateLabOrderGroupDto) =>
      apiClient.post<LabOrder[]>(`/v1/consultations/${consultationId}/lab-orders`, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
    },
  })
}

export function useDeleteOrderGroup(
  consultationId: string,
  type: 'prescriptions' | 'imaging-orders' | 'lab-orders',
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiClient.delete(`/v1/consultations/${consultationId}/${type}/${orderId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['consultation-orders', consultationId] })
    },
  })
}
