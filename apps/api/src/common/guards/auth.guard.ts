import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { ErrorCode, UserPreferencesSchema } from '@rezeta/shared'
import type { AuthUser, UserPreferences } from '@rezeta/shared'
import { UsersRepository } from '../../modules/users/users.repository.js'
import { AUTH_PROVIDER, type IAuthProvider, type VerifiedToken } from '../../lib/auth/index.js'
import { AuditLogService } from '../audit-log/audit-log.service.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'
import { PermissionsService } from '../../modules/permissions/permissions.service.js'

export interface AuthenticatedRequest extends Request {
  user: AuthUser
  tenantId: string
  verifiedToken?: VerifiedToken // only populated on provision route
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name)

  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(AUTH_PROVIDER) private authProvider: IAuthProvider,
    @Inject(UsersRepository) private users: UsersRepository,
    @Inject(AuditLogService) private auditLog: AuditLogService,
    @Inject(PermissionsService) private permissions: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const handler = ctx.getHandler()
    const classRef = ctx.getClass()

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, classRef])
    if (isPublic) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    const token = this.extractToken(request)
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authorization header missing or malformed',
      })
    }

    let verified: VerifiedToken
    try {
      verified = await this.authProvider.verifyToken(token)
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`)
      void this.auditLog.record({
        actorType: 'user',
        category: 'auth',
        action: 'login_failed',
        ...(request.ip ? { ipAddress: request.ip } : {}),
        ...(typeof request.headers['user-agent'] === 'string'
          ? { userAgent: request.headers['user-agent'] }
          : {}),
        status: 'failed',
        errorCode: ErrorCode.TOKEN_INVALID,
      })
      throw err
    }

    const isProvisionRoute = this.reflector.getAllAndOverride<boolean>(IS_PROVISION_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isProvisionRoute) {
      request.verifiedToken = verified
      return true
    }

    const user = await this.users.findByExternalUid(verified.externalUid)

    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.USER_NOT_PROVISIONED,
        message: 'User has not been provisioned. Call POST /v1/auth/provision first.',
      })
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'User account is deactivated',
      })
    }

    if (user.lastLoginAt === null) {
      void this.users.markSignedIn(user.id)
    }

    const role = user.role as AuthUser['role']
    const capabilities = await this.permissions.resolveCapabilities(user.tenantId, role)

    request.user = {
      id: user.id,
      externalUid: user.externalUid,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role,
      specialty: user.specialty,
      licenseNumber: user.licenseNumber,
      tenantSeededAt: user.tenant.seededAt?.toISOString() ?? null,
      tenantPlan: user.tenant.plan,
      preferences: parseUserPreferences(user.preferences),
      capabilities,
    }

    return true
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization
    if (!authHeader) return null
    const [type, token] = authHeader.split(' ')
    return type === 'Bearer' && token ? token : null
  }
}

function parseUserPreferences(raw: unknown): UserPreferences {
  const parsed = UserPreferencesSchema.safeParse(raw ?? {})
  return parsed.success ? parsed.data : {}
}
