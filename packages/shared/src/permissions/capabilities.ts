import type { UserRole } from '../types/auth.js'
import {
  ACCESS_LEVEL_RANK,
  MODULE_KEYS,
  PERMISSION_CATALOG,
  type AccessLevel,
  type ModuleKey,
} from './catalog.js'

/** A user's effective access level per module. */
export type CapabilityMap = Record<ModuleKey, AccessLevel>

/**
 * True when the capability map grants at least `required` on `module`. A module
 * absent from the map is treated as `none`.
 */
export function hasCapability(
  caps: CapabilityMap,
  module: ModuleKey,
  required: AccessLevel,
): boolean {
  return ACCESS_LEVEL_RANK[caps[module] ?? 'none'] >= ACCESS_LEVEL_RANK[required]
}

/** Build the full capability map for a role straight from the catalog defaults. */
export function defaultCapabilitiesFor(role: UserRole): CapabilityMap {
  const caps = {} as CapabilityMap
  for (const key of MODULE_KEYS) {
    caps[key] = PERMISSION_CATALOG[key].defaults[role]
  }
  return caps
}
