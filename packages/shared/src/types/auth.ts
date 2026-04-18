export type UserRole = 'owner' | 'doctor'

export interface AuthUser {
  id: string
  firebaseUid: string
  tenantId: string
  email: string
  fullName: string
  role: UserRole
  specialty: string | null
  licenseNumber: string | null
}

export interface RequestContext {
  user: AuthUser
  tenantId: string
}
