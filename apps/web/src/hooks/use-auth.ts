import { useAuthStore } from '@/store/auth.store'
import type { AuthUser } from '@rezeta/shared'

export function useAuth(): { user: AuthUser | null; isLoading: boolean; isAuthenticated: boolean } {
  const user = useAuthStore((s) => s.user)
  const identity = useAuthStore((s) => s.identity)
  return {
    user,
    isLoading: identity.kind === 'loading',
    isAuthenticated: identity.kind === 'clinic',
  }
}
