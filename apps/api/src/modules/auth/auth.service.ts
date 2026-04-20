import { Injectable, Inject } from '@nestjs/common'
import type { User } from '@rezeta/db'
import type { AuthUser } from '@rezeta/shared'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { AuthRepository } from './auth.repository.js'

@Injectable()
export class AuthService {
  constructor(@Inject(AuthRepository) private repository: AuthRepository) {}

  /**
   * Idempotent provision: called by POST /v1/auth/provision.
   * Returns the User row (existing or newly created).
   */
  async provision(decoded: DecodedIdToken): Promise<User> {
    return this.repository.provisionUser(decoded)
  }

  /**
   * Map a DB User to the AuthUser DTO returned by GET /v1/me.
   */
  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      firebaseUid: user.firebaseUid,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role as AuthUser['role'],
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
    }
  }
}
