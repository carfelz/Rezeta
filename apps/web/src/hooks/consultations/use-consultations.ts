import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type {
  ConsultationWithDetails,
  ConsultationProtocolUsage,
  CreateConsultationDto,
  AmendConsultationDto,
  AddProtocolUsageDto,
  Prescription,
  ImagingOrder,
  LabOrder,
  CreatePrescriptionGroupDto,
  CreateImagingOrderGroupDto,
  CreateLabOrderGroupDto,
  ResumableConsultation,
  OffProtocolNoteEvent,
  SignConsultationResponse,
} from '@rezeta/shared'

// Local stubs for types removed from shared in schema reset v2
type UpdateConsultationDto = Record<string, never>
type UpdateCheckedStateDto = { completedAt?: string | null; notes?: string | null }
type PatchImagingOrderDto = { groupOrder?: number; groupTitle?: string | null }
type PatchLabOrderDto = { groupOrder?: number; groupTitle?: string | null }
type RenameOrderGroupDto = { groupTitle: string | null }

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

export function usePatientPrescriptions(
  patientId: string,
): UseQueryResult<Prescription[], Error> {
  return useQuery({
    queryKey: [QK, 'prescriptions', { patientId }],
    queryFn: () => apiClient.get<Prescription[]>(`/v1/patients/${patientId}/prescriptions`),
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
      void qc.invalidateQueries({ queryKey: ['appointments'] })
      toast.success(toastStrings.consultationCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorConsultationCreate)
    },
  })
}

export function useUpdateConsultation(
  id: string,
): UseMutationResult<ConsultationWithDetails, Error, UpdateConsultationDto> {
  const qc = useQueryClient()
  return useMutation({
    // Silent — driven by the SOAP-state autosave debounce; feedback handled by
    // the inline save-status indicator, not a toast.
    mutationFn: (dto: UpdateConsultationDto) =>
      apiClient.patch<ConsultationWithDetails>(`/v1/consultations/${id}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
  })
}

export function useSignConsultation(
  id: string,
): UseMutationResult<SignConsultationResponse, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient.patch<SignConsultationResponse>(`/v1/consultations/${id}/sign`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      void qc.invalidateQueries({ queryKey: ['appointments'] })
      void qc.invalidateQueries({ queryKey: ['invoices'] })
      toast.success(toastStrings.consultationSigned)
    },
    onError: () => {
      toast.error(toastStrings.errorConsultationSign)
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
      toast.success(toastStrings.amendmentCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorAmendmentCreate)
    },
  })
}

export function useDeleteConsultation(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/consultations/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
      toast.success(toastStrings.consultationDeleted)
    },
    onError: () => {
      toast.error(toastStrings.errorConsultationDelete)
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
      toast.success(toastStrings.protocolUsageAdded)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolUsage)
    },
  })
}

export function useUpdateCheckedState(
  consultationId: string,
  usageId: string,
): UseMutationResult<ConsultationProtocolUsage, Error, UpdateCheckedStateDto> {
  const qc = useQueryClient()
  return useMutation({
    // Silent — fires on every protocol step toggle; feedback handled by the
    // inline checkbox state, not a toast.
    mutationFn: (dto: UpdateCheckedStateDto) =>
      apiClient.patch<ConsultationProtocolUsage>(
        `/v1/consultations/${consultationId}/protocols/${usageId}`,
        dto,
        { silent: true },
      ),
    // Targeted cache write instead of invalidation: the loud `useConsultation`
    // refetch would pulse the global loading chip on every checkbox toggle,
    // defeating the { silent: true } flag on this autosave PATCH.
    onSuccess: (usage) => {
      qc.setQueryData<ConsultationWithDetails>([QK, consultationId], (prev) =>
        prev
          ? {
              ...prev,
              protocolUsages: prev.protocolUsages.map((u) => (u.id === usage.id ? usage : u)),
            }
          : prev,
      )
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
      toast.success(toastStrings.protocolUsageRemoved)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolUsage)
    },
  })
}

/**
 * Returns the most recent in-progress (draft) consultation for a patient,
 * eligible for the resume banner. Endpoint returns null when no eligible
 * consultation exists.
 */
export function useResumableForPatient(
  patientId: string | null,
): UseQueryResult<ResumableConsultation | null, Error> {
  return useQuery({
    queryKey: [QK, 'resumable', patientId],
    queryFn: () =>
      apiClient.get<ResumableConsultation | null>(
        `/v1/patients/${patientId}/in-progress-consultation`,
      ),
    enabled: Boolean(patientId),
  })
}

/**
 * Append a `steps_skipped` event with reason to a protocol usage's
 * modifications. The server appends the payload onto the stored arrays, so
 * only the new event is sent — resending existing entries would duplicate
 * them.
 */
export function useSkipStep(
  consultationId: string,
  usageId: string,
): UseMutationResult<ConsultationProtocolUsage, Error, { stepId: string; reason: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stepId, reason }) =>
      apiClient.patch<ConsultationProtocolUsage>(
        `/v1/consultations/${consultationId}/protocols/${usageId}`,
        {
          modifications: {
            steps_skipped: [{ step_id: stepId, timestamp: new Date().toISOString(), reason }],
          },
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
      toast.success(toastStrings.stepSkipped)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolUsage)
    },
  })
}

/**
 * Append an `off_protocol_notes` event to a protocol usage's modifications.
 * The server appends onto the stored array, so only the new event is sent.
 */
export function useAddOffProtocolNote(
  consultationId: string,
  usageId: string,
): UseMutationResult<ConsultationProtocolUsage, Error, { title?: string; note: string }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, note }) => {
      const event: OffProtocolNoteEvent = { timestamp: new Date().toISOString(), note }
      if (title) event.title = title
      const updated = await apiClient.patch<ConsultationProtocolUsage>(
        `/v1/consultations/${consultationId}/protocols/${usageId}`,
        { modifications: { off_protocol_notes: [event] } },
      )
      return updated
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
      toast.success(toastStrings.offProtocolNoteAdded)
    },
    onError: () => {
      toast.error(toastStrings.errorProtocolUsage)
    },
  })
}

export function useCreatePrescription(
  consultationId: string,
): UseMutationResult<Prescription, Error, CreatePrescriptionGroupDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreatePrescriptionGroupDto) =>
      apiClient.post<Prescription>(`/v1/consultations/${consultationId}/prescriptions`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
      toast.success(toastStrings.prescriptionCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorPrescriptionSave)
    },
  })
}

export function useListPrescriptions(
  consultationId: string,
): UseQueryResult<Prescription[], Error> {
  return useQuery({
    queryKey: [QK, consultationId, 'prescriptions'],
    queryFn: () =>
      apiClient.get<Prescription[]>(`/v1/consultations/${consultationId}/prescriptions`),
    enabled: Boolean(consultationId),
  })
}

export function useCreateImagingOrder(
  consultationId: string,
): UseMutationResult<ImagingOrder[], Error, CreateImagingOrderGroupDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateImagingOrderGroupDto) =>
      apiClient.post<ImagingOrder[]>(`/v1/consultations/${consultationId}/imaging-orders`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
      toast.success(toastStrings.imagingOrderCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function useListImagingOrders(
  consultationId: string,
): UseQueryResult<ImagingOrder[], Error> {
  return useQuery({
    queryKey: [QK, consultationId, 'imaging-orders'],
    queryFn: () =>
      apiClient.get<ImagingOrder[]>(`/v1/consultations/${consultationId}/imaging-orders`),
    enabled: Boolean(consultationId),
  })
}

export function useCreateLabOrder(
  consultationId: string,
): UseMutationResult<LabOrder[], Error, CreateLabOrderGroupDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateLabOrderGroupDto) =>
      apiClient.post<LabOrder[]>(`/v1/consultations/${consultationId}/lab-orders`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId] })
      toast.success(toastStrings.labOrderCreated)
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function useListLabOrders(consultationId: string): UseQueryResult<LabOrder[], Error> {
  return useQuery({
    queryKey: [QK, consultationId, 'lab-orders'],
    queryFn: () => apiClient.get<LabOrder[]>(`/v1/consultations/${consultationId}/lab-orders`),
    enabled: Boolean(consultationId),
  })
}

export function useDeletePrescription(
  consultationId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prescriptionId: string) =>
      apiClient.delete(`/v1/consultations/${consultationId}/prescriptions/${prescriptionId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'prescriptions'] })
      toast.success(toastStrings.prescriptionDeleted)
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function useDeleteImagingOrder(
  consultationId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiClient.delete(`/v1/consultations/${consultationId}/imaging-orders/${orderId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'imaging-orders'] })
      toast.success(toastStrings.imagingOrderDeleted)
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function useDeleteLabOrder(consultationId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orderId: string) =>
      apiClient.delete(`/v1/consultations/${consultationId}/lab-orders/${orderId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'lab-orders'] })
      toast.success(toastStrings.labOrderDeleted)
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function usePatchImagingOrder(
  consultationId: string,
): UseMutationResult<ImagingOrder, Error, { orderId: string; dto: PatchImagingOrderDto }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, dto }) =>
      apiClient.patch<ImagingOrder>(
        `/v1/consultations/${consultationId}/imaging-orders/${orderId}`,
        dto,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'imaging-orders'] })
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function usePatchLabOrder(
  consultationId: string,
): UseMutationResult<LabOrder, Error, { orderId: string; dto: PatchLabOrderDto }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, dto }) =>
      apiClient.patch<LabOrder>(`/v1/consultations/${consultationId}/lab-orders/${orderId}`, dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'lab-orders'] })
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function useRenameImagingOrderGroup(
  consultationId: string,
): UseMutationResult<ImagingOrder[], Error, { groupOrder: number; dto: RenameOrderGroupDto }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupOrder, dto }) =>
      apiClient.patch<ImagingOrder[]>(
        `/v1/consultations/${consultationId}/imaging-orders/rename-group?groupOrder=${groupOrder}`,
        dto,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'imaging-orders'] })
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}

export function useRenameLabOrderGroup(
  consultationId: string,
): UseMutationResult<LabOrder[], Error, { groupOrder: number; dto: RenameOrderGroupDto }> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ groupOrder, dto }) =>
      apiClient.patch<LabOrder[]>(
        `/v1/consultations/${consultationId}/lab-orders/rename-group?groupOrder=${groupOrder}`,
        dto,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK, consultationId, 'lab-orders'] })
    },
    onError: () => {
      toast.error(toastStrings.errorOrderSave)
    },
  })
}
