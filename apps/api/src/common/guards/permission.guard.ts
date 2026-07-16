import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ErrorCode, hasCapability } from '@rezeta/shared'
import type { AuthenticatedRequest } from './auth.guard.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../decorators/require-permission.decorator.js'

/**
 * PermissionGuard — runs third, after AuthGuard and TenantGuard.
 *
 * Reads the @RequirePermission metadata on the handler and checks it against the
 * capability map that AuthGuard (Slice 2) resolved onto request.user.capabilities.
 * Does no DB work. Skips public routes and un-annotated routes (platform/staff
 * routes carry no @RequirePermission metadata, so they fall under the un-annotated
 * skip; this guard has no platform-admin bypass branch).
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const handler = ctx.getHandler()
    const classRef = ctx.getClass()

    // Public routes are never permission-gated.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, classRef])
    if (isPublic) return true

    // No @RequirePermission on this endpoint — nothing to enforce.
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      PERMISSION_KEY,
      [handler, classRef],
    )
    if (!required) return true

    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>()

    if (hasCapability(request.user.capabilities, required.module, required.level)) {
      return true
    }

    throw new ForbiddenException({
      code: ErrorCode.INSUFFICIENT_PERMISSION,
      message: `Missing '${required.level}' permission on '${required.module}'`,
    })
  }
}
