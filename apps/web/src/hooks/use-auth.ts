import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

export function useAuth(): { user: AuthUser | null; isLoading: boolean; isAuthenticated: boolean } {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  return { user, isLoading, isAuthenticated: user !== null }
}
