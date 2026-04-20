export type UserRole = 'owner' | 'doctor'

export interface AuthUser {
  id: string
  firebaseUid: string
  tenantId: string
  email: string
  fullName: string | null  // nullable until onboarding is complete
  role: UserRole
  specialty: string | null
  licenseNumber: string | null
}

export interface Tenant {
  id: string
  name: string | null       // nullable until onboarding is complete
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
