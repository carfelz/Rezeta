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
import type { DecodedIdToken } from 'firebase-admin/auth'
import { ErrorCode } from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { FirebaseService } from '../../lib/firebase.service.js'
import { PrismaService } from '../../lib/prisma.service.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import { IS_PROVISION_ROUTE_KEY } from '../decorators/provision-route.decorator.js'

export interface AuthenticatedRequest extends Request {
  user: AuthUser
  tenantId: string
  firebaseToken?: DecodedIdToken // only populated on provision route
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name)

  constructor(
    @Inject(Reflector) private reflector: Reflector,
    @Inject(FirebaseService) private firebase: FirebaseService,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const handler = ctx.getHandler()
    const classRef = ctx.getClass()

    // 1. @Public() — skip all auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, classRef])
    if (isPublic) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    // 3. Extract Bearer token
    const token = this.extractToken(request)
    if (!token) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authorization header missing or malformed',
      })
    }

    // 4. Verify Firebase ID token
    let decoded: DecodedIdToken
    try {
      decoded = await this.firebase.verifyIdToken(token)
    } catch (err) {
      this.logger.debug(`Token verification failed: ${(err as Error).message}`)
      throw new UnauthorizedException({
        code: ErrorCode.TOKEN_INVALID,
        message: 'Firebase ID token is invalid or expired',
      })
    }

    // 5. @ProvisionRoute() — token verified, skip DB user lookup
    const isProvisionRoute = this.reflector.getAllAndOverride<boolean>(IS_PROVISION_ROUTE_KEY, [
      handler,
      classRef,
    ])
    if (isProvisionRoute) {
      request.firebaseToken = decoded
      return true
    }

    // 6. Normal route — require a DB User row (with tenant for seededAt)
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: decoded.uid, deletedAt: null },
      include: { tenant: { select: { seededAt: true } } },
    })

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

    request.user = {
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

    return true
  }

  private extractToken(request: Request): string | null {
    const authHeader = request.headers.authorization
    if (!authHeader) return null
    const [type, token] = authHeader.split(' ')
    return type === 'Bearer' && token ? token : null
  }
}
