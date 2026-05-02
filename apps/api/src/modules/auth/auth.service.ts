import { Injectable, Inject, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthUser } from '@rezeta/shared'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { AppConfig } from '../../config/configuration.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AuthRepository, type UserWithTenant } from './auth.repository.js'

export interface ProvisionMeta {
  ip?: string
  userAgent?: string
  requestId?: string
}

export interface DevTokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthRepository) private repository: AuthRepository,
    @Inject(ConfigService) private config: ConfigService<AppConfig, true>,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  /**
   * Idempotent provision: called by POST /v1/auth/provision.
   * Returns the User row (existing or newly created) with tenant data.
   */
  async provision(decoded: DecodedIdToken, meta?: ProvisionMeta): Promise<UserWithTenant> {
    const user = await this.repository.provisionUser(decoded)
    void this.auditLog.record({
      tenantId: user.tenantId,
      actorUserId: user.id,
      actorType: 'user',
      category: 'auth',
      action: 'login',
      ...(meta?.ip ? { ipAddress: meta.ip } : {}),
      ...(meta?.userAgent ? { userAgent: meta.userAgent } : {}),
      ...(meta?.requestId ? { requestId: meta.requestId } : {}),
      status: 'success',
    })
    return user
  }

  /**
   * Dev-only: exchange email + password for a Firebase ID token.
   * Calls Firebase REST Identity Toolkit (or emulator). Blocked in production.
   */
  async devGetToken(email: string, password: string): Promise<DevTokenResponse> {
    if (this.config.get('nodeEnv', { infer: true }) === 'production') {
      throw new ForbiddenException('Not available in production')
    }

    const webApiKey = this.config.get('firebase', { infer: true }).webApiKey

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    )

    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } }
      throw new UnauthorizedException(body.error?.message ?? 'Invalid credentials')
    }

    const data = (await res.json()) as { idToken: string; expiresIn: string }
    return {
      access_token: data.idToken,
      token_type: 'bearer',
      expires_in: parseInt(data.expiresIn, 10),
    }
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
      tenantPlan: user.tenant.plan,
    }
  }
}
