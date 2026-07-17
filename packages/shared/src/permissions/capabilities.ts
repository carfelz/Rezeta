import type { UserRole } from '../types/auth.js'
import {
  ACCESS_LEVEL_RANK,
  MODULE_KEYS,
  PERMISSION_CATALOG,
  type AccessLevel,
  type ModuleKey,
  type SectionKey,
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

/**
 * True when the capability map grants at least `required` on ANY module whose
 * catalog `section` matches — used by hub/entry-point gates (e.g. the Ajustes
 * nav item) that represent a whole settings section rather than one leaf
 * module. A module absent from the map is treated as `none`, per hasCapability.
 */
export function hasAnyCapabilityInSection(
  caps: CapabilityMap,
  section: SectionKey,
  required: AccessLevel = 'view',
): boolean {
  return MODULE_KEYS.some(
    (module) => PERMISSION_CATALOG[module].section === section && hasCapability(caps, module, required),
  )
}

/** Build the full capability map for a role straight from the catalog defaults. */
export function defaultCapabilitiesFor(role: UserRole): CapabilityMap {
  const caps = {} as CapabilityMap
  for (const key of MODULE_KEYS) {
    caps[key] = PERMISSION_CATALOG[key].defaults[role]
  }
  return caps
}
