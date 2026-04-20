import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

export function useAuth(): { user: AuthUser | null; isLoading: boolean; isAuthenticated: boolean } {
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  return { user, isLoading: status === 'loading', isAuthenticated: status === 'authenticated' }
}
