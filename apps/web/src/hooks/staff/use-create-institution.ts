import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { STAFF_INSTITUTIONS_QK } from './use-institutions'

export function useCreateInstitution(): UseMutationResult<
  InstitutionCreatedDto,
  Error,
  CreateInstitutionDto
> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: CreateInstitutionDto) =>
      apiClient.post<InstitutionCreatedDto>('/v1/staff/institutions', dto),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [STAFF_INSTITUTIONS_QK] }),
  })
}
