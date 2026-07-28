import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { StaffInstitutionDto } from '@rezeta/shared'
import { apiClient } from '@/lib/api-client'

const QK = 'staff-institutions'

export function useStaffInstitutions(): UseQueryResult<StaffInstitutionDto[], Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<StaffInstitutionDto[]>('/v1/staff/institutions'),
  })
}

export const STAFF_INSTITUTIONS_QK = QK
