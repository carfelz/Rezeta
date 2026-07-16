import { hasCapability } from '@rezeta/shared'
import type { AccessLevel, ModuleKey } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'

/**
 * Returns whether the current user has at least `level` access on `module`.
 * False when unauthenticated (no capability map on the store).
 */
export function useCan(module: ModuleKey, level: AccessLevel = 'view'): boolean {
  const capabilities = useAuthStore((s) => s.user?.capabilities)
  if (!capabilities) return false
  return hasCapability(capabilities, module, level)
}
