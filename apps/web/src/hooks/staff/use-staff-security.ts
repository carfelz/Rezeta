import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { StaffSecurityOverviewDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'staff-security-overview'

export function useStaffSecurityOverview(): UseQueryResult<StaffSecurityOverviewDto, Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<StaffSecurityOverviewDto>('/v1/staff/identity/security/overview'),
  })
}
