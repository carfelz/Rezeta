import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'

export function useCreateInstitution(): UseMutationResult<
  InstitutionCreatedDto,
  Error,
  CreateInstitutionDto
> {
  return useMutation({
    mutationFn: (dto: CreateInstitutionDto) =>
      apiClient.post<InstitutionCreatedDto>('/v1/staff/institutions', dto),
  })
}
