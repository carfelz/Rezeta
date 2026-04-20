import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CreateProtocolDto } from '@rezeta/shared'

export function useProtocols() {
  const queryClient = useQueryClient()

  const useGetProtocols = () => {
    return useQuery({
      queryKey: ['protocols'],
      queryFn: () => apiClient.get<any[]>('/v1/protocols'),
    })
  }

  const useCreateProtocol = () => {
    return useMutation({
      mutationFn: (dto: CreateProtocolDto) =>
        apiClient.post<any>('/v1/protocols', dto),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['protocols'] })
      },
    })
  }

  return {
    useGetProtocols,
    useCreateProtocol,
  }
}
