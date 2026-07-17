import { Injectable, Inject, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { AuthUser, CapabilityMap, UserPreferences } from '@rezeta/shared'
import { UserPreferencesSchema, ErrorCode } from '@rezeta/shared'
import type { AppConfig } from '../../config/configuration.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { AUTH_PROVIDER, type IAuthProvider, type VerifiedToken } from '../../lib/auth/index.js'
import { UsersRepository, type UserWithTenant } from '../users/users.repository.js'
import { PermissionsService } from '../permissions/permissions.service.js'

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
    @Inject(UsersRepository) private repository: UsersRepository,
    @Inject(ConfigService) private config: ConfigService<AppConfig, true>,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(PermissionsService) private permissions: PermissionsService,
  ) {}

  /**
   * Idempotent provision: called by POST /v1/auth/provision.
   * Resolves the pre-created User row (with tenant data) for a verified token.
   * Never creates a tenant or user — users are created internally by an
   * admin/staff (see UsersService.createUser); an unknown identity is rejected
   * with USER_NOT_PROVISIONED.
   */
  async provision(verified: VerifiedToken, meta?: ProvisionMeta): Promise<UserWithTenant> {
    const user = await this.repository.provisionUser(verified)
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
   * Dev-only: exchange email + password for a bearer token via the auth provider.
   * Blocked in production.
   */
  async devGetToken(email: string, password: string): Promise<DevTokenResponse> {
    if (this.config.get('nodeEnv', { infer: true }) === 'production') {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Not available in production',
      })
    }
    const signed = await this.authProvider.signInWithPassword(email, password)
    return {
      access_token: signed.accessToken,
      token_type: 'bearer',
      expires_in: signed.expiresIn,
    }
  }

  /**
   * Map a DB User (with tenant) to the AuthUser DTO. `capabilities` must be the
   * already-resolved map (see `resolveAuthUser`) — this method never computes
   * catalog defaults itself, so callers cannot accidentally bypass a tenant's
   * stored `RolePermission` overrides.
   */
  toAuthUser(user: UserWithTenant, capabilities: CapabilityMap): AuthUser {
    return {
      id: user.id,
      externalUid: user.externalUid,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role as AuthUser['role'],
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
      tenantSeededAt: user.tenant.seededAt?.toISOString() ?? null,
      tenantPlan: user.tenant.plan,
      preferences: parsePreferences(user.preferences),
      capabilities,
    }
  }

  /**
   * Resolve a DB User's effective capability map (catalog defaults overlaid
   * with any stored `RolePermission` rows for the tenant) and map it to the
   * AuthUser DTO. Used by both the provision path (AuthController.provision)
   * and onboarding (OnboardingService.seedDefault/seedCustom) so every
   * AuthUser the API hands back reflects the tenant's actual Permissions
   * matrix, not the code catalog defaults.
   */
  async resolveAuthUser(user: UserWithTenant): Promise<AuthUser> {
    const capabilities = await this.permissions.resolveCapabilities(
      user.tenantId,
      user.role as AuthUser['role'],
    )
    return this.toAuthUser(user, capabilities)
  }
}

function parsePreferences(raw: unknown): UserPreferences {
  const parsed = UserPreferencesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}
