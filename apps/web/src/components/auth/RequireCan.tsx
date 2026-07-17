import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasAnyCapabilityInSection, hasCapability } from '@rezeta/shared'
import type { AccessLevel, ModuleKey, SectionKey } from '@rezeta/shared'
import { useAuthStore } from '@/store/auth.store'

interface RequireCanBaseProps {
  level?: AccessLevel
  children: ReactNode
}

/** Leaf-route gate: requires `level` on a single `module`. */
interface RequireCanModuleProps extends RequireCanBaseProps {
  module: ModuleKey
  anyOfSection?: never
}

/**
 * Hub/entry-point gate: requires `level` on ANY module in `anyOfSection`. Use
 * this for settings-hub entry points (nav item, avatar-dropdown link, the
 * `/ajustes` shell route) that represent a whole section rather than one leaf
 * module — so revoking one representative module (e.g. `templates`) no longer
 * hides the hub for a user who still has another admin-section capability
 * (e.g. `users: manage`). Leaf routes under the hub keep gating on `module`.
 */
interface RequireCanSectionProps extends RequireCanBaseProps {
  module?: never
  anyOfSection: SectionKey
}

type RequireCanProps = RequireCanModuleProps | RequireCanSectionProps

/**
 * Route guard: renders children when the user has at least `level` (default
 * 'view') on `module` (single-module leaf gate) or on ANY module within
 * `anyOfSection` (hub/entry-point gate) — otherwise redirects to the
 * dashboard. AuthGate handles the unauthenticated case earlier; this guard
 * only refines access per module/section.
 */
export function RequireCan({
  module,
  anyOfSection,
  level = 'view',
  children,
}: RequireCanProps): JSX.Element {
  const capabilities = useAuthStore((s) => s.user?.capabilities)
  const allowed = capabilities
    ? module
      ? hasCapability(capabilities, module, level)
      : hasAnyCapabilityInSection(capabilities, anyOfSection, level)
    : false
  if (!allowed) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}
