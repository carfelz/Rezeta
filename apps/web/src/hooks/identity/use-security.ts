import { useQuery } from '@tanstack/react-query'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LoginEventItemDto, SecuritySummaryDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const SUMMARY_QK = 'identity-security-summary'
const LOGINS_QK = 'identity-security-logins'

export function useSecuritySummary(days: number): UseQueryResult<SecuritySummaryDto, Error> {
  return useQuery({
    queryKey: [SUMMARY_QK, days],
    queryFn: () => apiClient.get<SecuritySummaryDto>(`/v1/identity/security/summary?days=${days}`),
  })
}

export interface SecurityLoginsParams {
  days: number
  userId?: string
  limit?: number
}

function buildQs(params: SecurityLoginsParams): string {
  const s = new URLSearchParams()
  s.set('days', String(params.days))
  if (params.userId) s.set('userId', params.userId)
  if (params.limit) s.set('limit', String(params.limit))
  return s.toString()
}

export function useSecurityLogins(
  params: SecurityLoginsParams,
): UseQueryResult<LoginEventItemDto[], Error> {
  return useQuery({
    queryKey: [LOGINS_QK, params],
    queryFn: () => apiClient.get<LoginEventItemDto[]>(`/v1/identity/security/logins?${buildQs(params)}`),
  })
}

export async function downloadSecurityLoginsCsv(
  params: Omit<SecurityLoginsParams, 'limit'>,
): Promise<Blob> {
  const s = new URLSearchParams()
  s.set('days', String(params.days))
  if (params.userId) s.set('userId', params.userId)
  return apiClient.download(`/v1/identity/security/logins.csv?${s.toString()}`)
}
