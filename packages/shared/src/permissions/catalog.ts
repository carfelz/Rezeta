import type { UserRole } from '../types/auth.js'

/** Ordered access levels. `none` (0) < `view` (1) < `manage` (2). */
export type AccessLevel = 'none' | 'view' | 'manage'

export const ACCESS_LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  manage: 2,
}

/** Sections group modules for the bulk-apply UI control; they are not stored. */
export type SectionKey = 'clinical' | 'admin'

/** Stable module keys guarded by the permission system, in display order. */
export type ModuleKey =
  | 'patients'
  | 'consultations'
  | 'protocols'
  | 'appointments'
  | 'orders'
  | 'billing'
  | 'locations'
  | 'templates'
  | 'categories'
  | 'schedules_config'
  | 'audit_log'
  | 'users'
  | 'permissions'

export interface PermissionModule {
  key: ModuleKey
  section: SectionKey
  defaults: Record<UserRole, AccessLevel>
}

/**
 * Code-defined source of structure: each module's section and its default access
 * level per role. Seeded into a tenant's `RolePermission` rows on creation, and
 * used as the fallback when a module has no stored row (see resolveCapabilities).
 * Default matrix per the shared contract / design spec §4.3.
 */
export const PERMISSION_CATALOG: Record<ModuleKey, PermissionModule> = {
  patients: {
    key: 'patients',
    section: 'clinical',
    defaults: { assistant: 'view', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  consultations: {
    key: 'consultations',
    section: 'clinical',
    defaults: { assistant: 'view', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  protocols: {
    key: 'protocols',
    section: 'clinical',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  appointments: {
    key: 'appointments',
    section: 'clinical',
    defaults: { assistant: 'manage', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  orders: {
    key: 'orders',
    section: 'clinical',
    defaults: { assistant: 'manage', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  billing: {
    key: 'billing',
    section: 'clinical',
    defaults: { assistant: 'manage', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  locations: {
    key: 'locations',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  templates: {
    key: 'templates',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  categories: {
    key: 'categories',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  schedules_config: {
    key: 'schedules_config',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  audit_log: {
    key: 'audit_log',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'manage', admin: 'manage', super_admin: 'manage' },
  },
  users: {
    key: 'users',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'none', admin: 'manage', super_admin: 'manage' },
  },
  permissions: {
    key: 'permissions',
    section: 'admin',
    defaults: { assistant: 'none', doctor: 'none', admin: 'manage', super_admin: 'manage' },
  },
}

/** All module keys in display order. */
export const MODULE_KEYS: ModuleKey[] = [
  'patients',
  'consultations',
  'protocols',
  'appointments',
  'orders',
  'billing',
  'locations',
  'templates',
  'categories',
  'schedules_config',
  'audit_log',
  'users',
  'permissions',
]
