import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { ErrorCode } from '@rezeta/shared'
import type { AuthUser } from '@rezeta/shared'
import { FirebaseService } from '../../lib/firebase.service.js'
import { PrismaService } from '../../lib/prisma.service.js'

interface AuthenticatedRequest extends Request {
  user: AuthUser
  tenantId: string
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private firebase: FirebaseService,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = this.extractToken(request)

    if (!token) {
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED, message: 'Missing token' })
    }

    let decodedToken: Awaited<ReturnType<FirebaseService['verifyIdToken']>>
    try {
      decodedToken = await this.firebase.verifyIdToken(token)
    } catch {
      throw new UnauthorizedException({ code: ErrorCode.TOKEN_INVALID, message: 'Invalid token' })
    }

    const user = await this.prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid, deletedAt: null },
    })

    if (!user) {
      throw new UnauthorizedException({ code: ErrorCode.USER_NOT_FOUND, message: 'User not found' })
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
    }
    request.tenantId = user.tenantId

    return true
  }

  private extractToken(request: Request): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    return type === 'Bearer' && token ? token : null
  }
}
