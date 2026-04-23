import { Injectable, Inject } from '@nestjs/common'
import type { AuthUser } from '@rezeta/shared'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { AuthRepository, type UserWithTenant } from './auth.repository.js'

@Injectable()
export class AuthService {
  constructor(@Inject(AuthRepository) private repository: AuthRepository) {}

  /**
   * Idempotent provision: called by POST /v1/auth/provision.
   * Returns the User row (existing or newly created) with tenant data.
   */
  async provision(decoded: DecodedIdToken): Promise<UserWithTenant> {
    return this.repository.provisionUser(decoded)
  }

  /**
   * Map a DB User (with tenant) to the AuthUser DTO.
   */
  toAuthUser(user: UserWithTenant): AuthUser {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role as AuthUser['role'],
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
      tenantSeededAt: user.tenant.seededAt?.toISOString() ?? null,
    }
  }
}
