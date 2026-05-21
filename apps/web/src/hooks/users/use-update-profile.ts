import { useMutation } from '@tanstack/react-query'
import type { UseMutationResult } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth.store'
import type { AuthUser, UpdateProfileDto } from '@rezeta/shared'

export function useUpdateProfile(): UseMutationResult<void, Error, UpdateProfileDto> {
  const setUser = useAuthStore((s) => s.setUser)

  return useMutation({
    mutationFn: async (dto: UpdateProfileDto) => {
      await apiClient.patch<void>('/v1/users/me/profile', dto)
    },
    onSuccess: async () => {
      const refreshed = await apiClient.get<AuthUser>('/v1/auth/me')
      setUser(refreshed)
      toast.success('Perfil actualizado')
    },
    onError: () => {
      toast.error('No se pudo actualizar el perfil. Intenta de nuevo.')
    },
  })
}
