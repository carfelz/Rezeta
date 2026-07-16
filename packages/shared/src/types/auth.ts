import type { UserPreferences } from '../schemas/user-preferences.js'
import type { CapabilityMap } from '../permissions/capabilities.js'

export type UserRole = 'assistant' | 'doctor' | 'admin' | 'super_admin'

export interface AuthUser {
  id: string
  externalUid: string
  tenantId: string
  email: string
  fullName: string | null // nullable until onboarding is complete
  role: UserRole
  specialty: string | null
  licenseNumber: string | null
  tenantSeededAt: string | null // ISO string; null means onboarding not yet complete
  tenantPlan?: string
  preferences: UserPreferences
  capabilities: CapabilityMap
}

export interface Tenant {
  id: string
  name: string | null // nullable until onboarding is complete
  type: string
  plan: string
  country: string
  language: string
  timezone: string
  createdAt: string
}

export interface RequestContext {
  user: AuthUser
  tenantId: string
}
