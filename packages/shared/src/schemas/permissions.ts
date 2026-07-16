import { z } from 'zod'
import { MODULE_KEYS } from '../permissions/catalog.js'
import type { ModuleKey, SectionKey, AccessLevel } from '../permissions/catalog.js'
import type { CapabilityMap } from '../permissions/capabilities.js'
import type { UserRole } from '../types/auth.js'

const ROLE_VALUES = ['assistant', 'doctor', 'admin', 'super_admin'] as const
const ACCESS_LEVEL_VALUES = ['none', 'view', 'manage'] as const

export const UpdatePermissionSchema = z.object({
  role: z.enum(ROLE_VALUES),
  // MODULE_KEYS is a ModuleKey[] (not a literal tuple), so refine instead of z.enum.
  moduleKey: z
    .string()
    .refine((k): k is ModuleKey => (MODULE_KEYS as readonly string[]).includes(k), {
      message: 'Unknown module key',
    }),
  accessLevel: z.enum(ACCESS_LEVEL_VALUES),
})

export type UpdatePermissionDto = z.infer<typeof UpdatePermissionSchema>

export interface PermissionCatalogEntry {
  key: ModuleKey
  section: SectionKey
  defaults: Record<UserRole, AccessLevel>
}

export interface PermissionMatrixResponse {
  matrix: Record<UserRole, CapabilityMap>
  modules: PermissionCatalogEntry[]
}
