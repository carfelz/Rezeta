import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { AuditLogItem, AuditLogListResponse } from '@rezeta/shared'

const QK = 'audit-logs'

export interface AuditLogParams {
  cursor?: string
  limit?: number
  dateFrom?: string
  dateTo?: string
  actorUserId?: string
  category?: string
  action?: string
  entityType?: string
  entityId?: string
  status?: string
}

function buildQs(params: AuditLogParams): string {
  const s = new URLSearchParams()
  if (params.cursor) s.set('cursor', params.cursor)
  if (params.limit) s.set('limit', String(params.limit))
  if (params.dateFrom) s.set('dateFrom', params.dateFrom)
  if (params.dateTo) s.set('dateTo', params.dateTo)
  if (params.actorUserId) s.set('actorUserId', params.actorUserId)
  if (params.category) s.set('category', params.category)
  if (params.action) s.set('action', params.action)
  if (params.entityType) s.set('entityType', params.entityType)
  if (params.entityId) s.set('entityId', params.entityId)
  if (params.status) s.set('status', params.status)
  return s.toString()
}

export function useAuditLogs(
  params: AuditLogParams = {},
): UseQueryResult<AuditLogListResponse, Error> {
  const qs = buildQs(params)
  return useQuery({
    queryKey: [QK, params],
    queryFn: () => apiClient.get<AuditLogListResponse>(`/v1/audit-logs${qs ? `?${qs}` : ''}`),
  })
}

export function useAuditLog(id: string): UseQueryResult<AuditLogItem, Error> {
  return useQuery({
    queryKey: [QK, id],
    queryFn: () => apiClient.get<AuditLogItem>(`/v1/audit-logs/${id}`),
    enabled: !!id,
  })
}

export async function downloadAuditLogCsv(
  params: Omit<AuditLogParams, 'cursor' | 'limit'>,
): Promise<Blob> {
  const s = new URLSearchParams()
  if (params.dateFrom) s.set('dateFrom', params.dateFrom)
  if (params.dateTo) s.set('dateTo', params.dateTo)
  if (params.actorUserId) s.set('actorUserId', params.actorUserId)
  if (params.category) s.set('category', params.category)
  if (params.action) s.set('action', params.action)
  if (params.entityType) s.set('entityType', params.entityType)
  if (params.entityId) s.set('entityId', params.entityId)
  if (params.status) s.set('status', params.status)
  const qs = s.toString()
  return apiClient.download(`/v1/audit-logs/export.csv${qs ? `?${qs}` : ''}`)
}
