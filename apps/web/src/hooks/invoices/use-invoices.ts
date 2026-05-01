import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  InvoiceWithDetails,
  CreateInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceStatusDto,
} from '@rezeta/shared'

const QK = 'invoices'

export interface InvoiceListParams {
  status?: string
  patientId?: string
  locationId?: string
  cursor?: string
  limit?: number
}

export interface InvoiceListResponse {
  items: InvoiceWithDetails[]
  hasMore: boolean
  nextCursor?: string
}

export function useInvoices(
  params?: InvoiceListParams,
): UseQueryResult<InvoiceListResponse, Error> {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.patientId) search.set('patientId', params.patientId)
  if (params?.locationId) search.set('locationId', params.locationId)
  if (params?.cursor) search.set('cursor', params.cursor)
  if (params?.limit) search.set('limit', String(params.limit))
  const qs = search.toString()

  return useQuery({
    queryKey: [QK, params],
    queryFn: () => apiClient.get<InvoiceListResponse>(`/v1/invoices${qs ? `?${qs}` : ''}`),
  })
}

export function useInvoice(id: string): UseQueryResult<InvoiceWithDetails, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<InvoiceWithDetails>(`/v1/invoices/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateInvoice(): UseMutationResult<InvoiceWithDetails, Error, CreateInvoiceDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateInvoiceDto) => apiClient.post<InvoiceWithDetails>('/v1/invoices', dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useUpdateInvoice(
  id: string,
): UseMutationResult<InvoiceWithDetails, Error, UpdateInvoiceDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateInvoiceDto) =>
      apiClient.patch<InvoiceWithDetails>(`/v1/invoices/${id}`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useUpdateInvoiceStatus(
  id: string,
): UseMutationResult<InvoiceWithDetails, Error, UpdateInvoiceStatusDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdateInvoiceStatusDto) =>
      apiClient.patch<InvoiceWithDetails>(`/v1/invoices/${id}/status`, dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}

export function useDeleteInvoice(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/v1/invoices/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [QK] }),
  })
}
