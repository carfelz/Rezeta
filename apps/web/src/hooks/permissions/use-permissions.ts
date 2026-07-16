import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { toastStrings } from '@/lib/toasts'
import type {
  CapabilityMap,
  PermissionMatrixResponse,
  UpdatePermissionDto,
} from '@rezeta/shared'

const QK = 'permissions'

export function usePermissionMatrix(): UseQueryResult<PermissionMatrixResponse, Error> {
  return useQuery({
    queryKey: [QK],
    queryFn: () => apiClient.get<PermissionMatrixResponse>('/v1/permissions'),
  })
}

export function useUpdatePermission(): UseMutationResult<CapabilityMap, Error, UpdatePermissionDto> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (dto: UpdatePermissionDto) =>
      apiClient.patch<CapabilityMap>('/v1/permissions', dto),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QK] })
    },
    onError: () => {
      toast.error(toastStrings.errorPermissionUpdate)
    },
  })
}
