import { useAuthStore } from '@/store/auth.store'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  return { user, isLoading, isAuthenticated: user !== null }
}
